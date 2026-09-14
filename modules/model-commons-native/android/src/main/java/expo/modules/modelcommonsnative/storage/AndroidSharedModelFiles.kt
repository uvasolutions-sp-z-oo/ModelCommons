package expo.modules.modelcommonsnative.storage

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.DocumentsContract
import android.system.Os
import android.system.OsConstants
import expo.modules.modelcommonsnative.security.CallerAuthorizer
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.FileNotFoundException
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.security.MessageDigest
import java.util.UUID

/** Consumer-side persisted SAF grants and read-only descriptor leases. */
class AndroidSharedModelFiles(private val context: Context) {
  private data class Connection(
    val id: String,
    val treeUri: String,
    val authority: String,
    val providerPackage: String,
    val signerSha256: List<String>,
  )

  private data class Lease(
    val id: String,
    val connectionId: String,
    val descriptor: ParcelFileDescriptor,
    var runtimeDescriptorIssued: Boolean = false,
    var bridgeDescriptor: ParcelFileDescriptor? = null,
  )

  private val lock = Any()
  private val leases = linkedMapOf<String, Lease>()
  private val recordsFile = File(context.noBackupFilesDir, CONNECTIONS_FILE)

  fun connect(treeUri: Uri, resultFlags: Int): Map<String, Any> = synchronized(lock) {
    require(treeUri.scheme == "content" && DocumentsContract.isTreeUri(treeUri)) {
      "PERMISSION_REQUIRED: Select the ModelCommons shared-model root."
    }
    require(resultFlags and Intent.FLAG_GRANT_READ_URI_PERMISSION != 0
      && resultFlags and Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION != 0) {
      "PERMISSION_REQUIRED: The provider did not return a persistent read grant."
    }
    val authority = treeUri.authority.orEmpty()
    require(AUTHORITY.matches(authority) && authority.endsWith(AUTHORITY_SUFFIX)) {
      "PERMISSION_REQUIRED: The selected provider is not a ModelCommons shared store."
    }
    require(DocumentsContract.getTreeDocumentId(treeUri) == AndroidSharedStoreIndex.ROOT_DOCUMENT_ID) {
      "PERMISSION_REQUIRED: Select the top-level ModelCommons shared-model root."
    }
    val provider = context.packageManager.resolveContentProvider(authority, 0)
      ?: throw IllegalStateException("HUB_NOT_FOUND: The selected ModelCommons provider is unavailable.")
    require(provider.exported && provider.permission == "android.permission.MANAGE_DOCUMENTS") {
      "PERMISSION_REQUIRED: The selected provider does not implement the restricted ModelCommons contract."
    }
    val signers = CallerAuthorizer(context).signingFingerprints(provider.packageName)
    require(signers.isNotEmpty() && signers.size <= 8) {
      "PERMISSION_REQUIRED: The selected provider signing identity is unavailable."
    }
    val uriText = treeUri.toString()
    val existing = readConnections().firstOrNull { it.treeUri == uriText }
    val hadGrant = hasReadGrant(treeUri)
    try {
      context.contentResolver.takePersistableUriPermission(treeUri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
      validateConnection(treeUri)
      if (existing != null) {
        require(existing.providerPackage == provider.packageName
          && existing.authority == authority
          && existing.signerSha256.toSet().intersect(signers.toSet()).isNotEmpty()) {
          "PERMISSION_REQUIRED: The selected provider identity changed; disconnect and authorize it again."
        }
        return@synchronized existing.dictionary()
      }
      val connection = Connection(UUID.randomUUID().toString(), uriText, authority, provider.packageName, signers.sorted())
      val records = readConnections().toMutableList()
      require(records.size < MAX_CONNECTIONS) { "STORAGE_UNAVAILABLE: Shared connection capacity reached." }
      records += connection
      persist(records)
      connection.dictionary()
    } catch (error: Exception) {
      if (!hadGrant && readConnections().none { it.treeUri == uriText }) {
        runCatching { context.contentResolver.releasePersistableUriPermission(treeUri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
      }
      throw error
    }
  }

  fun listConnections(): List<Map<String, Any>> = synchronized(lock) {
    val records = readConnections()
    // A temporarily unavailable or updated provider must remain diagnosable.
    // Reconcile only grants the OS has actually removed.
    val granted = records.filter { connection -> runCatching {
      val uri = Uri.parse(connection.treeUri)
      uri.scheme == "content" && uri.authority == connection.authority
        && DocumentsContract.isTreeUri(uri) && hasReadGrant(uri)
    }.getOrDefault(false) }
    if (granted.size != records.size) persist(granted)
    granted.map(Connection::dictionary)
  }

  fun disconnect(connectionId: String) = synchronized(lock) {
    val records = readConnections()
    val connection = records.firstOrNull { it.id == connectionId }
      ?: throw IllegalArgumentException("PERMISSION_REQUIRED: Shared model connection is unknown.")
    require(leases.values.none { it.connectionId == connectionId }) {
      "RUNTIME_UNAVAILABLE: Release model leases before disconnecting shared storage."
    }
    val remaining = records.filterNot { it.id == connectionId }
    if (remaining.none { it.treeUri == connection.treeUri }) {
      val uri = Uri.parse(connection.treeUri)
      if (hasReadGrant(uri)) {
        context.contentResolver.releasePersistableUriPermission(
          uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
    }
    persist(remaining)
  }

  fun acquire(connectionId: String, relativePath: String): Map<String, Any> = synchronized(lock) {
    require(safeRelativePath(relativePath)) { "INTEGRITY_FAILED: Unsafe shared model path." }
    require(leases.size < MAX_LEASES) { "RUNTIME_UNAVAILABLE: Shared model lease capacity reached." }
    val connection = readConnections().firstOrNull { it.id == connectionId }
      ?: throw IllegalArgumentException("PERMISSION_REQUIRED: Shared model connection is unknown.")
    val treeUri = requireValidConnection(connection)
    val documentUri = resolveRelativeDocument(treeUri, relativePath)
    val descriptor = context.contentResolver.openFileDescriptor(documentUri, "r")
      ?: throw FileNotFoundException("MODEL_NOT_READY: Shared model file is unavailable.")
    try {
      validateDescriptor(descriptor)
      val id = UUID.randomUUID().toString()
      leases[id] = Lease(id, connectionId, descriptor)
      mapOf(
        "id" to id,
        "connectionId" to connectionId,
        "uri" to NATIVE_DESCRIPTOR_URI,
        "resourceKind" to "android-file-descriptor",
        "coordinationVersion" to 2,
      )
    } catch (error: Exception) {
      descriptor.close()
      throw error
    }
  }

  fun release(leaseId: String) = synchronized(lock) {
    val lease = leases.remove(leaseId) ?: return@synchronized
    lease.bridgeDescriptor?.close()
    lease.descriptor.close()
  }

  fun stat(leaseId: String): Map<String, Any> = synchronized(lock) {
    val lease = requireLease(leaseId)
    val stat = Os.fstat(lease.descriptor.fileDescriptor)
    mapOf("size" to stat.st_size.toDouble(), "regular" to OsConstants.S_ISREG(stat.st_mode))
  }

  fun sha256(leaseId: String): String = synchronized(lock) {
    val lease = requireLease(leaseId)
    val stat = Os.fstat(lease.descriptor.fileDescriptor)
    require(OsConstants.S_ISREG(stat.st_mode) && stat.st_size > 0) {
      "INTEGRITY_FAILED: Shared artifact is not a regular file."
    }
    val digest = MessageDigest.getInstance("SHA-256")
    val buffer = ByteArray(1024 * 1024)
    var offset = 0L
    while (offset < stat.st_size) {
      val wanted = minOf(buffer.size.toLong(), stat.st_size - offset).toInt()
      val count = Os.pread(lease.descriptor.fileDescriptor, buffer, 0, wanted, offset)
      require(count > 0) { "INTEGRITY_FAILED: Shared artifact ended before its reported size." }
      digest.update(buffer, 0, count)
      offset += count
    }
    digest.digest().joinToString("") { "%02x".format(it) }
  }

  fun readMetadata(leaseId: String): String = synchronized(lock) {
    val lease = requireLease(leaseId)
    val stat = Os.fstat(lease.descriptor.fileDescriptor)
    require(OsConstants.S_ISREG(stat.st_mode) && stat.st_size in 1L..METADATA_LIMIT) {
      "INTEGRITY_FAILED: Shared metadata is invalid or too large."
    }
    val bytes = ByteArray(stat.st_size.toInt())
    var offset = 0
    while (offset < bytes.size) {
      val count = Os.pread(lease.descriptor.fileDescriptor, bytes, offset, bytes.size - offset, offset.toLong())
      require(count > 0) { "INTEGRITY_FAILED: Shared metadata ended unexpectedly." }
      offset += count
    }
    Charsets.UTF_8.newDecoder()
      .onMalformedInput(CodingErrorAction.REPORT)
      .onUnmappableCharacter(CodingErrorAction.REPORT)
      .decode(ByteBuffer.wrap(bytes)).toString()
  }

  /** Returns a native-owned borrowed descriptor. The patched runtime duplicates it immediately. */
  fun prepareRuntimeDescriptor(leaseId: String): Map<String, Any> = synchronized(lock) {
    val lease = requireLease(leaseId)
    require(!lease.runtimeDescriptorIssued) {
      "RUNTIME_UNAVAILABLE: This model lease already initialized a native runtime."
    }
    validateDescriptor(lease.descriptor)
    val duplicate = ParcelFileDescriptor.dup(lease.descriptor.fileDescriptor)
    try {
      Os.lseek(duplicate.fileDescriptor, 0, OsConstants.SEEK_SET)
      val identity = Os.fstat(duplicate.fileDescriptor)
      require(OsConstants.S_ISREG(identity.st_mode) && identity.st_dev >= 0L
        && identity.st_ino >= 0L && identity.st_size > 0L) {
        "INTEGRITY_FAILED: Shared artifact identity is invalid."
      }
      val raw = duplicate.fd
      lease.bridgeDescriptor = duplicate
      lease.runtimeDescriptorIssued = true
      mapOf(
        "kind" to "android-file-descriptor",
        "descriptor" to raw,
        "descriptorVersion" to 2,
        // Decimal strings preserve the native 64-bit identity through Hermes.
        "device" to identity.st_dev.toString(),
        "inode" to identity.st_ino.toString(),
        "size" to identity.st_size.toString(),
      )
    } catch (error: Exception) {
      duplicate.close()
      throw error
    }
  }

  fun closeAll() = synchronized(lock) {
    leases.values.forEach {
      runCatching { it.bridgeDescriptor?.close() }
      runCatching { it.descriptor.close() }
    }
    leases.clear()
  }

  private fun validateConnection(treeUri: Uri) {
    val rootDocument = DocumentsContract.buildDocumentUriUsingTree(
      treeUri, DocumentsContract.getTreeDocumentId(treeUri))
    context.contentResolver.query(rootDocument, arrayOf(
      DocumentsContract.Document.COLUMN_DISPLAY_NAME,
      DocumentsContract.Document.COLUMN_MIME_TYPE,
    ), null, null, null)?.use { cursor ->
      require(cursor.moveToFirst()
        && cursor.getString(0) == AndroidSharedStoreIndex.ROOT_TITLE
        && cursor.getString(1) == DocumentsContract.Document.MIME_TYPE_DIR) {
        "PERMISSION_REQUIRED: The selected root is not the ModelCommons shared-model root."
      }
    } ?: throw IllegalStateException("HUB_NOT_FOUND: The selected provider cannot be queried.")
    val protocol = parseMetadata(readDocumentBounded(resolveRelativeDocument(treeUri, "protocol.json")))
    val registry = parseMetadata(readDocumentBounded(resolveRelativeDocument(treeUri, "registry.json")))
    require(protocol.optString("schema") == "modelcommons.protocol"
      && protocol.optInt("schemaVersion") == 1
      && protocol.optString("protocolVersion") == PROTOCOL_VERSION) {
      "PROTOCOL_VERSION_UNSUPPORTED: Shared protocol metadata is incompatible."
    }
    require(registry.optString("schema") == "modelcommons.registry"
      && registry.optInt("schemaVersion") == 1
      && registry.optString("protocolVersion") == PROTOCOL_VERSION) {
      "INTEGRITY_FAILED: Shared registry metadata is invalid."
    }
  }

  private fun parseMetadata(text: String): JSONObject = try {
    requireBoundedJsonStructure(text)
    JSONObject(text)
  } catch (_: Exception) {
    throw IllegalArgumentException("INTEGRITY_FAILED: Shared metadata is not valid JSON.")
  }

  private fun requireValidConnection(connection: Connection): Uri {
    val treeUri = Uri.parse(connection.treeUri)
    require(treeUri.scheme == "content" && treeUri.authority == connection.authority
      && DocumentsContract.isTreeUri(treeUri)
      && DocumentsContract.getTreeDocumentId(treeUri) == AndroidSharedStoreIndex.ROOT_DOCUMENT_ID) {
      "PERMISSION_REQUIRED: The saved ModelCommons root is invalid; reconnect storage."
    }
    require(hasReadGrant(treeUri)) { "PERMISSION_REQUIRED: Shared model access was revoked; reconnect storage." }
    val provider = context.packageManager.resolveContentProvider(connection.authority, 0)
      ?: throw IllegalStateException("HUB_NOT_FOUND: The ModelCommons provider is unavailable.")
    require(provider.packageName == connection.providerPackage && provider.exported
      && provider.permission == "android.permission.MANAGE_DOCUMENTS") {
      "PERMISSION_REQUIRED: The ModelCommons provider contract changed; reconnect storage."
    }
    val currentSigners = CallerAuthorizer(context).signingFingerprints(provider.packageName)
    require(currentSigners.isNotEmpty()
      && connection.signerSha256.toSet().intersect(currentSigners.toSet()).isNotEmpty()) {
      "PERMISSION_REQUIRED: The ModelCommons provider signing identity changed; reconnect storage."
    }
    validateConnection(treeUri)
    return treeUri
  }

  private fun resolveRelativeDocument(treeUri: Uri, relativePath: String): Uri {
    require(safeRelativePath(relativePath)) { "INTEGRITY_FAILED: Unsafe shared model path." }
    var parentId = DocumentsContract.getTreeDocumentId(treeUri)
    var parentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, parentId)
    for (segment in relativePath.split('/')) {
      val children = DocumentsContract.buildChildDocumentsUriUsingTree(parentUri, parentId)
      var matchId: String? = null
      context.contentResolver.query(children, arrayOf(
        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
      ), null, null, null)?.use { cursor ->
        var rows = 0
        while (cursor.moveToNext()) {
          require(++rows <= MAX_CHILDREN) { "INTEGRITY_FAILED: Shared directory contains too many entries." }
          if (cursor.getString(1) == segment) {
            require(matchId == null) { "INTEGRITY_FAILED: Shared directory contains duplicate names." }
            matchId = cursor.getString(0)
          }
        }
      } ?: throw IllegalStateException("HUB_NOT_FOUND: Shared provider query failed.")
      parentId = matchId ?: throw FileNotFoundException("MODEL_NOT_READY: Shared model resource is unavailable.")
      parentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, parentId)
    }
    return parentUri
  }

  private fun readDocumentBounded(uri: Uri): String {
    val descriptor = context.contentResolver.openFileDescriptor(uri, "r")
      ?: throw FileNotFoundException("MODEL_NOT_READY: Shared metadata is unavailable.")
    return descriptor.use {
      val stat = Os.fstat(it.fileDescriptor)
      require(OsConstants.S_ISREG(stat.st_mode) && stat.st_size in 1L..METADATA_LIMIT) {
        "INTEGRITY_FAILED: Shared metadata is invalid or too large."
      }
      val bytes = ByteArray(stat.st_size.toInt())
      var offset = 0
      while (offset < bytes.size) {
        val count = Os.pread(it.fileDescriptor, bytes, offset, bytes.size - offset, offset.toLong())
        require(count > 0) { "INTEGRITY_FAILED: Shared metadata ended unexpectedly." }
        offset += count
      }
      String(bytes, Charsets.UTF_8)
    }
  }

  private fun validateDescriptor(descriptor: ParcelFileDescriptor) {
    val stat = Os.fstat(descriptor.fileDescriptor)
    require(OsConstants.S_ISREG(stat.st_mode) && stat.st_size > 0) {
      "MODEL_NOT_READY: Shared model resource must be a non-empty regular file."
    }
    val current = Os.lseek(descriptor.fileDescriptor, 0, OsConstants.SEEK_CUR)
    Os.lseek(descriptor.fileDescriptor, current, OsConstants.SEEK_SET)
  }

  private fun requireLease(leaseId: String): Lease = leases[leaseId]
    ?: throw IllegalArgumentException("PERMISSION_REQUIRED: Model file lease is unknown or already released.")

  private fun hasReadGrant(uri: Uri): Boolean = context.contentResolver.persistedUriPermissions.any {
    it.uri == uri && it.isReadPermission
  }

  private fun readConnections(): List<Connection> {
    if (!recordsFile.isFile || recordsFile.length() !in 1L..CONNECTIONS_LIMIT) return emptyList()
    return runCatching {
      val text = recordsFile.readText(Charsets.UTF_8)
      requireBoundedJsonStructure(text)
      val array = JSONArray(text)
      require(array.length() <= MAX_CONNECTIONS)
      buildList {
        for (index in 0 until array.length()) {
          val item = array.getJSONObject(index)
          val signers = item.getJSONArray("signerSha256")
          val id = item.getString("id")
          val treeUri = item.getString("treeUri")
          val authority = item.getString("authority")
          val providerPackage = item.getString("providerPackage")
          require(CONNECTION_ID.matches(id) && treeUri.length in 1..MAX_URI_LENGTH
            && AUTHORITY.matches(authority) && authority.endsWith(AUTHORITY_SUFFIX)
            && PACKAGE_NAME.matches(providerPackage) && signers.length() in 1..MAX_SIGNERS)
          add(Connection(
            id, treeUri, authority, providerPackage, buildList {
              for (signerIndex in 0 until signers.length()) {
                val signer = signers.getString(signerIndex)
                require(SIGNER_SHA256.matches(signer))
                add(signer)
              }
            }
          ))
        }
      }
    }.getOrDefault(emptyList())
  }

  private fun persist(records: List<Connection>) {
    val array = JSONArray()
    records.forEach { record ->
      array.put(JSONObject()
        .put("id", record.id)
        .put("treeUri", record.treeUri)
        .put("authority", record.authority)
        .put("providerPackage", record.providerPackage)
        .put("signerSha256", JSONArray(record.signerSha256)))
    }
    val staged = File(recordsFile.parentFile, recordsFile.name + ".next")
    FileOutputStream(staged, false).use { output ->
      output.write(array.toString().toByteArray(Charsets.UTF_8))
      output.fd.sync()
    }
    Os.rename(staged.path, recordsFile.path)
  }

  private fun Connection.dictionary(): Map<String, Any> = mapOf(
    "id" to id,
    "kind" to "android-shared-files",
    "displayName" to "ModelCommons (Android shared files)",
  )

  private fun safeRelativePath(value: String): Boolean = value.length in 1..1024
    && !value.contains('\\') && !value.contains('%') && !value.contains(':')
    && value.none { it.code < 32 }
    && value.split('/').all { SAFE_SEGMENT.matches(it) && it != "." && it != ".." }

  private fun requireBoundedJsonStructure(value: String) {
    var depth = 0
    var quoted = false
    var escaped = false
    for (character in value) {
      if (quoted) {
        if (escaped) escaped = false
        else if (character == '\\') escaped = true
        else if (character == '"') quoted = false
      } else if (character == '"') quoted = true
      else if (character == '{' || character == '[') {
        require(++depth <= MAX_JSON_DEPTH) { "INTEGRITY_FAILED: Shared metadata is nested too deeply." }
      } else if (character == '}' || character == ']') {
        require(--depth >= 0) { "INTEGRITY_FAILED: Shared metadata structure is invalid." }
      }
    }
    require(depth == 0 && !quoted && !escaped) { "INTEGRITY_FAILED: Shared metadata structure is invalid." }
  }

  companion object {
    private const val CONNECTIONS_FILE = "modelcommons-shared-connections-v1.json"
    private const val AUTHORITY_SUFFIX = ".modelcommons.documents"
    private const val NATIVE_DESCRIPTOR_URI = "modelcommons-native://android-file-descriptor"
    private const val PROTOCOL_VERSION = "0.1.0"
    private const val METADATA_LIMIT = 1024L * 1024L
    private const val CONNECTIONS_LIMIT = 128L * 1024L
    private const val MAX_CONNECTIONS = 8
    private const val MAX_SIGNERS = 8
    private const val MAX_URI_LENGTH = 4096
    private const val MAX_LEASES = 16
    private const val MAX_CHILDREN = 256
    private const val MAX_JSON_DEPTH = 32
    private val AUTHORITY = Regex("^[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+$")
    private val PACKAGE_NAME = AUTHORITY
    private val CONNECTION_ID = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    private val SIGNER_SHA256 = Regex("^[a-f0-9]{64}$")
    private val SAFE_SEGMENT = Regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$")
  }
}

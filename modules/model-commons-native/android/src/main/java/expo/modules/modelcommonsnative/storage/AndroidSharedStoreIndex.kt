package expo.modules.modelcommonsnative.storage

import android.content.Context
import android.provider.DocumentsContract
import android.system.Os
import android.system.OsConstants
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileNotFoundException
import java.security.MessageDigest

/** A cold-start-safe, read-only view of the Hub-owned ModelCommons store. */
internal class AndroidSharedStoreIndex(context: Context) {
  data class Node(
    val id: String,
    val parentId: String?,
    val displayName: String,
    val mimeType: String,
    val file: File?,
  ) {
    val directory: Boolean get() = mimeType == DocumentsContract.Document.MIME_TYPE_DIR
  }

  private val root = File(context.filesDir.canonicalFile, STORE_DIRECTORY)

  fun rootNode() = Node(ROOT_DOCUMENT_ID, null, ROOT_TITLE, DocumentsContract.Document.MIME_TYPE_DIR, null)

  fun nodes(): Map<String, Node> {
    val nodes = linkedMapOf(ROOT_DOCUMENT_ID to rootNode())
    val protocol = confinedRegularFile(PROTOCOL_FILE, METADATA_LIMIT)
    val registry = confinedRegularFile(REGISTRY_FILE, METADATA_LIMIT)
    val registryJson = parseObject(registry, METADATA_LIMIT)
    require(registryJson.optString("schema") == "modelcommons.registry" && registryJson.optInt("schemaVersion") == 1) {
      "INTEGRITY_FAILED: Unsupported shared registry."
    }

    addFile(nodes, ROOT_DOCUMENT_ID, PROTOCOL_FILE, protocol, "application/json")
    addFile(nodes, ROOT_DOCUMENT_ID, REGISTRY_FILE, registry, "application/json")
    val modelsId = opaqueId(MODELS_DIRECTORY)
    nodes[modelsId] = Node(modelsId, ROOT_DOCUMENT_ID, MODELS_DIRECTORY,
      DocumentsContract.Document.MIME_TYPE_DIR, null)

    val records = registryJson.optJSONArray("models")
      ?: throw IllegalArgumentException("INTEGRITY_FAILED: Shared registry has no models array.")
    require(records.length() <= MAX_MODELS) { "INTEGRITY_FAILED: Shared registry contains too many models." }
    for (index in 0 until records.length()) {
      val record = records.optJSONObject(index) ?: continue
      if (record.optString("state") != "READY") continue
      val manifest = record.optJSONObject("manifest") ?: continue
      val storageId = manifest.optString("storageId")
      if (!STORAGE_ID.matches(storageId)) continue
      if (!licenseAccepted(registryJson, manifest)) continue
      val modelRelative = "$MODELS_DIRECTORY/$storageId"
      val manifestFile = runCatching {
        confinedRegularFile("$modelRelative/$MANIFEST_FILE", METADATA_LIMIT)
      }.getOrNull() ?: continue
      val storedManifest = runCatching { parseObject(manifestFile, METADATA_LIMIT) }.getOrNull() ?: continue
      if (storedManifest.optString("schema") != "modelcommons.model-manifest"
        || storedManifest.optInt("schemaVersion") != 1
        || storedManifest.optString("id") != manifest.optString("id")
        || storedManifest.optString("revision") != manifest.optString("revision")
        || storedManifest.optString("storageId") != storageId) continue

      val files = storedManifest.optJSONArray("files") ?: continue
      if (files.length() !in 1..MAX_FILES_PER_MODEL) continue
      val artifacts = mutableListOf<Pair<String, File>>()
      val artifactPaths = mutableSetOf<String>()
      var valid = true
      for (fileIndex in 0 until files.length()) {
        val artifact = files.optJSONObject(fileIndex)
        if (artifact == null || !artifact.optBoolean("required", false)) continue
        val relativePath = artifact.optString("path")
        if (!safeRelativePath(relativePath) || !artifactPaths.add(relativePath)) { valid = false; break }
        val expected = artifact.optLong("sizeBytes", -1)
        val file = runCatching {
          confinedRegularFile("$modelRelative/$relativePath", MAX_ARTIFACT_BYTES)
        }.getOrNull()
        if (file == null || expected !in 1L..MAX_ARTIFACT_BYTES || file.length() != expected) {
          valid = false
          break
        }
        artifacts += relativePath to file
      }
      if (!valid || artifacts.isEmpty()) continue

      addDirectory(nodes, modelsId, modelRelative, storageId)
      addFile(nodes, opaqueId(modelRelative), "$modelRelative/$MANIFEST_FILE", manifestFile, "application/json")
      for ((relativePath, artifactFile) in artifacts) {
        addArtifactPath(nodes, modelRelative, relativePath, artifactFile)
      }
    }
    return nodes
  }

  private fun licenseAccepted(registry: JSONObject, manifest: JSONObject): Boolean {
    val license = manifest.optJSONObject("license") ?: return false
    if (!license.optBoolean("acceptanceRequired", false)) return true
    val acceptances = registry.optJSONArray("licenseAcceptances") ?: return false
    if (acceptances.length() > MAX_LICENSE_ACCEPTANCES) return false
    for (index in 0 until acceptances.length()) {
      val acceptance = acceptances.optJSONObject(index) ?: continue
      if (acceptance.optString("modelId") == manifest.optString("id")
        && acceptance.optString("modelRevision") == manifest.optString("revision")
        && acceptance.optString("licenseId") == license.optString("id")
        && acceptance.optString("licenseUrl") == license.optString("url")) return true
    }
    return false
  }

  private fun addArtifactPath(nodes: MutableMap<String, Node>, modelRelative: String, artifact: String, file: File) {
    val segments = artifact.split('/')
    var parentRelative = modelRelative
    var parentId = opaqueId(modelRelative)
    for (segment in segments.dropLast(1)) {
      val current = "$parentRelative/$segment"
      addDirectory(nodes, parentId, current, segment)
      parentRelative = current
      parentId = opaqueId(current)
    }
    addFile(nodes, parentId, "$modelRelative/$artifact", file, "application/octet-stream")
  }

  private fun addDirectory(nodes: MutableMap<String, Node>, parentId: String, relative: String, name: String) {
    val id = opaqueId(relative)
    nodes[id] = Node(id, parentId, name, DocumentsContract.Document.MIME_TYPE_DIR, null)
  }

  private fun addFile(
    nodes: MutableMap<String, Node>,
    parentId: String,
    relative: String,
    file: File,
    mimeType: String,
  ) {
    val id = opaqueId(relative)
    nodes[id] = Node(id, parentId, file.name, mimeType, file)
  }

  private fun confinedRegularFile(relative: String, maximumBytes: Long): File {
    require(safeRelativePath(relative)) { "INTEGRITY_FAILED: Unsafe shared store path." }
    val base = root.canonicalFile
    val requested = File(base, relative)
    val canonical = requested.canonicalFile
    require(canonical.path.startsWith(base.path + File.separator) && canonical.path == requested.absolutePath) {
      "INTEGRITY_FAILED: Shared store path escapes its root or contains a symlink."
    }
    val stat = try { Os.lstat(requested.path) } catch (_: Exception) {
      throw FileNotFoundException("MODEL_NOT_READY: Shared file is unavailable.")
    }
    require(!OsConstants.S_ISLNK(stat.st_mode) && OsConstants.S_ISREG(stat.st_mode)) {
      "INTEGRITY_FAILED: Shared resource is not a regular file."
    }
    require(stat.st_size in 1L..maximumBytes) { "INTEGRITY_FAILED: Shared resource size is invalid." }
    return canonical
  }

  private fun parseObject(file: File, maximumBytes: Long): JSONObject {
    val bytes = FileInputStream(file).use { input ->
      val buffer = ByteArray((maximumBytes + 1).toInt())
      var total = 0
      while (total < buffer.size) {
        val count = input.read(buffer, total, buffer.size - total)
        if (count < 0) break
        total += count
      }
      require(total <= maximumBytes) { "INTEGRITY_FAILED: Shared metadata is too large." }
      buffer.copyOf(total)
    }
    val text = String(bytes, Charsets.UTF_8)
    requireBoundedJsonStructure(text)
    return JSONObject(text)
  }

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

  private fun safeRelativePath(value: String): Boolean = value.length in 1..1024
    && !value.contains('\\') && !value.contains('%') && !value.contains(':')
    && value.none { it.code < 32 }
    && value.split('/').all { SAFE_SEGMENT.matches(it) && it != "." && it != ".." }

  private fun opaqueId(relative: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(relative.toByteArray(Charsets.UTF_8))
    return "mc-" + digest.take(18).joinToString("") { "%02x".format(it) }
  }

  companion object {
    const val ROOT_DOCUMENT_ID = "modelcommons-root-v1"
    const val ROOT_TITLE = "ModelCommons shared models"
    private const val STORE_DIRECTORY = "ModelCommons"
    private const val MODELS_DIRECTORY = "models"
    private const val PROTOCOL_FILE = "protocol.json"
    private const val REGISTRY_FILE = "registry.json"
    private const val MANIFEST_FILE = "manifest.json"
    private const val METADATA_LIMIT = 1024L * 1024L
    private const val MAX_ARTIFACT_BYTES = 32L * 1024L * 1024L * 1024L
    private const val MAX_MODELS = 128
    private const val MAX_LICENSE_ACCEPTANCES = 512
    private const val MAX_FILES_PER_MODEL = 16
    private const val MAX_JSON_DEPTH = 32
    private val STORAGE_ID = Regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$")
    private val SAFE_SEGMENT = Regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$")
  }
}

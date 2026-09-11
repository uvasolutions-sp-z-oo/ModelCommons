package expo.modules.modelcommonsnative.security

import android.content.Context
import android.content.pm.PackageManager
import android.content.pm.Signature
import android.os.Build
import android.os.Process
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

data class CallerIdentity(
  val uid: Int,
  val userId: Int,
  val packages: List<String>,
  val signingIdentity: List<String> = emptyList(),
  val approvalEpoch: Long = 0,
)

data class PendingClient(
  val packageName: String,
  val userId: Int,
  val certificateSha256: List<String>,
  val lastSeenAt: Long,
)

class CallerAuthorizer(private val context: Context) {
  private val packageManager = context.packageManager
  private val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

  fun requireAuthorized(uid: Int, requiredScope: String, rememberDenied: Boolean = true): CallerIdentity {
    val packages = packageManager.getPackagesForUid(uid)?.toList()?.sorted().orEmpty()
    if (packages.isEmpty() || packages.size > 16) throw SecurityException("CLIENT_NOT_AUTHORIZED")
    val certificates = packages.flatMap { name -> signingFingerprints(name).map { "$name:$it" } }
    if (certificates.size < packages.size || certificates.size > 64) throw SecurityException("CLIENT_NOT_AUTHORIZED")
    val identity = CallerIdentity(uid, userIdForUid(uid), packages, certificates.sorted(), preferences.getLong("epoch", 0))
    if (isTrustedHubProcess(uid, Process.myUid(), packages, context.packageName)) return identity

    val approvals = readApprovals()
    val authorized = packages.all { packageName ->
      approvals.any { approval ->
        approval.packageName == packageName &&
          approval.userId == identity.userId &&
          approval.approved &&
          requiredScope in approval.scopes &&
          certificateMatches(packageName, approval.certificateSha256)
      }
    }
    if (!authorized) {
      if (rememberDenied) rememberPending(identity)
      throw SecurityException(
        "PERMISSION_REQUIRED: every package sharing caller UID ${identity.uid} must have an active certificate-bound approval."
      )
    }
    return identity
  }

  @Synchronized
  fun setAuthorization(
    packageName: String,
    userId: Int,
    certificateSha256: String,
    approved: Boolean,
    scopes: List<String>,
  ) {
    require(PACKAGE_NAME.matches(packageName)) { "Invalid Android package name." }
    val normalizedCertificate = normalizeFingerprint(certificateSha256)
    require(SHA256.matches(normalizedCertificate)) { "Certificate must be a SHA-256 fingerprint." }
    val normalizedScopes = scopes.distinct().filter { it == SCOPE_METADATA || it == SCOPE_INFERENCE }
    require(!approved || normalizedScopes.isNotEmpty()) { "An approval requires at least one supported scope." }
    if (approved) {
      val application = packageManager.getApplicationInfo(packageName, 0)
      require(userIdForUid(application.uid) == userId) { "Package is installed for a different user." }
      require(certificateMatches(packageName, normalizedCertificate)) {
        "Certificate is not in the installed package signing history."
      }
    }

    val records = readApprovals().filterNot {
      // One current decision per package/user. This prevents an older signing-lineage
      // approval from surviving a later explicit revocation for the same package.
      it.packageName == packageName && it.userId == userId
    }.toMutableList()
    val record = Approval(
      packageName = packageName,
      userId = userId,
      certificateSha256 = normalizedCertificate,
      approved = approved,
      scopes = normalizedScopes,
      updatedAt = System.currentTimeMillis(),
    )
    records.add(record)
    require(records.size <= 128) { "Authorization capacity reached." }
    check(preferences.edit().putString(KEY_APPROVALS, encodeApprovals(records))
      .putLong("epoch", preferences.getLong("epoch", 0) + 1).commit()) {
      "Unable to persist client authorization."
    }
  }

  fun pendingClients(): List<PendingClient> {
    val raw = preferences.getString(KEY_PENDING, null) ?: return emptyList()
    if (raw.length > 128 * 1024) return emptyList()
    return try {
      val array = JSONArray(raw)
      require(array.length() <= 128)
      buildList {
        for (index in 0 until array.length()) {
          val item = array.getJSONObject(index)
          val certificates = item.getJSONArray("certificates")
          add(
            PendingClient(
              packageName = item.getString("packageName"),
              userId = item.getInt("userId"),
              certificateSha256 = buildList {
                for (certificateIndex in 0 until certificates.length()) add(certificates.getString(certificateIndex))
              },
              lastSeenAt = item.getLong("lastSeenAt"),
            )
          )
        }
      }
    } catch (_: Exception) {
      emptyList()
    }
  }

  fun installedUid(packageName: String): Int? = try {
    packageManager.getApplicationInfo(packageName, 0).uid
  } catch (_: PackageManager.NameNotFoundException) {
    null
  }

  @Synchronized
  @Synchronized private fun rememberPending(identity: CallerIdentity) {
    val pending = pendingClients().associateBy { "${it.userId}:${it.packageName}" }.toMutableMap()
    if (identity.packages.all { (pending["${identity.userId}:$it"]?.lastSeenAt ?: 0) > System.currentTimeMillis() - 30000 }) return
    for (packageName in identity.packages) {
      pending["${identity.userId}:$packageName"] = PendingClient(
        packageName,
        identity.userId,
        signingFingerprints(packageName),
        System.currentTimeMillis(),
      )
    }
    val encoded = JSONArray()
    pending.values.sortedByDescending { it.lastSeenAt }.take(128).forEach { item ->
      encoded.put(
        JSONObject()
          .put("packageName", item.packageName)
          .put("userId", item.userId)
          .put("certificates", JSONArray(item.certificateSha256))
          .put("lastSeenAt", item.lastSeenAt)
      )
    }
    preferences.edit().putString(KEY_PENDING, encoded.toString()).commit()
  }

  private fun certificateMatches(packageName: String, normalizedSha256: String): Boolean {
    return try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        packageManager.hasSigningCertificate(
          packageName,
          decodeHex(normalizedSha256),
          PackageManager.CERT_INPUT_SHA256,
        )
      } else {
        normalizedSha256 in signingFingerprints(packageName)
      }
    } catch (_: PackageManager.NameNotFoundException) {
      false
    }
  }

  @Suppress("DEPRECATION")
  fun signingFingerprints(packageName: String): List<String> {
    return try {
      val signatures: Array<out Signature> = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        val info = packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)
        val signingInfo = info.signingInfo ?: return emptyList()
        signingInfo.apkContentsSigners.orEmpty()
      } else {
        packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNATURES).signatures.orEmpty()
      }
      signatures.map { signature ->
        MessageDigest.getInstance("SHA-256").digest(signature.toByteArray())
          .joinToString("") { byte -> "%02x".format(byte) }
      }.distinct()
    } catch (_: PackageManager.NameNotFoundException) {
      emptyList()
    }
  }

  private fun userIdForUid(uid: Int): Int {
    require(uid >= 0) { "Android UID must be non-negative." }
    // Android allocates each user a fixed UID range. getUserId(uid) performs
    // this division internally, but that helper is hidden from the public SDK.
    return uid / ANDROID_UID_USER_RANGE
  }

  private fun readApprovals(): List<Approval> {
    val raw = preferences.getString(KEY_APPROVALS, null) ?: return emptyList()
    if (raw.length > 128 * 1024) return emptyList()
    return try {
      val array = JSONArray(raw)
      require(array.length() <= 128)
      buildList {
        for (index in 0 until array.length()) {
          val item = array.getJSONObject(index)
          val scopes = item.getJSONArray("scopes")
          val packageName = item.getString("packageName")
          val userId = item.getInt("userId")
          val certificate = normalizeFingerprint(item.getString("certificateSha256"))
          val approved = item.getBoolean("approved")
          val normalizedScopes = buildList {
            for (scopeIndex in 0 until scopes.length()) add(scopes.getString(scopeIndex))
          }.distinct()
          val updatedAt = item.getLong("updatedAt")
          require(PACKAGE_NAME.matches(packageName))
          require(userId >= 0)
          require(SHA256.matches(certificate))
          require(normalizedScopes.all { it == SCOPE_METADATA || it == SCOPE_INFERENCE })
          require(!approved || normalizedScopes.isNotEmpty())
          require(updatedAt > 0)
          add(
            Approval(
              packageName = packageName,
              userId = userId,
              certificateSha256 = certificate,
              approved = approved,
              scopes = normalizedScopes,
              updatedAt = updatedAt,
            )
          )
        }
      }
    } catch (_: Exception) {
      // Corrupt authorization state means nobody is authorized.
      emptyList()
    }
  }

  private fun encodeApprovals(records: List<Approval>): String {
    val array = JSONArray()
    records.forEach { record ->
      array.put(
        JSONObject()
          .put("packageName", record.packageName)
          .put("userId", record.userId)
          .put("certificateSha256", record.certificateSha256)
          .put("approved", record.approved)
          .put("scopes", JSONArray(record.scopes))
          .put("updatedAt", record.updatedAt)
      )
    }
    return array.toString()
  }

  private fun normalizeFingerprint(value: String): String = value.lowercase().replace(":", "").trim()

  private fun decodeHex(value: String): ByteArray = ByteArray(value.length / 2) { index ->
    value.substring(index * 2, index * 2 + 2).toInt(16).toByte()
  }

  private data class Approval(
    val packageName: String,
    val userId: Int,
    val certificateSha256: String,
    val approved: Boolean,
    val scopes: List<String>,
    val updatedAt: Long,
  )

  companion object {
    const val SCOPE_METADATA = "metadata"
    const val SCOPE_INFERENCE = "inference"
    private const val PREFERENCES = "modelcommons_authorization_v1"
    private const val KEY_APPROVALS = "approvals"
    private const val KEY_PENDING = "pending"
    private const val ANDROID_UID_USER_RANGE = 100_000
    private val SHA256 = Regex("^[a-f0-9]{64}$")
    private val PACKAGE_NAME = Regex("^[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+$")

    internal fun isTrustedHubProcess(
      callerUid: Int,
      hubUid: Int,
      packages: List<String>,
      hubPackage: String,
    ): Boolean = callerUid == hubUid && packages.size == 1 && packages.single() == hubPackage
  }
}

package expo.modules.modelcommonsnative

import android.app.ActivityManager
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Build
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.modelcommonsnative.client.AndroidHubClient
import expo.modules.modelcommonsnative.security.CallerAuthorizer
import expo.modules.modelcommonsnative.service.ModelCommonsService
import expo.modules.modelcommonsnative.service.InferenceCoordinator
import expo.modules.modelcommonsnative.storage.AppOwnedFileOps
import expo.modules.modelcommonsnative.storage.HubStateStore
import expo.modules.modelcommonsnative.storage.PrivateModelFiles

class ModelCommonsNativeModule : Module() {
  private val androidContext: Context
    get() = appContext.reactContext?.applicationContext
      ?: throw IllegalStateException("React application context is unavailable.")

  private val hubClientDelegate = lazy {
    AndroidHubClient(androidContext) { event -> sendEvent("onModelCommonsEvent", event) }
  }
  private val hubClient: AndroidHubClient by hubClientDelegate
  private val privateFiles by lazy { PrivateModelFiles(androidContext) }
  private data class PendingImport(val id: String, val path: String, val expected: Double, val promise: Promise)
  private var pendingImport: PendingImport? = null
  private val mutationToken = Any()
  private var mutating = false
  private val privateDownloads = java.util.concurrent.atomic.AtomicLong(0)
  private val privateImports = java.util.concurrent.atomic.AtomicLong(0)

  override fun definition() = ModuleDefinition {
    Name("ModelCommonsNative")
    Events("onModelCommonsEvent")

    AsyncFunction("importPrivateModel") { id: String, path: String, expected: Double, promise: Promise ->
      privateImports.incrementAndGet()
      if (pendingImport != null) {
        promise.reject("ERR_PRIVATE_MODEL", "RUNTIME_UNAVAILABLE: An import picker is already active.", null)
      } else {
        pendingImport = PendingImport(id, path, expected, promise)
        try {
          appContext.throwingActivity.startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            // GGUF has no consistently registered provider MIME type. The
            // independently approved size/digest is the import authority.
            type = "*/*"
            putExtra(Intent.EXTRA_LOCAL_ONLY, true)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          }, 48627)
        } catch (_: Exception) {
          pendingImport = null
          promise.reject("ERR_PRIVATE_MODEL", "STORAGE_UNAVAILABLE: Unable to open the file picker.", null)
        }
      }
    }.runOnQueue(expo.modules.kotlin.functions.Queues.MAIN)

    OnActivityResult { _, (requestCode, resultCode, data) ->
      if (requestCode == 48627) {
        val pending = pendingImport
        pendingImport = null
        val source = data?.data
        if (pending != null) {
          if (resultCode != Activity.RESULT_OK || source == null) {
            pending.promise.reject("ERR_PRIVATE_MODEL", "USER_CANCELLED: Import cancelled.", null)
          } else Thread {
            try {
              privateFiles.copySelected(pending.id, source, pending.path, pending.expected)
              pending.promise.resolve(null)
            } catch (error: Exception) {
              val code = error.message?.substringBefore(':')?.takeIf {
                it in setOf("USER_CANCELLED", "PERMISSION_REQUIRED", "INTEGRITY_FAILED", "RUNTIME_UNAVAILABLE")
              } ?: "STORAGE_UNAVAILABLE"
              pending.promise.reject("ERR_PRIVATE_MODEL", "$code: Private import failed.", null)
            }
          }.start()
        }
      }
    }

    AsyncFunction("privateModelOperation") { operation: String, path: String, value: String ->
      privateFiles.operation(operation, path, value)
    }

    AsyncFunction("downloadPrivateModel") { id: String, source: String, path: String, expected: Double, origins: List<String>, promise: Promise ->
      privateDownloads.incrementAndGet()
      // Do not block the Expo queue: cancellation/progress must remain callable.
      Thread {
        try {
          privateFiles.download(id, source, path, expected, origins)
          promise.resolve(null)
        } catch (error: Exception) {
          val code = error.message?.substringBefore(':')?.takeIf {
            it in setOf("USER_CANCELLED", "PERMISSION_REQUIRED", "INTEGRITY_FAILED", "STORAGE_UNAVAILABLE")
          } ?: "STORAGE_UNAVAILABLE"
          promise.reject("ERR_PRIVATE_MODEL", "$code: Model provisioning failed.", null)
        }
      }.start()
    }

    AsyncFunction("privateModelEvidence") {
      val root = java.io.File(androidContext.noBackupFilesDir.canonicalFile, "ModelCommonsPrivate")
      var count = 0L
      var bytes = 0L
      var entries = 0
      fun scan(file: java.io.File, depth: Int) {
        check(depth <= 8 && ++entries <= 8192 && file.canonicalFile == file.absoluteFile) { "INTEGRITY_FAILED" }
        if (file.isDirectory) {
          (file.listFiles() ?: throw IllegalStateException("STORAGE_UNAVAILABLE")).forEach { scan(it, depth + 1) }
        } else if (file.isFile && file.name.contains(".gguf")) { count++; bytes += file.length() }
      }
      if (root.exists()) scan(root, 0)
      mapOf("downloadAttempts" to privateDownloads.get().toDouble(), "importAttempts" to privateImports.get().toDouble(),
        "artifactCount" to count.toDouble(), "artifactBytes" to bytes.toDouble())
    }

    AsyncFunction("getAvailability") {
      mapOf(
        "available" to true,
        "platform" to "android",
        "androidHubConnected" to (hubClientDelegate.isInitialized() && hubClient.isConnected),
        "iosSharedModels" to false,
      )
    }

    AsyncFunction("getDeviceProfile") {
      val memory = ActivityManager.MemoryInfo()
      val activityManager = androidContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      activityManager.getMemoryInfo(memory)
      val cpuName = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        Build.SOC_MODEL.takeIf { it.isNotBlank() } ?: Build.HARDWARE
      } else {
        Build.HARDWARE
      }
      mapOf(
        "physicalMemoryBytes" to memory.totalMem.toDouble(),
        "availableMemoryBytes" to memory.availMem.toDouble(),
        "osVersion" to Build.VERSION.RELEASE,
        "accelerators" to listOf(
          mapOf(
            "id" to "cpu",
            "kind" to "cpu",
            "name" to cpuName,
          )
        ),
      )
    }

    AsyncFunction("atomicReplaceFile") { stagedUri: String, destinationUri: String ->
      AppOwnedFileOps.atomicReplace(androidContext, stagedUri, destinationUri)
    }

    AsyncFunction("sha256File") { uri: String ->
      AppOwnedFileOps.sha256(androidContext, uri)
    }

    AsyncFunction("connectAndroidHub") { packageName: String, certificates: List<String>, promise: Promise ->
      hubClient.connect(packageName, certificates) { result ->
        result.fold(
          onSuccess = promise::resolve,
          onFailure = { error ->
            promise.reject("ERR_MODELCOMMONS_CONNECT", error.message ?: "Unable to connect to Hub.", error)
          },
        )
      }
    }

    AsyncFunction("disconnectAndroidHub") {
      if (hubClientDelegate.isInitialized()) hubClient.close()
    }

    AsyncFunction("openAndroidHub") { packageName: String, certificates: List<String> ->
      require(certificates.size in 1..8 && certificates.all { Regex("^[a-fA-F0-9]{64}$").matches(it) }) { "CLIENT_NOT_AUTHORIZED: Invalid Hub signing policy." }
      val signers = CallerAuthorizer(androidContext).signingFingerprints(packageName)
      require(signers.isNotEmpty() && signers.all { it in certificates.map(String::lowercase) }) { "CLIENT_NOT_AUTHORIZED: Hub signing identity does not match policy." }
      val intent = androidContext.packageManager.getLaunchIntentForPackage(packageName)
        ?: throw IllegalStateException("HUB_NOT_FOUND: The selected Hub cannot be opened.")
      androidContext.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    AsyncFunction("androidListModels") { cursor: String?, limit: Int ->
      hubClient.listModels(cursor, limit)
    }

    AsyncFunction("androidCreateSession") { modelId: String, profileId: String ->
      hubClient.createSession(modelId, profileId)
    }

    AsyncFunction("androidGenerate") { sessionId: String, requestId: String, requestJson: String ->
      hubClient.generate(sessionId, requestId, requestJson)
    }

    AsyncFunction("androidCancel") { sessionId: String, requestId: String ->
      hubClient.cancel(sessionId, requestId)
    }

    AsyncFunction("androidReleaseSession") { sessionId: String ->
      hubClient.releaseSession(sessionId)
    }

    AsyncFunction("androidAcknowledge") { sessionId: String, requestId: String, sequence: Double ->
      require(sequence >= 0 && sequence == sequence.toLong().toDouble())
      hubClient.acknowledge(sessionId, requestId, sequence.toLong())
    }
    AsyncFunction("androidIsSessionDrained") { sessionId: String -> hubClient.isSessionDrained(sessionId) }
    AsyncFunction("androidHostAvailability") {
      mapOf("available" to (InferenceCoordinator.backend(androidContext)?.available() == true),
        "runtimeId" to "modelcommons.android.cpu", "runtimeVersion" to "0.1.0", "packageName" to androidContext.packageName)
    }
    AsyncFunction("beginAndroidHubMutation") {
      synchronized(mutationToken) {
        check(!mutating && InferenceCoordinator.acquire(mutationToken)) { "RUNTIME_UNAVAILABLE: Hub model is leased or mutation is active." }
        mutating = true
      }
    }
    AsyncFunction("endAndroidHubMutation") {
      synchronized(mutationToken) { if (mutating) { mutating = false; InferenceCoordinator.release(mutationToken) } }
    }

    AsyncFunction("publishAndroidHubState") { modelsJson: String ->
      HubStateStore(androidContext).publishModels(modelsJson)
    }

    AsyncFunction("listPendingAndroidClients") {
      CallerAuthorizer(androidContext).pendingClients().map { client ->
        mapOf(
          "packageName" to client.packageName,
          "userId" to client.userId,
          "certificateSha256" to client.certificateSha256,
          "lastSeenAt" to client.lastSeenAt.toDouble(),
        )
      }
    }

    AsyncFunction("setAndroidClientAuthorization") {
      packageName: String,
      userId: Int,
      certificateSha256: String,
      approved: Boolean,
      scopes: List<String> ->
      val authorizer = CallerAuthorizer(androidContext)
      authorizer.setAuthorization(packageName, userId, certificateSha256, approved, scopes)
      authorizer.installedUid(packageName)?.let(ModelCommonsService::revokeUid)
    }

    OnActivityEntersBackground { if (hubClientDelegate.isInitialized()) hubClient.close() }
    OnDestroy {
      if (hubClientDelegate.isInitialized()) hubClient.close()
      // A destroyed JS owner cannot prove an outstanding filesystem mutation drained.
      // Keep that gate occupied until completion or process restart; never admit mmap early.
    }
  }
}

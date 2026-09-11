package org.modelcommons.host

import android.content.Context
import expo.modules.modelcommonsnative.ipc.ModelDescriptorParcel
import expo.modules.modelcommonsnative.service.HostFailure
import expo.modules.modelcommonsnative.service.InferenceBackend
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

class NativeInferenceHost(private val context: Context) : InferenceBackend {
  private val resolver = VerifiedArtifactResolver(context)
  override fun available(): Boolean = NativeWorker.loaded
  override fun models(): List<ModelDescriptorParcel> = VerifiedArtifactResolver.pins.mapNotNull { pin ->
    try {
      val manifest = resolver.manifest(pin)
      // Runtime compatibility is host discovery metadata. Stored manifests remain untouched.
      manifest.put("compatibleRuntimes", JSONArray().put(JSONObject().put("id", "modelcommons.android.cpu").put("minimumVersion", "0.1.0")))
      manifest.put("recommendedProfiles", JSONArray().put("safe"))
      manifest.put("context", JSONObject().put("recommended", 1024).put("maximum", 1024).put("trained", 8192))
      ModelDescriptorParcel(pin.id, pin.revision, manifest.getString("displayName"), "READY", listOf("text"), manifest.toString())
    } catch (_: Exception) { null } // Absent/invalid stores are never advertised as ready.
  }
  override fun run(modelId: String, request: JSONObject, cancelled: AtomicBoolean, delta: (String) -> Unit): JSONObject {
    if (!available()) throw HostFailure("RUNTIME_UNAVAILABLE")
    val parsed = try { TextRequest.parse(request, modelId) } catch (e: HostFailure) { throw e }
      catch (_: Exception) { throw HostFailure("FEATURE_UNSUPPORTED") }
    val pin = VerifiedArtifactResolver.pins.singleOrNull { it.id == modelId } ?: throw HostFailure("MODEL_NOT_FOUND")
    val memory = android.app.ActivityManager.MemoryInfo()
    (context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager).getMemoryInfo(memory)
    if (memory.lowMemory || memory.availMem < pin.size * 2 + 256L * 1024 * 1024) throw HostFailure("INSUFFICIENT_MEMORY")
    val lease = try { resolver.acquire(pin, cancelled) }
      catch (e: HostFailure) { throw e }
      catch (e: android.system.ErrnoException) {
        throw HostFailure(if (e.errno == android.system.OsConstants.ENOENT) "MODEL_NOT_READY" else "STORAGE_UNAVAILABLE")
      } catch (_: org.json.JSONException) { throw HostFailure("INTEGRITY_FAILED") }
    lease.use { file ->
      val control = Control()
      val watch = Executors.newSingleThreadScheduledExecutor { Thread(it, "ModelCommonsNativeCancel").apply { isDaemon = true } }
      val task = watch.scheduleAtFixedRate({ if (cancelled.get()) control.cancel() }, 0, 25, TimeUnit.MILLISECONDS)
      try {
        if (cancelled.get()) throw HostFailure("USER_CANCELLED")
        val text = StringBuilder()
        val sink = TokenSink { part ->
          if (cancelled.get()) throw HostFailure("USER_CANCELLED")
          if (JSONObject.quote(text.toString() + part).toByteArray(Charsets.UTF_8).size > 12 * 1024)
            throw HostFailure("RUNTIME_INITIALIZATION_FAILED")
          text.append(part); delta(part)
        }
        val usage = NativeWorker.run(control.handle, file.fd, parsed.roles, parsed.texts, parsed.output, parsed.temperature, parsed.topP, sink)
        sink.finish()
        return JSONObject().put("text", text.toString()).put("inputTokens", usage[0]).put("outputTokens", usage[1])
          .put("artifactSha256", pin.hash).put("artifactBytes", pin.size)
          .put("stopReason", if (usage[2] == 1) "stop" else "length")
      } catch (e: HostFailure) { throw e }
      catch (e: Exception) {
        throw HostFailure(when (e.message) {
          "USER_CANCELLED", "INSUFFICIENT_MEMORY", "FEATURE_UNSUPPORTED", "STORAGE_UNAVAILABLE" -> e.message!!
          "CONTEXT_LIMIT_EXCEEDED" -> "MODEL_INCOMPATIBLE"
          else -> "RUNTIME_INITIALIZATION_FAILED"
        })
      } finally {
        task.cancel(false); watch.shutdownNow(); control.close()
        // JNI has destroyed sampler/context/model before this verified descriptor closes.
      }
    }
  }
  private class Control {
    val handle = NativeWorker.create()
    private var closed = false
    @Synchronized fun cancel() { if (!closed) NativeWorker.cancel(handle) }
    @Synchronized fun close() { if (!closed) { closed = true; NativeWorker.destroy(handle) } }
  }
}

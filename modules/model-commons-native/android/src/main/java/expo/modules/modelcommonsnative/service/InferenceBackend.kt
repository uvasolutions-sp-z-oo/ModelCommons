package expo.modules.modelcommonsnative.service

import android.content.Context
import expo.modules.modelcommonsnative.ipc.ModelDescriptorParcel
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicBoolean

/** Implemented by the optional host package. No llama/JSI dependency in the connector. */
interface InferenceBackend {
  fun available(): Boolean
  fun models(): List<ModelDescriptorParcel>
  fun run(modelId: String, request: JSONObject, cancelled: AtomicBoolean, delta: (String) -> Unit): JSONObject
}

class HostFailure(val code: String) : RuntimeException(code)

/** Process-wide admission and mutation gate, shared even across Service recreation. */
object InferenceCoordinator {
  private var owner: Any? = null
  @Synchronized fun acquire(token: Any): Boolean {
    if (owner != null) return false
    owner = token
    return true
  }
  @Synchronized fun release(token: Any) { if (owner === token) owner = null }
  @Synchronized fun busy(): Boolean = owner != null

  fun backend(context: Context): InferenceBackend? = try {
    Class.forName("org.modelcommons.host.NativeInferenceHost")
      .getConstructor(Context::class.java).newInstance(context) as InferenceBackend
  } catch (_: ReflectiveOperationException) { null }
}

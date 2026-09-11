package expo.modules.modelcommonsnative.service

import android.app.Service
import android.content.Intent
import android.os.Binder
import android.os.IBinder
import android.os.SystemClock
import expo.modules.modelcommonsnative.ipc.*
import expo.modules.modelcommonsnative.security.CallerAuthorizer
import expo.modules.modelcommonsnative.security.CallerIdentity
import expo.modules.modelcommonsnative.security.CallerAuthorizer.Companion.SCOPE_INFERENCE
import expo.modules.modelcommonsnative.security.CallerAuthorizer.Companion.SCOPE_METADATA
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.*
import java.util.concurrent.atomic.AtomicBoolean

/** API 2: ordinary bound service, no Activity, JS runtime, sticky start or foreground-service claim. */
class ModelCommonsService : Service() {
  private lateinit var authorizer: CallerAuthorizer
  private var host: InferenceBackend? = null
  private val sessions = ConcurrentHashMap<String, Session>()
  private val lifecycle = Any()
  private val workers = ThreadPoolExecutor(1, 1, 0, TimeUnit.SECONDS, ArrayBlockingQueue(1),
    ThreadFactory { Thread(it, "ModelCommonsInference").apply { isDaemon = true } })
  private val clock = Executors.newSingleThreadScheduledExecutor()

  private val binder = object : IModelCommonsService.Stub() {
    override fun getApiVersion(): Int { metadata(); return API_VERSION }
    override fun getProtocolVersion(): String { metadata(); return PROTOCOL_VERSION }
    override fun getCapabilities(): CapabilitiesParcel {
      metadata()
      val ready = host?.available() == true
      return CapabilitiesParcel(ready, if (ready) "READY" else RUNTIME_STATE_NOT_READY, true, true, MAX_REQUEST_BYTES, MAX_EVENT_BYTES)
    }
    override fun listModels(cursor: String?, limit: Int): ModelPageParcel {
      metadata()
      if (cursor != null || limit < 1 || host?.available() != true) return ModelPageParcel(emptyList(), null)
      return ModelPageParcel(host!!.models().take(2), null)
    }
    override fun createSession(modelId: String, profileId: String, protocolVersion: String, contextSize: Int, maxOutputTokens: Int, lifetime: IBinder): SessionResultParcel {
      val identity = authorizer.requireAuthorized(Binder.getCallingUid(), SCOPE_INFERENCE)
      if (protocolVersion != PROTOCOL_VERSION) return SessionResultParcel(false, code = "PROTOCOL_VERSION_UNSUPPORTED")
      if (!validIdentifier(modelId) || profileId != "safe" || contextSize != 1024 || maxOutputTokens != 128)
        return SessionResultParcel(false, code = "FEATURE_UNSUPPORTED")
      if (host?.available() != true) return SessionResultParcel(false, code = "RUNTIME_UNAVAILABLE")
      synchronized(lifecycle) {
        if (sessions.size >= 16 || sessions.values.count { it.identity.uid == identity.uid } >= 4)
          return SessionResultParcel(false, code = "RUNTIME_UNAVAILABLE", message = "Session capacity reached.")
        val id = UUID.randomUUID().toString()
        val session = Session(identity, modelId, lifetime)
        session.death = IBinder.DeathRecipient { close(id, session) }
        sessions[id] = session
        try { lifetime.linkToDeath(session.death, 0) } catch (_: Exception) { close(id, session); return SessionResultParcel(false, code = "TRANSPORT_UNAVAILABLE") }
        if (!lifetime.isBinderAlive || session.closed.get()) { close(id, session); return SessionResultParcel(false, code = "TRANSPORT_UNAVAILABLE") }
        return SessionResultParcel(true, id)
      }
    }
    override fun generate(sessionId: String, request: GenerateRequestParcel, callback: IModelCommonsCallback): OperationResultParcel {
      val session = owned(sessionId) ?: return failure("CLIENT_NOT_AUTHORIZED")
      if (request.protocolVersion != PROTOCOL_VERSION) return failure("PROTOCOL_VERSION_UNSUPPORTED")
      if (!validIdentifier(request.requestId) || request.requestJson.toByteArray(Charsets.UTF_8).size > MAX_REQUEST_BYTES)
        return failure("FEATURE_UNSUPPORTED")
      synchronized(session) {
        if (session.closed.get() || session.operation != null || session.used.size >= 32 || request.requestId in session.used)
          return failure("RUNTIME_UNAVAILABLE")
        val operation = Operation(request.requestId, callback)
        if (!InferenceCoordinator.acquire(operation)) return failure("RUNTIME_UNAVAILABLE")
        session.used.add(request.requestId)
        session.operation = operation
        operation.death = IBinder.DeathRecipient { operation.stop() }
        try {
          callback.asBinder().linkToDeath(operation.death, 0)
          workers.execute { execute(sessionId, session, operation, request.requestJson) }
        } catch (_: Exception) {
          try { callback.asBinder().unlinkToDeath(operation.death, 0) } catch (_: Exception) {}
          session.operation = null
          InferenceCoordinator.release(operation)
          return failure("TRANSPORT_UNAVAILABLE")
        }
        return OperationResultParcel(true)
      }
    }
    override fun acknowledge(sessionId: String, requestId: String, sequence: Long): OperationResultParcel {
      val op = owned(sessionId)?.operation ?: return failure("CLIENT_NOT_AUTHORIZED")
      synchronized(op) {
        if (op.id != requestId || sequence != op.awaiting || op.acknowledged) return failure("INTEGRITY_FAILED")
        op.acknowledged = true; op.credit.release()
      }
      return OperationResultParcel(true)
    }
    override fun cancel(sessionId: String, requestId: String): OperationResultParcel {
      val session = owned(sessionId) ?: return failure("CLIENT_NOT_AUTHORIZED")
      session.operation?.takeIf { it.id == requestId }?.stop()
      return OperationResultParcel(true)
    }
    override fun releaseSession(sessionId: String): OperationResultParcel {
      val session = owned(sessionId) ?: return failure("CLIENT_NOT_AUTHORIZED")
      close(sessionId, session)
      return OperationResultParcel(true) // accepted; isSessionDrained reports actual native destruction
    }
    override fun isSessionDrained(sessionId: String): Boolean {
      val session = sessions[sessionId] ?: return true
      if (session.identity.uid != Binder.getCallingUid()) throw SecurityException("CLIENT_NOT_AUTHORIZED")
      return session.operation == null
    }
  }

  override fun onCreate() {
    super.onCreate()
    authorizer = CallerAuthorizer(applicationContext)
    host = InferenceCoordinator.backend(applicationContext)
    instances.add(this)
    clock.scheduleAtFixedRate({
      sessions.forEach { (id, s) ->
        val op = s.operation
        if (!authorized(s) || !s.lifetime.isBinderAlive || (op == null && SystemClock.elapsedRealtime() - s.touched > 300000)) close(id, s)
        else if (op != null && SystemClock.elapsedRealtime() - op.created > 120000) op.stop()
      }
    }, 1, 1, TimeUnit.SECONDS)
  }
  override fun onBind(intent: Intent?): IBinder? = if (intent?.action == ACTION_BIND) binder else null
  override fun onDestroy() {
    instances.remove(this)
    sessions.forEach { (id, s) -> close(id, s) }
    clock.shutdownNow()
    workers.shutdown() // Keep the process gate until cooperative JNI cleanup has actually returned.
    super.onDestroy()
  }
  private fun metadata() { authorizer.requireAuthorized(Binder.getCallingUid(), SCOPE_METADATA) }
  private fun owned(id: String): Session? {
    val identity = authorizer.requireAuthorized(Binder.getCallingUid(), SCOPE_INFERENCE)
    return sessions[id]?.takeIf { it.identity == identity }?.also { it.touched = SystemClock.elapsedRealtime() }
  }
  private fun authorized(s: Session): Boolean = try {
    authorizer.requireAuthorized(s.identity.uid, SCOPE_INFERENCE, false) == s.identity
  } catch (_: Exception) { false }
  private fun close(id: String, s: Session) {
    synchronized(s) {
      s.closed.set(true); s.operation?.stop()
      try { s.lifetime.unlinkToDeath(s.death, 0) } catch (_: Exception) {}
      if (s.operation == null) sessions.remove(id, s)
    }
  }
  private fun execute(id: String, s: Session, op: Operation, requestJson: String) {
    val diagnostics = JSONObject().put("offline", true).put("resolvedModelId", s.modelId)
      .put("runtimeId", "modelcommons.android.cpu").put("runtimeVersion", "0.1.0").put("profileId", "safe")
    var started = false
    try {
      started = true
      emit(id, s, op, JSONObject().put("type", "response.started").put("createdAt", System.currentTimeMillis())
        .put("modelId", s.modelId).put("diagnostics", diagnostics))
      if (op.cancelled.get()) throw HostFailure("USER_CANCELLED")
      val json = try { StrictRequestJson.parse(requestJson) } catch (_: Exception) { throw HostFailure("FEATURE_UNSUPPORTED") }
      if (json.has("id") && json.getString("id") != op.id) throw HostFailure("FEATURE_UNSUPPORTED")
      if (!authorized(s)) throw HostFailure("CLIENT_NOT_AUTHORIZED")
      val result = (host ?: throw HostFailure("RUNTIME_UNAVAILABLE")).run(s.modelId, json, op.cancelled) { text ->
        emit(id, s, op, JSONObject().put("type", "text.delta").put("delta", text))
      }
      if (op.cancelled.get()) throw HostFailure("USER_CANCELLED")
      val response = JSONObject().put("id", op.id).put("createdAt", System.currentTimeMillis()).put("modelId", s.modelId)
        .put("content", JSONArray().put(JSONObject().put("type", "text").put("text", result.getString("text"))))
        .put("stopReason", result.getString("stopReason"))
        .put("usage", JSONObject().put("inputTokens", result.getInt("inputTokens")).put("outputTokens", result.getInt("outputTokens"))
          .put("totalTokens", result.getInt("inputTokens") + result.getInt("outputTokens")))
        .put("diagnostics", diagnostics.put("artifactSha256", result.getString("artifactSha256")).put("artifactBytes", result.getLong("artifactBytes")))
      emit(id, s, op, JSONObject().put("type", "response.completed").put("response", response), terminal = true)
    } catch (error: Throwable) {
      if (started && !op.terminal) {
        val code = if (error is LinkageError) "RUNTIME_UNAVAILABLE"
          else (error as? HostFailure)?.code ?: "RUNTIME_INITIALIZATION_FAILED"
        try { emit(id, s, op, JSONObject().put("type", "response.failed").put("error", JSONObject()
          .put("code", code).put("message", "The Hub could not complete this request.").put("retryable", code != "FEATURE_UNSUPPORTED")), terminal = true) }
        catch (_: Exception) {} // Dead/revoked/non-consuming clients receive no further content.
      }
    } finally {
      try { op.callback.asBinder().unlinkToDeath(op.death, 0) } catch (_: Exception) {}
      synchronized(s) {
        s.operation = null; s.touched = SystemClock.elapsedRealtime()
        InferenceCoordinator.release(op)
        if (s.closed.get()) sessions.remove(id, s)
      }
    }
  }
  private fun emit(id: String, s: Session, op: Operation, event: JSONObject, terminal: Boolean = false) {
    if (s.closed.get() || !authorized(s)) throw HostFailure("CLIENT_NOT_AUTHORIZED")
    if (!terminal && op.cancelled.get() && op.sequence > 0) throw HostFailure("USER_CANCELLED")
    if (event.getString("type") != "response.completed") event.put("responseId", op.id)
    val json = event.toString()
    if (json.toByteArray(Charsets.UTF_8).size > MAX_EVENT_BYTES) throw HostFailure("RUNTIME_INITIALIZATION_FAILED")
    val sequence: Long
    synchronized(op) {
      sequence = op.sequence++
      op.awaiting = sequence; op.acknowledged = false; op.credit.drainPermits()
    }
    val sent = try { deliveries.submit {
      if (!s.closed.get() && authorized(s) && op.awaiting == sequence)
        op.callback.onEvent(StreamEventParcel(id, op.id, sequence, json))
    } } catch (_: RejectedExecutionException) { throw HostFailure("TRANSPORT_UNAVAILABLE") }
    if (terminal) op.terminal = true
    val deadline = SystemClock.elapsedRealtime() + 5000
    try {
      // Window = one event. JS iterator consumption returns credit; oneway is not flow control.
      while (SystemClock.elapsedRealtime() < deadline) {
        if (op.credit.tryAcquire(100, TimeUnit.MILLISECONDS) && op.acknowledged) return
        if (s.closed.get() || !op.callback.asBinder().isBinderAlive) throw HostFailure("TRANSPORT_UNAVAILABLE")
        if (!terminal && sequence > 0 && op.cancelled.get()) throw HostFailure("USER_CANCELLED")
        if (sent.isDone) sent.get()
      }
      op.stop()
      throw HostFailure("TRANSPORT_UNAVAILABLE")
    } finally { sent.cancel(true); deliveries.purge() }
  }
  private class Session(val identity: CallerIdentity, val modelId: String, val lifetime: IBinder) {
    lateinit var death: IBinder.DeathRecipient
    val closed = AtomicBoolean(false)
    val used = HashSet<String>()
    @Volatile var touched = SystemClock.elapsedRealtime()
    @Volatile var operation: Operation? = null
  }
  private class Operation(val id: String, val callback: IModelCommonsCallback) {
    lateinit var death: IBinder.DeathRecipient
    val cancelled = AtomicBoolean(false)
    val credit = Semaphore(0)
    val created = SystemClock.elapsedRealtime()
    var sequence = 0L
    @Volatile var awaiting = -1L
    @Volatile var acknowledged = false
    @Volatile var terminal = false
    fun stop() { cancelled.set(true); credit.release() }
  }
  companion object {
    const val ACTION_BIND = "org.modelcommons.action.BIND"
    const val SERVICE_CLASS = "expo.modules.modelcommonsnative.service.ModelCommonsService"
    const val API_VERSION = 2
    const val PROTOCOL_VERSION = "0.1.0"
    const val RUNTIME_STATE_NOT_READY = "RUNTIME_NOT_READY"
    const val MAX_REQUEST_BYTES = 48 * 1024
    const val MAX_EVENT_BYTES = 16 * 1024
    const val MAX_IDENTIFIER_BYTES = 256
    private val instances = CopyOnWriteArraySet<ModelCommonsService>()
    private val deliveries = ThreadPoolExecutor(1, 1, 0, TimeUnit.SECONDS, ArrayBlockingQueue(1),
      ThreadFactory { Thread(it, "ModelCommonsCallbacks").apply { isDaemon = true } })
    fun revokeUid(uid: Int) { instances.forEach { service -> service.sessions.forEach { (id, s) -> if (s.identity.uid == uid) service.close(id, s) } } }
    private fun validIdentifier(value: String) = value.isNotBlank() && value.toByteArray(Charsets.UTF_8).size <= MAX_IDENTIFIER_BYTES
    private fun failure(code: String) = OperationResultParcel(false, code, "The Hub request was not accepted.")
  }
}

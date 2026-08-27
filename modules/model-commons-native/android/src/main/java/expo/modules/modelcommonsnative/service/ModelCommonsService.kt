package expo.modules.modelcommonsnative.service

import android.app.Service
import android.content.Intent
import android.os.Binder
import android.os.IBinder
import android.os.RemoteException
import expo.modules.modelcommonsnative.ipc.CapabilitiesParcel
import expo.modules.modelcommonsnative.ipc.GenerateRequestParcel
import expo.modules.modelcommonsnative.ipc.IModelCommonsCallback
import expo.modules.modelcommonsnative.ipc.IModelCommonsService
import expo.modules.modelcommonsnative.ipc.ModelPageParcel
import expo.modules.modelcommonsnative.ipc.OperationResultParcel
import expo.modules.modelcommonsnative.ipc.SessionResultParcel
import expo.modules.modelcommonsnative.ipc.StreamEventParcel
import expo.modules.modelcommonsnative.security.CallerAuthorizer
import expo.modules.modelcommonsnative.security.CallerAuthorizer.Companion.SCOPE_INFERENCE
import expo.modules.modelcommonsnative.security.CallerAuthorizer.Companion.SCOPE_METADATA
import expo.modules.modelcommonsnative.storage.HubStateStore
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Real, versioned Binder boundary. The llama.rn engine is JSI-owned, so this iteration
 * intentionally reports RUNTIME_NOT_READY instead of pretending the Service can invoke it.
 */
class ModelCommonsService : Service() {
  private lateinit var authorizer: CallerAuthorizer
  private lateinit var hubState: HubStateStore
  private val sessions = ConcurrentHashMap<String, SessionRecord>()
  private val sessionLifecycleLock = Any()
  private val executor = Executors.newSingleThreadExecutor { runnable ->
    Thread(runnable, "ModelCommonsBinderCallbacks").apply { isDaemon = true }
  }

  private val binder = object : IModelCommonsService.Stub() {
    override fun getApiVersion(): Int {
      val callingUid = Binder.getCallingUid()
      authorizer.requireAuthorized(callingUid, SCOPE_METADATA)
      return API_VERSION
    }

    override fun getProtocolVersion(): String {
      val callingUid = Binder.getCallingUid()
      authorizer.requireAuthorized(callingUid, SCOPE_METADATA)
      return PROTOCOL_VERSION
    }

    override fun getCapabilities(): CapabilitiesParcel {
      val callingUid = Binder.getCallingUid()
      authorizer.requireAuthorized(callingUid, SCOPE_METADATA)
      return CapabilitiesParcel(
        centralizedInference = false,
        runtimeState = RUNTIME_STATE_NOT_READY,
        streamingContract = true,
        cancellation = true,
        maxRequestBytes = MAX_REQUEST_BYTES,
        maxEventBytes = MAX_EVENT_BYTES,
      )
    }

    override fun listModels(cursor: String?, limit: Int): ModelPageParcel {
      val callingUid = Binder.getCallingUid()
      authorizer.requireAuthorized(callingUid, SCOPE_METADATA)
      if (cursor != null && (!validIdentifier(cursor) || cursor.toIntOrNull() == null)) {
        return ModelPageParcel(emptyList(), null)
      }
      return hubState.page(cursor, limit)
    }

    override fun createSession(modelId: String, profileId: String): SessionResultParcel {
      val callingUid = Binder.getCallingUid()
      authorizer.requireAuthorized(callingUid, SCOPE_INFERENCE)
      if (!validIdentifier(modelId) || !validIdentifier(profileId)) {
        return SessionResultParcel(false, code = "INVALID_REQUEST", message = "Invalid model/profile identifier.")
      }
      if (!hubState.hasReadyModel(modelId)) {
        return SessionResultParcel(false, code = "MODEL_NOT_READY", message = "The requested model is not READY.")
      }
      val sessionId = UUID.randomUUID().toString()
      synchronized(sessionLifecycleLock) {
        val confirmedCaller = authorizer.requireAuthorized(callingUid, SCOPE_INFERENCE)
        if (sessions.values.count { it.ownerUid == callingUid } >= MAX_SESSIONS_PER_UID) {
          return SessionResultParcel(false, code = "RESOURCE_LIMIT", message = "Caller session limit reached.")
        }
        sessions[sessionId] = SessionRecord(
          ownerUid = callingUid,
          ownerPackages = confirmedCaller.packages,
          modelId = modelId,
          profileId = profileId,
        )
      }
      return SessionResultParcel(true, sessionId = sessionId)
    }

    override fun generate(
      sessionId: String,
      request: GenerateRequestParcel,
      callback: IModelCommonsCallback,
    ): OperationResultParcel {
      val callingUid = Binder.getCallingUid()
      val caller = authorizer.requireAuthorized(callingUid, SCOPE_INFERENCE)
      if (!validIdentifier(sessionId)) {
        return OperationResultParcel(false, "INVALID_REQUEST", "Invalid session identifier.")
      }
      val session = ownedSession(sessionId, callingUid, caller.packages)
        ?: return OperationResultParcel(false, "SESSION_NOT_FOUND", "Session is absent or owned by another UID.")
      if (request.protocolVersion != PROTOCOL_VERSION) {
        return OperationResultParcel(false, "PROTOCOL_VERSION_UNSUPPORTED", "Unsupported request protocol version.")
      }
      if (!validIdentifier(request.requestId)) {
        return OperationResultParcel(false, "INVALID_REQUEST", "Invalid request identifier.")
      }
      val payloadBytes = request.requestJson.toByteArray(Charsets.UTF_8).size
      if (payloadBytes > MAX_REQUEST_BYTES) {
        return OperationResultParcel(false, "TRANSACTION_TOO_LARGE", "Request exceeds $MAX_REQUEST_BYTES bytes.")
      }
      try {
        JSONObject(request.requestJson)
      } catch (_: Exception) {
        return OperationResultParcel(false, "INVALID_REQUEST", "requestJson must contain one JSON object.")
      }
      val operation = OperationRecord(callback)
      synchronized(session.operations) {
        if (session.closed.get()) {
          return OperationResultParcel(false, "SESSION_NOT_FOUND", "Session has been released or revoked.")
        }
        if (session.operations.size >= MAX_INFLIGHT_PER_SESSION) {
          return OperationResultParcel(false, "RESOURCE_LIMIT", "Only one request may be active per session.")
        }
        if (session.operations.putIfAbsent(request.requestId, operation) != null) {
          return OperationResultParcel(false, "DUPLICATE_REQUEST", "Request identifier is already active.")
        }
      }
      val deathRecipient = IBinder.DeathRecipient {
        operation.cancelled.set(true)
        session.operations.remove(request.requestId, operation)
      }
      operation.deathRecipient = deathRecipient
      try {
        callback.asBinder().linkToDeath(deathRecipient, 0)
      } catch (_: RemoteException) {
        session.operations.remove(request.requestId, operation)
        return OperationResultParcel(false, "TRANSPORT_UNAVAILABLE", "Callback binder is already dead.")
      }

      try {
        executor.execute {
          val startedJson = JSONObject()
            .put("type", "response.started")
            .put("responseId", request.requestId)
            .put("createdAt", System.currentTimeMillis())
            .put("modelId", session.modelId)
            .put(
              "diagnostics",
              JSONObject()
                .put("offline", true)
                .put("resolvedModelId", session.modelId)
                .put("runtimeId", "android-binder-scaffold")
                .put("profileId", session.profileId),
            )
            .toString()
          sendEvent(operation.callback, sessionId, request.requestId, 0, startedJson)
          val code = if (operation.cancelled.get()) "USER_CANCELLED" else ERROR_RUNTIME_UNAVAILABLE
          val message = if (operation.cancelled.get()) {
            "The Binder request was cancelled."
          } else {
            "RUNTIME_NOT_READY: the Android Binder contract is active, but llama.rn is owned by the Hub React Native JSI runtime. " +
              "A cold-start/headless native inference broker has not been implemented."
          }
          val eventJson = JSONObject()
            .put("type", "response.failed")
            .put("responseId", request.requestId)
            .put(
              "error",
              JSONObject()
                .put("code", code)
                .put("message", message)
                .put("retryable", code == ERROR_RUNTIME_UNAVAILABLE),
            )
            .toString()
          sendEvent(operation.callback, sessionId, request.requestId, 1, eventJson)
          finishOperation(session, request.requestId, operation)
        }
      } catch (_: RejectedExecutionException) {
        finishOperation(session, request.requestId, operation)
        return OperationResultParcel(false, "TRANSPORT_UNAVAILABLE", "Service callback executor is unavailable.")
      }
      return OperationResultParcel(true)
    }

    override fun cancel(sessionId: String, requestId: String): OperationResultParcel {
      val callingUid = Binder.getCallingUid()
      val caller = authorizer.requireAuthorized(callingUid, SCOPE_INFERENCE)
      if (!validIdentifier(sessionId) || !validIdentifier(requestId)) {
        return OperationResultParcel(false, "INVALID_REQUEST", "Invalid session/request identifier.")
      }
      val session = ownedSession(sessionId, callingUid, caller.packages)
        ?: return OperationResultParcel(false, "SESSION_NOT_FOUND", "Session is absent or owned by another UID.")
      val operation = session.operations[requestId]
        ?: return OperationResultParcel(false, "REQUEST_NOT_FOUND", "Request is not active.")
      operation.cancelled.set(true)
      return OperationResultParcel(true)
    }

    override fun releaseSession(sessionId: String): OperationResultParcel {
      val callingUid = Binder.getCallingUid()
      val caller = authorizer.requireAuthorized(callingUid, SCOPE_INFERENCE)
      if (!validIdentifier(sessionId)) {
        return OperationResultParcel(false, "INVALID_REQUEST", "Invalid session identifier.")
      }
      val session = ownedSession(sessionId, callingUid, caller.packages)
        ?: return OperationResultParcel(false, "SESSION_NOT_FOUND", "Session is absent or owned by another UID.")
      if (!sessions.remove(sessionId, session)) {
        return OperationResultParcel(false, "SESSION_NOT_FOUND", "Session was already released.")
      }
      closeSession(session)
      return OperationResultParcel(true)
    }
  }

  override fun onCreate() {
    super.onCreate()
    authorizer = CallerAuthorizer(applicationContext)
    hubState = HubStateStore(applicationContext)
    instances.add(this)
  }

  override fun onBind(intent: Intent?): IBinder? {
    if (intent?.action != ACTION_BIND) return null
    return binder
  }

  override fun onDestroy() {
    instances.remove(this)
    sessions.values.forEach(::closeSession)
    sessions.clear()
    executor.shutdownNow()
    super.onDestroy()
  }

  private fun ownedSession(sessionId: String, callingUid: Int, callingPackages: List<String>): SessionRecord? =
    sessions[sessionId]?.takeIf {
      it.ownerUid == callingUid && it.ownerPackages == callingPackages
    }

  private fun finishOperation(session: SessionRecord, requestId: String, operation: OperationRecord) {
    session.operations.remove(requestId, operation)
    unlinkCallbackDeath(operation)
  }

  private fun sendEvent(
    callback: IModelCommonsCallback,
    sessionId: String,
    requestId: String,
    sequence: Long,
    eventJson: String,
  ) {
    if (eventJson.toByteArray(Charsets.UTF_8).size > MAX_EVENT_BYTES) return
    try {
      callback.onEvent(StreamEventParcel(sessionId, requestId, sequence, eventJson))
    } catch (_: RemoteException) {
      // Binder death cleanup owns cancellation; never retry unbounded callback payloads.
    }
  }

  private fun closeSession(session: SessionRecord) {
    synchronized(session.operations) {
      session.closed.set(true)
      session.operations.values.forEach { operation ->
        operation.cancelled.set(true)
        unlinkCallbackDeath(operation)
      }
    }
  }

  private fun dropSessionsForUid(uid: Int) {
    synchronized(sessionLifecycleLock) {
      sessions.entries.forEach { (sessionId, session) ->
        if (session.ownerUid == uid && sessions.remove(sessionId, session)) {
          closeSession(session)
        }
      }
    }
  }

  private fun unlinkCallbackDeath(operation: OperationRecord) {
    val recipient = operation.deathRecipient ?: return
    operation.deathRecipient = null
    try {
      operation.callback.asBinder().unlinkToDeath(recipient, 0)
    } catch (_: Exception) {
      // Callback already died or was unlinked.
    }
  }

  private fun validIdentifier(value: String): Boolean =
    value.isNotBlank() && value.toByteArray(Charsets.UTF_8).size in 1..MAX_IDENTIFIER_BYTES

  private data class SessionRecord(
    val ownerUid: Int,
    val ownerPackages: List<String>,
    val modelId: String,
    val profileId: String,
    val operations: ConcurrentHashMap<String, OperationRecord> = ConcurrentHashMap(),
    val closed: AtomicBoolean = AtomicBoolean(false),
  )

  private class OperationRecord(val callback: IModelCommonsCallback) {
    val cancelled = AtomicBoolean(false)
    @Volatile var deathRecipient: IBinder.DeathRecipient? = null
  }

  companion object {
    const val ACTION_BIND = "org.modelcommons.action.BIND"
    const val SERVICE_CLASS = "expo.modules.modelcommonsnative.service.ModelCommonsService"
    const val PROTOCOL_VERSION = "0.1.0"
    const val API_VERSION = 1
    const val MAX_REQUEST_BYTES = 48 * 1024
    const val MAX_EVENT_BYTES = 16 * 1024
    const val MAX_IDENTIFIER_BYTES = 256
    private const val MAX_SESSIONS_PER_UID = 4
    private const val MAX_INFLIGHT_PER_SESSION = 1
    private const val RUNTIME_STATE_NOT_READY = "RUNTIME_NOT_READY"
    private const val ERROR_RUNTIME_UNAVAILABLE = "RUNTIME_UNAVAILABLE"
    private val instances = CopyOnWriteArraySet<ModelCommonsService>()

    fun revokeUid(uid: Int) {
      instances.forEach { service -> service.dropSessionsForUid(uid) }
    }
  }
}

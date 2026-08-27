package expo.modules.modelcommonsnative.client

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import expo.modules.modelcommonsnative.ipc.GenerateRequestParcel
import expo.modules.modelcommonsnative.ipc.IModelCommonsCallback
import expo.modules.modelcommonsnative.ipc.IModelCommonsService
import expo.modules.modelcommonsnative.ipc.OperationResultParcel
import expo.modules.modelcommonsnative.ipc.StreamEventParcel
import expo.modules.modelcommonsnative.service.ModelCommonsService
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap

class AndroidHubClient(
  private val context: Context,
  private val emitEvent: (Map<String, Any?>) -> Unit,
) {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val sessions = ConcurrentHashMap<String, SessionIdentity>()
  private val operations = ConcurrentHashMap<OperationKey, OperationState>()
  @Volatile private var service: IModelCommonsService? = null
  @Volatile private var serviceBinder: IBinder? = null
  private var connection: ServiceConnection? = null
  private var connectedPackage: String? = null
  private var pendingConnect: ((Result<Map<String, Any?>>) -> Unit)? = null
  private var activeDeathRecipient: IBinder.DeathRecipient? = null
  @Volatile private var connectionGeneration = 0L
  @Volatile private var intentionalDisconnect = false

  private val callback = object : IModelCommonsCallback.Stub() {
    override fun onEvent(event: StreamEventParcel) {
      val key = OperationKey(event.sessionId, event.requestId)
      val state = operations[key] ?: return
      synchronized(state) {
        if (state.terminal) return
        val validated = try {
          validateStreamEvent(event, key, state)
        } catch (_: Exception) {
          failOperationLocked(
            key,
            state,
            "INTEGRITY_FAILED",
            "The Hub emitted an invalid canonical stream event.",
          )
          return
        }
        val terminal = validated.type == "response.completed" || validated.type == "response.failed"
        if (terminal) {
          state.terminal = true
          operations.remove(key, state)
        }
        if (validated.type == "response.started") state.startedAccepted = true
        state.nextSequence = event.sequence + 1L
        mainHandler.post {
          emitEvent(
            mapOf(
              "sessionId" to event.sessionId,
              "requestId" to event.requestId,
              "sequence" to event.sequence.toDouble(),
              "eventJson" to event.eventJson,
            )
          )
        }
      }
    }
  }

  val isConnected: Boolean
    get() = serviceBinder?.isBinderAlive == true && service != null

  @Synchronized
  fun connect(packageName: String, result: (Result<Map<String, Any?>>) -> Unit) {
    require(PACKAGE_NAME.matches(packageName)) { "Invalid Hub package name." }
    if (isConnected && connectedPackage == packageName) {
      result(runCatching { readServiceInfo(requireService()) })
      return
    }
    if (pendingConnect != null) {
      result(Result.failure(IllegalStateException("A Hub connection attempt is already in progress.")))
      return
    }
    close()
    intentionalDisconnect = false
    val generation = connectionGeneration
    pendingConnect = result
    connectedPackage = packageName
    val component = ComponentName(packageName, ModelCommonsService.SERVICE_CLASS)
    val intent = Intent(ModelCommonsService.ACTION_BIND).setComponent(component)
    val newConnection = object : ServiceConnection {
      override fun onServiceConnected(name: ComponentName, binder: IBinder) {
        handleServiceConnected(generation, binder)
      }

      override fun onServiceDisconnected(name: ComponentName) {
        handleTransportDeath(generation, null, "Hub service disconnected.")
      }

      override fun onBindingDied(name: ComponentName) {
        handleTransportDeath(generation, null, "Hub binding died.")
      }

      override fun onNullBinding(name: ComponentName) {
        handleNullBinding(generation)
      }
    }
    connection = newConnection
    val bound = try {
      context.bindService(intent, newConnection, Context.BIND_AUTO_CREATE)
    } catch (error: Throwable) {
      pendingConnect = null
      connection = null
      connectedPackage = null
      result(Result.failure(error))
      false
    }
    if (!bound && pendingConnect != null) {
      pendingConnect?.invoke(Result.failure(IllegalStateException("ModelCommons Hub service was not found or enabled.")))
      pendingConnect = null
      connection = null
      connectedPackage = null
    }
  }

  @Synchronized
  fun close() {
    connectionGeneration = if (connectionGeneration == Long.MAX_VALUE) 1L else connectionGeneration + 1L
    intentionalDisconnect = true
    val remote = service
    if (remote != null) {
      sessions.keys.forEach { sessionId ->
        try {
          remote.releaseSession(sessionId)
        } catch (_: Exception) {
          // Binder may already be dead or authorization may have been revoked.
        }
      }
    }
    failOperations(
      code = "USER_CANCELLED",
      message = "The Hub connection was closed before the request completed.",
    )
    sessions.clear()
    val recipient = activeDeathRecipient
    serviceBinder?.let { binder ->
      try {
        if (recipient != null) binder.unlinkToDeath(recipient, 0)
      } catch (_: Exception) {
        // Already unlinked/dead.
      }
    }
    activeDeathRecipient = null
    connection?.let { activeConnection ->
      try {
        context.unbindService(activeConnection)
      } catch (_: IllegalArgumentException) {
        // Not bound.
      }
    }
    pendingConnect?.invoke(Result.failure(IllegalStateException("Hub connection was closed.")))
    pendingConnect = null
    service = null
    serviceBinder = null
    connection = null
    connectedPackage = null
  }

  fun listModels(cursor: String?, limit: Int): Map<String, Any?> {
    val snapshot = requireConnectionSnapshot()
    val page = snapshot.remote.listModels(cursor, limit)
    if (!isConnectionCurrent(snapshot)) throw staleConnectionError()
    return mapOf(
      "models" to page.models.map { model ->
        mapOf(
          "id" to model.id,
          "revision" to model.revision,
          "displayName" to model.displayName,
          "state" to model.state,
          "capabilities" to model.capabilities,
        )
      },
      "nextCursor" to page.nextCursor,
    )
  }

  fun createSession(modelId: String, profileId: String): Map<String, Any?> {
    if (!validIdentifier(modelId) || !validIdentifier(profileId)) {
      return invalidOperationMap("Invalid model/profile identifier.")
    }
    val snapshot = requireConnectionSnapshot()
    val result = snapshot.remote.createSession(modelId, profileId)
    val sessionId = result.sessionId?.takeIf { result.ok && validIdentifier(it) }
    val invalidSuccess = result.ok && sessionId == null
    val current = synchronized(this) {
      val valid = isConnectionCurrentLocked(snapshot)
      if (valid && sessionId != null) sessions[sessionId] = SessionIdentity(modelId, profileId)
      valid
    }
    if (!current) {
      if (sessionId != null) {
        try {
          snapshot.remote.releaseSession(sessionId)
        } catch (_: Exception) {
          // The captured connection is already gone; its service owns death cleanup.
        }
      }
      return staleOperationMap()
    }
    if (invalidSuccess) {
      return mapOf(
        "ok" to false,
        "sessionId" to null,
        "code" to "INTEGRITY_FAILED",
        "message" to "The Hub returned an invalid session identifier.",
      )
    }
    return mapOf(
      "ok" to result.ok,
      "sessionId" to sessionId,
      "code" to result.code,
      "message" to result.message,
    )
  }

  fun generate(sessionId: String, requestId: String, requestJson: String): Map<String, Any?> {
    if (!validIdentifier(sessionId) || !validIdentifier(requestId)) {
      return invalidOperationMap("Invalid session/request identifier.")
    }
    if (requestJson.toByteArray(Charsets.UTF_8).size > ModelCommonsService.MAX_REQUEST_BYTES) {
      return mapOf(
        "ok" to false,
        "code" to "TRANSACTION_TOO_LARGE",
        "message" to "Request exceeds ${ModelCommonsService.MAX_REQUEST_BYTES} bytes.",
      )
    }
    lateinit var snapshot: ConnectionSnapshot
    lateinit var key: OperationKey
    lateinit var state: OperationState
    synchronized(this) {
      snapshot = requireConnectionSnapshotLocked()
      val identity = sessions[sessionId] ?: return mapOf(
        "ok" to false,
        "code" to "SESSION_NOT_FOUND",
        "message" to "The session is not owned by this Hub connection.",
      )
      key = OperationKey(sessionId, requestId)
      state = OperationState(identity.modelId, identity.profileId)
      if (operations.putIfAbsent(key, state) != null) {
        return mapOf(
          "ok" to false,
          "code" to "DUPLICATE_REQUEST",
          "message" to "The request identifier is already active.",
        )
      }
    }
    return try {
      val result = snapshot.remote.generate(
        sessionId,
        GenerateRequestParcel(ModelCommonsService.PROTOCOL_VERSION, requestId, requestJson),
        callback,
      )
      if (!result.ok) {
        synchronized(state) {
          if (!state.terminal) {
            if (state.startedAccepted) {
              failOperationLocked(
                key,
                state,
                "INTEGRITY_FAILED",
                "The Hub rejected a request after starting its stream.",
              )
            } else {
              state.terminal = true
              operations.remove(key, state)
            }
          }
        }
      }
      if (!isConnectionCurrent(snapshot)) {
        synchronized(state) {
          failOperationLocked(
            key,
            state,
            "TRANSPORT_UNAVAILABLE",
            "The Hub connection changed before the request was accepted.",
          )
        }
        staleOperationMap()
      } else {
        operationMap(result)
      }
    } catch (error: Throwable) {
      synchronized(state) {
        if (!state.terminal) {
          if (state.startedAccepted) {
            failOperationLocked(
              key,
              state,
              "TRANSPORT_UNAVAILABLE",
              "The Hub transport failed after starting the request stream.",
            )
          } else {
            state.terminal = true
            operations.remove(key, state)
          }
        }
      }
      throw error
    }
  }

  fun cancel(sessionId: String, requestId: String): Map<String, Any?> {
    if (!validIdentifier(sessionId) || !validIdentifier(requestId)) {
      return invalidOperationMap("Invalid session/request identifier.")
    }
    val snapshot = requireConnectionSnapshot()
    val result = snapshot.remote.cancel(sessionId, requestId)
    return if (isConnectionCurrent(snapshot)) operationMap(result) else staleOperationMap()
  }

  fun releaseSession(sessionId: String): Map<String, Any?> {
    if (!validIdentifier(sessionId)) return invalidOperationMap("Invalid session identifier.")
    val snapshot = requireConnectionSnapshot()
    val result = snapshot.remote.releaseSession(sessionId)
    val current = synchronized(this) {
      val valid = isConnectionCurrentLocked(snapshot)
      if (valid && result.ok) {
        sessions.remove(sessionId)
        failOperations(
          code = "USER_CANCELLED",
          message = "The session was released before the request completed.",
          sessionId = sessionId,
        )
      }
      valid
    }
    return if (current) operationMap(result) else staleOperationMap()
  }

  private fun readServiceInfo(remote: IModelCommonsService): Map<String, Any?> {
    val capabilities = remote.capabilities
    return mapOf(
      "protocolVersion" to remote.protocolVersion,
      "apiVersion" to remote.apiVersion,
      "centralizedInference" to capabilities.centralizedInference,
      "runtimeState" to capabilities.runtimeState,
      "maxRequestBytes" to capabilities.maxRequestBytes,
      "maxEventBytes" to capabilities.maxEventBytes,
    )
  }

  private fun operationMap(result: OperationResultParcel): Map<String, Any?> = mapOf(
    "ok" to result.ok,
    "code" to result.code,
    "message" to result.message,
  )

  private fun invalidOperationMap(message: String): Map<String, Any?> = mapOf(
    "ok" to false,
    "code" to "INVALID_REQUEST",
    "message" to message,
  )

  private fun validIdentifier(value: String): Boolean =
    value.isNotBlank()
      && value.toByteArray(Charsets.UTF_8).size in 1..ModelCommonsService.MAX_IDENTIFIER_BYTES

  private fun staleOperationMap(): Map<String, Any?> = mapOf(
    "ok" to false,
    "code" to "TRANSPORT_UNAVAILABLE",
    "message" to "The Hub connection changed before the operation completed.",
  )

  private fun staleConnectionError(): IllegalStateException =
    IllegalStateException("TRANSPORT_UNAVAILABLE: the Hub connection changed before the operation completed.")

  @Synchronized
  private fun requireConnectionSnapshot(): ConnectionSnapshot = requireConnectionSnapshotLocked()

  private fun requireConnectionSnapshotLocked(): ConnectionSnapshot {
    val remote = service
    val binder = serviceBinder
    if (remote == null || binder?.isBinderAlive != true) {
      throw IllegalStateException("TRANSPORT_UNAVAILABLE: ModelCommons Hub is not connected.")
    }
    return ConnectionSnapshot(remote, binder, connectionGeneration)
  }

  @Synchronized
  private fun isConnectionCurrent(snapshot: ConnectionSnapshot): Boolean =
    isConnectionCurrentLocked(snapshot)

  private fun isConnectionCurrentLocked(snapshot: ConnectionSnapshot): Boolean =
    snapshot.generation == connectionGeneration
      && snapshot.binder === serviceBinder
      && snapshot.remote === service
      && snapshot.binder.isBinderAlive

  private fun requireService(): IModelCommonsService {
    val remote = service
    if (remote == null || serviceBinder?.isBinderAlive != true) {
      throw IllegalStateException("ModelCommons Hub is not connected.")
    }
    return remote
  }

  private fun validateStreamEvent(
    event: StreamEventParcel,
    key: OperationKey,
    state: OperationState,
  ): ValidatedStreamEvent {
    require(event.eventJson.toByteArray(Charsets.UTF_8).size <= ModelCommonsService.MAX_EVENT_BYTES)
    require(event.sequence >= 0L && event.sequence < MAX_SAFE_JS_INTEGER)
    require(event.sequence == state.nextSequence)
    val json = JSONObject(event.eventJson)
    val type = requiredJsonString(json, "type", maximum = 80)
    if (!state.startedAccepted) require(type == "response.started")
    if (state.startedAccepted) require(type != "response.started")

    when (type) {
      "response.started" -> {
        requireResponseId(json, key)
        requireNonNegativeNumber(json, "createdAt")
        require(requiredJsonString(json, "modelId", maximum = 512) == state.modelId)
        validateDiagnostics(requiredJsonObject(json, "diagnostics"), state)
      }
      "text.delta" -> {
        requireResponseId(json, key)
        requiredJsonString(json, "delta", allowEmpty = true, maximum = ModelCommonsService.MAX_EVENT_BYTES)
      }
      "tool_call.started" -> {
        requireResponseId(json, key)
        requiredJsonString(json, "callId", maximum = 512)
        requiredJsonString(json, "name", maximum = 512)
        requireNonNegativeInteger(json, "index")
      }
      "tool_call.arguments.delta" -> {
        requireResponseId(json, key)
        requiredJsonString(json, "callId", maximum = 512)
        requiredJsonString(json, "delta", allowEmpty = true, maximum = ModelCommonsService.MAX_EVENT_BYTES)
        requireNonNegativeInteger(json, "index")
      }
      "tool_call.completed" -> {
        requireResponseId(json, key)
        validateToolCall(requiredJsonObject(json, "call"))
        requireNonNegativeInteger(json, "index")
      }
      "usage.updated" -> {
        requireResponseId(json, key)
        validateUsage(requiredJsonObject(json, "usage"))
      }
      "response.completed" -> validateCompletedResponse(requiredJsonObject(json, "response"), key, state)
      "response.failed" -> {
        requireResponseId(json, key)
        validateFailure(requiredJsonObject(json, "error"))
      }
      else -> throw IllegalArgumentException("Unsupported canonical stream event type.")
    }
    return ValidatedStreamEvent(type)
  }

  private fun validateDiagnostics(value: JSONObject, state: OperationState) {
    require(value.opt("offline") == true)
    require(requiredJsonString(value, "resolvedModelId", maximum = 512) == state.modelId)
    requiredJsonString(value, "runtimeId", maximum = 256)
    require(requiredJsonString(value, "profileId", maximum = 256) == state.profileId)
  }

  private fun validateCompletedResponse(value: JSONObject, key: OperationKey, state: OperationState) {
    require(requiredJsonString(value, "id", maximum = 512) == key.requestId)
    requireNonNegativeNumber(value, "createdAt")
    require(requiredJsonString(value, "modelId", maximum = 512) == state.modelId)
    validateContent(requiredJsonArray(value, "content"))
    require(requiredJsonString(value, "stopReason", maximum = 32) in STOP_REASONS)
    if (value.has("stopSequence")) {
      requiredJsonString(value, "stopSequence", allowEmpty = true, maximum = 1024)
    }
    validateUsage(requiredJsonObject(value, "usage"))
    validateDiagnostics(requiredJsonObject(value, "diagnostics"), state)
  }

  private fun validateContent(content: JSONArray) {
    for (index in 0 until content.length()) {
      val part = content.opt(index) as? JSONObject
        ?: throw IllegalArgumentException("Canonical response content must contain objects.")
      when (requiredJsonString(part, "type", maximum = 32)) {
        "text" -> requiredJsonString(part, "text", allowEmpty = true, maximum = ModelCommonsService.MAX_EVENT_BYTES)
        "image" -> {
          requiredJsonString(part, "uri", maximum = ModelCommonsService.MAX_EVENT_BYTES)
          if (part.has("mediaType")) requiredJsonString(part, "mediaType", maximum = 256)
          if (part.has("detail")) require(requiredJsonString(part, "detail", maximum = 16) in IMAGE_DETAILS)
        }
        "audio" -> {
          requiredJsonString(part, "mediaType", maximum = 256)
          require(part.has("uri") xor part.has("data"))
          if (part.has("uri")) requiredJsonString(part, "uri", maximum = ModelCommonsService.MAX_EVENT_BYTES)
          if (part.has("data")) requiredJsonString(part, "data", maximum = ModelCommonsService.MAX_EVENT_BYTES)
        }
        "tool_call" -> validateToolCall(requiredJsonObject(part, "call"))
        "tool_result" -> {
          val result = requiredJsonObject(part, "result")
          requiredJsonString(result, "toolCallId", maximum = 512)
          require(result.has("content"))
          require(isJsonValue(result.opt("content")))
          if (result.has("isError")) require(result.opt("isError") is Boolean)
        }
        else -> throw IllegalArgumentException("Unsupported canonical response content type.")
      }
    }
  }

  private fun validateToolCall(call: JSONObject) {
    requiredJsonString(call, "id", maximum = 512)
    requiredJsonString(call, "name", maximum = 512)
    requiredJsonObject(call, "arguments")
    if (call.has("rawArguments")) {
      requiredJsonString(call, "rawArguments", maximum = ModelCommonsService.MAX_EVENT_BYTES)
    }
  }

  private fun validateUsage(usage: JSONObject) {
    for (key in USAGE_KEYS) {
      if (usage.has(key)) requireNonNegativeInteger(usage, key)
    }
  }

  private fun validateFailure(error: JSONObject) {
    require(requiredJsonString(error, "code", maximum = 64) in ERROR_CODES)
    requiredJsonString(error, "message", maximum = 1024)
    require(error.opt("retryable") is Boolean)
    if (error.has("details")) require(error.opt("details") is JSONObject)
  }

  private fun requireResponseId(value: JSONObject, key: OperationKey) {
    require(requiredJsonString(value, "responseId", maximum = 512) == key.requestId)
  }

  private fun requiredJsonObject(value: JSONObject, key: String): JSONObject =
    value.opt(key) as? JSONObject ?: throw IllegalArgumentException("$key must be an object.")

  private fun requiredJsonArray(value: JSONObject, key: String): JSONArray =
    value.opt(key) as? JSONArray ?: throw IllegalArgumentException("$key must be an array.")

  private fun requiredJsonString(
    value: JSONObject,
    key: String,
    allowEmpty: Boolean = false,
    maximum: Int,
  ): String {
    val result = value.opt(key) as? String ?: throw IllegalArgumentException("$key must be a string.")
    require(result.length <= maximum && (allowEmpty || result.isNotBlank()))
    return result
  }

  private fun requireNonNegativeNumber(value: JSONObject, key: String): Double {
    val result = (value.opt(key) as? Number)?.toDouble()
      ?: throw IllegalArgumentException("$key must be a number.")
    require(result.isFinite() && result >= 0.0)
    return result
  }

  private fun requireNonNegativeInteger(value: JSONObject, key: String): Long {
    val result = requireNonNegativeNumber(value, key)
    require(result <= MAX_SAFE_JS_INTEGER.toDouble() && result == kotlin.math.floor(result))
    return result.toLong()
  }

  private fun isJsonValue(value: Any?): Boolean = when (value) {
    null, JSONObject.NULL, is String, is Boolean, is JSONObject, is JSONArray -> true
    is Number -> value.toDouble().isFinite()
    else -> false
  }

  @Synchronized
  private fun handleServiceConnected(generation: Long, binder: IBinder) {
    if (generation != connectionGeneration || intentionalDisconnect) return
    val remote = IModelCommonsService.Stub.asInterface(binder)
    val recipient = IBinder.DeathRecipient {
      mainHandler.post { handleTransportDeath(generation, binder, "Hub Binder died.") }
    }
    try {
      binder.linkToDeath(recipient, 0)
      activeDeathRecipient = recipient
      serviceBinder = binder
      service = remote
      val info = readServiceInfo(remote)
      pendingConnect?.invoke(Result.success(info))
      pendingConnect = null
    } catch (error: Throwable) {
      pendingConnect?.invoke(Result.failure(error))
      pendingConnect = null
      close()
    }
  }

  @Synchronized
  private fun handleNullBinding(generation: Long) {
    if (generation != connectionGeneration || intentionalDisconnect) return
    pendingConnect?.invoke(Result.failure(IllegalStateException("Hub returned a null Binder.")))
    pendingConnect = null
    close()
  }

  @Synchronized
  private fun handleTransportDeath(generation: Long, expectedBinder: IBinder?, message: String) {
    if (intentionalDisconnect || generation != connectionGeneration) return
    if (expectedBinder != null && serviceBinder !== expectedBinder) return
    val recipient = activeDeathRecipient
    serviceBinder?.let { binder ->
      try {
        if (recipient != null) binder.unlinkToDeath(recipient, 0)
      } catch (_: Exception) {
        // The Binder may already be dead.
      }
    }
    activeDeathRecipient = null
    service = null
    serviceBinder = null
    pendingConnect?.invoke(Result.failure(IllegalStateException(message)))
    pendingConnect = null
    failOperations("TRANSPORT_UNAVAILABLE", message)
    sessions.clear()
    connectionGeneration = if (connectionGeneration == Long.MAX_VALUE) 1L else connectionGeneration + 1L
    val deadConnection = connection
    connection = null
    connectedPackage = null
    if (deadConnection != null) {
      try {
        context.unbindService(deadConnection)
      } catch (_: IllegalArgumentException) {
        // The framework may already have removed a dead binding.
      }
    }
  }

  private fun failOperations(code: String, message: String, sessionId: String? = null) {
    operations.entries.forEach { (key, state) ->
      if (sessionId != null && key.sessionId != sessionId) return@forEach
      synchronized(state) {
        failOperationLocked(key, state, code, message)
      }
    }
  }

  /** Caller holds the operation-state monitor. */
  private fun failOperationLocked(
    key: OperationKey,
    state: OperationState,
    code: String,
    message: String,
  ) {
    if (state.terminal) return
    state.terminal = true
    if (!operations.remove(key, state)) return
    mainHandler.post {
      var sequence = state.nextSequence
      if (!state.startedAccepted) {
        val startedJson = JSONObject()
          .put("type", "response.started")
          .put("responseId", key.requestId)
          .put("createdAt", System.currentTimeMillis())
          .put("modelId", state.modelId)
          .put(
            "diagnostics",
            JSONObject()
              .put("offline", true)
              .put("resolvedModelId", state.modelId)
              .put("runtimeId", "android-binder-scaffold")
              .put("profileId", state.profileId),
          )
          .toString()
        emitStreamEvent(key, 0L, startedJson)
        sequence = 1L
      }
      val errorJson = JSONObject()
        .put("type", "response.failed")
        .put("responseId", key.requestId)
        .put(
          "error",
          JSONObject()
            .put("code", code)
            .put("message", message)
            .put("retryable", code == "TRANSPORT_UNAVAILABLE"),
        )
        .toString()
      emitStreamEvent(key, sequence, errorJson)
    }
  }

  private fun emitStreamEvent(key: OperationKey, sequence: Long, eventJson: String) {
    emitEvent(
      mapOf(
        "sessionId" to key.sessionId,
        "requestId" to key.requestId,
        "sequence" to sequence.toDouble(),
        "eventJson" to eventJson,
      )
    )
  }

  private data class ConnectionSnapshot(
    val remote: IModelCommonsService,
    val binder: IBinder,
    val generation: Long,
  )
  private data class ValidatedStreamEvent(val type: String)
  private data class SessionIdentity(val modelId: String, val profileId: String)
  private data class OperationKey(val sessionId: String, val requestId: String)
  private class OperationState(val modelId: String, val profileId: String) {
    var terminal = false
    var startedAccepted = false
    var nextSequence = 0L
  }

  companion object {
    private val PACKAGE_NAME = Regex("^[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+$")
    private const val MAX_SAFE_JS_INTEGER = 9_007_199_254_740_991L
    private val STOP_REASONS = setOf("stop", "length", "tool_call", "cancelled", "error")
    private val IMAGE_DETAILS = setOf("auto", "low", "high")
    private val USAGE_KEYS = setOf("inputTokens", "outputTokens", "totalTokens", "cachedInputTokens")
    private val ERROR_CODES = setOf(
      "HUB_NOT_FOUND",
      "PERMISSION_REQUIRED",
      "CLIENT_NOT_AUTHORIZED",
      "MODEL_NOT_FOUND",
      "MODEL_NOT_READY",
      "MODEL_INCOMPATIBLE",
      "RUNTIME_UNAVAILABLE",
      "RUNTIME_INITIALIZATION_FAILED",
      "INSUFFICIENT_MEMORY",
      "STORAGE_UNAVAILABLE",
      "PROTOCOL_VERSION_UNSUPPORTED",
      "USER_CANCELLED",
      "INTEGRITY_FAILED",
      "LICENSE_ACCEPTANCE_REQUIRED",
      "FEATURE_UNSUPPORTED",
      "CAPABILITY_UNAVAILABLE",
      "TRANSPORT_UNAVAILABLE",
    )
  }
}

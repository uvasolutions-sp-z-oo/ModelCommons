package expo.modules.modelcommonsnative.ipc

import android.os.Parcelable
import kotlinx.parcelize.Parcelize

@Parcelize
data class CapabilitiesParcel(
  val centralizedInference: Boolean,
  val runtimeState: String,
  val streamingContract: Boolean,
  val cancellation: Boolean,
  val maxRequestBytes: Int,
  val maxEventBytes: Int,
  val runtimeId: String = "modelcommons.android.cpu",
  val runtimeVersion: String = "0.1.0",
  val sourceIdentity: String = "llama.rn-source-0.12.9-b10256-6c8dcaa",
  val contextSize: Int = 1024,
  val maxOutputTokens: Int = 128,
) : Parcelable

@Parcelize
data class GenerateRequestParcel(
  val protocolVersion: String,
  val requestId: String,
  val requestJson: String,
) : Parcelable

@Parcelize
data class ModelDescriptorParcel(
  val id: String,
  val revision: String,
  val displayName: String,
  val state: String,
  val capabilities: List<String>,
  val manifestJson: String = "",
) : Parcelable

@Parcelize
data class ModelPageParcel(
  val models: List<ModelDescriptorParcel>,
  val nextCursor: String?,
) : Parcelable

@Parcelize
data class OperationResultParcel(
  val ok: Boolean,
  val code: String? = null,
  val message: String? = null,
) : Parcelable

@Parcelize
data class SessionResultParcel(
  val ok: Boolean,
  val sessionId: String? = null,
  val code: String? = null,
  val message: String? = null,
) : Parcelable

@Parcelize
data class StreamEventParcel(
  val sessionId: String,
  val requestId: String,
  val sequence: Long,
  val eventJson: String,
) : Parcelable

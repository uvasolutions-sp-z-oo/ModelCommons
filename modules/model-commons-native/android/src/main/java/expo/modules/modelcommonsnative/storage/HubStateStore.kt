package expo.modules.modelcommonsnative.storage

import android.content.Context
import expo.modules.modelcommonsnative.ipc.ModelDescriptorParcel
import expo.modules.modelcommonsnative.ipc.ModelPageParcel
import org.json.JSONArray
import org.json.JSONObject

class HubStateStore(context: Context) {
  private val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

  @Synchronized
  fun publishModels(modelsJson: String) {
    require(modelsJson.toByteArray(Charsets.UTF_8).size <= MAX_SNAPSHOT_BYTES) {
      "Hub model snapshot exceeds $MAX_SNAPSHOT_BYTES bytes."
    }
    val input = JSONArray(modelsJson)
    require(input.length() <= MAX_MODELS) { "Hub model snapshot contains too many models." }
    val normalized = JSONArray()
    for (index in 0 until input.length()) {
      val item = input.getJSONObject(index)
      val id = requiredShortString(item, "id", 160)
      val revision = requiredShortString(item, "revision", 160)
      val displayName = requiredShortString(item, "displayName", 240)
      val state = requiredShortString(item, "state", 64)
      val capabilitiesInput = item.optJSONArray("capabilities") ?: JSONArray()
      require(capabilitiesInput.length() <= 16) { "Too many model capabilities." }
      val capabilities = JSONArray()
      for (capabilityIndex in 0 until capabilitiesInput.length()) {
        val capability = capabilitiesInput.getString(capabilityIndex)
        require(capability.length in 1..64) { "Invalid model capability." }
        capabilities.put(capability)
      }
      normalized.put(
        JSONObject()
          .put("id", id)
          .put("revision", revision)
          .put("displayName", displayName)
          .put("state", state)
          .put("capabilities", capabilities)
      )
    }
    check(preferences.edit().putString(KEY_MODELS, normalized.toString()).commit()) {
      "Unable to persist the Hub model snapshot."
    }
  }

  fun hasReadyModel(modelId: String): Boolean = readModels().any {
    it.id == modelId && it.state == "READY"
  }

  fun page(cursor: String?, requestedLimit: Int): ModelPageParcel {
    val models = readModels().sortedBy { it.id }
    val start = cursor?.toIntOrNull()?.coerceIn(0, models.size) ?: 0
    val limit = requestedLimit.coerceIn(1, MAX_PAGE_MODELS)
    val selected = ArrayList<ModelDescriptorParcel>()
    var estimatedBytes = 0
    var index = start
    while (index < models.size && selected.size < limit) {
      val candidate = models[index]
      val candidateBytes = utf8Size(candidate.id) + utf8Size(candidate.revision) + utf8Size(candidate.displayName) +
        utf8Size(candidate.state) + candidate.capabilities.sumOf { utf8Size(it) + 16 } + 128
      if (selected.isNotEmpty() && estimatedBytes + candidateBytes > MAX_PAGE_BYTES) break
      selected.add(candidate)
      estimatedBytes += candidateBytes
      index += 1
    }
    return ModelPageParcel(selected, if (index < models.size) index.toString() else null)
  }

  private fun readModels(): List<ModelDescriptorParcel> {
    val raw = preferences.getString(KEY_MODELS, null) ?: return emptyList()
    return try {
      val array = JSONArray(raw)
      buildList {
        for (index in 0 until array.length()) {
          val item = array.getJSONObject(index)
          val capabilitiesJson = item.getJSONArray("capabilities")
          val capabilities = buildList {
            for (capabilityIndex in 0 until capabilitiesJson.length()) {
              add(capabilitiesJson.getString(capabilityIndex))
            }
          }
          add(
            ModelDescriptorParcel(
              id = item.getString("id"),
              revision = item.getString("revision"),
              displayName = item.getString("displayName"),
              state = item.getString("state"),
              capabilities = capabilities,
            )
          )
        }
      }
    } catch (_: Exception) {
      // Corrupt metadata is never exposed across the trust boundary.
      emptyList()
    }
  }

  private fun requiredShortString(value: JSONObject, key: String, maxLength: Int): String {
    val result = value.getString(key).trim()
    require(result.isNotEmpty() && result.length <= maxLength) { "Invalid $key." }
    return result
  }

  private fun utf8Size(value: String): Int = value.toByteArray(Charsets.UTF_8).size

  companion object {
    private const val PREFERENCES = "modelcommons_hub_state_v1"
    private const val KEY_MODELS = "models"
    private const val MAX_SNAPSHOT_BYTES = 256 * 1024
    private const val MAX_MODELS = 500
    private const val MAX_PAGE_MODELS = 50
    private const val MAX_PAGE_BYTES = 48 * 1024
  }
}

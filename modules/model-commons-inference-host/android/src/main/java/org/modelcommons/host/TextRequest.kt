package org.modelcommons.host

import expo.modules.modelcommonsnative.service.HostFailure
import org.json.JSONObject

internal data class TextRequest(val roles: Array<ByteArray>, val texts: Array<ByteArray>,
  val output: Int, val temperature: Float, val topP: Float) {
  companion object {
    fun parse(json: JSONObject, modelId: String): TextRequest {
      fun reject(): Nothing = throw HostFailure("FEATURE_UNSUPPORTED")
      fun keys(value: JSONObject, allowed: Set<String>) { if (value.keys().asSequence().any { it !in allowed }) reject() }
      keys(json, setOf("id", "model", "instructions", "messages", "maxOutputTokens", "sampling"))
      val model = json.getJSONObject("model")
      keys(model, setOf("id", "profile", "capabilities"))
      if ((model.has("id") && model.opt("id") !is String) || (model.has("profile") && model.opt("profile") !is String)) reject()
      if (model.optString("id", modelId) != modelId || model.optString("profile", "safe") != "safe" ||
        model.getJSONArray("capabilities").toString() != "[\"text\"]") reject()
      val outputValue = json.opt("maxOutputTokens") ?: 128
      if (outputValue !is Number || outputValue.toDouble() != outputValue.toInt().toDouble() || outputValue.toInt() !in 1..128) reject()
      val sampling = json.optJSONObject("sampling") ?: JSONObject()
      if (json.has("sampling") && json.optJSONObject("sampling") == null) reject()
      keys(sampling, setOf("temperature", "topP"))
      fun number(key: String, fallback: Double, min: Double, max: Double): Float {
        val n = sampling.opt(key) ?: fallback
        if (n !is Number || !n.toDouble().isFinite() || n.toDouble() !in min..max) reject()
        return n.toFloat()
      }
      val roles = mutableListOf<ByteArray>()
      val texts = mutableListOf<ByteArray>()
      fun add(role: String, text: String) {
        if ('\u0000' in text || text.length > 48 * 1024) reject()
        var index = 0
        while (index < text.length) {
          val char = text[index++]
          if (char.isLowSurrogate()) reject()
          if (char.isHighSurrogate() && (index >= text.length || !text[index++].isLowSurrogate())) reject()
        }
        roles.add(role.toByteArray()); texts.add(text.toByteArray(Charsets.UTF_8))
      }
      if (json.has("instructions")) {
        val instructions = json.get("instructions")
        if (instructions !is String) reject()
        add("system", instructions)
      }
      val messages = json.getJSONArray("messages")
      if (messages.length() !in 1..63) reject()
      for (i in 0 until messages.length()) {
        val message = messages.getJSONObject(i)
        keys(message, setOf("role", "content"))
        val role = message.getString("role")
        if (role !in setOf("system", "user", "assistant") || (role == "system" && (i != 0 || roles.isNotEmpty()))) reject()
        val parts = message.getJSONArray("content")
        if (parts.length() !in 1..32) reject()
        val text = StringBuilder()
        for (j in 0 until parts.length()) {
          val part = parts.getJSONObject(j)
          keys(part, setOf("type", "text"))
          if (part.getString("type") != "text" || part.get("text") !is String) reject()
          text.append(part.getString("text"))
        }
        add(role, text.toString())
      }
      if (messages.getJSONObject(messages.length() - 1).getString("role") != "user") reject()
      return TextRequest(roles.toTypedArray(), texts.toTypedArray(), outputValue.toInt(),
        number("temperature", 0.0, 0.0, 2.0), number("topP", 1.0, 0.01, 1.0))
    }
  }
}

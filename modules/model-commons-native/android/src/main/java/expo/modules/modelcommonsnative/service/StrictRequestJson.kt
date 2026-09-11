package expo.modules.modelcommonsnative.service

import android.util.JsonReader
import android.util.JsonToken
import org.json.JSONArray
import org.json.JSONObject
import java.io.StringReader

/** Android JSONObject's permissive parser is unsuitable for a hostile request boundary. */
object StrictRequestJson {
  fun parse(text: String, maxBytes: Int = ModelCommonsService.MAX_REQUEST_BYTES, maxArray: Int = 128): JSONObject {
    if (text.toByteArray(Charsets.UTF_8).size > maxBytes) throw HostFailure("FEATURE_UNSUPPORTED")
    val reader = JsonReader(StringReader(text)).apply { isLenient = false }
    var nodes = 0
    fun value(depth: Int): Any {
      if (++nodes > 8192 || depth > 12) throw HostFailure("FEATURE_UNSUPPORTED")
      return when (reader.peek()) {
        JsonToken.BEGIN_OBJECT -> {
          val result = JSONObject(); reader.beginObject()
          while (reader.hasNext()) {
            val name = reader.nextName()
            if (name.length > 64 || result.has(name)) throw HostFailure("FEATURE_UNSUPPORTED")
            result.put(name, value(depth + 1))
          }
          reader.endObject(); result
        }
        JsonToken.BEGIN_ARRAY -> {
          val result = JSONArray(); reader.beginArray()
          while (reader.hasNext()) { if (result.length() >= maxArray) throw HostFailure("FEATURE_UNSUPPORTED"); result.put(value(depth + 1)) }
          reader.endArray(); result
        }
        JsonToken.STRING -> reader.nextString()
        JsonToken.NUMBER -> reader.nextDouble().also { if (!it.isFinite()) throw HostFailure("FEATURE_UNSUPPORTED") }
        JsonToken.BOOLEAN -> reader.nextBoolean()
        JsonToken.NULL -> { reader.nextNull(); JSONObject.NULL }
        else -> throw HostFailure("FEATURE_UNSUPPORTED")
      }
    }
    return reader.use {
      val result = value(0) as? JSONObject ?: throw HostFailure("FEATURE_UNSUPPORTED")
      if (reader.peek() != JsonToken.END_DOCUMENT) throw HostFailure("FEATURE_UNSUPPORTED")
      result
    }
  }
}

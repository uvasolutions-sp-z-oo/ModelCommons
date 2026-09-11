package org.modelcommons.host

import android.test.AndroidTestCase
import expo.modules.modelcommonsnative.service.HostFailure
import org.json.JSONObject

@Suppress("DEPRECATION")
class NativeHostTest : AndroidTestCase() {
  private val model = "unsloth/smollm2-135m-instruct-gguf:q4-k-m"
  private fun request() = JSONObject("""{"model":{"id":"$model","profile":"safe","capabilities":["text"]},"messages":[{"role":"user","content":[{"type":"text","text":"hello"}]}],"maxOutputTokens":16}""")
  fun testStrictTextSliceRejectsUnsupportedAndOverBudgetSettings() {
    for (bad in listOf(request().put("tools", org.json.JSONArray()), request().put("stop", org.json.JSONArray().put("x")),
      request().put("maxOutputTokens", 129), request().put("maxOutputTokens", "16"), request().put("path", "/untrusted/model.gguf"))) {
      try { TextRequest.parse(bad, model); fail("Unsupported request accepted") } catch (_: HostFailure) {}
    }
    val good = TextRequest.parse(request(), model)
    assertEquals(16, good.output)
    assertEquals("hello", good.texts.single().toString(Charsets.UTF_8))
  }
  fun testUtf8TokenSplitsAndSurrogatesArePreserved() {
    val output = StringBuilder()
    val sink = TokenSink { output.append(it) }
    "Zażółć 😀 東京".toByteArray(Charsets.UTF_8).forEach { sink.emit(byteArrayOf(it)) }
    sink.finish()
    assertEquals("Zażółć 😀 東京", output.toString())
  }
  fun testJniCancellationBeforeFileOpen() {
    assertTrue("CPU host library failed to load", NativeWorker.loaded)
    val control = NativeWorker.create()
    try {
      NativeWorker.cancel(control)
      try {
        NativeWorker.run(control, -1, arrayOf("user".toByteArray()), arrayOf("hello".toByteArray()), 16, 0f, 1f, TokenSink { fail("Cancelled worker emitted text") })
        fail("Cancelled worker entered model loading")
      } catch (error: IllegalStateException) { assertEquals("USER_CANCELLED", error.message) }
    } finally { NativeWorker.destroy(control) }
  }
  fun testMissingStoreCannotBecomeReadyFromInventory() {
    // A fresh library test APK owns a separate filesDir; no Hub data is modified.
    val resolver = VerifiedArtifactResolver(context)
    try { resolver.manifest(VerifiedArtifactResolver.pins.first()); fail("Absent authoritative store was accepted") }
    catch (_: Exception) {}
  }
}

package expo.modules.modelcommonsnative.service

import android.test.AndroidTestCase

@Suppress("DEPRECATION")
class StrictRequestJsonTest : AndroidTestCase() {
  fun testRejectsDuplicateKeysTrailingTokensAndDeepInput() {
    listOf("{\"model\":1,\"model\":2}", "{} {}", "{unquoted:1}", "{\"x\":" + "[".repeat(20) + "0" + "]".repeat(20) + "}").forEach { text ->
      try { StrictRequestJson.parse(text); fail("Untrusted JSON was accepted") } catch (_: Exception) {}
    }
  }
  fun testRejectsUtf8OversizeBeforeParsing() {
    try { StrictRequestJson.parse("{\"x\":\"" + "é".repeat(25000) + "\"}"); fail("Oversized request accepted") }
    catch (_: HostFailure) {}
  }
  fun testKeepsUnicodeAndFiniteNumbers() {
    val value = StrictRequestJson.parse("{\"text\":\"Zażółć 😀\",\"temperature\":0.2}")
    assertEquals("Zażółć 😀", value.getString("text"))
    assertEquals(0.2, value.getDouble("temperature"))
  }
}

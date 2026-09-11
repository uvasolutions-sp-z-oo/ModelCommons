package org.modelcommons.host

import android.content.ContextWrapper
import android.system.Os
import android.test.AndroidTestCase
import expo.modules.modelcommonsnative.service.HostFailure
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

@Suppress("DEPRECATION")
class ArtifactResolverTest : AndroidTestCase() {
  fun testWrongSizeAndSymlinkCannotReachNativeParsing() {
    val scratch = File(context.cacheDir.canonicalFile, "modelcommons-test-${UUID.randomUUID()}")
    val testContext = object : ContextWrapper(context) { override fun getFilesDir() = scratch }
    val root = File(scratch, "ModelCommons").apply { mkdirs() }
    val pin = VerifiedArtifactResolver.pins.first()
    val directory = File(root, "models/${pin.storage}").apply { mkdirs() }
    val manifest = JSONObject().put("schema", "modelcommons.model-manifest").put("schemaVersion", 1).put("protocolVersion", "0.1.0")
      .put("id", pin.id).put("revision", pin.revision).put("storageId", pin.storage).put("format", "gguf").put("quantization", "Q4_K_M")
      .put("capabilities", JSONArray().put("text")).put("license", JSONObject().put("id", "Apache-2.0")
        .put("url", "https://www.apache.org/licenses/LICENSE-2.0").put("acceptanceRequired", false).put("gated", false).put("redistribution", "allowed"))
      .put("files", JSONArray().put(JSONObject().put("role", "model").put("path", "model.gguf").put("required", true).put("sizeBytes", pin.size)
        .put("integrity", JSONObject().put("algorithm", "sha256").put("digest", pin.hash))))
    try {
      File(root, "protocol.json").writeText("""{"schema":"modelcommons.protocol","schemaVersion":1,"protocolVersion":"0.1.0"}""")
      File(directory, "manifest.json").writeText(manifest.toString())
      File(root, "registry.json").writeText(JSONObject().put("schema", "modelcommons.registry").put("schemaVersion", 1).put("protocolVersion", "0.1.0")
        .put("models", JSONArray().put(JSONObject().put("manifest", manifest).put("state", "READY").put("relativeManifestPath", "models/${pin.storage}/manifest.json"))).toString())
      val artifact = File(directory, "model.gguf").apply { writeBytes(byteArrayOf(1, 2, 3)) }
      val resolver = VerifiedArtifactResolver(testContext)
      try { resolver.acquire(pin, AtomicBoolean(false)).close(); fail("Wrong-size artifact accepted") }
      catch (error: HostFailure) { assertEquals("INTEGRITY_FAILED", error.code) }
      val other = File(scratch, "other.gguf").apply { writeBytes(byteArrayOf(1)) }
      assertTrue(artifact.delete())
      Os.symlink(other.path, artifact.path)
      try { resolver.acquire(pin, AtomicBoolean(false)).close(); fail("Symlink accepted") }
      catch (error: HostFailure) { assertEquals("INTEGRITY_FAILED", error.code) }
    } finally {
      check(scratch.canonicalPath.startsWith(context.cacheDir.canonicalPath + File.separator))
      // Only the isolated test tree; never the Hub's actual ModelCommons store.
      scratch.deleteRecursively()
    }
  }
}

package org.modelcommons.host

import android.content.Context
import android.os.ParcelFileDescriptor
import android.system.Os
import android.system.OsConstants
import expo.modules.modelcommonsnative.service.HostFailure
import expo.modules.modelcommonsnative.service.StrictRequestJson
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean

/** Exact Expo legacy documentDirectory producer: AppDirectoriesModule -> context.filesDir. */
internal class VerifiedArtifactResolver(context: Context) {
  private val root = File(context.filesDir.canonicalFile, "ModelCommons")
  data class Pin(val id: String, val revision: String, val storage: String, val size: Long, val hash: String)
  companion object {
    val pins = listOf(
      Pin("unsloth/smollm2-135m-instruct-gguf:q4-k-m", "9e6855bc4be717fca1ef21360a1db4b29d5c559a",
        "smollm2-135m-instruct-q4-k-m-9e6855bc4be7", 105454144,
        "ed5fa30c487b282ec156c29062f1222e5c20875a944ac98289dbd242e947f747"),
      Pin("unsloth/smollm2-360m-instruct-gguf:q4-k-m", "391ed11137586e383b1be0fab9acf01d282c2e11",
        "smollm2-360m-instruct-q4-k-m-391ed1113758", 270590560,
        "16c7f1667fea34bacad196a57b548effcb37614db4ab5677a20c8c7b823b9e63"),
    )
  }
  private fun confined(relative: String): File {
    val file = File(root, relative).absoluteFile
    if (root.canonicalFile != root || file.canonicalFile != file || !file.path.startsWith(root.path + File.separator))
      throw HostFailure("INTEGRITY_FAILED")
    return file
  }
  private fun json(relative: String, max: Long): JSONObject {
    return ParcelFileDescriptor.AutoCloseInputStream(open(relative)).use { input ->
      val stat = Os.fstat(input.fd)
      if (!OsConstants.S_ISREG(stat.st_mode) || stat.st_size !in 1..max) throw HostFailure("INTEGRITY_FAILED")
      val bytes = input.readBytesBounded(max.toInt())
      StrictRequestJson.parse(Charsets.UTF_8.newDecoder().decode(java.nio.ByteBuffer.wrap(bytes)).toString(), max.toInt(), 500)
    }
  }
  private fun open(relative: String): ParcelFileDescriptor {
    val descriptor = Os.open(confined(relative).path, OsConstants.O_RDONLY or OsConstants.O_NOFOLLOW or OsConstants.O_CLOEXEC, 0)
    try { return ParcelFileDescriptor.dup(descriptor) } finally { Os.close(descriptor) }
  }
  fun manifest(pin: Pin): JSONObject {
    val marker = json("protocol.json", 4096)
    checkSchema(marker, "modelcommons.protocol")
    val registry = json("registry.json", 1024 * 1024)
    checkSchema(registry, "modelcommons.registry")
    val records = registry.getJSONArray("models")
    if (records.length() > 500) throw HostFailure("INTEGRITY_FAILED")
    val matches = (0 until records.length()).map { records.getJSONObject(it) }
      .filter { it.getJSONObject("manifest").optString("id") == pin.id }
    if (matches.size != 1 || matches.single().optString("state") != "READY") throw HostFailure("MODEL_NOT_READY")
    val record = matches.single()
    val relative = "models/${pin.storage}/manifest.json"
    if (record.optString("relativeManifestPath") != relative) throw HostFailure("INTEGRITY_FAILED")
    val manifest = json(relative, 16 * 1024)
    verifyManifest(manifest, pin)
    verifyManifest(record.getJSONObject("manifest"), pin)
    return manifest
  }
  private fun checkSchema(value: JSONObject, schema: String) {
    if (value.optString("schema") != schema || (value.opt("schemaVersion") as? Number)?.toDouble() != 1.0 || value.optString("protocolVersion") != "0.1.0")
      throw HostFailure("PROTOCOL_VERSION_UNSUPPORTED")
  }
  private fun verifyManifest(m: JSONObject, pin: Pin) {
    checkSchema(m, "modelcommons.model-manifest")
    val files = m.getJSONArray("files")
    val license = m.getJSONObject("license")
    if (m.getString("id") != pin.id || m.getString("revision") != pin.revision ||
      m.getString("storageId") != pin.storage || m.getString("format") != "gguf" ||
      m.getString("quantization") != "Q4_K_M" || m.optBoolean("experimental", false) ||
      m.getJSONArray("capabilities").toString() != "[\"text\"]" || files.length() != 1 ||
      license.getString("id") != "Apache-2.0" || license.getBoolean("acceptanceRequired") ||
      license.getString("url") != "https://www.apache.org/licenses/LICENSE-2.0" ||
      license.getBoolean("gated") || license.getString("redistribution") != "allowed") throw HostFailure("INTEGRITY_FAILED")
    val f = files.getJSONObject(0)
    if (f.opt("sizeBytes") !is Number || license.opt("acceptanceRequired") !is Boolean || license.opt("gated") !is Boolean)
      throw HostFailure("INTEGRITY_FAILED")
    if (f.getString("role") != "model" || f.getString("path") != "model.gguf" || f.opt("required") != true ||
      f.getLong("sizeBytes") != pin.size || f.getJSONObject("integrity").getString("algorithm") != "sha256" ||
      f.getJSONObject("integrity").getString("digest") != pin.hash) throw HostFailure("INTEGRITY_FAILED")
  }
  fun acquire(pin: Pin, cancelled: AtomicBoolean): ParcelFileDescriptor {
    manifest(pin) // Never rely on the READY inventory snapshot.
    return ParcelFileDescriptor.AutoCloseInputStream(open("models/${pin.storage}/model.gguf")).use { input ->
      val stat = Os.fstat(input.fd)
      if (!OsConstants.S_ISREG(stat.st_mode) || stat.st_size != pin.size) throw HostFailure("INTEGRITY_FAILED")
      val digest = MessageDigest.getInstance("SHA-256")
      val buffer = ByteArray(1024 * 1024)
      var read = 0L
      while (true) {
        if (cancelled.get()) throw HostFailure("USER_CANCELLED")
        val n = input.read(buffer)
        if (n < 0) break
        read += n
        if (read > pin.size) throw HostFailure("INTEGRITY_FAILED")
        digest.update(buffer, 0, n)
      }
      if (read != pin.size || digest.digest().joinToString("") { "%02x".format(it) } != pin.hash)
        throw HostFailure("INTEGRITY_FAILED")
      Os.lseek(input.fd, 0, OsConstants.SEEK_SET)
      ParcelFileDescriptor.dup(input.fd)
    }
  }
  private fun FileInputStream.readBytesBounded(max: Int): ByteArray {
    val result = java.io.ByteArrayOutputStream()
    val buffer = ByteArray(4096)
    while (true) {
      val n = read(buffer)
      if (n < 0) return result.toByteArray()
      if (result.size() + n > max) throw HostFailure("INTEGRITY_FAILED")
      result.write(buffer, 0, n)
    }
  }
}

package expo.modules.modelcommonsnative.storage

import android.content.Context
import android.net.Uri
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

/** No caller-supplied root, external storage, or exported file provider. */
class PrivateModelFiles(private val context: Context) {
  private val cancelled = ConcurrentHashMap<String, AtomicBoolean>()
  private val progress = ConcurrentHashMap<String, Long>()
  private val mutation = AtomicBoolean(false)
  private val root: File
    get() = File(context.noBackupFilesDir, "ModelCommonsPrivate").also {
      check(it.isDirectory || it.mkdirs()) { "STORAGE_UNAVAILABLE: Private model storage is unavailable." }
    }.canonicalFile

  private fun file(relative: String): File {
    require(relative.length in 1..1024 && !relative.contains('\\') && !relative.contains('%')
      && !relative.contains(':') && relative.none { it.code < 32 }
      && relative.split('/').all { it.isNotEmpty() && it != "." && it != ".." }) {
      "INTEGRITY_FAILED: Unsafe private model path."
    }
    val base = root
    val result = File(base, relative).canonicalFile
    require(result.path.startsWith(base.path + File.separator)) { "INTEGRITY_FAILED: Model path escapes private storage." }
    return result
  }

  fun operation(operation: String, path: String, value: String): Any? {
    if (operation == "identity") return Uri.fromFile(root).toString()
    if (operation == "free") return root.usableSpace.toDouble()
    if (operation == "cancel") { cancelled[path]?.set(true); return null }
    if (operation == "progress") return (progress[path] ?: 0L).toDouble()
    val target = file(path)
    return when (operation) {
      "uri" -> Uri.fromFile(target).toString()
      "stat" -> if (!target.exists()) null else mapOf("size" to target.length().toDouble(), "regular" to target.isFile)
      "read" -> {
        if (!target.exists()) null else {
          require(target.isFile && target.length() <= 1024 * 1024) { "INTEGRITY_FAILED: Metadata is too large." }
          target.inputStream().use { input ->
            val buffer = ByteArray(1024 * 1024 + 1)
            var total = 0
            while (total < buffer.size) {
              val count = input.read(buffer, total, buffer.size - total)
              if (count < 0) break
              total += count
            }
            require(total <= 1024 * 1024) { "INTEGRITY_FAILED: Metadata is too large." }
            String(buffer, 0, total, Charsets.UTF_8)
          }
        }
      }
      "write" -> {
        val bytes = value.toByteArray(Charsets.UTF_8)
        require(bytes.size <= 1024 * 1024) { "INTEGRITY_FAILED: Metadata is too large." }
        check(target.parentFile!!.isDirectory || target.parentFile!!.mkdirs())
        val staged = file(path + ".next")
        FileOutputStream(staged).use { it.write(bytes); it.fd.sync() }
        AppOwnedFileOps.atomicReplace(context, Uri.fromFile(staged).toString(), Uri.fromFile(target).toString())
        null
      }
      "mkdir" -> { check(target.isDirectory || target.mkdirs()); null }
      "remove" -> { removeConfined(target); null }
      "move" -> {
        val destination = file(value)
        require(target.isFile && !destination.exists()) { "INTEGRITY_FAILED: Immutable destination already exists." }
        check(target.renameTo(destination)) { "STORAGE_UNAVAILABLE: Model publication failed." }
        null
      }
      "sha256" -> AppOwnedFileOps.sha256(context, Uri.fromFile(target).toString())
      else -> throw IllegalArgumentException("FEATURE_UNSUPPORTED: Unknown private store operation.")
    }
  }

  private fun removeConfined(target: File) {
    require(target.canonicalPath.startsWith(root.path + File.separator)) { "INTEGRITY_FAILED: Unsafe removal." }
    if (target.isDirectory) target.listFiles()?.forEach { removeConfined(it) }
    check(!target.exists() || target.delete()) { "STORAGE_UNAVAILABLE: Model removal failed." }
  }

  fun download(id: String, source: String, path: String, expected: Double, origins: List<String>) {
    require(id.length in 1..128 && expected > 0 && expected <= 32.0 * 1024 * 1024 * 1024)
    val target = file(path)
    require(path.endsWith(".part"))
    check(mutation.compareAndSet(false, true)) { "RUNTIME_UNAVAILABLE: Provisioning is busy." }
    val stop = AtomicBoolean(false)
    cancelled[id] = stop
    progress[id] = 0
    var connection: HttpURLConnection? = null
    try {
      var url = URL(source)
      var redirects = 0
      while (true) {
        require(url.protocol == "https" && url.userInfo == null
          && origins.contains("https://" + url.host + if (url.port == -1 || url.port == 443) "" else ":${url.port}")) {
          "PERMISSION_REQUIRED: Model download origin is not allowed."
        }
        check(!stop.get()) { "USER_CANCELLED: Provisioning cancelled." }
        val current = url.openConnection() as HttpURLConnection
        connection = current
        current.instanceFollowRedirects = false
        current.connectTimeout = 15000
        current.readTimeout = 15000
        current.setRequestProperty("Accept-Encoding", "identity")
        val code = current.responseCode
        if (code in listOf(301, 302, 303, 307, 308)) {
          require(++redirects <= 5) { "PERMISSION_REQUIRED: Too many download redirects." }
          url = URL(url, current.getHeaderField("Location") ?: error("Missing redirect."))
          current.disconnect()
          continue
        }
        require(code == 200) { "STORAGE_UNAVAILABLE: Model download failed." }
        val length = current.contentLengthLong
        require(length < 0 || length == expected.toLong()) { "INTEGRITY_FAILED: Download size mismatch." }
        FileOutputStream(target, false).use { output ->
          current.inputStream.use { input ->
            val buffer = ByteArray(256 * 1024)
            var total = 0L
            while (true) {
              check(!stop.get()) { "USER_CANCELLED: Provisioning cancelled." }
              val count = input.read(buffer)
              if (count < 0) break
              total += count
              require(total <= expected.toLong()) { "INTEGRITY_FAILED: Download exceeds expected size." }
              output.write(buffer, 0, count)
              progress[id] = total
            }
            require(total == expected.toLong()) { "INTEGRITY_FAILED: Download size mismatch." }
          }
          output.fd.sync()
        }
        return
      }
    } finally {
      connection?.disconnect()
      cancelled.remove(id)
      progress.remove(id)
      mutation.set(false)
    }
  }

  fun copySelected(id: String, source: Uri, path: String, expected: Double) {
    require(source.scheme == "content" && id.length in 1..128 && path.endsWith(".part")
      && expected > 0 && expected <= 32.0 * 1024 * 1024 * 1024) { "INTEGRITY_FAILED: Invalid private import." }
    val target = file(path)
    check(mutation.compareAndSet(false, true)) { "RUNTIME_UNAVAILABLE: Provisioning is busy." }
    val stop = AtomicBoolean(false)
    cancelled[id] = stop
    try {
      val input = context.contentResolver.openInputStream(source)
        ?: throw IllegalStateException("STORAGE_UNAVAILABLE: Selected file is unavailable.")
      input.use {
        FileOutputStream(target, false).use { output ->
          val buffer = ByteArray(256 * 1024)
          var total = 0L
          while (true) {
            check(!stop.get()) { "USER_CANCELLED: Import cancelled." }
            val count = input.read(buffer)
            if (count < 0) break
            total += count
            require(total <= expected.toLong()) { "INTEGRITY_FAILED: Import exceeds approved size." }
            output.write(buffer, 0, count)
          }
          require(total == expected.toLong()) { "INTEGRITY_FAILED: Import size mismatch." }
          output.fd.sync()
        }
      }
    } finally { cancelled.remove(id); mutation.set(false) }
  }
}

package expo.modules.modelcommonsnative.storage

import android.content.Context
import android.net.Uri
import android.os.Build
import android.system.Os
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest

object AppOwnedFileOps {
  fun sha256(context: Context, uriString: String): String {
    openForRead(context, uriString).use { input ->
      val digest = MessageDigest.getInstance("SHA-256")
      val buffer = ByteArray(1024 * 1024)
      while (true) {
        val count = input.read(buffer)
        if (count < 0) break
        if (count > 0) digest.update(buffer, 0, count)
      }
      return digest.digest().joinToString("") { byte -> "%02x".format(byte) }
    }
  }

  fun atomicReplace(context: Context, stagedUri: String, destinationUri: String) {
    val staged = appOwnedFile(context, stagedUri, mustExist = true)
    val destination = appOwnedFile(context, destinationUri, mustExist = false)
    require(staged.isFile) { "The staged URI must reference a regular file." }
    require(staged.parentFile?.canonicalFile == destination.parentFile?.canonicalFile) {
      "Atomic replacement requires staged and destination files to be siblings."
    }
    require(staged != destination) { "Staged and destination files must differ." }
    require(!destination.exists() || destination.isFile) {
      "The destination must be absent or a regular file."
    }
    FileOutputStream(staged, true).use { stream -> stream.fd.sync() }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      try {
        Files.move(
          staged.toPath(),
          destination.toPath(),
          StandardCopyOption.ATOMIC_MOVE,
          StandardCopyOption.REPLACE_EXISTING,
        )
      } catch (_: AtomicMoveNotSupportedException) {
        // Never delete the published destination first. Same-directory replace is the safe fallback.
        Files.move(staged.toPath(), destination.toPath(), StandardCopyOption.REPLACE_EXISTING)
      }
    } else {
      // POSIX rename atomically replaces a same-filesystem destination on API 21-25.
      Os.rename(staged.absolutePath, destination.absolutePath)
    }
  }

  private fun openForRead(context: Context, uriString: String): InputStream {
    val uri = Uri.parse(uriString)
    return when (uri.scheme?.lowercase()) {
      "content" -> context.contentResolver.openInputStream(uri)
        ?: throw IllegalArgumentException("Unable to open content URI.")
      "file" -> FileInputStream(appOwnedFile(context, uriString, mustExist = true))
      null -> FileInputStream(appOwnedFile(context, uriString, mustExist = true))
      else -> throw IllegalArgumentException("Only app-owned file and content URIs can be hashed.")
    }
  }

  private fun appOwnedFile(context: Context, uriString: String, mustExist: Boolean): File {
    val uri = Uri.parse(uriString)
    val path = when (uri.scheme?.lowercase()) {
      "file" -> uri.path
      null -> uriString
      else -> null
    } ?: throw IllegalArgumentException("Atomic replacement accepts only file URIs or absolute paths.")
    require(File(path).isAbsolute) { "Atomic replacement requires an absolute path." }
    val file = if (mustExist) File(path).canonicalFile else {
      val requested = File(path)
      val parent = requested.parentFile?.canonicalFile
        ?: throw IllegalArgumentException("Destination has no parent directory.")
      File(parent, requested.name)
    }
    val roots = buildList {
      add(context.filesDir)
      add(context.noBackupFilesDir)
      add(context.cacheDir)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) add(context.codeCacheDir)
      context.getExternalFilesDirs(null).filterNotNull().forEach(::add)
      context.externalCacheDirs.filterNotNull().forEach(::add)
    }.map { it.canonicalFile }
    require(roots.any { root -> file == root || file.path.startsWith(root.path + File.separator) }) {
      "Path is outside app-owned storage."
    }
    if (mustExist) require(file.exists()) { "File does not exist." }
    return file
  }
}

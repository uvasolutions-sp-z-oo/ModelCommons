package expo.modules.modelcommonsnative.storage

import android.content.pm.ProviderInfo
import android.os.ParcelFileDescriptor
import android.system.Os
import android.system.OsConstants
import android.test.AndroidTestCase
import java.io.File
import java.security.MessageDigest

/** Exercises actual Android SDK fields; string-based source checks cannot do this. */
@Suppress("DEPRECATION")
class SharedProviderContractTest : AndroidTestCase() {
  private fun provider() = ProviderInfo().apply {
    enabled = true
    exported = true
    grantUriPermissions = true
    readPermission = "android.permission.MANAGE_DOCUMENTS"
    writePermission = "android.permission.MANAGE_DOCUMENTS"
  }

  fun testRestrictedProviderAndEachMissingProtection() {
    AndroidSharedModelFiles.requireRestrictedProvider(provider())
    val weakened = listOf<ProviderInfo.() -> Unit>(
      { enabled = false }, { exported = false }, { grantUriPermissions = false },
      { readPermission = null }, { writePermission = null },
      { readPermission = "example.permission" }, { writePermission = "example.permission" },
    )
    for (change in weakened) {
      try {
        AndroidSharedModelFiles.requireRestrictedProvider(provider().apply(change))
        fail("A provider with a missing protection was accepted")
      } catch (error: IllegalArgumentException) {
        assertTrue(error.message.orEmpty().startsWith("PERMISSION_REQUIRED:"))
      }
    }
  }

  fun testHashAndCancellationPreserveTheOpenDescriptorAndOffset() {
    val file = File.createTempFile("modelcommons-hash-", ".bin", context.cacheDir)
    try {
      val bytes = ByteArray(2 * 1024 * 1024 + 17) { (it % 251).toByte() }
      file.writeBytes(bytes)
      ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
        Os.lseek(descriptor.fileDescriptor, 7, OsConstants.SEEK_SET)
        val expected = MessageDigest.getInstance("SHA-256").digest(bytes)
          .joinToString("") { "%02x".format(it) }
        assertEquals(expected, AndroidSharedModelFiles.hashDescriptor(descriptor) { false })
        assertEquals(7L, Os.lseek(descriptor.fileDescriptor, 0, OsConstants.SEEK_CUR))
        var checks = 0
        try {
          AndroidSharedModelFiles.hashDescriptor(descriptor) { ++checks >= 3 }
          fail("Verification ignored cancellation between chunks")
        } catch (error: IllegalArgumentException) {
          assertTrue(error.message.orEmpty().startsWith("USER_CANCELLED:"))
        }
        assertEquals(3, checks)
        assertEquals(bytes.size.toLong(), Os.fstat(descriptor.fileDescriptor).st_size)
        assertEquals(7L, Os.lseek(descriptor.fileDescriptor, 0, OsConstants.SEEK_CUR))
      }
    } finally {
      file.delete()
    }
  }
}

package expo.modules.modelcommonsnative.security

import android.content.Context
import android.content.ContextWrapper
import android.content.SharedPreferences
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import android.test.AndroidTestCase
import android.test.mock.MockPackageManager
import java.util.UUID

/** Real installed signing data with isolated test-only UID/package and preference fixtures. */
@Suppress("DEPRECATION")
class CallerAuthorizationTest : AndroidTestCase() {
  fun testDeniedApprovedScopesRevocationAndSharedUid() {
    val fixture = Fixture(context)
    val authorizer = CallerAuthorizer(fixture)
    fun denied(scope: String) {
      try { authorizer.requireAuthorized(fixture.clientUid, scope); fail("Unapproved scope accepted") }
      catch (_: SecurityException) {}
    }
    try {
      denied("metadata")
      val pin = authorizer.signingFingerprints("example.client").first()
      try {
        expo.modules.modelcommonsnative.client.AndroidHubClient(fixture) { fail("Untrusted Hub emitted content") }
          .connect("example.client", listOf("b".repeat(64))) { fail("Untrusted Hub bound") }
        fail("Wrong Hub signing pin accepted")
      } catch (_: IllegalArgumentException) {}
      authorizer.setAuthorization("example.client", fixture.clientUid / 100000, pin, true, listOf("metadata", "inference"))
      val approved = authorizer.requireAuthorized(fixture.clientUid, "inference")
      fixture.signerPackage = "android"
      denied("inference")
      fixture.signerPackage = fixture.original.packageName
      fixture.packages = arrayOf("example.client", "example.shared")
      denied("inference") // same UID and signer are insufficient without the second package approval
      fixture.packages = arrayOf("example.client")
      authorizer.setAuthorization("example.client", fixture.clientUid / 100000, pin, true, listOf("metadata"))
      denied("inference")
      assertFalse(approved == authorizer.requireAuthorized(fixture.clientUid, "metadata"))
      authorizer.setAuthorization("example.client", fixture.clientUid / 100000, pin, false, emptyList())
      denied("metadata")
      try { authorizer.requireAuthorized(fixture.clientUid + 1000, "metadata"); fail("Spoofed UID accepted") }
      catch (_: SecurityException) {}
    } finally { fixture.preferences.edit().clear().commit() }
  }
  private class Fixture(val original: Context) : ContextWrapper(original) {
    val clientUid = Process.myUid() + 1
    var packages = arrayOf("example.client")
    var signerPackage = original.packageName
    val preferences: SharedPreferences = original.getSharedPreferences("modelcommons-test-${UUID.randomUUID()}", Context.MODE_PRIVATE)
    override fun getPackageName() = "example.hub"
    override fun getSharedPreferences(name: String, mode: Int) = preferences
    override fun getPackageManager(): PackageManager = object : MockPackageManager() {
      override fun getPackagesForUid(uid: Int): Array<String>? = if (uid == clientUid) packages else null
      override fun getApplicationInfo(name: String, flags: Int) = ApplicationInfo().apply { uid = clientUid; packageName = name }
      override fun getPackageInfo(name: String, flags: Int): PackageInfo = original.packageManager.getPackageInfo(signerPackage, flags)
      override fun hasSigningCertificate(name: String, certificate: ByteArray, type: Int): Boolean =
        Build.VERSION.SDK_INT >= 28 && original.packageManager.hasSigningCertificate(signerPackage, certificate, type)
    }
  }
}

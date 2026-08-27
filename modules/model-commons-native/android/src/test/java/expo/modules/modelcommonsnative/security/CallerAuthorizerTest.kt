package expo.modules.modelcommonsnative.security

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CallerAuthorizerTest {
  @Test
  fun trustsOnlyTheSoleHubPackageForTheHubUid() {
    assertTrue(
      CallerAuthorizer.isTrustedHubProcess(
        callerUid = 10001,
        hubUid = 10001,
        packages = listOf("com.example.hub"),
        hubPackage = "com.example.hub",
      )
    )
    assertFalse(
      CallerAuthorizer.isTrustedHubProcess(
        callerUid = 10001,
        hubUid = 10001,
        packages = listOf("com.example.hub", "com.example.shareduid"),
        hubPackage = "com.example.hub",
      )
    )
  }

  @Test
  fun rejectsDifferentUidOrDifferentPackage() {
    assertFalse(
      CallerAuthorizer.isTrustedHubProcess(
        callerUid = 10002,
        hubUid = 10001,
        packages = listOf("com.example.hub"),
        hubPackage = "com.example.hub",
      )
    )
    assertFalse(
      CallerAuthorizer.isTrustedHubProcess(
        callerUid = 10001,
        hubUid = 10001,
        packages = listOf("com.example.other"),
        hubPackage = "com.example.hub",
      )
    )
  }
}

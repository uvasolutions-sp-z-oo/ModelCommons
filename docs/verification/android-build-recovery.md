# Recover the September 17 Android build failure

The saved Gradle log identified three separate problems:

- Hub source: `Connection::dictionary` referenced a member extension, which
  Kotlin cannot use as a callable reference. The source now uses
  `granted.map { it.dictionary() }`.
- SPM's installed **and vendored** `@modelcommons/native` 0.2.0 still contained
  the old `provider.permission` expressions. Repacking and installing the current
  connector is required; retrying the same installed package will fail again.
- The Gradle daemon ran with a 512 MB Metaspace limit and exhausted it. KSP and
  build shutdown then reported repeated failures from the same memory problem.

The `codecvt`/`wstring_convert` deprecation notices, OpenCL TODO message and
cross-drive hard-link fallback were warnings, not these compilation errors.

Run the following in **PowerShell**, in order. These remain owner-run commands.
Stop at the first error. Do not run `clean`, delete native build caches, or use
`prebuild --clean`. This recovery uses the existing generated Android projects;
both were already configured with `rnllamaBuildFromSource=true`.

## 1. Target the emulator and check the Hub connector first

```powershell
adb devices
$androidSerial = 'emulator-5554' # Replace with the listed running emulator.
$androidAbi = (adb -s $androidSerial shell getprop ro.product.cpu.abi).Trim()
if ($LASTEXITCODE -ne 0 -or $androidAbi -notin @('x86_64', 'arm64-v8a')) {
  throw 'Select a connected 64-bit Android device before building'
}
$gradleArgs = @(
  '--no-daemon', '--no-parallel', '--max-workers=2', '--console=plain', '--build-cache',
  '-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=2048m -Dfile.encoding=UTF-8',
  "-PreactNativeArchitectures=$androidAbi"
)

Set-Location 'D:\GitHub\ModelCommons\android'
.\gradlew.bat :modelcommons-native:compileReleaseKotlin @gradleArgs
if ($LASTEXITCODE -ne 0) { throw 'Stop: ModelCommons connector compilation failed' }
```

This checks the actual Kotlin SDK compilation before paying for the llama.rn
C++ application build. The expected result is `BUILD SUCCESSFUL`.
The command gives Gradle a 4 GB heap and 2 GB Metaspace ceiling, disables parallel
project execution and limits workers to two. These are limits, not a guarantee
of total build memory usage; C++ tools and an emulator also need RAM. Close
other heavy builds while retrying.

`org.gradle.jvmargs` controls the build VM; changing only `JAVA_OPTS` does not
fix its Metaspace limit. See [Gradle's JVM configuration](https://docs.gradle.org/current/userguide/config_gradle.html).

## 2. Repack and refresh SPM without discarding llama.rn's build cache

```powershell
Set-Location 'D:\GitHub\ModelCommons'
npm.cmd run packages:pack-local -- 'D:\GitHub\spm\vendor\modelcommons'
if ($LASTEXITCODE -ne 0) { throw 'Stop: package packing failed' }

Set-Location 'D:\GitHub\spm'
$localPackages = @((Get-Content .\package.json -Raw | ConvertFrom-Json).dependencies.PSObject.Properties |
  Where-Object { $_.Name.StartsWith('@modelcommons/') } |
  ForEach-Object { "$($_.Name)@$($_.Value)" })
if ($localPackages.Count -ne 9) { throw 'Expected nine local ModelCommons packages' }
npm.cmd install --force @localPackages
if ($LASTEXITCODE -ne 0) { throw 'Stop: local package installation failed' }
npm.cmd run eas-build-post-install
if ($LASTEXITCODE -ne 0) { throw 'Stop: native preparation failed' }
node 'D:\GitHub\ModelCommons\scripts\verify-local-consumer.cjs' 'D:\GitHub\spm'
if ($LASTEXITCODE -ne 0) { throw 'Stop: installed packages are still stale or inconsistent' }
```

This is a targeted retry install. The checker verifies archive/lockfile integrity,
required hooks, and that the installed Android connector matches the current
ModelCommons source (normalizing line endings). A version number alone is not
enough. If the checker fails, keep its error and stop before building.

The clean `npm ci` installation in the [full quick start](android-local-expo-quickstart.md)
remains the separate reproducibility check. It replaces all `node_modules`, so
it also removes the expensive native build outputs stored inside dependencies.
Do not run it merely to retry this compile error. Updated native sources may
still require their affected C++ objects to rebuild; that cannot be skipped.

## 3. Check SPM Kotlin and KSP before the complete build

In the same PowerShell session, retain `$gradleArgs` from step 1:

```powershell
Set-Location 'D:\GitHub\spm'
$env:APP_VARIANT = 'uva'
$env:APP_ENV = 'preview'
Set-Location '.\android'
.\gradlew.bat :modelcommons-native:compileReleaseKotlin :expo-updates:kspReleaseKotlin @gradleArgs
if ($LASTEXITCODE -ne 0) { throw 'Stop: SPM Kotlin/KSP compilation failed' }
```

Both tasks must succeed. If one fails, send the first `e: file:///...kt:line`
diagnostic or the actual memory exception, rather than only the final task
summary. No full app build is needed to diagnose these two tasks.

## 4. Build and install the standalone apps

The build below invokes the same local Gradle release task used by Expo, with
explicit memory and ABI limits. Expo then installs/opens the built APK via
`--binary`, avoiding a second build. There is no EAS cloud operation or Metro
requirement.

```powershell
Set-Location 'D:\GitHub\ModelCommons'
npm.cmd run android:prepare-native
if ($LASTEXITCODE -ne 0) { throw 'Stop: Hub native preparation failed' }
Set-Location '.\android'
.\gradlew.bat :app:assembleRelease -x lint -x test @gradleArgs
if ($LASTEXITCODE -ne 0) { throw 'Stop: Hub release build failed' }
Set-Location '..'
npx.cmd expo run:android --device --variant release --no-bundler --binary '.\android\app\build\outputs\apk\release\app-release.apk'
if ($LASTEXITCODE -ne 0) { throw 'Stop: Hub installation failed' }

Set-Location 'D:\GitHub\spm\android'
.\gradlew.bat :app:assembleRelease -x lint -x test @gradleArgs
if ($LASTEXITCODE -ne 0) { throw 'Stop: SPM release build failed' }
Set-Location '..'
npx.cmd expo run:android --device --variant release --no-bundler --binary '.\android\app\build\outputs\apk\release\app-release.apk'
if ($LASTEXITCODE -ne 0) { throw 'Stop: SPM installation failed' }
```

At each Expo device prompt, select the emulator used for the ABI check. This
installed Expo CLI resolves a supplied `--device` string by emulator/device
name, not by the ADB serial `emulator-5554`. Bare `--device` opens its selector;
with only one intended running emulator, you can omit `--device` entirely.
If the APK built successfully and only device selection failed, rerun just the
Expo `--binary` command from that app's root. No rebuild is needed. Plain
`npm run android` starts the default debug build and Metro instead.

Do not uninstall an existing Hub to bypass a signing mismatch if its model data
must be kept. Use a separate emulator or matching signing credentials.

Continue with APK inspection and the sharing test in steps 5–6 of the
[quick start](android-local-expo-quickstart.md). On x86_64, test the Hub's provider
and SPM inference; the Hub's own chat worker still requires ARM64.

Status: the source correction and instructions are prepared. Successful Kotlin,
KSP, full builds and device inference remain to be established by this retry.

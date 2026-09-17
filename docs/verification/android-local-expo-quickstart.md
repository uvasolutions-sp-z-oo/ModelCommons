# Local Android builds with Expo on Windows

Run these commands yourself in **PowerShell**, in order. Stop at the first
non-zero exit code and keep that error output. These are local builds; Expo Go
cannot load these native modules, and no EAS cloud build is needed.

Status: source changes prepared; the commands and device acceptance below still
need an owner run. Do not treat a successful package check as Android proof.

If you hit the September 17 Kotlin/Metaspace failure, use the
[focused recovery procedure](android-build-recovery.md). It checks Kotlin/KSP
first and preserves the existing dependency build caches during package refresh.

## 1. Start the emulator

Install the Android SDK/build tools and the JDK required by the existing Expo 54
projects through Android Studio. Start your Android virtual device in **Device
Manager**. Use a 64-bit image and allow enough RAM for the selected small model.
Ensure `java`, Node/npm and the SDK's `platform-tools` are on your PATH.

```powershell
adb devices
$androidSerial = 'emulator-5554' # Replace with the serial listed as "device" above.
$androidAbi = (adb -s $androidSerial shell getprop ro.product.cpu.abi).Trim()
if ($LASTEXITCODE -ne 0 -or $androidAbi -notin @('x86_64', 'arm64-v8a')) {
  throw 'Select a connected 64-bit Android device before building'
}
# Applies to Gradle launched by Expo in this PowerShell session.
$env:GRADLE_OPTS = "$env:GRADLE_OPTS " +
  '-Dorg.gradle.jvmargs="-Xmx4096m -XX:MaxMetaspaceSize=2048m -Dfile.encoding=UTF-8" ' +
  '-Dorg.gradle.workers.max=2 -Dorg.gradle.parallel=false ' +
  "-Dorg.gradle.project.reactNativeArchitectures=$androidAbi"
```

An **x86_64 emulator** can exercise the ModelCommons document provider and SPM's
own llama.rn inference. ModelCommons' separate chat worker currently supports
**arm64-v8a only**: Hub chat is not an acceptance requirement on x86_64. Do not
interpret its unavailable-runtime error there as failure of folder sharing.
Use an ARM64 physical phone for the full two-app acceptance, including Hub chat
and the original first-download 135M regression.

The session options above raise the previously exhausted 512 MB Metaspace cap,
limit Gradle concurrency and target this device's ABI. Expo release builds do
not automatically select only the attached device's ABI. These JVM limits need
room alongside the emulator and native compiler processes. They do not change
the checked-in release/distribution architecture configuration.

## 2. Check and prepare ModelCommons

Your previous SPM `npm install` completed, but the native/runtime packages have
changed again since that install. Check the current source before repacking:

```powershell
Set-Location 'D:\GitHub\ModelCommons'
npm.cmd run lint
if ($LASTEXITCODE -ne 0) { throw 'ModelCommons lint failed' }
npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) { throw 'ModelCommons typecheck failed' }
npm.cmd test
if ($LASTEXITCODE -ne 0) { throw 'ModelCommons tests failed' }
npm.cmd run android:prepare-native
if ($LASTEXITCODE -ne 0) { throw 'ModelCommons native preparation failed' }
npm.cmd run packages:pack-local -- 'D:\GitHub\spm\vendor\modelcommons'
if ($LASTEXITCODE -ne 0) { throw 'Consumer package packing failed' }
```

The preparation hook applies the reviewed descriptor patch to exactly llama.rn
0.12.9. It may obtain that dependency's checksum-verified native support payloads;
it does not download models. Packing produces all nine archives and provenance.

## 3. Refresh SPM's lockfile and install the new archives

Pass all nine explicit local dependencies to npm so repacked archives with the
same version numbers are reconsidered. Then use `npm ci` to prove the resulting
lockfile can install them from scratch. This replaces SPM's generated
`node_modules`; it does not change either installed Android app's data.

```powershell
Set-Location 'D:\GitHub\spm'
$localPackages = @((Get-Content .\package.json -Raw | ConvertFrom-Json).dependencies.PSObject.Properties |
  Where-Object { $_.Name.StartsWith('@modelcommons/') } |
  ForEach-Object { "$($_.Name)@$($_.Value)" })
if ($localPackages.Count -ne 9) { throw 'Expected nine local ModelCommons packages' }
npm.cmd install --package-lock-only --force @localPackages
if ($LASTEXITCODE -ne 0) { throw 'Local package lockfile refresh failed' }
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Clean dependency installation failed' }
npm.cmd run eas-build-post-install
if ($LASTEXITCODE -ne 0) { throw 'SPM native preparation failed' }
node 'D:\GitHub\ModelCommons\scripts\verify-local-consumer.cjs' 'D:\GitHub\spm'
if ($LASTEXITCODE -ne 0) { throw 'Consumer package consistency check failed' }
npm.cmd run config:validate
if ($LASTEXITCODE -ne 0) { throw 'SPM configuration check failed' }
npm.cmd run config:validate:uva:production
if ($LASTEXITCODE -ne 0) { throw 'UVA production configuration check failed' }
npm.cmd run config:validate:customer:production
if ($LASTEXITCODE -ne 0) { throw 'Customer production configuration check failed' }
npm.cmd test
if ($LASTEXITCODE -ne 0) { throw 'SPM tests failed' }
```

The consistency check must report agreement for all nine archives, provenance,
lockfile entries, installed versions and the newly required hooks. An integrity
failure means stop before building; do not edit integrity hashes by hand. Review
the generated archives, provenance and lockfile together when you later commit.
The `--force` above refreshes the explicit local packages; it is not
`npm audit fix --force` and does not request unrelated dependency upgrades.

## 4. Build and install both apps locally

Run in the **same PowerShell session** as step 1. Non-clean prebuild is required:
Expo's run command does not necessarily regenerate an existing `android/`
directory when a config plugin changes. Review native changes if these projects
contain manual customizations; do not add `--clean`.

Build ModelCommons:

```powershell
Set-Location 'D:\GitHub\ModelCommons'
npx.cmd expo prebuild --platform android --no-install
if ($LASTEXITCODE -ne 0) { throw 'ModelCommons prebuild failed' }
Select-String -Path .\android\gradle.properties -Pattern '^rnllamaBuildFromSource=true$'
Push-Location '.\android'
try {
  .\gradlew.bat :modelcommons-native:compileReleaseKotlin --no-daemon --console=plain
  if ($LASTEXITCODE -ne 0) { throw 'ModelCommons connector Kotlin compilation failed' }
} finally { Pop-Location }
npx.cmd expo run:android --device --variant release --no-bundler
if ($LASTEXITCODE -ne 0) { throw 'ModelCommons local build/install failed' }
```

Build Sales&Pricing Mobile:

```powershell
Set-Location 'D:\GitHub\spm'
$env:APP_VARIANT = 'uva'
$env:APP_ENV = 'preview'
npx.cmd expo prebuild --platform android --no-install
if ($LASTEXITCODE -ne 0) { throw 'SPM prebuild failed' }
Select-String -Path .\android\gradle.properties -Pattern '^rnllamaBuildFromSource=true$'
Push-Location '.\android'
try {
  .\gradlew.bat :modelcommons-native:compileReleaseKotlin :expo-updates:kspReleaseKotlin --no-daemon --console=plain
  if ($LASTEXITCODE -ne 0) { throw 'SPM Kotlin/KSP compilation failed' }
} finally { Pop-Location }
npx.cmd expo run:android --device --variant release --no-bundler
if ($LASTEXITCODE -ne 0) { throw 'SPM local build/install failed' }
```

Select the same emulator at each Expo device prompt. In the installed CLI,
`--device <value>` matches the device name, not the ADB serial used above. Bare
`--device` opens the selector; omit it entirely to use Expo's default device.

Both property inspections must show `rnllamaBuildFromSource=true`. The source
build includes both the JNI wrapper and its matching core. The first native
build can take a while and requires the configured Android SDK/NDK/CMake and
Gradle dependencies. These commands bundle JavaScript into standalone release
APKs and install/open them on the selected emulator; no Metro process is needed.

Both existing release build types currently use the local debug keystore. These
APKs are for local testing. If installation reports `INSTALL_FAILED_UPDATE_INCOMPATIBLE`,
the existing app uses another signer. Use a separate test emulator or matching
signing credentials; do not uninstall a Hub containing models you need to keep.

## 5. Inspect the built native payload

```powershell
Set-Location 'D:\GitHub\ModelCommons'
.\scripts\inspect-android-descriptor-apk.ps1 `
  -Apk 'D:\GitHub\ModelCommons\android\app\build\outputs\apk\release\app-release.apk' -Abi $androidAbi
.\scripts\inspect-android-descriptor-apk.ps1 `
  -Apk 'D:\GitHub\spm\android\app\build\outputs\apk\release\app-release.apk' -Abi $androidAbi
```

Each JNI/core pair for that ABI must contain the descriptor handshake symbols.
This checks APK contents only. During actual shared-model initialization, the
app also queries the **loaded** JNI wrapper, which calls into its linked core
and checks the common parameter-layout size before an FD is handed over.

Optional SDK instrumentation checks for actual `ProviderInfo` fields and
cancellable descriptor hashing, on the emulator already running:

```powershell
Set-Location 'D:\GitHub\ModelCommons\android'
$env:ANDROID_SERIAL = $androidSerial
.\gradlew.bat :modelcommons-native:connectedDebugAndroidTest --no-daemon
if ($LASTEXITCODE -ne 0) { throw 'Native connector instrumentation failed' }
```

These small tests use synthetic files. They do not establish cross-app model
loading or replace the physical-device acceptance.

## 6. Try the sharing flow

1. Open ModelCommons. Use your approved small text model; wait for **READY** and
   accept its license. A new emulator has no model installed yet.
2. Open SPM -> **Settings -> Local AI -> ModelCommons -> Choose shared folder**.
   In Android's picker open **ModelCommons shared models** and approve the root.
3. Refresh, choose that installed model and the **Safe** profile, then press
   **Test local AI**. The fixed test asks for a short sentence about a blue bicycle.
4. Require streamed text, completion, and cleanup `released`. The exported
   diagnostic must include `transportKind: android-shared-files`,
   `executionOwner: application`, `nativeDescriptorHandshakeVersion: 1`,
   `sameBackingVerification: true` and unchanged private-model counts/counters.
5. Repeat with airplane mode enabled, and after restarting SPM. Cancel while
   the message says **Verifying the selected artifact**; the native read should
   stop between chunks and cleanup must finish before another test starts.
6. Select the same shared folder again and cancel; the prior grant must survive.
   Also test recovery from an old `android-binder:` selection or a revoked grant.

On an ARM64 phone, separately reproduce the original Hub issue: start with only
the approved 135M model installed, select it and chat before adding a second
model. Use the [full acceptance checklist](android-shared-files-owner-run.md)
for signer/UID, no-copy, lifecycle and physical offline evidence.

If anything fails, keep the first build error or the sanitized Local AI report,
plus the app/ABI/stage. Do not post full device logs containing business data.

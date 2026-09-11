# Android Binder inference — owner-run verification

Status, 2026-09-11: implementation source added. The owner's first validation run passed 22 of 23 selected TypeScript tests; typecheck found missing cache settings in the initialization test fixture, and the native-error test incorrectly required an omitted `cause` property. Both fixtures are corrected in source, **awaiting an owner rerun**. The owner also installed dependencies and packed nine consumer packages, but that pack ran after failed checks and is not validation evidence. Native compilation, signed-device verification and release support remain unverified. No installs, test runs, package repacks, native builds, EAS operations, model downloads, credential changes, app-data deletion or Git writes were performed by the agent. Preserve the separate [iOS acceptance gate](ios-shared-models.md).

## Architecture and source authority

Latest owner evidence: S&P's selected suite now passes **31/31**. Both Android prebuilds completed, and autolinking listed the host only in Hub and the connector in both apps. Both native builds stopped at connector Kotlin compilation: a missing `MAX_IDENTIFIER_BYTES` constant and a repeated `@Synchronized` annotation. Source now defines the existing 256-byte limit once for service/client use and keeps one synchronization annotation. Native compilation remains **awaiting an owner rerun**. These native source corrections require a fresh consumer package archive/install before retrying the S&P build.

`S&P local_modelcommons → @modelcommons/native createAndroidBinderTransport → AndroidHubClient → Binder API 2 → ModelCommonsService → process-wide InferenceCoordinator → optional @modelcommons/inference-host → isolated JNI/llama.cpp CPU worker`.

Hub chat uses that same Binder service through its own UID; no external self-approval is required. No mounted Activity, React component, React-owned JSI runtime or embedded S&P engine is an execution dependency. Protocol/client remain platform-neutral. The connector has no host dependency; the Hub-only package depends on the connector and the existing exact `llama.rn` source package. The consumer pack script intentionally excludes the heavy host.

The source is the **patched npm archive**, not an arbitrary upstream checkout:

- Package: `llama.rn@0.12.9`, archive `https://registry.npmjs.org/llama.rn/-/llama.rn-0.12.9.tgz`.
- Archive integrity: `sha512-uRsTVARp1KnDkDg00FvOGIrN6SZfMqYVJfCOdxN9FSyGufLC+Aad6oFWZVEO8vmtNqu+JBlsCGevP4sJGifAvg==`.
- Package build metadata: `b10256`, upstream short commit label `6c8dcaa`; this label alone is not the source pin.
- The locally cached archive's SHA-512 matched the lockfile, and its complete `cpp/` inventory matched all **683 installed source files** byte for byte. [source-pin.json](../../modules/model-commons-inference-host/source-pin.json) records SHA-256 for every file. CMake rejects added, missing or modified source files using [source-files.cmake](../../modules/model-commons-inference-host/source-files.cmake).
- [NOTICE](../../modules/model-commons-inference-host/NOTICE) carries both source MIT notices. No copied binary, dynamic `llama.rn` ABI, upstream-main fetch or workspace-specific build path is used. Existing embedded/iOS `llama.rn` remains 0.12.9.

The new library is `libmodelcommons_host.so`. Hidden visibility, a JNI-only linker export map and `-Bsymbolic` isolate it from `llama.rn` in the same process. Owner inspection of the built symbol table remains mandatory. Gradle resolves the installed package with Node in the build checkout, including EAS; CMake reads its verified source directly. Current host target: **arm64-v8a, Android API 24+, C++17, CPU only**, using the existing project's NDK and CMake 3.22+; no x86 emulator or GPU/NPU claim.

The worker calls the installed headers' actual `llama_model_load_from_file_ptr`, `llama_model_chat_template`, `llama_chat_apply_template`, `llama_tokenize`, `llama_decode`, sampler-chain and token-to-piece APIs. It loads from a duplicate of the verified descriptor. Model/context/sampler destruction completes in JNI before the Kotlin descriptor closes and the coordinator becomes available. Cancellation reaches model-load progress and CPU decode abort callbacks through a native atomic control. UTF-8 token fragments are decoded incrementally without splitting surrogate pairs.

## Supported contract and limits

API **2** is incompatible with the old scaffold's parcels/signatures. Both apps need rebuilt matching native connectors. Protocol remains **0.1.0**. Session creation negotiates protocol, `safe`, context **1024**, output ceiling **128** and an idle-session Binder lifetime token. A request may ask for fewer output tokens. Unsupported profiles, larger contexts/output, tools, structured output, vision/audio, stop-sequence arrays, arbitrary paths/URLs, metadata and unsupported roles/fields are rejected. Prompt token count plus output reserve must fit 1024; history is never silently truncated. EOG and output length are supported stop reasons.

| Boundary          | Enforced limit / meaning                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Worker            | One admitted generation and one loaded context process-wide; busy requests are rejected, no waiting inference queue       |
| Session           | Four per UID, sixteen total, thirty-two distinct request IDs per session; duplicate IDs rejected                          |
| Idle session      | Five-minute timeout plus death token, including before first generation                                                   |
| Request           | 48 KiB UTF-8, strict JSON, depth 12, 8192 structural nodes, bounded arrays/messages/parts                                 |
| Events            | 16 KiB UTF-8; final escaped text limited to 12 KiB with explicit failure on overflow                                      |
| Flow control      | One unacknowledged event, five-second consumption deadline; bounded delivery executor, separate from worker/control paths |
| Execution         | Two-minute cooperative request deadline; no sticky start, background-execution or foreground-service promise              |
| Metadata          | Protocol 4 KiB, manifest 16 KiB, registry 1 MiB / 500 records / bounded structural parser; two pinned starter descriptors |
| Pending approvals | 128 entries with per-client write throttling; persisted approvals bounded and revalidated                                 |

`centralizedInference=true` / `runtimeState=READY` means the optional CPU host implementation and its native library are present. It is **not** evidence of a model load or generation. Discovery advertises installed metadata that matches trusted pins; every generation independently rechecks store authority and hashes the actual GGUF. Session creation is admission, not model initialization. Only a successful canonical terminal and confirmed drain establish that particular execution succeeded and released resources.

The trusted pins are the existing SmolLM2 135M and 360M Q4_K_M catalog entries, with their exact revisions, storage IDs, sizes, SHA-256 and ungated Apache-2.0 licenses. The root comes from Expo's actual producer: `legacy/AppDirectoriesModule.kt persistentFilesDirectory = context.filesDir`, exposed as `FileSystemLegacyModule`'s `documentDirectory`. Native resolution uses its canonical parent plus `ModelCommons`, checks `protocol.json`, `registry.json`, the immutable relative manifest path and per-model manifest, confines opens, rejects symlinks/non-regular files, checks exact size, streams SHA-256, then retains that descriptor through execution. Inventory publication is not artifact authority. No inference path downloads or copies a model.

Hub download/publication and deletion acquire the same process-wide mutation gate. Deletion fails while any request owns it, including another app's request. If a JS owner is destroyed during a mutation, the gate stays occupied until completion or process restart: automatically unlocking would risk concurrent writes and mmap. iOS deletion deferral remains intact.

## Identity and lifecycle

The Hub authorizes OS-derived UID, user, complete package set, current signing identity, approved certificate lineage and scope. Sessions capture identity plus approval epoch; worker admission and event delivery recheck it. Revocation or a scope/signing change cancels work and suppresses future content. Packages sharing a UID each require approval. Pending approval discovery does not grant access. No caller-supplied package, path or checksum is trusted as authority.

The consumer selects a configured package and checks its installed signing certificates before binding. Configuration contains public certificate SHA-256 fingerprints, never private keys. Package visibility uses explicit `<queries>` entries; no broad package enumeration permission is introduced. Normal cross-app clients still require explicit Hub approval even when signed by the same developer.

The connector cancels/releases on background transition, account boundary, disconnect and iterator abandonment. A release acknowledgement only means cleanup was requested; `isSessionDrained` reports native completion. A missing connection cannot prove drain: S&P records failure/unknown and requires restart when cleanup is uncertain. Tokens and buffers are cleared between requests; there is no shared context/KV cache. Live cooperative streams have one start and one terminal. Delivery cannot be guaranteed to a dead, revoked or non-consuming endpoint; these paths cancel and discard remaining content instead of accumulating callbacks.

Ordinary process reclamation and cold bind are distinct from force-stop. Use Android's [bound-service lifecycle](https://developer.android.com/develop/background-work/services/bound-services) and [Binder death/oneway semantics](https://developer.android.com/reference/kotlin/android/os/IBinder) when interpreting results. The source uses an ordinary bound service; user force-stop can require explicitly reopening Hub. No indefinite background availability is promised.

## Owner commands — not executed by the agent

Review the working diffs first. The root manifest now includes the optional host workspace, so let npm regenerate the producer lock; never hand-edit integrity fields. The installs below may invoke the existing pinned payload installer. Do not replace either app's signing configuration.

```powershell
& {
  $ErrorActionPreference = 'Stop'
  Set-Location D:\GitHub\ModelCommons
  npm install
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
  npm run typecheck
  if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed; packages were not refreshed.' }
  npm run test -- modules/model-commons-native/src/__tests__/androidTransport.test.ts modules/model-commons-native/src/__tests__/nativeError.test.ts services/modelcommons/__tests__/catalog.test.ts packages/client/src/__tests__/in-process.test.ts packages/runtime-llama-rn/src/__tests__/runtime.test.ts packages/runtime-llama-rn/src/__tests__/initialization.test.ts
  if ($LASTEXITCODE -ne 0) { throw 'Tests failed; packages were not refreshed.' }
  npm run packages:pack-local -- 'D:/GitHub/spm/vendor/modelcommons'
  if ($LASTEXITCODE -ne 0) { throw 'Package refresh failed.' }
}
```

Run this as one script block: the explicit native exit-code checks prevent PowerShell from continuing to pack after failed validation. If installation already succeeded and dependencies have not changed, omit `npm install` and its adjacent exit-code check on the rerun. The initialization suite is now included in the selected tests.

The first install reported blocked `esbuild`, `llama.rn` and `unrs-resolver` lifecycle scripts. Review them with `npm install-scripts ls`; do not assume dependency installation proves native payload readiness. Before native builds, the existing owner-run `node modules/model-commons-native/scripts/ensure-llama-payload.cjs` checks pinned payload markers/presence and invokes the pinned installer if needed (dependency binaries, not model weights). The reported 31 dependency vulnerabilities need a separate `npm audit` review before selecting targeted fixes; do not apply blanket forced upgrades as part of this Binder verification.

Refresh **all nine consumer packages together**. They retain unpublished version 0.1.0; same-name tarballs require refreshing npm's previous integrity records. This npm-managed removal/reinstall changes dependencies/locks, not user model files. Inspect the resulting dependency graph and generated provenance manifest before a native build.

```powershell
& {
  $ErrorActionPreference = 'Stop'
  Set-Location D:\GitHub\spm
  npm uninstall --ignore-scripts --no-audit --no-fund @modelcommons/client @modelcommons/device-profile @modelcommons/embedded @modelcommons/model-store @modelcommons/native @modelcommons/protocol @modelcommons/provider-anthropic @modelcommons/provider-openai @modelcommons/runtime-llama-rn
  if ($LASTEXITCODE -ne 0) { throw 'Package removal failed; inspect the dependency state.' }
  npm install --save-exact --ignore-scripts --no-audit --no-fund ./vendor/modelcommons/modelcommons-client-0.1.0.tgz ./vendor/modelcommons/modelcommons-device-profile-0.1.0.tgz ./vendor/modelcommons/modelcommons-embedded-0.1.0.tgz ./vendor/modelcommons/modelcommons-model-store-0.1.0.tgz ./vendor/modelcommons/modelcommons-native-0.1.0.tgz ./vendor/modelcommons/modelcommons-protocol-0.1.0.tgz ./vendor/modelcommons/modelcommons-provider-anthropic-0.1.0.tgz ./vendor/modelcommons/modelcommons-provider-openai-0.1.0.tgz ./vendor/modelcommons/modelcommons-runtime-llama-rn-0.1.0.tgz
  if ($LASTEXITCODE -ne 0) { throw 'Consumer installation failed.' }
  npm ls @modelcommons/native @modelcommons/client @modelcommons/protocol @modelcommons/model-store @modelcommons/runtime-llama-rn @modelcommons/embedded @modelcommons/device-profile @modelcommons/provider-openai @modelcommons/provider-anthropic
  if ($LASTEXITCODE -ne 0) { throw 'Consumer dependency verification failed.' }
  node --experimental-vm-modules --test test/androidSharedBridge.test.js test/localSharedBridge.test.js test/localAIBoundaries.test.js test/localAIBuildConfig.test.js test/sharedConnection.test.js
  if ($LASTEXITCODE -ne 0) { throw 'Consumer tests failed.' }
}
```

Ensure `@modelcommons/inference-host` is absent from S&P's dependency graph/archive. Its existing llama.rn package belongs only to explicit embedded mode. The new `/evidence` runtime subpath exports counters without importing the engine. Recheck both node_modules contents and tarball provenance; editing producer TypeScript alone does not update an installed consumer archive.

Configure a **real installed Hub signer** in S&P before its native build. Read the built APK's public signing certificate with Android SDK `apksigner verify --print-certs <Hub.apk>`. Set the following in the owner's build environment, or supply the equivalent `variant.localAI.androidHubs` array. Placeholder text intentionally fails validation; replace it, without changing keystores:

```powershell
$env:MODELCOMMONS_ANDROID_HUB_PACKAGE = 'com.uvasolutions.modelcommons'
$env:MODELCOMMONS_ANDROID_HUB_SHA256 = '<64 hex characters from the installed Hub APK signer>'
```

The optional host is a local Expo module in ModelCommons; consumer builds do not discover it. Both apps need native rebuilds, not OTA updates. For owner-controlled local debug builds, with the existing Android SDK/NDK/JDK installed:

```powershell
& {
  $ErrorActionPreference = 'Stop'
  $env:NODE_ENV = 'development'
  Set-Location D:\GitHub\ModelCommons
  npx expo prebuild --platform android
  if ($LASTEXITCODE -ne 0) { throw 'Hub prebuild failed.' }
  Set-Location android
  .\gradlew.bat :modelcommons-native:testDebugUnitTest :modelcommons-native:connectedDebugAndroidTest :modelcommons-inference-host:connectedDebugAndroidTest :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
  if ($LASTEXITCODE -ne 0) { throw 'Hub native checks/build failed; stop before the S&P build.' }
  Set-Location D:\GitHub\spm
  npx expo prebuild --platform android
  if ($LASTEXITCODE -ne 0) { throw 'S&P prebuild failed.' }
  Set-Location android
  .\gradlew.bat :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
  if ($LASTEXITCODE -ne 0) { throw 'S&P native build failed.' }
}
```

For this Kotlin-only correction, the completed prebuilds can be reused: omit the `npx expo prebuild` lines and their adjacent checks. First retry the Hub Gradle command against local source. After it passes, run the producer validation/pack block and the complete nine-package consumer refresh above, then retry the S&P Gradle command. Do not edit `node_modules`, reuse the earlier archive, or regenerate native projects to fix these compiler errors. The connected test tasks require an attached compatible Android device. These debug commands set `NODE_ENV=development` in the current terminal; use the intended environment for later release workflows.

Use the owner's existing separately signed build workflow for the physical proof; do not interpret two default debug APKs sharing a debug key as that proof. Module Gradle project names derive from Expo's package-name conversion. If autolinking does not expose `modelcommons-native` and `modelcommons-inference-host` in the Hub, stop and inspect dependency/autolinking output. Do not add a guessed standalone library path or bypass the source hashes.

Inspect `libmodelcommons_host.so` with the installed NDK's `llvm-nm -D --defined-only <library>`: only intended `Java_org_modelcommons_host_NativeWorker_*` API symbols should be globally exported. Confirm ordinary `llama_*`, `lm_ggml_*` and C++ symbols are local; confirm the APK's ABI and packaged notices. Also build/run the existing embedded and iOS regression suites before treating this as a release candidate.

## Test sources and remaining coverage

Native test execution is not established by the supplied evidence: both builds stopped at connector Kotlin compilation. The owner's selected producer TypeScript run is recorded above; corrected producer fixtures await a rerun. The latest S&P run passes **31/31**, including all four Android shared-bridge tests and both corrected initialization sanitization assertions. This is not native/device inference verification.

- JVM coordinator contention and foreign-token release tests.
- Android strict JSON/UTF-8/depth/size and authorization tests: denied/approved/scoped/revoked callers, shared UID, changed signer, spoofed UID and wrong Hub pin, using isolated preferences and real installed test signing metadata.
- Android host tests: unsupported text features/output limits, UTF-8 splits, actual JNI cancellation before file open, missing authoritative store, wrong-sized artifact and symlink rejection in a separate cache fixture.
- TypeScript reusable transport tests: event credit, iterator abandonment, drain acknowledgement, native failure propagation and unsupported context.
- S&P VM integration tests: shared Android branches before embedded/store imports, explicit connection requirement, observed nonzero evidence preservation, failure/cleanup handling and strict trust policy. Existing iOS report-version assertions updated to schema 5.

Tests do **not yet establish** native compilation, real model template compatibility on this build, full-model corruption detection on device, cross-process session theft/duplicate/callback-death behavior, cancellation latency, RSS bounds or signed two-app inference. The following owner matrix is required; a source review or mocked stream cannot substitute for it.

## Physical Samsung S22 acceptance

Record device/model/Android version, API/ABI, both APK identifiers/version codes/certificate fingerprints, source revision and archive provenance. Use synthetic text only. Start with a fresh S&P test installation or an owner-confirmed empty private GGUF store; preserve existing user files. A matching model name/hash in two apps is not proof of one stored copy.

1. Hub downloads and verifies one pinned SmolLM2 GGUF once. Record revision, immutable storage ID, size and SHA-256. Use Safe / 1024 / 128 in both UIs; previously persisted larger Hub settings are not silently rewritten.
2. In S&P select ModelCommons, choose the configured Hub and Connect. First connection must be denied/pending. Open Hub voluntarily, approve S&P's **installed certificate** for metadata/inference in Clients, then return and reconnect. Refresh, select that installed model and run the synthetic test.
3. Enable airplane mode **and disable Wi-Fi**. Observe ordered real text and exactly one successful terminal, then `cleanup=released`. Repeat with a different synthetic conversation to detect residual context/KV state.
4. Export sanitized receipt schema 5: `android-binder`, storage/execution `hub`, `modelcommons.android.cpu`, runtime/source identity, model/revision and verified artifact. Require measured private artifact count/bytes zero before and after, unchanged download/import attempt counters and unchanged embedded initialization attempts. Unknown evidence fails the proof. Counters describe this module/JS lifetime; they are not all-time or process-wide attestations. Corroborate with an owner-controlled private-directory inspection in a debuggable test build and absence of consumer provisioning operations.
5. Cancel during verification, model loading and token streaming. Confirm no later text reaches S&P, JNI drains, and retry succeeds without a second live context. Abandon an iterator without Cancel and repeat. Background S&P, change account, disconnect and revoke approval during work; all must cancel and prevent subsequent response content.
6. While S&P is generating, attempt Hub chat and deletion. Both must respect the same gate; deletion must leave the artifact intact. After drain, an explicit owner deletion is allowed on Android. Do not exercise deletion on the only copy of user data without the owner's chosen test setup.
7. With a separate signed test client/harness, try wrong protocol/profile/context/output, oversize/deep JSON, mismatched model/request IDs, duplicate request IDs, a stolen session ID, excessive sessions, a callback that stops acknowledging, callback death and idle client death before generate. Record typed rejection, bounded resources, death-recipient cleanup and lack of cross-client text. Actual cross-process tests are mandatory, even where an isolated test source exists.
8. Exercise full-size corruption and stale manifest/revision/license metadata only in an owner-created test store. Loading must fail before native model parsing and must not download a replacement. Observe memory/file descriptors across repeated success/failure/cancel cycles and simultaneous callers.
9. Cold-bind test: disconnect clients, leave Hub in the background, then reclaim its ordinary process with `adb shell am kill com.uvasolutions.modelcommons`; confirm its PID is absent before reconnecting from S&P. Stored approvals/models must work without mounting Hub chat. Test service/client process death separately. Record user force-stop as a separate recovery scenario and reopen Hub when Android requires it; do not equate force-stop with ordinary reclamation.
10. Finally verify S&P explicit private embedded mode with Hub absent, and rerun the iOS shared/private acceptance checks. No cloud/LAN/private fallback is permitted for an Android shared request.

Keep four separate statuses in the evidence: source implementation, locally compiled/tested, signed-device verified, public-release supported. Until this matrix passes, the launch claim remains **unverified Android centralized inference**.

Keep port 8081 for USB development. Port 4004 is conditional.

- 8081: lets the phone reach Metro on your PC to load the development JavaScript bundle. React Native documentation.
- 4004: needed only if S&P uses http://localhost:4004 for your PC’s local CAP backend.
- ModelCommons Binder inference: requires neither port; communication stays between apps on the phone.
  For a normal retry, you can skip restarting ADB, stopping Gradle and running clean:
  Set-Location D:\GitHub\spm
  adb devices
  adb reverse tcp:8081 tcp:8081

# Only when using the local CAP backend:

adb reverse tcp:4004 tcp:4004

adb reverse --list
npx expo run:android --device
Refresh S&P’s ModelCommons packages with the Kotlin fixes before rebuilding. For the eventual standalone offline demonstration, use builds containing their JavaScript bundle so Metro is unnecessary.

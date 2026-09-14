# Android shared-files owner-run acceptance

Status: **implementation handoff; physical two-app acceptance not yet run**.

This procedure verifies that Sales & Pricing Mobile performs real offline
inference from the GGUF already installed in ModelCommons. It must use two
distinct Android application UIDs. Mocked reads, same-process tests, metadata
listing, build success, and a renamed transport receipt do not establish the
result.

## 1. Review and run source checks

Do not pack packages until the ModelCommons checks succeed:

```powershell
Set-Location 'D:\GitHub\ModelCommons'
npm run lint
npm run typecheck
npm test
npm run android:prepare-native
```

Expected source-contract results include:

- the Android host pins match the TypeScript catalog, including the 135M
  `9e6855bc4be7` storage ID;
- provider defaults are disabled/unexported, and its API is read-only;
- descriptor resources survive native store, verified store, embedded runtime,
  and `llama.rn` wrappers;
- the pinned `modelcommons-android-fd-v2` patch applies once and is idempotent;
- a missing patch fails before a descriptor is borrowed;
- context release precedes lease release.

The descriptor patch targets exactly `llama.rn` 0.12.9. Both app config plugins
set `rnllamaBuildFromSource=true`; inspect both Android build logs for
`RNLLAMA_BUILD_FROM_SOURCE=ON`. The patch changes the JSI wrapper and matching
common C++ parameter ABI together, so a patched wrapper linked to an unpatched
prebuilt core cannot satisfy this acceptance.

## 2. Pack and install the consumer closure

The consumer cannot use ModelCommons source directly. The following packer is
marked OWNER-RUN ONLY and writes all nine archives plus `provenance.json`:

```powershell
Set-Location 'D:\GitHub\ModelCommons'
npm run packages:pack-local -- "D:\GitHub\spm\vendor\modelcommons"

Set-Location 'D:\GitHub\spm'
npm install
npm run config:validate
npm run config:validate:uva:production
npm test
```

Confirm `package.json`, `package-lock.json`, and `vendor/modelcommons/provenance.json`
agree on these changed package versions:

```text
@modelcommons/embedded          0.2.0
@modelcommons/model-store       0.2.0
@modelcommons/native            0.2.0
@modelcommons/runtime-llama-rn  0.2.0
```

The other packed protocol/client/profile/provider packages remain `0.1.0`.
Never edit a TGZ or its integrity entry manually.

## 3. Inspect generated native configuration

Generate or build through the repositories' existing Expo workflows; do not
discard hand-maintained native changes with an unreviewed clean prebuild.
Inspect the final merged manifests, rather than only `app.config` source.

The ModelCommons application manifest must contain an enabled/exported
`ModelCommonsDocumentsProvider` with authority
`com.uvasolutions.modelcommons.modelcommons.documents`, read grants, and
`android.permission.MANAGE_DOCUMENTS`. Its Binder service may be enabled for Hub
chat but must be unexported for the normal path.

The Sales & Pricing Mobile manifest must keep that provider and Binder service
disabled/unexported. It needs no `QUERY_ALL_PACKAGES`, broad storage permission,
or ModelCommons package `<queries>` entry for normal SAF sharing. Its Gradle
properties must enable the descriptor source build.

Build fresh compatible native binaries with the intended signing profiles:

```powershell
Set-Location 'D:\GitHub\ModelCommons'
eas.cmd build --platform android --profile preview

Set-Location 'D:\GitHub\spm'
npm run build:uva:preview:android
```

Use production profiles only when performing a production-signer acceptance.
An AAB is suitable for Play distribution but cannot be installed directly with
`adb`; use the preview APK profiles for direct device installation. Prefer a
normal signed upgrade of ModelCommons so its installed model remains intact.

## 4. Record the fixture

Record the device model, Android version, ABI, page size, both package IDs,
version codes, signing-certificate fingerprints, source revisions, and archive
provenance. Use the existing approved SmolLM2 360M Q4_K_M artifact and record its
catalog revision, exact byte size, and SHA-256 from the app. Do not add model
weights or device identifiers to Git.

Verify distinct application UIDs:

```powershell
adb shell cmd package list packages -U com.uvasolutions.modelcommons
adb shell cmd package list packages -U com.sirnejo.CPQMobile
```

Replace the second package ID if the selected SPM variant differs.

The repository also includes a read-only owner harness that enforces distinct
UIDs and records bounded device, provider, grant, and consumer-private GGUF
evidence without exporting raw tree URIs or private paths:

```powershell
Set-Location 'D:\GitHub\ModelCommons'
.\scripts\inspect-android-shared-files-device.ps1 `
  -HubPackage com.uvasolutions.modelcommons `
  -ConsumerPackage com.sirnejo.CPQMobile `
  -OutputPath "$env:TEMP\modelcommons-android-before.json"
```

Run it before the folder grant, after the grant, and after generation. The
persisted-grant observation should change only after authorization, while the
consumer-private GGUF count/bytes should not change. `run-as` evidence is
available only for debuggable builds; release acceptance must pair the app's
bounded private-store diagnostics with owner-controlled device inspection. Do
not commit the generated device records.

## 5. Physical no-copy and inference proof

1. In ModelCommons, confirm the 360M model is READY and run its own synthetic
   chat. Record that Hub chat still works with the external service unexported.
2. Through Sales & Pricing Mobile's own UI, remove only a known consumer-private
   model if present. Do not clear ModelCommons data or uninstall it.
3. Capture the consumer's private GGUF count/bytes and download/import counters.
   In a debuggable build, also inspect its files and cache roots for `*.gguf`.
4. In SPM Settings -> Local AI, select ModelCommons, choose **Choose shared
   folder**, select **ModelCommons shared models** in Android's picker, and grant
   access. Refresh and select the recorded 360M model.
5. Run **Test local AI** with Safe context 1024, output at most 128, and the fixed
   prompt: `Write one short sentence about a blue bicycle.` Require actual
   streamed text and a completed terminal event.
6. Export the sanitized receipt. Require `transportKind=android-shared-files`,
   `storageOwner=shared-store`, `executionOwner=application`,
   `centralizedInference=false`, `runtimeId=llama.rn`,
   `runtimeVersion=0.12.9`, `nativeSharedAcquisition=true`,
   `modelLocationKind=native-file-descriptor`, the expected model/revision/hash,
   and `cleanup=released`.
7. Confirm the consumer's private/cache inspection and attempt counters remain
   unchanged. A small native grant record is expected; a second GGUF is not.
8. Put the device in airplane mode, close/background the ModelCommons UI, and
   repeat from a standalone SPM build. Do not use Metro, `adb reverse`, a host
   server, or the Binder inference service. Test Android force-stop separately.
9. Restart SPM and repeat without choosing the folder again. Reboot and repeat as
   a separate case.
10. Cancel during verification, load, and generation. Change mode/account during
    a pending selection. Verify stale results are suppressed and candidate grants
    are released.
11. Revoke the tree grant and require a clear reconnect failure with no private
    download or cloud fallback. Reconnect explicitly.
12. Exercise owner-side delete/update while a consumer context is active, then
    repeat acquisition. Require no crash, no mutated mapped revision, and a clear
    later not-ready result.
13. Repeat load/generate/release cycles and inspect descriptor/context/memory
    behavior for accumulation. Smoke-test iOS Files and explicit private mode
    with the same package closure.

Provider access proves that Android authorized the consumer to open the file. A
zero private-directory counter alone does not prove absence of all copies, so
retain both the instrumented counters and the owner-controlled filesystem
inspection. Mark Android accepted only after the relevant physical checks have
actual recorded results.

For Metro-based development troubleshooting only:

```powershell
adb devices
adb reverse tcp:8081 tcp:8081
```

These commands are unrelated to shared-file authorization and must not be needed
by the standalone offline result.

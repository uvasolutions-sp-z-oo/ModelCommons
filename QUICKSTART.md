# ModelCommons quick start

This is the shortest path to trying the ModelCommons Hub with a compatible app.
ModelCommons is currently a pre-alpha developer preview, so use test data and a
physical device that you can reinstall while the native integration is evolving.

## Android: ModelCommons with Sales&Pricing Mobile

Android keeps the model and inference runtime in the ModelCommons Hub. The
consumer app connects through Android Binder and must trust the Hub's public
signing certificate before it is built.

### 1. Install the matching apps

Install the official production ModelCommons Hub and a Sales&Pricing Mobile build
configured for that Hub. The published Hub identity is:

```text
Package: com.uvasolutions.modelcommons
SHA-256: 69:15:CE:DD:34:F3:C2:EC:F2:A6:82:89:AB:1E:A4:81:A3:2C:AD:E8:A7:CA:A8:A6:FB:E2:AF:93:08:42:70:54
```

The certificate fingerprint is public identity data. It is not a signing key or
credential. It applies only to the official production Hub distribution. EAS
preview APKs, debug builds, and independently built forks can have different
signing certificates.

### 2. Configure and build Sales&Pricing Mobile

Run this from the Sales&Pricing Mobile checkout before its production Android
build:

```powershell
Set-Location 'D:\GitHub\spm'

eas.cmd env:set `
  --name MODELCOMMONS_ANDROID_HUB_SHA256 `
  --value "69:15:CE:DD:34:F3:C2:EC:F2:A6:82:89:AB:1E:A4:81:A3:2C:AD:E8:A7:CA:A8:A6:FB:E2:AF:93:08:42:70:54" `
  --environment production `
  --visibility plaintext `
  --scope project

npm run build:uva:production:android
```

Use the `preview` EAS environment and preview build command when both apps are
preview builds signed with the certificate configured for that channel. A forked
consumer must be linked to its own EAS project.

### 3. Prepare the Hub

1. Open ModelCommons and install an approved SmolLM2 model from **Models**.
2. Open Hub chat and confirm that the model can generate a response.
3. Leave the Hub installed; it owns the model and Android inference service.

### 4. Connect and approve the consumer

1. In Sales&Pricing Mobile, open **Settings → Local AI** and select
   **ModelCommons**.
2. Choose **Connect / reconnect**.
3. If approval is requested, open ModelCommons, go to **Clients**, refresh, and
   approve Sales&Pricing Mobile for metadata and inference.
4. Return to Sales&Pricing Mobile, reconnect, refresh models, and run
   **Test local AI** with Safe, context 1024, and output no greater than 128.
5. Repeat the test in airplane mode to confirm that no network provider is used.

The Android service is implemented, but signed two-app device acceptance remains
in progress. Record failures using the stable code shown by the client. See the
[Android platform guide](docs/platforms/android.md) and
[device acceptance procedure](docs/verification/android-binder-inference-owner-run.md)
for security boundaries and detailed checks.

## iOS: share a model through Files

1. Install native builds of ModelCommons and a compatible client. Expo Go cannot
   load the required native modules.
2. Download a compatible model in ModelCommons.
3. In the client, select shared ModelCommons mode and choose the ModelCommons
   store through the Files folder picker.
4. Select the model and generate a synthetic response offline.

On iOS, the client reads the shared file and runs its own local runtime. The
[owner-verified iOS procedure](docs/verification/ios-shared-models.md) explains
the demonstrated flow and its current evidence limits.

## Build the Hub or integrate another client

Developers building ModelCommons from source, signing a fork, or adding a new
consumer should continue with [Getting started](docs/getting-started.md). A
self-built Android Hub has its own certificate identity; extract it from the APK
with `apksigner verify --verbose --print-certs ModelCommons.apk` and configure
that SHA-256 value in the consumer build.

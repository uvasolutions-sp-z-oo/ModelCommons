# ModelCommons quick start

Use native builds for ModelCommons and the consuming app. Expo Go and an OTA
JavaScript update cannot install the native file provider or descriptor runtime.

## Android: share one installed model

1. Install matching `0.2.0`-package native builds of ModelCommons and your
   compatible consumer.
2. Open ModelCommons, download an approved single-file text GGUF, and wait until
   the Models screen shows **READY**.
3. In the consumer, select **ModelCommons** as the local AI source.
4. Choose **Choose shared folder**. In Android's system picker select
   **ModelCommons shared models**, then approve use of that folder.
5. Refresh the model list, select the installed model, and run the consumer's
   synthetic local test.
6. Repeat in airplane mode. A successful diagnostic should report
   `android-shared-files`, storage owner `shared-store`, execution owner
   `application`, `centralizedInference: false`, and cleanup `released`.

The GGUF remains in ModelCommons. The consumer gets a persisted read grant and
runs its own local `llama.rn` context. It does not need approval in ModelCommons
**Clients**, and normal sharing does not require an Android signing fingerprint
environment variable. Disconnecting revokes this consumer's saved grant without
deleting the ModelCommons model.

Android two-app inference still requires the documented owner-run physical
acceptance before it is called verified. See the
[Android platform contract](docs/platforms/android.md) and
[acceptance procedure](docs/verification/android-shared-files-owner-run.md).

## iOS: share through Files

1. Install native builds of ModelCommons and a compatible client.
2. Download a compatible model in ModelCommons.
3. In the client, select shared ModelCommons mode and choose the ModelCommons
   store through the Files folder picker.
4. Select the model and generate a synthetic response offline.

The [iOS evidence record](docs/verification/ios-shared-models.md) describes the
owner-verified scenario and its evidence limits.

## Build from source

```powershell
Set-Location 'D:\GitHub\ModelCommons'
npm ci
npm run lint
npm run typecheck
npm test
npm run android:prepare-native
```

Those commands are owner-run for the current Android handoff. To update a local
consumer, pack the complete closure rather than editing an archive:

```powershell
Set-Location 'D:\GitHub\ModelCommons'
npm run packages:pack-local -- "D:\GitHub\spm\vendor\modelcommons"

Set-Location 'D:\GitHub\spm'
npm install
npm run config:validate:uva:production
npm test
```

The pack step writes source and archive hashes to `provenance.json`. Commit the
resulting consumer `package-lock.json` only after it references the new archives.
Both applications then need new native Android binaries. Continue with the
[developer guide](docs/getting-started.md) for EAS profiles and fork-specific
application identifiers.

## Public production signing identity

The maintained production Hub package is `com.uvasolutions.modelcommons`; its
published signing-certificate SHA-256 fingerprint is:

```text
69:15:CE:DD:34:F3:C2:EC:F2:A6:82:89:AB:1E:A4:81:A3:2C:AD:E8:A7:CA:A8:A6:FB:E2:AF:93:08:42:70:54
```

This is public identity data, not a secret. Normal Android shared files do not
need the pin. It is retained for explicitly enabled legacy Binder trust and for
operators comparing the official installed signer. Self-built, debug, preview,
and Play-distributed installations may use a different signing certificate.

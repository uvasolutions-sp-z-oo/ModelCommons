# Android shared models

The normal Android integration shares ModelCommons-owned model files through
Android's Storage Access Framework (SAF). A compatible consumer asks the user to
select **ModelCommons shared models**, persists the returned read-only tree
grant, verifies the model through a native lease, and runs its own `llama.rn`
context. ModelCommons receives no prompt or generated response through this
path.

```text
ModelCommons filesDir/ModelCommons (one verified GGUF)
        -> read-only DocumentsProvider
        -> user-selected persisted SAF tree grant
        -> consumer ParcelFileDescriptor lease
        -> consumer-owned llama.rn context
```

Android shared files are implemented in package version `0.2.0`. Physical
two-application inference and lifecycle acceptance is still owner-run and must
not be described as verified until the
[Android acceptance procedure](../verification/android-shared-files-owner-run.md)
has been completed.

## User flow

1. Install matching new native builds of ModelCommons and the consumer. An OTA
   update cannot add the provider, native lease methods, or descriptor loader.
2. Download a supported model in ModelCommons and wait for **READY**.
3. In the consumer, select ModelCommons and choose **Choose shared folder**.
4. In Android's picker, select **ModelCommons shared models**, then approve use
   of that folder.
5. Refresh, select the installed model, and run the consumer's local test.

The grant is read-only and persists across consumer restarts until the user or
consumer revokes it. Disconnecting removes the consumer's saved access; it does
not delete the Hub model. The consumer can read any bytes exposed by the granted
tree and could copy them, like any application that receives file access. Grant
revocation prevents later authorized opens but cannot erase bytes already read
or instantly invalidate a mapping already held by another process.

## Provider boundary

The owner-only `ModelCommonsDocumentsProvider` is cold-start safe and does not
wait for React Native, Hub chat, or an inference worker. It exposes a small
virtual tree containing `protocol.json`, `registry.json`, READY manifests, and
the required READY artifacts. It omits partial downloads, journals, chat data,
client approvals, logs, credentials, and unrelated files.

The provider uses stable opaque document IDs, confines every file beneath the
Hub's real documents store, rejects symlinks and unknown IDs, and opens files
with `O_RDONLY | O_NOFOLLOW | O_CLOEXEC` before returning a duplicated
`ParcelFileDescriptor`. It advertises no create,
write, rename, move, delete, virtual-document, or cloud capability. Its manifest
uses an application-ID-derived authority, `grantUriPermissions`, and the
`android.permission.MANAGE_DOCUMENTS` provider pattern. It requests neither
all-files access nor package enumeration.

Configure the package plugin by role:

```js
// ModelCommons owner app
['@modelcommons/native/app.plugin.js', {
  androidHubService: true,
  androidHubServiceExported: false,
  androidSharedDocumentsProvider: true,
  androidDescriptorRuntime: true,
}]

// Normal consumer app
['@modelcommons/native/app.plugin.js', {
  androidHubService: false,
  androidHubServiceExported: false,
  androidSharedDocumentsProvider: false,
  androidDescriptorRuntime: true,
  androidHubPackages: [],
}]
```

Both applications set `androidDescriptorRuntime: true` because the reproducible
patch updates the JSI wrapper and its matching common C++ parameter ABI as one
source build. Linking the patched wrapper to an unpatched prebuilt core is
unsupported and must fail build review. The option builds the pinned
`llama.rn` 0.12.9 source with
the narrow `modelcommons-android-fd-v2` patch. The runtime checks the patched
capability before requesting a native descriptor. The public resource is keyed
by its opaque native lease ID. At the internal JSI handoff, the patch
synchronously duplicates the one-shot descriptor, checks its read mode and
native device/inode/size identity, and gives the background initializer a
reference-counted owner. llama then owns a second `FILE*` duplicate until its
model/context is destroyed. Hashing uses `pread`, so it does not disturb the
loader offset. Reusing a released opaque lease is rejected, and a reused numeric
descriptor cannot pass the recorded native identity check. The implementation
does not use a `content://` filename, a private owner path, `/proc/self/fd`, or a
consumer GGUF copy.

## Publisher identity and the public fingerprint

The SAF grant is the user's authorization to read the selected tree. On first
connection the consumer records the provider package and the actual installed
signing-certificate fingerprints, then rechecks that identity before later
access. This is a trust-on-first-user-selection policy; managed applications can
add an independent allowlist policy when their deployment requires a publisher
pin.

The official production ModelCommons Android identity is public:

| Field | Value |
| --- | --- |
| Package | `com.uvasolutions.modelcommons` |
| Signing certificate SHA-256 | `69:15:CE:DD:34:F3:C2:EC:F2:A6:82:89:AB:1E:A4:81:A3:2C:AD:E8:A7:CA:A8:A6:FB:E2:AF:93:08:42:70:54` |

The fingerprint is a public trust identifier. It is not a private key, keystore,
password, token, or secret. It applies only to an installation signed with that
production app-signing certificate. Debug, preview, EAS internal, fork, and Play
installations can have another signer. For Play, compare the installed app's app
signing certificate rather than the upload certificate. For an APK you control,
print its signer with:

```text
apksigner verify --verbose --print-certs ModelCommons.apk
```

Do not use the APK file checksum as a certificate fingerprint.

Normal SAF sharing does not require `MODELCOMMONS_ANDROID_HUB_SHA256`. That EAS
variable belongs to the older cross-application Binder inference policy. If a
consumer explicitly enables that experimental transport, the public production
pin can be stored as plaintext in the consumer's EAS project:

```powershell
Set-Location 'D:\GitHub\spm'
eas.cmd env:set `
  --name MODELCOMMONS_ANDROID_HUB_SHA256 `
  --value "69:15:CE:DD:34:F3:C2:EC:F2:A6:82:89:AB:1E:A4:81:A3:2C:AD:E8:A7:CA:A8:A6:FB:E2:AF:93:08:42:70:54" `
  --environment production `
  --visibility plaintext `
  --scope project
```

## Legacy Binder inference

The API 2 Binder inference implementation remains source-isolated as an
experimental option. It is not used automatically when shared files fail and
ordinary consumers do not need approval in ModelCommons **Clients**. The Hub's
own chat may continue using its internal service with that service enabled but
unexported. Exporting it to other applications requires a deliberate build
option, package visibility, certificate pins, and Hub client authorization; see
the historical [Binder owner-run guide](../verification/android-binder-inference-owner-run.md).

The document provider may run while the ModelCommons UI is closed or its chat
worker is unavailable. Android force-stop behavior is a separate operating
system case and must be recorded during device acceptance.

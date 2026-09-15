# @modelcommons/native

Optional Expo Modules API bridge for ModelCommons on Expo SDK 54 / React Native 0.81. It is safe to import on web: the platform resolver loads a null native module and `getNativeAvailability()` reports that native support is absent.

The owner-verified [iOS Files milestone](../../docs/verification/ios-shared-models.md)
uses this connector on a physical iPhone SE. Android SAF shared files are
implemented in `0.2.0`; physical two-app acceptance remains owner-run.

## Configure

Install this package in the app that needs native sharing or Android Hub transport, then add its config plugin. A package-name reference works when the workspace/package is installed; a source checkout can also reference `./modules/model-commons-native/app.plugin.js` directly.

```ts
plugins: [
  [
    '@modelcommons/native',
    {
      androidHubService: true,
      androidHubServiceExported: false,
      androidSharedDocumentsProvider: true,
      androidDescriptorRuntime: true,
      iosAppGroups: ['group.com.example.modelcommons'],
      iosExposeDocumentsInFiles: true,
    },
  ],
]
```

The Android service and provider are disabled and unexported in the library
manifest. Only the owner app sets `androidSharedDocumentsProvider: true`.
Normal consumers set `androidDescriptorRuntime: true` while leaving the provider
and service disabled; they do not need `androidHubPackages`. App Groups also
require matching Apple Developer capabilities and provisioning for every
participating app. A native build is required; Expo Go cannot contain this
module.

All public native calls reject with `ModelCommonsError` from `@modelcommons/protocol`. Deliberate native messages may opt into a stable code prefix such as `PERMISSION_REQUIRED:`; otherwise platform-localized and Expo implementation text is discarded in favor of a method-specific message. The native-only `RUNTIME_NOT_READY` readiness sentinel is exposed as the canonical `RUNTIME_UNAVAILABLE` error code.

## File connectors and leases

On iOS, `connectSharedDirectory()` presents a folder picker and persists a minimal bookmark. Bookmark resolution is non-interactive, refreshes stale bookmarks, and keeps the exact security-scoped URL active until all file leases are released. `connectAppGroup(groupIdentifier)` resolves a provisioned App Group container.

On Android, the same API launches `ACTION_OPEN_DOCUMENT_TREE`, accepts only the
ModelCommons root, persists only the returned read grant, records the provider's
installed signing identity, and revalidates the grant and provider before use.
The owner provider exposes protocol/registry metadata and READY files only.
Artifact leases contain a native descriptor resource keyed by the opaque lease
ID. The patched runtime synchronously duplicates the one-shot native-owned
descriptor, validates its recorded device/inode/size identity, and never
receives a private path or `content://` filename.

On both platforms, paths passed to
`acquireModelLease(connectionId, relativePath)` must remain below the connected
root and resolve to a regular file.

`ModelFileLease` is structurally compatible with the lease expected by `@modelcommons/runtime-llama-rn`. Pass it to the runtime and let session/context teardown release it after the native mmap is gone.

```ts
const lease = await acquireModelLease(connection.id, 'models/model.gguf');
const session = await runtime.createSession({
  model: { id: 'model-id', uri: lease.uri, lease },
  profile,
});
await session.release();
```

Both platforms expose streaming SHA-256 hashing. iOS holds the corresponding lease/root lock for the complete read so security-scoped access cannot be stopped midway.

On Android, `connectSharedDirectory()` adds an attempt-local `created` flag:
`false` means it reused a native connection. Cancellation or failed validation
must not disconnect that existing connection. Android disconnect is idempotent
for an absent record but still rejects a live lease before checking records.

The optional fourth argument to `createSharedStorePort(connectionId, onAcquire,
connectionKind, signal)` forwards an `AbortSignal` to model acquisition and
verification. Android hashing checks a cancellation flag between bounded reads;
it retains the descriptor lock until the read has stopped. Callers await that
settlement before releasing the lease. Aborting does not close an FD underneath
an active read. iOS retains its existing coordinated-read lifetime.

## Atomic publication

The exact JavaScript API is:

```ts
atomicReplaceFile(stagedUri: string, destinationUri: string): Promise<void>
```

Both files must be distinct siblings in app-owned storage (or, on iOS, an active managed root). The staged resource must be a regular file. Android fsyncs it and uses `Files.move(ATOMIC_MOVE, REPLACE_EXISTING)`, falling back to same-directory replacement when the filesystem explicitly does not support atomic moves; API 24-25 uses POSIX `rename`. iOS synchronizes the staged file and uses `FileManager.replaceItemAt` or `moveItem`. The implementation never accepts an arbitrary cross-root move and never deletes the published destination before a fallback.

## Legacy Android Binder contract

`IModelCommonsService` is API version **2** and protocol version 0.1.0. Rebuild both sides; API 1 parcels are incompatible. Session creation negotiates protocol, Safe/context 1024/output ceiling 128 and a Binder lifetime token. UID/package/user/signing identity and approval epoch belong to the session, and scopes are rechecked before work and delivery. Every package sharing a UID needs approval. Only the sole Hub package in its own process bypasses external approval.

Unknown clients are recorded as pending after a rejected call. The Hub UI can inspect `listPendingAndroidClients()` and call `setAndroidClientAuthorization(...)`. Requests are capped at 48 KiB, events and model pages at 16/48 KiB, sessions are UID-owned, callback Binder death cancels work, and client teardown releases sessions.

The optional `@modelcommons/inference-host` now supplies a service-owned CPU worker built from pinned source into an isolated JNI library. It is not a dependency of this connector. Without that package/library, capabilities remain unavailable. With it, centralized inference is implemented in source; the native CPU host has compiled and linked locally, while signed two-app device verification remains pending. Availability does not establish successful model loading or inference. See the [owner-run build, trust, packaging and physical acceptance guide](../../docs/verification/android-binder-inference-owner-run.md).

`createAndroidBinderTransport({ packageName, trustedCertificateSha256 })` remains
available for an explicitly enabled experimental integration. It is not the
normal Android shared-files route and is never an automatic fallback. Select the
package and actual installed signing pin explicitly. Native package visibility
must contain that package through `androidHubPackages`, and the owner must
deliberately export its service. A later connection invalidates earlier
transports. The transport uses one-event credit, native cancellation and drain
confirmation, including iterator abandonment.

## Device profile

`getDeviceProfile()` reports Android `ActivityManager.MemoryInfo.totalMem/availMem` and iOS `ProcessInfo.physicalMemory`. iOS available memory is intentionally omitted because this module does not expose a defensible stable budget estimate. Accelerator metadata reports CPU only; it does not infer GPU or NPU availability.

Large GGUF contexts remain an OOM/jetsam risk even when the model is mmap-backed. Keep one loaded context by default, choose conservative context/batch/KV-cache profiles, and treat device-reported available memory as a changing observation rather than an allocation guarantee.

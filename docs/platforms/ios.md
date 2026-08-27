# iOS storage and runtime sharing

Status as of 2026-08-27: `@modelcommons/native` implements App Group and
user-selected-directory connections, minimal bookmark persistence/stale refresh,
canonical-root/symlink confinement, regular-file checks, SHA-256, opaque
reference-counted leases, atomic app-owned replacement, optional JS lookup, and
lifecycle teardown. `@modelcommons/runtime-llama-rn` accepts such a lease and
releases it after the context. This code has not been built or verified on a
signed physical device, and it does not implement cross-app inference.

iOS does not provide a general, supported equivalent of an Android exported
inference service. ModelCommons therefore draws a hard line between sharing
storage and sharing execution.

## Two designed storage relationships

### Same developer team: App Group

Apps signed by the same developer team may use an App Group entitlement. Resolve
the shared container only with
`FileManager.containerURL(forSecurityApplicationGroupIdentifier:)`; a `nil`
result is a configuration failure. Never guess or construct the container path.

The entitlement, provisioning profiles, and App Store configuration must all be
validated with signed physical-device builds. A simulator directory existing is
not proof that production entitlements work.

### Unrelated developers: user-selected directory

For apps from unrelated teams, the documented path is explicit user selection
through a document picker. Open a directory in place (`asCopy: false`), persist
the resulting security-scoped URL as a minimal bookmark in app-private storage,
and expect the bookmark to become stale or access to be revoked.

On every use:

1. resolve the bookmark and report staleness/revocation;
2. call `startAccessingSecurityScopedResource()` and stop if it returns false;
3. coordinate reads/writes where another process could be changing the file;
4. resolve symlinks and prove the final path remains under the selected root;
5. verify the selected artifact's expected size and SHA-256 immediately before
   load; and
6. balance every successful start with exactly one stop.

JS receives opaque connection/lease IDs and a lease-scoped file URI, not bookmark
bytes. The native connector stores bookmarks in the app's standard private user
defaults. Products with a stronger at-rest requirement should review whether
Keychain or additional data-protection policy is appropriate.

The current connector does not yet wrap shared reads in `NSFileCoordinator`.
Until coordination is added and tested, publishers must treat revisions as
immutable and never replace a file while another process may hold a lease.

## Access lease and mmap lifetime

Security-scoped access must outlive every file descriptor, mmap, model, and
llama context that depends on it. Use a reference-counted native lease:

```text
resolve bookmark -> start access -> verify -> initialize model/context
generate/cancel as needed
release context/model -> close mappings/descriptors -> stop access
```

Stopping scope after initialization while retaining an mmap is invalid lifecycle
management. Conversely, leaking access leases will eventually exhaust the
process's limited security-scope resources.

## What sharing a directory does not do

Sharing a GGUF avoids a second on-disk copy. It does **not** share a llama
context, KV cache, memory mapping, RAM, GPU allocation, inference queue, or
license acceptance between unrelated applications. Each unrelated iOS client
that performs inference needs its own optional native runtime and enough memory.

App Group peers can coordinate files, but ModelCommons does not claim a
persistent cross-app inference daemon. Background execution, loopback servers,
VPN tricks, undocumented IPC, and extensions kept alive outside their supported
purpose are not accepted substitutes.

## Current configuration and normalized failures

The Hub config accepts an App Group through `MODELCOMMONS_APP_GROUP`; no hardcoded
group is shipped. The root [`.env.example`](../../.env.example) documents this
optional build-time value. The plugin also enables opening documents in place.
The native availability flag means connector code exists, not that an
entitlement or shared directory connection has been established.

The iOS device snapshot reports `ProcessInfo.physicalMemory` and a CPU baseline,
but intentionally omits an available-memory estimate because the module has no
defensible stable allocation budget. Unknown available memory remains unknown in
the resolver. The Hub adds a llama.rn version only after adapter availability.

The public JavaScript wrappers normalize native/Expo rejections into
`ModelCommonsError`. A trusted leading stable protocol code is retained (with
`RUNTIME_NOT_READY` mapped to `RUNTIME_UNAVAILABLE`); untrusted localized text
and raw causes are discarded in favor of bounded operation-specific messages.
Representative behavior is:

- Missing native module: `RUNTIME_UNAVAILABLE`.
- App Group unavailable or user selection not granted: `PERMISSION_REQUIRED`.
- Connection listing/removal or lease acquisition/release failure:
  `STORAGE_UNAVAILABLE`; stale or revoked bookmarks require explicit
  re-selection.
- Hash failure or host-detected size/SHA mismatch: `INTEGRITY_FAILED`; do not
  load. Path confinement is enforced before a lease is returned.
- No compatible local runtime: `RUNTIME_UNAVAILABLE` or
  `UNSUPPORTED_PLATFORM`, never a silent network request.
- Memory pressure or termination: release the context and scope, remember a
  non-sensitive failure category, and recommend a safer profile on next load.

## Verification gate

See [Physical-device verification](../verification/physical-devices.md). Test an
App Store-like signed build, fresh install, upgrade, revoked access, moved folder,
stale bookmark, protected-data lock state, background/foreground transitions,
memory pressure, cancellation, and reinstall. Run separate same-team App Group
and unrelated-developer document-picker scenarios; they are not interchangeable.

## Primary references

- [Configuring App Groups](https://developer.apple.com/documentation/xcode/configuring-app-groups)
- [App Group entitlement](https://developer.apple.com/documentation/BundleResources/Entitlements/com.apple.security.application-groups)
- [`containerURL(forSecurityApplicationGroupIdentifier:)`](https://developer.apple.com/documentation/foundation/filemanager/containerurl(forsecurityapplicationgroupidentifier:))
- [Providing access to directories](https://developer.apple.com/documentation/uikit/providing-access-to-directories)
- [`startAccessingSecurityScopedResource`](https://developer.apple.com/documentation/foundation/nsurl/startaccessingsecurityscopedresource())

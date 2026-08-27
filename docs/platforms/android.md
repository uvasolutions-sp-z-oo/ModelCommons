# Android hub service

Status as of 2026-08-27: `@modelcommons/native` contains an AIDL contract,
exported-service implementation, Expo client bridge, explicit-package binding,
certificate-bound per-call authorization, pagination, bounded payloads, callback
death handling, and owner approval APIs. It is a secured IPC scaffold, not
centralized inference: capabilities report `centralizedInference = false` and
`RUNTIME_NOT_READY`; an accepted `generate` ends with canonical
`response.failed` / `RUNTIME_UNAVAILABLE` because the service cannot yet invoke
the Hub's JSI-owned llama.rn runtime. The scaffold emits `response.started` at
sequence 0 followed by that terminal failure at sequence 1, satisfying canonical
failure ordering without pretending inference ran. No physical-device
verification has been recorded.

Android is the platform on which ModelCommons can most closely implement a
device-wide model commons: one app owns model files and llama contexts, while
authorized apps call an exported bound service. This is an Android-specific
capability, not a promise that iOS behaves the same way.

## Intended split

The hub application owns:

- downloads, checksums, manifests, license acceptance, and deletion;
- compatibility decisions, runtime profiles, llama contexts, and scheduling;
- the authorization UI and revocable client allowlist;
- cancellation, crash recovery, and resource cleanup.

The client library owns discovery and binding, protocol negotiation, request
validation, streaming callbacks, and conversion to canonical ModelCommons
events. A client receives opaque model/session IDs. It never receives a model
path, a GGUF file descriptor, or another app's prompts.

AIDL is justified here because the boundary is cross-application. In-process
runtime calls should use the TypeScript transport or an Expo module directly,
not Binder merely for architectural symmetry.

## Implemented Binder surface

Keep the AIDL surface small, append-only within a protocol major, and made of
bounded primitives/parcelables:

```text
getApiVersion()
getProtocolVersion()
getCapabilities()
listModels(cursor, limit) -> page
createSession(modelId, profileId) -> session result
generate(sessionId, request parcel, callback) -> operation acknowledgement
cancel(sessionId, requestId)
releaseSession(sessionId)
```

`generate` must return quickly. Stream events through a one-way callback in
chunks no larger than 8–16 KiB. The implementation caps serialized requests at
48 KiB, events at 16 KiB, and each UID at four sessions with one in-flight
request per session. It paginates model lists and rejects oversized input before
queuing work. Android's
Binder transaction buffer is 1 MiB and is shared by all in-flight transactions
in a process; it is not an invitation to send histories or model bytes through
IPC. The platform's `IBinder` guidance recommends keeping transaction data well
below that ceiling.

The AIDL acknowledgement/result parcel uses versioned Binder-local admission
codes; it is not itself the canonical protocol error union. Public wrapper
rejections are normalized to `ModelCommonsError`, and a started generation ends
through one callback terminal event. The runtime-not-ready scaffold now follows
that ordering; a future runtime broker must preserve it for deltas and successful
completion. The client bridge also checks the 16 KiB event cap, exact sequence
progression, start-before-terminal lifecycle, inner response identity, and the
required canonical event fields before forwarding an IPC event. Malformed IPC
is replaced with one correlated `INTEGRITY_FAILED` terminal lifecycle. This is
implemented source behavior, not physical-device verification.

## Authorization must happen on every call

`onBind()` is insufficient: Android caches one binder for all clients. Every
AIDL entry point must:

1. capture `Binder.getCallingUid()` synchronously, before a coroutine or any
   call to `clearCallingIdentity()`;
2. resolve the complete `PackageManager.getPackagesForUid(uid)` result;
3. fail closed for no package, any package sharing the UID that lacks a separate
   approval, a changed signing identity, or a revoked approval;
4. verify package name and SHA-256 signing-certificate identity against a
   user-approved record, accounting deliberately for certificate rotation;
5. scope every session and request ID to that caller; and
6. record only non-sensitive security audit metadata.

PID and work-source UID are not authentication signals. A signature permission
is an excellent additional control for same-publisher deployments, but cannot
authorize an open ecosystem signed by unrelated developers. Open mode therefore
requires an exported service plus explicit user approval, package/certificate
pinning, revocation, and a clear system disclosure.

Use an explicit component name when binding. Do not accept implicit intents for
an exported sensitive service. Treat every `Intent`, `Bundle`, URI, and
`Parcelable` as untrusted input. Do not expose a permissive content provider as
a shortcut around Binder authorization.

## Lifecycle and concurrency

- Link a death recipient to each client callback. The current code removes that
  operation on callback death; a production broker must also prove caller-death
  session cleanup rather than waiting for explicit release.
- Make request IDs unguessable and caller-scoped. Idempotently handle cancel and
  release.
- Serialize access to a non-thread-safe llama context. Bound concurrency and
  return a typed capacity error rather than growing an unbounded queue.
- Recheck authorization for every request even when the session already exists.
- Cancel native work when the caller aborts, the service is destroyed, or the
  callback dies.
- Never log prompt text, generated text, tool arguments, model paths, or
  authorization tokens.

The Expo bridge exposes asynchronous connection/model/session/generate/cancel/
release operations plus stream events, and tears them down in module/app-context
lifecycle hooks. It uses optional native-module lookup so web and unsupported
builds can report availability instead of crashing at import time.

Its device snapshot reads total and currently available memory from
`ActivityManager.MemoryInfo` and reports only a CPU baseline accelerator. It
does not infer GPU/NPU support from chipset branding. The Hub adds a llama.rn
version to the profile only after the runtime adapter reports available.

The library manifest keeps the service disabled and unexported. The config
plugin changes those flags only for a designated Hub. The current Hub config
enables/exports it; authorization therefore remains mandatory even though
inference is scaffolded.

## Verification gate

The feature is not supported until the physical-device matrix in
[Physical-device verification](../verification/physical-devices.md) passes,
including malicious/unapproved client checks, signing-certificate mismatch,
shared-UID handling, oversized payload rejection, client death, cancellation,
background/foreground transitions, and service-process restart.

## Primary references

- [Android bound services](https://developer.android.com/develop/background-work/services/bound-services)
- [Android Interface Definition Language](https://developer.android.com/develop/background-work/services/aidl)
- [`Binder.getCallingUid`](https://developer.android.com/reference/android/os/Binder#getCallingUid())
- [`PackageManager.getPackagesForUid`](https://developer.android.com/reference/android/content/pm/PackageManager#getPackagesForUid(int))
- [Parcelable/Bundle transaction limits](https://developer.android.com/guide/components/activities/parcelables-and-bundles)
- [`IBinder` transaction guidance](https://android.googlesource.com/platform/frameworks/base/+/HEAD/core/java/android/os/IBinder.java)

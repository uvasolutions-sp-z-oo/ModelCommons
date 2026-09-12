# Model store and publication lifecycle

Status, 2026-09-12: the Hub store lives in `services/modelcommons/`; reusable
registry, policy, private storage and read-only shared composition live in
`@modelcommons/model-store`. The owner verified a Files-based iOS consumer using
a model stored by the Hub; see the [device record](../verification/ios-shared-models.md).
Recovery, deletion, concurrency, App Groups, and broader lifecycle cases still
need physical testing. The Hub's resumable downloader and the generic private
store's explicit retry path have different responsibilities; neither path permits
unverified artifacts to be treated as ready.

## Goals

The store must make four facts auditable before a model can be loaded:

- exactly which model revision and artifacts were selected;
- which license applies and whether acceptance was required;
- whether each required artifact matches its declared size and SHA-256; and
- whether publication completed atomically.

A model ID is a logical identity. `storageId` is its safe local directory name.
Neither may be interpreted as a path supplied by a remote manifest.

## Current layout

```text
ModelCommons/
  protocol.json
  registry.json
  models/
    <storageId>/
      manifest.json
      model.gguf
      mmproj.gguf
      download-manifest.json
      *.part
  clients/                      # reserved; no store writer yet
  profiles/                     # reserved; no store writer yet
  device/                       # reserved; no store writer yet
  migrations/
    legacy-medgemma.json        # transient migration journal
```

`protocol.json`, each `manifest.json`, and `registry.json` carry protocol
meaning. `download-manifest.json`, `.part` files, swap files, and the migration
journal are internal recovery state and must never be mistaken for a published
model. Some reserved directories are created before their writers exist.

All manifest paths are normalized relative paths. Reject absolute paths, URI
schemes, backslashes, empty segments, `.`/`..`, NULs, and any symlink/canonical
path that escapes the store root. The TypeScript protocol validator covers the
portable lexical checks; native storage code must still enforce canonical-root
confinement.

## Immutable identity

A published `model.id` is bound to one immutable revision and `storageId`. A
repository branch such as `main` is not an adequate installed revision: resolve
and record an immutable commit/revision before download. If bytes or metadata
change, publish a new model ID/revision. Do not overwrite a `READY` artifact in
place.

Aliases are explicit application or registry configuration. They are never a
claim that one local model is behaviorally equivalent to a provider model. A
response must disclose the actual model/revision/runtime/profile in diagnostics.

## Implemented download transaction

1. Validate the candidate manifest and protocol compatibility.
2. Display the exact model source and license. Record acceptance only after an
   explicit user action when `acceptanceRequired` is true.
3. Check free space for artifact bytes, partial-download overhead, and at least
   the resolver's publication margin (currently 512 MiB).
4. Download to a `.part` file beside its eventual artifact. Only HTTPS catalog
   URLs are accepted.
5. Resume only when remote identity/range semantics and local state agree. If
   identity is uncertain, discard the partial artifact rather than concatenate.
6. Verify declared byte length and SHA-256 before any runtime parses the file.
7. Move the verified part to its immutable destination, verify all required
   artifacts again, and write the manifest.
8. Publish a revisioned registry snapshot with state `READY`.
9. On startup, check existence and declared size for every `READY` artifact.
   Before a revision's first load in each process, perform the full SHA-256 gate
   and demote a mismatch to `FAILED` before runtime parsing.

Current cancellation is phase-dependent. During native download the store asks
the resumable task to pause, persists resume data when that succeeds, rechecks
abort after listener installation/download, and normalizes an aborted native
rejection to `USER_CANCELLED`. It also checks cancellation before and after each
verification and immediately before `READY`. Size/SHA-256 verification itself
has no `AbortSignal`, so cancellation cannot interrupt a hash already in
progress; it takes effect after that file's check. The UI labels this “Stop after
current SHA-256 check.” Physical-device races and resume behavior still require
verification.

Bundled remote catalog entries contain exact sizes and SHA-256 digests. SHA-256
is fail-closed if the native verifier is unavailable. The one documented
exception is the legacy donor migration: it can publish an already-installed
artifact after path and size validation, records that no cryptographic integrity
claim was made, and uses a local migration identity. It must not be confused
with the checksum-pinned catalog model.

Startup repair now checks presence and declared byte length without hashing.
`verifyReadyModel()` performs a full byte-for-byte SHA-256 once per immutable
revision in each process before its first load; a successful installation has
already passed SHA-256 immediately before publication and is cached as verified
for that process. This remains fail-closed before runtime parsing, but first load
after a restart can incur substantial I/O, latency, energy, and thermal cost,
especially for the 18.5 GB MoE experiment. Measure startup and first-load cost
separately. The in-memory verification cache is not a durable file-identity
attestation.

Expo's legacy filesystem API does not expose a true atomic replace. The store
uses `.next`/`.previous` recovery files and prefers
`ModelCommonsNative.atomicReplaceFile` when available. Crash/recovery and actual
filesystem semantics therefore remain a device verification requirement.

Initialization reads and negotiates an existing `protocol.json` before writing
anything. An incompatible marker fails with `PROTOCOL_VERSION_UNSUPPORTED`; the
current process writes a marker only when none exists. Stored download and
legacy-migration journals are shape/identity/path validated before use.

## Adding a catalog model

The static built-in catalog is intentionally small during pre-alpha, but a new
entry must remain an ordinary `ModelManifest` consumed by the same store and
runtime path. Do not add a model-specific downloader, filesystem path, runtime
initializer, or committed model weight.

Before adding an entry, independently record and review:

- the actual distribution repository and a full immutable revision (never
  `main`), with the exact artifact present at that revision;
- exact artifact filename, positive byte size, and SHA-256 from that pinned
  artifact;
- upstream/original-model provenance separately from any GGUF conversion or
  distribution publisher;
- the applicable license URL, gating, acceptance requirement, and conservative
  redistribution status;
- only capabilities proven through the ModelCommons runtime/template path;
- context evidence, including the distinction between trained context and any
  lower artifact/runtime maximum; and
- conservative RAM estimates with notes explaining that context, KV cache,
  backend, buffers, and OS pressure affect resident memory.

Hub-only labels, tiering, summaries, recommendation status, and sort order live
beside the catalog in presentation metadata. They are not protocol manifest
fields and do not influence automatic model selection. Add focused metadata and
selection tests with every entry; network tests must not download model weights.

## Lifecycle and crash recovery

The protocol states are `NOT_INSTALLED`, `DOWNLOADING`, `VERIFYING`, `READY`, and
`FAILED`. Recovery rules are deterministic:

- an orphan `.part` remains non-runnable and may be offered for verified resume;
- a complete model directory missing from the registry is quarantined or
  re-indexed only after full verification;
- a `READY` registry record whose required artifact is missing or mismatched is
  demoted and never loaded;
- registry revision numbers increase monotonically; and
- cancellation closes handles and persists only enough non-sensitive state for
  a safe resume.

Deletion first blocks new sessions, cancels or waits for active users, releases
contexts/mappings, deletes the artifact directory, then removes that immutable
record from the registry. License-acceptance records currently remain; keep them
only if the product has a documented retention need.

## License and provenance

The repository MIT license covers ModelCommons source, not downloaded weights.
Each manifest carries its own license URL and redistribution status. Gated or
restricted artifacts must not be mirrored merely because the store can download
them. Model cards and licenses should be cached beside the artifact, but their
source URL and revision remain authoritative.

The initial MedGemma reference uses Google's Health AI Developer Foundations
terms, not MIT. See [the reference README](../../examples/reference-medgemma/README.md)
once that metadata-only example is installed.

The current `LicenseAcceptance` schema binds acceptance to model ID, model
revision, license ID, license URL, and time. A changed revision, license ID, or
URL therefore requires a new acceptance. It does not store a terms-content
digest/version, so silently changing content at the same URL under the same
identity is still an open protocol/legal risk. Publishers must use an immutable
terms URL or rotate an identity field when terms change; a content digest/version
should receive owner/legal review before release.

The registry rejects an existing model ID if a catalog attempts to bind it to a
different revision or `storageId`; publication policy requires a new model ID for
new bytes. Deletion removes the current record rather than retaining a tombstone,
so publishers must continue enforcing that no-reuse rule in catalog governance.

## Multi-process coordination

One process is the publisher for a store. Readers consume immutable revisions
and a snapshot registry; they do not edit model directories. Use platform file
coordination/locks appropriate to the storage relationship. Never assume a
rename or lock has identical guarantees across Android app storage, an iOS App
Group, and an iOS security-scoped external directory.

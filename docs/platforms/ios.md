# iOS shared model storage

Status, 2026-09-12: the owner verified **Files folder-picker sharing on a physical
iPhone SE**, with a model installed only in ModelCommons and successful
Sales & Pricing Mobile generation in airplane mode. See the
[current device evidence](../verification/ios-shared-models.md). Exact model/build
metadata and attachments remain unrecorded; App Groups and unrelated-team signing
need separate verification. The [historical handoff](../verification/ios-implementation-handoff.md)
preserves the implementation and extended acceptance procedure.

## Storage contract

ModelCommons is an early Uva-designed protocol, not a ratified industry standard.
A selected root contains `protocol.json`, `registry.json`, and
`models/<immutable storageId>/manifest.json` plus manifest-declared artifacts.
The generic reader validates versioned metadata against its own pinned catalog;
a producer's checksum does not establish trust. Listing checks presence and size;
acquisition validates manifest identity and every required artifact's full SHA-256.
License gates remain in force. The reproduction procedure suggests a small ungated
SmolLM2 model; the original successful run's model identity is not yet recorded.

Files is the default: the Hub continues to write directly to
`Documents/ModelCommons`. Select that exact folder in the consuming application's
directory picker (`asCopy: false`). The folder containing both marker and registry
is the reliable instruction; Files labels can vary. Parent folders are not searched.
No model import, download, staging or model copy is part of shared consumption.

## Permission and provider boundary

Only a native minimal bookmark and an opaque local connection ID are durable
connection authority. The runtime receives a temporary lease URI. Paths, bookmarks
and container IDs are not exported in diagnostics or portable configuration.
Stale bookmarks refresh only after successful security-scope authorization.
Invalid, cancelled or obsolete selection disposes of its candidate and preserves
the selected connection. Disconnect removes the consumer grant, not the model.

The alpha admits direct sibling application `Documents/ModelCommons` roots below
the current application's container parent, with a UUID application component.
It canonicalizes symlinks and checks confinement before file coordination or reads.
This conservative layout rule excludes third-party File Provider containers,
iCloud, removable storage and unknown layouts, even if cached locally. It is not
a public provider-identity API or an access grant. The picker/bookmark scope is
still required. If iOS supplies a provider wrapper instead of the direct Documents
root on a target device, that Files path is unsupported until separately evaluated;
there is no hidden materialization fallback. No filesystem search is performed.

Apple documents [directory access](https://developer.apple.com/documentation/uikit/providing-access-to-directories)
and [coordinated reads](https://developer.apple.com/documentation/foundation/nsfilecoordinator/coordinate(readingitemat:options:error:byaccessor:)).

## Lease lifetime and mutation

`CoordinatedModelRead` keeps the original NSFileCoordinator accessor open on one
dedicated worker per lease. Native admission is at most eight active or pending
leases per connector. The reader rejects older native leases lacking the lifetime
coordination version marker. Acquisition waits at most 15 seconds; timeout cancels the
coordinator and marks the request stopped before a delayed accessor can activate.
Pending workers retain their slot/scope until they exit. There is no lease expiry
or stale-heartbeat rule that permits deletion while an app is suspended.

Verification and pre-initialization stat use the artifact lease's accessor URL,
without nested coordination or another lease. Required auxiliary artifacts are
also retained. Ordering is acquisition, verification, URI normalization at the
existing llama boundary, context creation, generation/cancellation, context teardown,
then lease release. Release runs independently of acquisition and hashing queues.
It signals the accessor, waits up to five seconds for actual exit, and reports
failure if drain remains unresolved. Scope release happens after accessor exit.
A failed native context teardown retains protection and denies unsafe reuse.
Module teardown deliberately leaves outstanding workers/scopes alive; process
exit is the ultimate recovery when explicit cleanup is lost. Hashing and native
initialization are not instantly interruptible; cancellation after hashing is
checked before starting a new context.

Cooperative writers wait until the read ends, including moves/deletions covered by
coordination. Hub metadata replacement now coordinates its atomic publication.
Published GGUFs are immutable and never overwritten; iOS Hub deletion remains
deferred. Do not modify a live production model through Files.

Coordination is cooperative, not an OS-wide mandatory lock. The stat, hash and
llama loader still open a pathname; the SDK does not pass an already-open file
descriptor into llama. An authorized writer ignoring coordination can replace,
truncate or change bytes between checks and load or during inference. This is
not tamper-proof storage. Native worker tests cannot establish real mmap/device
behavior or security-scope grant persistence.

## Optional same-team App Group ownership

Set `MODELCOMMONS_APP_GROUP` to a registered group and explicitly select
`MODELCOMMONS_IOS_STORE=app-group` for the Hub build. Without that selection,
existing installs use Documents, even if an entitlement exists. The native resolver
uses `containerURL(forSecurityApplicationGroupIdentifier:)` and accepts only the
configured owner group. Missing/unavailable group access fails explicitly.
The hashing/atomic-write allowlist extends only to that group's `ModelCommons`
child. Existing Expo filesystem permission code includes entitled App Group roots.

Downloads, publication and Hub local inference all use the selected destination.
No existing files are copied or migrated, including legacy donor models. Existing
Documents files remain allocated and must not be counted as shared savings.
S&P's counterpart is `localAI.appGroup` in `config/apps/<variant>.json`; there is
no matching S&P environment variable in current source. Both apps require the
same team, associated app IDs, matching provisioning profiles and new binaries.
The SDK consumer API is read-only; an entitled peer may have broader OS write
access. See Apple's [App Groups documentation](https://developer.apple.com/documentation/xcode/configuring-app-groups).

## Execution and privacy

Generic client setup uses the same SDK composition as S&P (policy and device
provider are supplied by the integrating app):

```ts
const connection = await connectSharedDirectory();
const store = createReadOnlyModelStore(createSharedStorePort(connection.id), trustedPolicy);
try {
  await store.list(); // Validate before replacing the app's saved connection ID.
} catch (error) {
  await disconnectSharedDirectory(connection.id);
  throw error;
}
const backend = createEmbeddedLocalAI({ modelStore: store, ownership: 'shared-files',
  deviceProvider, policy: { maxContext: 1024, maxOutput: 128 } });
try {
  const client = await ModelCommons.connect({ transport: backend.transport });
  const session = await client.createSession({ capabilities: ['text'], modelId: approvedModelId });
  // Use session.generate/stream with canonical text requests and an AbortSignal.
  // backend.release below drains the owned session/context before its file lease.
} finally {
  await backend.release(); // Propagate failure; deny further work if cleanup fails.
}
```

Imports come from `@modelcommons/native`, `@modelcommons/model-store`,
`@modelcommons/embedded` and `@modelcommons/client`. The app stores only the
validated connection's opaque ID, owns its cancellation/identity boundary, and
supplies independently trusted model manifests. It must not add fallback or a
private provisioning call to a shared request.

Storage owner is the shared store; execution owner is the consuming application.
Each app creates its own llama context, KV cache and allocations. No shared iOS
inference daemon or RAM deduplication is claimed. Android centralized execution
remains a separate task.

The default Hub destination for model metadata/artifacts is Documents; an
explicitly configured owner can instead select App Group storage. Chat,
preferences and approval UI state use their existing private persistence, and
reporting does not add Documents exports. The legacy model migration is the
other Documents consumer. Existing user-created or old-version Documents files
cannot be audited from source; the owner must inspect the test installation.
S&P's Documents area is not exposed by its native plugin configuration.

S&P diagnostic report v4 adds observed shared acquisition, verified artifact
metadata, transport and bounded SDK-private GGUF inventory/call counters. It
exports no content, filenames, URLs, bookmarks or physical file identifiers.
Measurements are null when unavailable. See the
[historical handoff](../verification/ios-implementation-handoff.md) for their exact limits.

> Historical implementation brief/checkpoint. Its instructions and status claims
> describe earlier work, not the current release state. See the
> [current documentation status](README.md) and
> [iOS device evidence](verification/ios-shared-models.md).

# Codex implementation prompt 1: Real iOS shared model reuse

## Mission and scope

Finish an actual two-application iOS model-sharing path in ModelCommons and Sales & Pricing Mobile. Implement the changes, not just a proposal. The primary acceptance target is:

    Download one approved GGUF in ModelCommons Hub
    -> S&P selects the Hub's local store with Apple's directory picker
    -> S&P verifies and loads that same artifact in place
    -> S&P generates text offline using its own runtime
    -> no model download, import, staging file, or weight copy in S&P

First finish the Files/security-scoped path. Then implement the optional same-team App Group writer/reader path as a separate, clearly labeled configuration. Do not let App Group configuration become a prerequisite for the Files path.

This task does not implement Android Binder inference. Preserve Android's working embedded inference and its honest unavailable state for centralized inference. A separate work brief covers the Android worker.

## Workspace and operating rules

Producer/shared libraries and Hub: D:\GitHub\ModelCommons
Consumer: D:\GitHub\spm
Expected remotes: uvasolutions-sp-z-oo/ModelCommons and uvasolutions-sp-z-oo/sales-pricing-mobile-internal-history.

These are independent repositories in a multi-root VS Code workspace. There is no required parent/submodule relationship. Check the actual Git roots, existing instructions and working-tree changes; do not switch branches or overwrite existing work. Confirm both roots are available and writable before consumer edits.

Allowed: inspect source and installed dependency source, edit working-tree files, add tests, add owner-run scripts, inspect diffs. Respect repository instructions.

Do not commit, stage, push, create PRs, publish anything, change repository visibility, install dependencies, execute tests/typechecks, run pack scripts, run prebuild, compile native projects, run EAS, download models, modify signing credentials, or delete user data. The owner runs checks and builds. Do not write to node_modules or hand-edit tarballs/lockfile integrity. Do not run npm audit fix, disable integrity checks, or change llama.rn from 0.12.9.

## Evidence and boundaries

The owner reports real local text generation in ModelCommons Hub and S&P on physical devices, including iOS. Android embedded inference also previously worked. This proves the individual applications can use the runtime; it does NOT yet prove the same stored model is reused across apps.

The GitHub review on 2026-09-11 inspected ModelCommons main at 4e90e463561a66379ed5bbfeca0a7cb087545c17 and current S&P master. Read current local source as authoritative when it differs. Do not reset to the inspected commit.

Keep these fixes intact:

* Explicit apple.modules and apple.podspecPath in expo-module.config.json. CocoaPods inclusion alone was not Expo module registration.
* The runtime fix for percent-encoded file URLs: Application%20Support must reach the loader as Application Support. Inspect the existing normalization helper; do not reimplement or double-decode it.
* iOS memory entitlements, optional report receiver configuration, and deterministic EAS fingerprinting.
* In-app private provisioning/inference. Customers must still be able to choose a completely app-contained local mode.
* Cloud and LAN choices, existing business authorization, and cancellation on account/identity changes.

A shared iOS file still has a separate inference context in each consuming app. This task saves duplicate model storage/downloads; it does not create a shared iOS inference daemon or promise RAM deduplication.

## Read these files first

ModelCommons:

* docs/DUAL-LOCAL-AI-CHECKPOINT.md (historical implementation map; embedded-device statements are stale)
* services/modelcommons/modelStore.ts and services/modelcommons/registry.ts
* packages/model-store/src/{store,registry,policy,catalog}.ts
* modules/model-commons-native/src/{sharedStore,index,types,nativeError}.ts
* modules/model-commons-native/ios/{SharedModelConnector,ModelCommonsNativeModule,PrivateModelFiles}.swift
* modules/model-commons-native/app.plugin.js, expo-module.config.json, ModelCommonsNative.podspec
* packages/embedded/src and packages/runtime-llama-rn/src (only resource/context lifecycle and existing URI handling)
* app/(tabs)/clients.tsx, models.tsx, and the relevant Hub lifecycle/store composition
* app.config.ts, eas.json, scripts/pack-local-packages.cjs

S&P:

* src/services/inference/localBridge.native.js
* src/services/inference/{localDiagnostics,localCoordinator,localIdentityBoundary,localPolicy}.js
* src/components/LocalAISettings.js
* src/store/inferenceStore and the app config producing LOCAL_AI_POLICY
* package.json and vendor/modelcommons/provenance.json

Read imports and focused tests as needed. Avoid another repository-wide architecture redesign.

## What already exists

The Hub's default owner store is Documents/ModelCommons. It writes protocol.json, registry.json, models/<storageId>/manifest.json and the model artifacts. The plugin enables UIFileSharingEnabled and LSSupportsOpeningDocumentsInPlace for the Hub.

S&P's local_modelcommons iOS route already calls createReadOnlyModelStore(createSharedStorePort(connectionId), policy). Its UI already imports connectSharedFolder and connectSharedGroup.

The native picker uses UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false). SharedModelConnector persists bookmarks and provides acquire/release, metadata, stat and SHA-256 methods. The App Group reader expects <group container>/ModelCommons.

The current gaps are substantial enough to inspect, but do not require rebuilding everything:

* The reader/writer contract has not been recorded as passing a two-app device test.
* Security-scope lifetime exists, but withLeaseRead coordinates only individual operations. That does not by itself protect the later llama mmap lifetime.
* acquireVerified obtains an artifact lease, then verifies through path-based port operations which may obtain other leases. Check exact-resource consistency.
* Hub deletion is deliberately disabled on iOS because another app may still map the file. Do not casually remove that safeguard.
* The Hub does not write to the App Group root merely because it has an entitlement.
* Local-only/provider availability, stale bookmarks, wrong-folder selection and no-copy proof need clear user-facing states.

## 1. Make the shared store contract executable

Keep one documented, versioned layout, reusing existing protocol/version rules:

    <selected store root>/
      protocol.json
      registry.json
      models/<immutable storageId>/
        manifest.json
        <manifest-declared GGUF filename>

Do not introduce a second registry schema or a S&P-specific JSON export.

Add a writer/reader conformance fixture using metadata emitted by the Hub and read through createReadOnlyModelStore. Verify compatible protocol/schema, pinned model ID/revision/storageId, declared required artifacts, exact byte sizes and independently trusted SHA-256.

The consumer's trusted catalog remains the trust source. A shared registry cannot make an arbitrary model trusted by supplying its own checksum. Reject manifest substitution, unknown IDs, traversal, symlink escapes, oversized/deep metadata, partial files and falsely READY entries. Retain existing license gates. First acceptance uses the small ungated SmolLM2 entry; do not generalize a recorded acceptance into rights for another user or app.

A connected store and a READY artifact are distinct states. Neither proves inference works. A valid empty store should display an empty state, not a misleading native-runtime error. An incompatible store should display an actionable compatibility error.

Validate a newly selected connection before replacing a working connection. Cancellation or invalid selection must not erase the previous connection or leak the new bookmark/scope. Do not search the whole filesystem. If you support selecting the parent application folder, check only the fixed ModelCommons child and validate its marker; document this exact behavior.

## 2. Finish the no-copy Files path

Use the current Hub-owned Documents/ModelCommons store as the default. Do not move existing working models into a new private root or export a second GGUF copy just to share them.

The user selects the directory containing protocol.json and registry.json, not a GGUF file and not the private import action. Explain the folder in the UI. Files labels can vary; use the actual directory contents as the reliable instruction.

Keep only the native bookmark and an opaque local connection ID for reconnecting. Never persist a sandbox UUID-dependent absolute path as the durable authority. Do not put bookmarks or raw file URLs into portable client config or logs.

Reconnect after restart, refresh stale bookmarks only while authorized, and handle moved/deleted/revoked stores with explicit re-selection. Selection is user consent to expose that model folder to the consumer. Explain that disconnect removes the consumer's saved connection and does not delete the owner's model.

Reject cloud-only/ubiquitous or unsupported File Provider resources without intentionally materializing them. Do not assume isUbiquitousItem alone identifies every third-party provider. Limit the supported alpha path to local on-device folders and document provider limitations. Never advertise an offline path that depends on a hidden provider download.

Audit the Hub's exposed Documents area for unrelated sensitive files. Do not add chat, reports, business data, tokens or client secrets there. S&P private storage must remain unexposed.

## 3. Make lifetime, integrity and mutation handling correct

This is the most important native part. Permissions, integrity and concurrent file lifetime are different controls.

Required lifecycle:

    authorize selected root
    -> establish native resource/coordination lease
    -> inspect and hash the intended immutable artifact
    -> normalize URI at the existing runtime boundary
    -> initialize native context from that artifact
    -> generate or cancel
    -> destroy native context
    -> release file coordination and security scope

Use a native design appropriate to asynchronous, memory-mapped reads. Inspect Apple NSFileCoordinator/NSFilePresenter behavior, not just method names. A coordinate(readingItemAt:) accessor that returns before inference begins is not a full-lifetime coordinated read.

Choose and implement a defensible coordination/presenter design. Do not block the main/UI thread, Binder threads, a module queue needed for release, or a connector-wide lock while waiting for inference. A cancellation/release path must remain runnable independently of acquisition/hash/generation. Bound admission and manage pending acquisitions without timed-out work unexpectedly becoming active later.

For move/deletion/presenter notifications, do not acknowledge that a file has been relinquished while llama still maps it. Drain/cancel and release first, or deny/defer the operation truthfully. Do not invent a stale-heartbeat timeout that authorizes deleting a model held by a suspended live app.

Improve lease-local inspection/hash access where needed so verification and inference refer to the same resource. Keep protocol-level interfaces small and backward-compatible where feasible. Do not rehash per token, copy weights into memory, or change the full integrity requirement. Preserve the existing native streaming hash path.

Use immutable revision directories and never rewrite/truncate a published GGUF. Registry updates publish only fully verified artifacts. If full safe cross-app deletion is not established, retain the existing iOS deletion deferral and make the UI explain it. Do not remove an artifact then discover it is leased.

Be precise about the threat boundary: application-cooperative coordination is not an OS-wide mandatory lock against every authorized or malicious writer. Do not claim it is. Document any remaining race between verification and path-based loader open. If exact file identity cannot be held through the loader, state the residual risk and avoid claiming tamper-proof shared storage.

Context teardown failure must keep its resource protected and prevent unsafe reuse. Do not unconditionally stop security-scoped access from module teardown while native memory mapping may survive. Preserve the existing context-before-lease ordering and handle double release, acquisition failure and process death honestly.

## 4. Add App Group ownership only as a separate optional path

Complete Files sharing first. App Groups are useful for Uva apps signed by the same Apple team, but are not a prerequisite for arbitrary third-party integrations.

The existing consumer reads <entitled group>/ModelCommons. Implement the missing Hub writer for exactly the same layout, using a native root resolver and explicit storage-destination selection/configuration.

Obtain the root with FileManager.containerURL(forSecurityApplicationGroupIdentifier:), never by string-building a guessed path. Accept only an explicitly configured group actually available to the signed app. Narrow any extension to owner-path allowlists for hashing/atomic writes; never authorize the entire filesystem or every arbitrary client-provided group.

Both Hub download/write operations and Hub local inference must use the selected root. Do not download to Documents and then silently copy every GGUF into the group. The consumer remains a reader; no consumer write authority is added to its store API. Note that an entitled same-team app may have broader OS-level access than this SDK API exposes; do not market the API restriction as an OS read-only guarantee.

No automatic migration of existing model files. Default existing installations to their current Documents store unless the user/operator explicitly selects the other destination. If a move/export workflow would be complex, leave it out and explain how to install a model directly into the group store for testing. Do not hide abandoned duplicate files or report them as shared savings.

Keep MODELCOMMONS_APP_GROUP optional. Inspect S&P's actual app-group setting name and give the owner the exact counterpart; do not assume both repos use the same environment key. Missing group configuration must leave Files and embedded modes usable. Requested but unavailable group access must fail explicitly, not silently fall back to private storage.

Provide owner instructions for one real registered group ID, association with both app IDs, matching entitlements/profiles, and new signed builds. A suggested group name is only a suggestion until registered. Do not change team IDs, bundle IDs, certificates or EAS settings yourself.

## 5. Complete the consumer and Hub experience

S&P must keep these distinct:

* In this app: current private download/import/verify/inference behavior.
* ModelCommons / shared storage: connect, inspect, select installed model, test, disconnect.
* Cloud and LAN: unchanged and independently selectable.

In shared mode, no download/import button may secretly write a private model. Do not obtain a private store for normal shared inference. No fallback to private, Hub execution, another model, cloud, LAN, or global fetch. Switching mode is a separate explicit user action.

Reuse the canonical client and embedded composition for iOS, with ownership=shared-files. Reuse the existing llama.rn adapter and URI fix. A S&P-specific path replacement is not acceptable.

Use readable states: not connected, checking store, connected with no compatible models, artifact available, verifying, loading, generating, cancelled, access lost, and failed. A boolean iosSharedModels capability does not mean a connection is ready.

Display storage owner and execution owner clearly. For Files sharing: storage is ModelCommons shared storage; execution is Sales & Pricing Mobile. Keep synthetic test output selectable. Preserve request snapshots so mode/model/account changes cannot deliver a result into a different state.

Add a Hub sharing panel with actual storage destination, layout explanation, readiness, Files instructions and limitations. Do not invent a share URL or ask users to copy an iPhone filesystem path.

## 6. Produce useful, truthful no-copy evidence

Extend the existing sanitized diagnostic report rather than inventing an unrelated debug export. Decide explicitly whether its schema version changes; inspect the current version first.

Useful fields, only when observed:

    mode: local_modelcommons
    platform: ios
    transportKind: ios-shared-files or ios-app-group
    storageOwner: shared-store
    executionOwner: application
    modelId and immutable revision
    runtime ID/version
    verified artifact size and digest metadata
    native shared acquisition performed
    effective profile
    firstTextMs, outcome, cleanup, fallback

For no-copy proof, add narrow owner-test instrumentation for model provisioning/import/copy calls and consumer-private artifact inventory, or a documented equivalent. Unknown measurements remain null/not measured. Never hardcode downloadedBytes=0 or shared=true just because a mode was selected. Matching hashes alone prove equal bytes, not reuse of the same physical file.

The evidence should combine a no-private-model starting state, the verified shared acquisition route, zero observed consumer provisioning/copy operations, and real completion. Normal caches, app code and per-app metadata are not model duplication. Do not claim all app storage is zero.

No export of paths, filenames selected by the user, bookmarks, container UUIDs, inode/device identifiers, prompts, responses, stack traces, raw native errors, access tokens or business data. Use fixed allowlisted failure categories. The user can show a synthetic response in a separate demonstration, but diagnostics must remain content-free.

Capture model/revision after resource resolution even if session creation later fails. Do not report cleanup=released unless the applicable teardown actually completed; no acquired resource is distinct from a successfully released one.

## 7. Add tests, without executing them

Write focused tests in the current test frameworks:

* Hub-generated marker/registry/manifest is accepted by the generic shared reader.
* Shared read APIs expose no provisioning, import or deletion operation.
* Missing/incompatible marker, invalid schema, oversized/deep JSON, forged READY, manifest/checksum substitution, path traversal and symlink escape are rejected.
* Valid empty store is handled; wrong folder and cancelled picker preserve the prior connection.
* Private and shared settings/inventories do not leak into one another.
* Shared generation never calls the private store or network/model-copy functions.
* Correct file URL normalization remains intact for spaces, Unicode and literal percent characters; no double-decoding.
* Acquisition, checksum failure, init failure, cancellation, iterator return, account change, backgrounding and teardown failure preserve ordering and release ownership.
* Test the coordination/presenter lifecycle in native tests where the project supports it; do not pretend JS mocks prove native behavior.
* App Group writer and Files writer produce the same protocol layout, with distinct correctly authorized roots.
* Missing group config keeps default mode working; a requested invalid group never silently changes storage mode.
* Diagnostic output rejects unknown fields, injected paths/errors and fabricated proof values.
* Existing Android embedded and iOS private tests remain compatible.

## 8. Owner-run physical acceptance and documentation

Create docs/verification/ios-shared-models-owner-run.md with a minimal first smoke and a deeper matrix.

First smoke, Files path:

1. Record actual app builds, commits, device/OS, signing channel, model ID/revision and runtime.
2. Use SmolLM2 135M or 360M already pinned in both catalogs. Download/verify it in Hub only.
3. Use a test S&P installation with no private GGUF. Any deletion of an existing private model is the owner's explicit, confirmed UI action, never an automatic script or app migration.
4. Select S&P's ModelCommons shared mode, choose the local Hub store directory, and refresh compatible models.
5. Enable airplane mode and explicitly disable Wi-Fi. Reopen S&P and generate a synthetic sentence about a blue bicycle.
6. Record actual no-copy instrumentation, model identity, real text, request completion and cleanup. Synthetic response need not exactly match a predetermined sentence.
7. Repeat after closing/reopening S&P and after closing the Hub. The Hub UI should not be the iOS inference server.
8. Cancel generation, then start another request. No hangs, leaked scope or old callbacks.

Additional cases: picker cancel, wrong directory, empty store, rejected cloud location, stale bookmark/re-selection, conflicting mutation, integrity mismatch in synthetic fixtures, background/foreground, connection removal, and private-mode regression. Do not encourage modifying/truncating a live mapped production model through Files.

App Group smoke is separate: explicit provisioned group, download directly in group, consumer reads there, no private GGUF, offline inference, restart/cancel checks. Record each path separately; one does not prove the other.

Testing two Uva-signed apps through the directory picker demonstrates that path, not a tested unrelated-developer deployment. Keep cross-team support as designed/unverified until a separately signed client exercises it.

Document the protocol and client steps for another developer, using generic examples. Label the protocol an early Uva-designed protocol, not a ratified industry standard. Keep platform limitations visible.

## Packaging and handoff

Do not manually edit generated vendor artifacts. Give the owner exact PowerShell commands, one command per line, based on current manifests:

    Set-Location -LiteralPath 'D:\GitHub\ModelCommons'
    npm run packages:pack-local -- 'D:/GitHub/spm/vendor/modelcommons'

The pack command repacks the dependency closure. Explain which archives changed and how to explicitly reinstall ALL changed/repacked ModelCommons dependencies into S&P, refresh lock integrity, and inspect installed files. Do not repeat the earlier native-only reinstall instruction when runtime/store/client packages also changed. Do not invent lock hashes or recommend deleting the entire lockfile.

Provide focused test commands for the owner and the iOS EAS build commands for each app; do not execute them. New Swift/plugin changes require new binaries. Keep package distribution separate from npm publishing.

Finish with: source findings; files changed; Files path status; App Group path status; coordination and remaining race assumptions; privacy/copy evidence; owner-only provisioning steps; commands; and exact unverified physical gates.

Do not mark tests or device results passed. Confirm precisely which commands, if any, you actually ran. No commits, pushes, PRs, installs, tests, package repacks, prebuilds, native/EAS builds or publication actions are authorized.

## Definition of done

A complete, inspectable implementation of the no-copy Files path, with conformance tests and an owner-run demonstration; an independently labeled App Group path with a real writer if completed; and no regression to working app-contained inference. Any remaining blocker must be attached to its exact path, not hidden behind a generic success summary. Preserve safety controls even if that means an unsafe mutation stays disabled.

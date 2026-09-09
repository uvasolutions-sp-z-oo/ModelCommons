# ModelCommons + Sales & Pricing Mobile: dual local-AI implementation

Use this implementation brief with Terra Very High or SOL High reasoning.

## 1. Mission and superseding decision

Implement two FIRST-CLASS local-AI modes in Sales & Pricing Mobile using reusable ModelCommons infrastructure:

- APP-CONTAINED: the application owns a private verified model and executes inference inside its own process. ModelCommons Hub is not required, discovered, contacted, or used.
- SHARED MODELCOMMONS: the application deliberately uses ModelCommons-managed resources. Android uses Hub-hosted inference through Binder. iOS uses shared model FILES with inference in the consuming app.

This supersedes previous instructions to eliminate ALL application-owned models or remove llama.rn from every Sales & Pricing build. Preserve standalone capability. Replace duplicated implementation, not the customer's choice.

Two apps intentionally keeping private copies is acceptable when isolation is selected. Hidden copying in shared mode is not acceptable.

Keep the existing cloud, LAN and deterministic application paths where permitted by policy. No automatic fallback between embedded, shared, cloud or LAN providers.

Implement code, integration, focused test sources and owner-run verification instructions. Do not stop at an architecture document. Avoid unrelated redesign.

## 2. Workspace, scope and operating rules

Work with two local checkouts:

1. uvasolutions-sp-z-oo/ModelCommons, default branch observed as main.
2. The ACTIVE Sales & Pricing Mobile checkout. The connected GitHub repository currently resolves to uvasolutions-sp-z-oo/sales-pricing-mobile-internal-history, default branch master. Verify the local remote and instructions; do not assume a similarly named folder is the active project.

Read all applicable AGENTS.md instructions. Inspect git status and preserve unrelated working-tree edits. Treat current working-tree code and installed definitions as authoritative; the source anchors below are observations, not instructions to revert newer work.

Allowed: read-only repository inspection and scoped working-tree edits in these two projects.

Do NOT:

- Commit, push, create PRs, rewrite history, change repository visibility, publish packages, or submit apps.
- Modify Partidito, CAP/backend repositories, or unrelated customer code.
- Download model weights during implementation.
- Run tests, builds, Expo prebuild, EAS build/submit/update, emulators or signing operations in this task. Author tests and scripts, and give the owner exact commands.
- Perform dependency installation or lock regeneration silently. Specify the owner-run commands; never manufacture lockfile content or a successful verification result.
- Perform destructive cleanup of old app data or rewrite unrelated native projects.

No backward compatibility or migration is required for obsolete Sales & Pricing AI settings. Fresh AI configuration is acceptable. This does not authorize deleting business databases, identity settings, the owner's existing Hub model, or unrelated files.

If only one checkout is accessible, complete coherent reusable changes there and write a precise handoff for the missing checkout. Do not fabricate package APIs or duplicate ModelCommons internals into Sales & Pricing.

## 3. Reviewed source anchors and important traps

Inspect at least these ModelCommons files and their callers/tests:

- package.json, package-lock.json, packages/*/package.json, tsconfig.json.
- services/modelcommons/modelStore.ts, registry.ts, catalog.ts, hubRuntime.ts, inference.ts, selection.ts, lifecycle.ts, deviceProfile.ts.
- packages/client/src/{client,types,in-process,selection,config}.ts.
- packages/protocol/src/{model,device,inference,client-config,validation,errors,path}.ts.
- packages/runtime-llama-rn/src/{runtime,mapping,types,mutex}.ts.
- packages/device-profile/src/{profiles,resolver}.ts.
- modules/model-commons-native/src/{index,types,nativeModule,nativeError}.ts.
- modules/model-commons-native/app.plugin.js, expo-module.config.json, ModelCommonsNative.podspec.
- Android ModelCommonsService.kt, AndroidHubClient.kt, CallerAuthorizer.kt, HubStateStore.kt, AppOwnedFileOps.kt and all AIDL contracts.
- iOS ModelCommonsNativeModule.swift and SharedModelConnector.swift.
- examples/reference-client/native.ts and the provider examples.
- app/(tabs)/{clients,models,settings,device}.tsx, store/inferenceStore.ts.
- app.config.ts, eas.json, scripts/ensure-llama-rn-native.cjs, platform/security/verification documentation.

Inspect at least these Sales & Pricing files and their callers/tests:

- package.json, package-lock.json, app.config.js, app.base.json, config/apps/*.json, eas.json.
- src/services/inference/{router,deviceModelService,cpqPrompt,assistantWorkflow}.js.
- src/services/inference/providers/{deviceProvider,cloudProvider,lanOllamaProvider,mockProvider}.js.
- src/services/inference/scenarios/{scenarioExecutor,scenarioRegistry}.js and scenario implementations.
- src/store/inferenceStore.js and inferencePromptMigration if still referenced.
- src/screens/SettingsScreen.js, assistant screens/components, navigation, diagnostics, localization, app lifecycle and auth/customer switching.
- scripts/validate-app-config.js, existing package/license/deployment tests and notices.

Known observations to verify before changing anything:

A. ModelCommons has real Hub-local Android generation reported by the owner. This does not prove shared inference or iOS.
B. ModelCommonsService currently advertises centralizedInference=false and RUNTIME_NOT_READY. Its runtime broker is not implemented.
C. The host model store still imports Hub catalog/logging/publication concerns and chooses Documents/ModelCommons directly.
D. hubRuntime.ts still uses Hub Zustand state and a module-level runtime. Extract reusable composition; do not import this file directly into a consumer.
E. The native reference example is in-process. It is not an Android cross-app transport.
F. ModelCommons currently pins llama.rn 0.12.9; Sales & Pricing declares a different range. Inspect BOTH lockfiles and native payloads before concluding what is actually installed. Keep a verified common version unless a specific blocker requires change.
G. Sales & Pricing's router defaults unknown modes to LAN. Replace that unsafe default with explicit mode validation; an invalid local setting must not cause a network request.
H. GREETING, GENERAL_HELP and CONTEXTUAL_ASSISTANCE are intentionally deterministic/no-model scenarios. A friendly assistant answer is not proof that the local engine ran.
I. Existing uva-testflight/customer-testflight build and submit profiles should be preserved and refined, not replaced with new app identities.
J. Read actual manifests and native definitions. Do not assume roadmap features or names in a schema are implemented capabilities.

## 4. Delivery sequence and truthful completion

Implement in this order, leaving coherent checkpoints:

A. Shared foundations: reusable store, explicit policy, resource/session lifecycle, usable package boundaries.
B. App-contained mode in Sales & Pricing on Android AND iOS, including a TestFlight-accessible diagnostic. Preserve the Hub's working local flow.
C. Shared Android: actual Hub inference broker, reusable client transport, approval and Sales & Pricing integration.
D. Shared iOS: read-only consumer store connection, App Group and folder-picker integration, full lease lifetime.
E. Provider compatibility regressions, documentation, isolated-build configuration and owner test matrix.

Do not postpone working app-contained iPhone inference behind completion of the Android broker. Conversely, do not describe shared Android as implemented merely because discovery or authorization works.

Keep status labels separate: implemented/unverified, verified by an owner-provided result, blocked, not implemented. If scope remains incomplete, finish the coherent checkpoint, state the exact blocker and next code step, and keep unsupported paths unavailable. Do not fabricate evidence.

## 5. Product modes and architecture

Use clear application modes, adapting exact names to existing conventions:

LOCAL_EMBEDDED
LOCAL_MODELCOMMONS
CLOUD
LAN_OLLAMA
MOCK (development/test only where explicitly allowed)

Display:

- Local AI - In this app
- Local AI - Shared with ModelCommons

The chosen mode determines an explicit backend. Do not use "auto" to move between trust boundaries.

Platform truth:

| Mode | Model owner/storage | Inference owner | Hub required |
| --- | --- | --- | --- |
| Embedded Android | Sales & Pricing private | Sales & Pricing process | No |
| Embedded iOS | Sales & Pricing private | Sales & Pricing process | No |
| Shared Android | ModelCommons Hub | Hub service process | Yes |
| Shared iOS | Connected shared store | Sales & Pricing process | For provisioning; not a running inference daemon |

Separate artifact ownership from execution ownership in implementation and diagnostics. A shared iOS file does not mean shared inference or shared KV memory.

Keep business context, calculations, verifiers, prompts, tools and authorization in Sales & Pricing. ModelCommons provides generic model/runtime infrastructure. Do not move proprietary business logic into MIT ModelCommons packages.

## 6. Reusable package boundaries

Keep existing protocol, client, provider and runtime packages. Do not create a new framework or monorepo merger.

Extract the smallest coherent reusable storage/host functionality, for example:

- @modelcommons/model-store: manifests, registry, provisioning lifecycle, integrity and resource leases behind injected filesystem/download ports.
- @modelcommons/embedded: optional composition of store + device/profile resolver + llama.rn adapter into a ModelCommons transport, only if a separate package earns its complexity.
- Reusable Android and iOS transports in the existing native integration or a focused transport package.

New names are proposed, not existing APIs. Define and document actual exports.

Required rules:

- @modelcommons/protocol and @modelcommons/client stay free of React Native and llama.rn dependencies.
- A client-only Android app can use Binder without acquiring llama native binaries transitively.
- Sales & Pricing with embedded support explicitly depends on the optional runtime adapter and its compatible llama.rn peer.
- Heavy Android HOST execution code/dependencies must not become unavoidable client dependencies. Split the host artifact from client/storage code if necessary.
- No library imports Hub screens, Zustand store, app catalog singleton or application logger.
- No store/runtime creation or Hub binding at module import time. Use factories and lazy initialization.
- Supply catalog, storage root, policy, diagnostic sink and optional publication hooks explicitly.
- The Hub adapts these libraries; it is not the library.

A proposed factory might accept:

createEmbeddedLocalAI({ modelStore, runtimeFactory, deviceProvider, policy, diagnostics })

Its implementation must use the actual ModelCommons client/transport interfaces. Do not invent a parallel canonical protocol.

## 7. Policy and trust boundaries

Create a small validated policy layer, not a new enterprise policy server.

Distinguish:

- permitted inference modes;
- permission to provision weights over the network;
- approved model IDs/revisions/digests;
- approved source origins and download redirect rules;
- whether user-selected private model import is allowed;
- whether shared stores/Hub connections are allowed;
- context/output/resource ceilings;
- diagnostic export permission.

Build-time customer configuration supplies the maximum allowed capability set. Runtime preferences can narrow it, never broaden it. Reuse existing trusted customer configuration where available; do not claim a mutable AsyncStorage flag is administrator enforcement. Never turn a Hub-exported config or imported model manifest into an authorization grant.

For standard alpha builds, both local modes may be offered. Default a fresh local setup conservatively to embedded/not configured rather than automatically finding another app or network provider. Existing deliberately selected cloud/LAN modes may remain explicit.

For an isolated customer build, omit or enforce-disable shared and remote AI integrations. Do not merely hide buttons. Do not remove the business application's legitimate SAP/CAP networking. "No external inference" does not mean the entire sales application has no network access.

Use a customer warning for shared Android: prompts are processed by the separately installed, user-approved ModelCommons Hub. Offline IPC still crosses an application trust boundary.

Never automatically retry through a different provider, model ownership domain or shared folder. A deterministic business answer remains allowed and must be labeled as deterministic, not as successful model inference.

## 8. Store design, private roots and provisioning

Make model stores instance-based. A store's identity includes its ownership domain/root and trust configuration, not merely a model ID. Two private stores may legitimately hold identical bytes.

Private storage:

- Android: internal app-specific persistent storage, with appropriate model/metadata backup exclusions. No external/shared storage or exported content provider for private models.
- iOS: Library/Application Support/<app-owned-model-area>, outside exposed Documents. Apply appropriate data-protection and backup-exclusion attributes. Do not put persistent required models in purgeable caches.
- Resolve roots through native APIs; never persist sandbox UUID-dependent absolute paths as portable configuration.
- Do not enable Files exposure, App Groups or Keychain sharing on Sales & Pricing merely because it imports the native library.

Make native hashing/atomic operations explicitly support the chosen roots. Review the current broad app-home/leased-root allowlist; do not turn a caller-supplied root into arbitrary filesystem authority.

Reuse and retain the existing lifecycle:

explicit install -> staged partial -> exact size/hash validation -> immutable artifact -> validated manifest -> atomic READY registry publication.

Include cancellation, interrupted-download recovery, low-disk failure, one mutation at a time per store, and atomic registry updates. Installation and readiness are distinct from execution availability.

Stream native file hashing. Never read multi-GB weights into JS, base64, an ArrayBuffer or a single Data object. Do not duplicate weights in temporary caches unnecessarily. Enforce bounded metadata size/nesting before parsing.

Use the curated pinned starter manifests from ModelCommons. Do not make users paste a GGUF URL for the normal path. Preserve separate model license handling; do not add artificial acceptance requirements to ungated entries that do not need them.

Private import is an intentional COPY from a user-approved source into private staging, then verification/publication. It must not remain a bookmark into another app's store while claiming isolation. Shared-file connection, by contrast, must not silently copy weights. Make the distinction visible before the operation.

An arbitrary imported GGUF needs an approved manifest or an explicitly allowed advanced-import policy. A digest computed from an untrusted file only identifies it; it does not establish publisher authenticity. For curated models validate against a trusted catalog digest. Do not execute remote scripts, downloaded native code or JS from model packages.

No automatic download, catalog refresh, update or connection when the user simply opens the assistant. Provisioning may use network access under its separate policy. Generation never downloads a missing model behind the user's back.

## 9. Read-only shared-store consumption

Separate writable owner stores from read-only consumer views. Shared consumers must not create registries, accept licenses on behalf of the Hub, overwrite profiles, delete artifacts or run legacy migration.

For iOS, read protocol marker/registry/manifests through the same authorized connection as the artifact. Do not assume a file URL returned by a picker makes every generic Expo filesystem operation authorized.

Validate schema/version, relative paths, revision/digest identity and size. If metadata and the file can be edited by the same third-party app, their matching checksum alone is not a trust anchor. Match curated/enterprise-approved revisions against independently trusted metadata.

App Group and user-granted folder access are not Android-style per-client broker authorization. Do not claim ModelCommons can forcibly revoke another app's existing OS file permission or private copy. Document actual revocation boundaries.

In shared mode, absent/corrupt/unavailable resources produce actionable errors. Never download a private copy to mask the failure.

## 10. Embedded runtime and session lifecycle

Use createLlamaRnRuntime and InProcessTransport through reusable composition. Preserve known-working native configuration and the verified version until a specific incompatibility is demonstrated.

Start with a CPU-first safe profile for a starter model: context around 1024 tokens, output around 128 tokens, modest batches, mmap on, mlock off, GPU layers zero. These are requested smoke-test settings, not measured guarantees. Verify exact supported fields and report the effective settings after resolution/loading.

Do not apply CPU-MoE or speculative/exotic features to this task. Do not globally downgrade other profiles. Use the existing resolver without bypassing hard safety checks.

One active generation/model context per backend by default. Serialize transitions. Reuse weights only with documented context isolation; clear/reset KV and recurrent state between independent sessions/identities, or destroy the context when reset cannot be guaranteed. Never reuse customer conversation state across logins, tenants or providers.

Make cancel/release idempotent. Cancellation must interrupt native generation, detach listeners and release resources. Capture errors without losing the original failure to a cleanup exception; report cleanup failure separately and refuse unsafe reuse.

On mode/model/profile/customer change: freeze new requests, cancel/drain the old request, wait for native completion, release context and leases, disconnect the old transport, then activate the new backend. Drop callbacks from obsolete generations via operation IDs/generation counters.

Do not unload a model while native code is still using its mmap. If cleanup times out, mark the engine unavailable instead of loading a second multi-GB context.

OOM is not always catchable. Track a minimal pending-load marker and report an interrupted prior load on restart without falsely diagnosing every interruption as OOM. No automatic crash/reload loop. Normal errors should preserve a lower-risk manual recovery path.

Context budgeting must include the rendered template, system/business instructions, conversation and requested output. Use supported tokenization where available. Never silently remove business instructions or evidence to make a prompt fit; shorten only eligible history under an explicit policy, or reject with a clear size error.

## 11. Android shared inference: real runtime ownership

Do not just set centralizedInference=true. Existing Binder discovery and synthetic failure events are not generation.

Preferred target: a Hub-owned, bounded native inference worker accessible through the existing secured Service and reusable transport. It must work when the consumer is foregrounded and the Hub Activity is not visible. Do not require an Activity, React hook or chat screen to execute requests.

Before choosing the implementation, inspect the PINNED llama.rn Android/JSI/C++ implementation, its exported interfaces, native artifacts, embedded upstream revision and license notices.

Prefer a supported reusable native entry point if one exists. If the native engine is only JSI-owned, implement a minimal maintainable JNI worker around a pinned compatible llama.cpp build rather than pretending Kotlin can call arbitrary JS methods. Reuse upstream model loading, template rendering, tokenization, sampling and cancellation; do not write inference kernels or guess native symbols.

A supported service-managed headless React host is an alternative only if it demonstrably owns initialization/lifecycle without an Activity and meets the same acceptance criteria. Explain that tradeoff. A hidden UI or forwarding to whichever React screen happens to be alive is unacceptable.

Default to the existing Hub process unless concrete isolation/linker/lifecycle reasons justify a separate service process. If separating processes, redesign registry/approval invalidation and control IPC appropriately: static instance sets and ordinary cached SharedPreferences cannot be treated as cross-process coherence.

Prevent Hub chat and the broker from independently loading the same model. Prefer routing Android Hub chat through the same broker once it is viable, or provide one shared execution owner with an enforced global context limit. Review duplicate native binaries, symbol collisions and native memory ownership.

Initially support short text generation, streaming, cancellation and safe serial use. Capability discovery must advertise only this actual subset. Heavy work must run off Binder/main threads. Do not promise indefinite background inference, add fake foreground-service types, or abuse wake locks/boot-start behavior.

Keep authorization derived from Binder.getCallingUid at the IPC boundary BEFORE posting work to another thread. Preserve package, signing-certificate, Android-user and scope validation. Recheck authorization immediately before queued execution and handle revocation during active work. Authenticate the Hub provider too through configured/approved package-signing identity; a familiar package string alone is not sufficient trust for customer prompts.

## 12. Android IPC correctness, resources and security

Implement/reuse a ModelCommonsTransport backed by the native client. Sales & Pricing must not own custom AIDL, callback parsing or request routing logic.

Review the current descriptor shape. The generic client needs enough validated metadata to resolve a model/profile, while the native descriptor currently contains a smaller snapshot. Extend/version the contract or supply a bounded descriptor lookup. Do not cast incomplete metadata to ModelManifest or invent fields.

Public calls reference model/revision/profile/session IDs, never arbitrary Hub paths. Resolve verified READY artifacts in owner storage. Check license and policy at execution time. UI snapshots and booleans are not the execution authority.

Bind explicitly to the configured service. Keep consumer androidHubService=false and declare only narrow package visibility queries. Do not request QUERY_ALL_PACKAGES. Do not turn every consuming application into an exported Hub.

Preserve and enforce existing request/event byte limits and pagination. Fail early with a typed size error. Never truncate a business prompt to fit Binder. Keep streamed event sizes bounded, preserve UTF-8 and sequence numbers, and use real flow control or a bounded queue with explicit failure/cancellation; one-way Binder callbacks do not themselves provide backpressure.

Validate the full canonical request in native code or in the trusted runtime host before execution. Parsing JSONObject alone is insufficient. Maintain shared fixtures for cross-language constraints. Reject unsupported fields/features rather than ignoring them.

Start with one generation at a time and explicit BUSY behavior rather than an unbounded queue. Bound sessions per UID and globally. Bind ownership to caller/session identities. Clean up idle sessions as well as active requests when clients die; an active-generation callback death recipient alone leaves idle sessions uncovered.

Handle client death, callback failure, service death, revocation, timeout and repeated cancel/release. A request has one start and one terminal outcome. Register listeners before generation can emit. Reject mismatched session/request IDs and stale/out-of-order events. Never replay customer requests automatically after process death.

Separate engine/transport readiness from artifact readiness and model residency. An unloaded usable engine must not be confused with an unimplemented broker. A successful createSession or bind is not a successful inference result.

## 13. iOS modes and native safeguards

Embedded iOS is a required first checkpoint. Use the private store and runtime adapter with no Hub, App Group or document bookmark dependency.

Shared iOS has two separately testable connection types:

A. App Group for apps actually provisioned under the same Apple Developer team. Resolve the real container. Both the Hub writer and consumer must agree on the ModelCommons subdirectory root. Do not only add entitlements while leaving Hub downloads in private Documents.

B. User-selected directory for open-ecosystem access. Use the native folder picker with asCopy=false, persist a bookmark, handle stale/revoked/deleted resources, and reacquire access on later launches. Prefer locally available on-device files for the offline proof. Do not silently materialize cloud files during inference.

Do not invent entitlement values or assume all UVA apps use the same signing team. Build embedded-only iOS successfully when no group is configured. Group unavailability should affect the shared mode only.

Audit SharedModelConnector and native module teardown carefully. Desired order:

start authorized access -> coordinated metadata/integrity read -> runtime load/mmap -> inference -> native context destruction -> release file/security-scope lease.

The security scope must stay alive for the entire native context lifetime, including cancellation and failure. Expo OnDestroy/OnAppContextDestroys must not revoke scopes before llama has finished using them. Arrange teardown ownership explicitly.

Do not hold a global connection mutex during multi-GB hashing. Pin the lease while I/O occurs, keep blocking operations on a worker queue, and serialize only state transitions. Support cancellation checkpoints where possible without falsely claiming immediate native SHA cancellation.

Use supported file coordination for shared metadata and mutable publication boundaries. READY weights are immutable by convention, not magically immutable because a URL was granted. Design owner deletion/update behavior for cooperating readers. Do not claim the Hub's JavaScript beforeDelete hook can release another app's runtime. If safe cross-app deletion cannot be established, refuse/defer that destructive operation and document the boundary.

Do not use VPNs, NetworkExtension, private APIs, a hidden local webserver or a simulated iOS inference daemon.

## 14. Sales & Pricing provider integration

Keep business-facing code in the existing repository style; do not convert the whole app to TypeScript.

Suggested narrow file changes, adapting names to existing architecture:

- providers/embeddedLocalProvider.js: private-store in-process backend.
- providers/modelCommonsProvider.js: shared backend selected by platform.
- A shared application bridge/factory: converts existing messages/options into canonical ModelCommons requests and results.
- Reusable availability/diagnostic hook or service, independent from the large Settings screen.
- inferenceStore.js: explicit mode and separate configuration for embedded versus shared.
- router.js: exhaustive mode resolution, policy checks and accurate execution evidence.
- Dedicated Local AI settings section/screen integrated into current navigation.

The existing deviceProvider and deviceModelService may become thin delegates temporarily or be removed once the embedded replacement is feature-complete. Do not leave two live downloaders/context managers for the same embedded mode.

Keep provider.generate(messages, options), healthCheck and release compatibility where helpful. Internally obtain a structured result with actual model/revision, backend and timing. Do not use a mutable global last-result variable. Adapt strings only at the existing application edge.

Snapshot mode, policy and identity at request start. Report the actual resolved model rather than modelcommons:auto. Add request-scoped execution receipt plumbing without breaking strict canonical validators or leaking a provider's raw exception/request body.

## 15. Preserve deterministic business safety

Do not modify deterministic calculations, authorization, scenario eligibility or narration verifiers merely to make the new model appear useful.

The application currently keeps GREETING, GENERAL_HELP and CONTEXTUAL_ASSISTANCE model-free. Preserve that. Use a dedicated synthetic connection test to prove generation.

Keep executeDeterministic -> verify -> render -> optional model narration -> verify narration -> deterministic fallback.

Do not stream unverified business narration into the final answer before the verifier approves it. Streaming is appropriate for the synthetic diagnostic; business display follows existing safety requirements.

Cancellation must propagate through the workflow to the provider and native session. User cancellation must not be interpreted as permission for another provider or a fabricated successful model result. A model rejection may still return an explicitly labeled deterministic business answer.

Preserve synchronized business guardrails and per-sales-area prompts. Do not apply blanket AI-state resets to these unrelated settings. Clean obsolete local URL/path/tuning state intentionally without adding migration machinery.

## 16. Settings and mode switching UX

Offer compact mode-specific controls, not a generic cloud-model browser.

Embedded:

- Installed private models, curated starter options, explicit download/import/delete.
- Source, exact revision/digest, formatted size, license and readiness.
- A safe/balanced profile choice and sensible context/output controls.
- Clear notice that a private copy uses additional space and does not require the Hub.

Shared Android:

- Hub identity/version, approval status, actual runtime readiness.
- Installed compatible models, selected profile and reconnect/refresh.
- Open Hub only on explicit action; keep prompts out of deep links.
- Guide the current pending-request -> Hub approval -> retry flow. Do not pretend an automatic OS approval popup already exists.

Shared iOS:

- Connect configured App Group or choose shared directory.
- Connection status, immutable model selection and disconnect.
- Explain that weights are shared but generation runs in Sales & Pricing.

Use distinct states for unavailable native module, no Hub, untrusted Hub, permission required, denied/revoked, protocol mismatch, runtime not implemented, no usable model, ready, busy/loading/generating, cancellation and memory failure. Map them to existing typed errors; add new stable codes only where a current code cannot represent the distinction.

No checks that load a model, request permissions, install weights or discover the Hub merely to paint Settings green. Make verification an explicit action. Keep web imports safe and return unsupported states without native-module crashes.

Reuse current UI and localization conventions. Do not introduce a redesign, new navigation framework or English-only strings into an otherwise localized surface.

## 17. Real diagnostic, available in TestFlight

Add a small Test local AI screen/action with a synthetic prompt, bounded output, Run, Cancel and a sanitized result summary.

Make it available in the chosen alpha/TestFlight build through explicit build configuration. __DEV__ alone is insufficient because TestFlight uses release builds. Do not expose unrestricted production diagnostics or any authentication bypass.

Run through the selected REAL provider, with mock/cloud/cross-mode fallback disabled. This screen must be usable for a local infrastructure check without contacting a live SAP backend or reading real business/customer data. Preserve normal application access controls; use a harmless pre-login health surface or existing offline demo fixture as appropriate.

Record/display:

- selected mode and actual execution/storage ownership;
- actual model ID/revision, runtime version, requested/effective profile;
- first-text latency and total duration;
- streaming observed, terminal outcome, cancellation and cleanup status;
- fallback=false and typed failure reason where applicable.

A generated answer need not match an exact phrase to pass transport validation. Small models may answer poorly. Separate semantic quality from infrastructure success.

Persistent/exported diagnostics contain only allowlisted metadata. No prompts, generated answers, business objects, credentials, native stack traces, filesystem paths or tool arguments. Synthetic output can be displayed in the test UI without adding real chat contents to logs.

Add targeted diagnostic/error-copy support that works without Xcode. Do not claim a UI "offline" badge is proof that no network was used.

## 18. OpenAI/Anthropic compatibility

Preserve the independent canonical protocol and existing provider adapters. Both local backends should feed the SAME adapter implementation through a reusable provider backend, not Hub-only composition.

Support the currently implemented text subsets for OpenAI Responses, Chat Completions, model listing and Anthropic Messages, including existing streaming/error semantics. Do not expand embeddings, tools, vision or structured-output guarantees just to fill a matrix.

The effective capability set is the intersection of model, loaded template, runtime, transport and policy. Unsupported features fail explicitly. Never discard tools/schema/image requirements and return ordinary text as if the request were fulfilled.

Injected fetch must remain per-client, synthetic-origin allowlisted and fail closed. Never replace global fetch, use real vendor secrets in local configuration, perform DNS for the synthetic origin, or forward unrecognized requests to the network. Disable automatic retries/logging in SDK acceptance fixtures.

Provide examples for embedded and shared transports using the SAME OpenAI/Anthropic conversion code. Keep official SDKs optional/dev-only; do not assume React Native SDK support from Node fixtures. Preserve wire-level tests and add actual owner-run mobile smoke cases.

Keep existing cloud behavior outside the local backend. If touching cloud credential persistence, remove public build-variable/plain AsyncStorage handling of secret keys in that path; use the existing secure credential mechanism or an explicit narrow SecureStore integration. Do not expand this into a backend identity rewrite.

## 19. Native packaging and reproducible cross-repository consumption

Make the required packages consumable through documented exports, not TypeScript path aliases pointing into a sibling checkout. Compiled JS plus declarations is the default target for pure packages; use correct RN/platform entry points and include native Swift/Kotlin/AIDL/podspec/plugin files where required.

For development before npm publication, provide a pack-and-install workflow:

- Owner builds/packs the required dependency closure from ModelCommons.
- Version-matched tarballs live inside the Sales & Pricing EAS upload root, e.g. vendor/modelcommons/.
- Consumer package references are project-relative and every transitive ModelCommons dependency resolves locally without an unpublished npm package lookup.
- Lockfiles are generated by the package manager and artifacts are traceable to source/version/digest.
- .gitignore/.easignore and uploaded content must agree. A tarball on the owner's PC outside the uploaded app directory is not available on an EAS worker.

No absolute paths, npm link assumptions, undocumented symlinks, credentials in registry URLs, committed weights or copied editable library source in the consumer.

Keep native client/storage and Android Hub execution dependencies separate. Importing the client must not export a service or include a llama engine. Verify merged manifests and iOS entitlements in owner-run artifact inspection.

Do not casually change Expo/RN, Java/Kotlin/NDK, llama.rn or the protocol version. Document every necessary compatibility change and update all affected fixtures/manifests coherently.

## 20. iPhone TestFlight / EAS readiness

The owner develops on Windows and has an iPhone/TestFlight path. Make cloud-built release binaries the intended iOS verification path; a local Xcode installation is not a prerequisite for this task.

Retain each project's correct bundle ID, EAS project ID, Apple team configuration, variants, OAuth schemes, update channels and runtime compatibility. Never reuse the Hub's app identity for Sales & Pricing.

For Sales & Pricing refine the existing uva-testflight build/submit profiles. They should produce store-distribution, non-simulator, non-development-client release builds, with the local-AI diagnostic explicitly enabled for this alpha channel. APP_ENV=preview may remain appropriate; store-distribution binaries and production business data are different decisions.

Review native payload installation in cloud builds. The current Hub's preandroid hook alone is not an iOS/EAS guarantee. Ensure the pinned dependency's required Apple artifacts, podspec and native module autolinking participate in a clean EAS install. Do not skip TLS/integrity verification or hand-edit node_modules as the solution.

Changing native modules/entitlements requires a new native build. Review expo-updates runtime-version/channel compatibility so an incompatible JS update cannot land on an old binary. Do not publish OTA updates in this task.

Use owner-managed signing. Never print, commit or invent certificates, provisioning profiles, App Store Connect IDs or private keys. Do not set encryption-compliance answers merely to suppress an App Store Connect warning.

Provide commands using the actual profiles. Prefer submitting an explicit reviewed build ID over an ambiguous --latest when several builds exist. Explain required operator steps for TestFlight groups and App Group provisioning. Do not initiate builds, uploads or release yourself.

## 21. Model and memory scope

Use the already pinned SmolLM2 360M Instruct Q4_K_M catalog entry as the default candidate; keep 135M as a lighter alternate and Qwen2.5 0.5B as a second-family test.

Use existing verified manifest data rather than retyping checksums or assuming mutable main URLs. Preserve MedGemma and experimental Qwen3 entries without using them as acceptance prerequisites.

The owner has reported Android generation success, but do not invent its precise model/profile/OS or claim all three models have passed. Physical results require recorded observations.

Do not port FreeToken, implement an expert pager, add system-model adapters or tune GPU/NPU performance in this task. Memory estimates are estimates. mmap does not add physical RAM; file deduplication does not deduplicate all runtime/KV memory.

## 22. Focused tests to AUTHOR, not execute

Use existing test runners and dependency injection. No real weights or network calls in unit tests.

Cover these meaningful behaviors:

1. Store root isolation; same model ID in two owner stores cannot cross-resolve.
2. Shared read-only consumers cannot mutate owner registry/files.
3. Path traversal, symlink escape, hostile URI/metadata and untrusted-manifest rejection.
4. Hash/size mismatch, interrupted download, cancellation, atomic READY publication and low disk.
5. Explicit import copies into private storage; shared connection does not copy.
6. Embedded mode never discovers/binds Hub or invokes network inference.
7. Shared mode never falls back to embedded or invokes private provisioning.
8. Invalid/forbidden provider never falls through to LAN/cloud/mock.
9. Policy limits cannot be expanded by settings or imported config.
10. Repeated cancellation/release, failed load cleanup, stale callbacks and mode switching.
11. Independent sessions/customer identities cannot reuse previous KV/recurrent state.
12. Model deletion cannot race a live local runtime; shared deletion behavior matches documented limits.
13. Actual resolved-model evidence is request-scoped and survives alias selection accurately.
14. Deterministic scenarios remain model-free; narration verification still rejects invalid output.
15. Binder caller identity captured correctly, provider trust, owner-scoped sessions and revocation.
16. Native request validation matches TypeScript fixtures; bounded chunks, ordering and one terminal outcome.
17. Client/service death, idle-session cleanup, busy/resource limits and explicit retry.
18. iOS bookmark lifecycle, stale/denied path, read-only access and context-before-lease teardown.
19. Native/browser-safe imports and missing optional runtime handling.
20. OpenAI/Anthropic fixtures work with both backends, including streaming/cancel/error rejection.
21. AI-path network traps assert zero provider fallthrough; separate provisioning traffic is explicitly permitted only in provisioning tests.
22. A clean external consumer resolves the packed dependency closure without workspace aliases or hidden root dependencies.
23. Isolated customer build configuration excludes/denies prohibited integrations.
24. Diagnostics never persist sensitive payloads and TestFlight diagnostic access is not __DEV__-only.

Mark native cases requiring hardware as integration test plans, not as unit-test proof.

## 23. Owner-run acceptance matrix

Document exact commands and pass/fail evidence for:

E-A: Embedded Android
- ModelCommons Hub absent/disabled; Sales & Pricing cold starts.
- Explicitly provision/import a starter model into private storage.
- Disconnect network after provisioning; run synthetic text/stream/cancel/release/repeat.
- Demonstrate no Hub binding and no external inference request.

E-I: Embedded iPhone/TestFlight
- Standalone release binary with no Metro and no Hub installed.
- Provision while online, then run after restart in airplane mode.
- Test bounded generation, cancellation, repeated load/release, lock/background/foreground.
- Record private storage and no shared entitlement requirement.

S-A: Shared Android
- Hub owns one verified model; consumer private model absent/unused.
- Consumer discovers/verifies Hub, approval occurs, metadata and runtime state agree.
- Generate through the broker with Hub UI not visible; prove execution ownership.
- Revoke approval and terminate service/client; demonstrate truthful errors and no fallback.
- Distinguish process recreation from Android force-stop semantics; do not promise recovery from force-stop without user action.

S-I-G: Shared iOS App Group
- Both signed apps actually have the same provisioned group.
- Hub provisions into the group store; consumer opens that exact file without a second artifact.
- Consumer performs inference locally with correct lease/context cleanup.
- Record shared container/file evidence; matching hashes alone do not prove there is only one physical file.

S-I-F: Shared iOS Files
- Explicit on-device folder selection, restart and bookmark restoration.
- Read the same verified resource without copy; cancel/release safely.
- Deletion/revocation/unavailable files fail clearly.
- Testing two same-team apps through a picker validates the mechanism but is not proof of a separately signed unrelated-developer deployment.

B: Business safety
- Greetings/help remain deterministic with model.invoked=false.
- A model-enabled scenario uses the selected backend and still passes narration verification or returns the correctly labeled deterministic answer.

I: Isolation profile
- Shared/remote AI mode cannot be enabled through settings/config tricks.
- Business networking remains governed by the existing application configuration.

Do not call the project fully verified until these separate outcomes are actually recorded. Report implementation status independently from device evidence.

## 24. Documentation and final handoff

Update only relevant architecture, integration, privacy, security, package-consumption, TestFlight and test documentation. Keep source licenses/notices intact; ModelCommons source, Sales & Pricing business source and model weights have separate licensing responsibilities. No private business code or data in generic examples.

Deliver:

- Per-repository file/change list and actual dependency changes.
- Final package graph and exported public APIs.
- Policy/mode matrix and explicit fallback rules.
- Storage roots/backup/data-protection choices and import-versus-sharing behavior.
- Embedded Android/iOS implementation status.
- Android broker choice, native-source provenance and remaining lifecycle limits.
- Shared iOS implementation status and entitlement/operator prerequisites.
- Provider compatibility matrix with unsupported capabilities stated.
- Tests authored versus checks actually run (none unless separately authorized).
- Owner commands for dependency resolution, packing, consumer installation, static/unit checks, native builds and TestFlight submission.
- Every residual blocker, especially any path still scaffolded.
- The first smallest physical test to run and the precise evidence it should produce.

Keep a compact implementation checkpoint document so a subsequent coding session can continue without guessing. Do not mark a checklist item complete when only its interface exists.

The final product should let a customer deliberately choose:

"Keep my model and inference entirely in this application."

or:

"Use shared on-device resources managed by ModelCommons."

Both choices use the same maintained ModelCommons foundations. Neither choice silently becomes the other.

Proceed with scoped repository inspection and implementation.

---

### Primary references to verify against the selected toolchain

These support platform decisions; they are not permission to assume an API exists in the pinned version:

- Android bound services: `https://developer.android.com/develop/background-work/services/bound-services`
- Android AIDL: `https://developer.android.com/develop/background-work/services/aidl`
- Android app-specific storage: `https://developer.android.com/training/data-storage/app-specific`
- Apple App Groups: `https://developer.apple.com/documentation/xcode/configuring-app-groups`
- Apple directory access: `https://developer.apple.com/documentation/uikit/providing-access-to-directories`
- Apple backup exclusions: `https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup`
- EAS iOS build process: `https://docs.expo.dev/build-reference/ios-builds/`
- EAS iOS submission: `https://docs.expo.dev/submit/ios/`
- EAS TestFlight: `https://docs.expo.dev/submit/testflight/`
- Runtime source: `https://github.com/mybigday/llama.rn` and its pinned release/embedded llama.cpp revision.
- Provider SDK source: `https://github.com/openai/openai-node` and `https://github.com/anthropics/anthropic-sdk-typescript`, pinned only where used in acceptance tests.

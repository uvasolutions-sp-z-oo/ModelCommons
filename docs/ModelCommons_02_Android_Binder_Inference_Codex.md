> Historical implementation brief/checkpoint. Its instructions and status claims
> describe earlier work, not the current release state. See the
> [current documentation status](README.md) and
> [iOS device evidence](verification/ios-shared-models.md).

# Codex implementation prompt 2: Android centralized inference over Binder

## Execution order

Run this as a separate implementation pass after reviewing the iOS sharing changes. Do not run both prompts concurrently against the same working trees. Preserve any newer owner changes.

This is a native runtime/IPC task, not simply enabling an existing feature flag. Build a real, bounded two-app inference flow, rather than a service that returns placeholder success or forwards work to a mounted Hub screen.

## Goal

    ModelCommons Hub owns and downloads one approved GGUF
    -> S&P has no private copy of that GGUF
    -> S&P connects through an explicitly selected Android Binder service
    -> user approves S&P's installed signing identity in Hub
    -> Hub-owned native worker loads the verified artifact
    -> canonical text events stream back to S&P
    -> cancellation/release and revocation reach the native worker

Storage owner = Hub. Execution owner = Hub. No weights need to cross Binder. The S&P process must not initialize its embedded llama.rn engine for this shared-mode request.

Keep private embedded inference as a separate, explicitly selectable option. Keep iOS shared-file inference separate: on iOS the consumer executes its own runtime against a shared file.

## Repositories and authority

D:\GitHub\ModelCommons
D:\GitHub\spm

Expected remotes: uvasolutions-sp-z-oo/ModelCommons and uvasolutions-sp-z-oo/sales-pricing-mobile-internal-history.

Read applicable repository instructions and existing diffs. No branch switching or destructive cleanup. No commits, staging, pushes, PRs, releases, publication, installs, tests/typechecks, package repacks, prebuilds, native builds, EAS calls, model downloads, credential changes or removal of user files. Add code, tests and owner-run commands; the owner executes them.

Do not edit node_modules or vendored archives. Do not change llama.rn 0.12.9 for existing embedded/iOS routes. Do not combine this with framework upgrades, MoE, AI Core, new models, voice, image support, app redesign or marketing publication.

## Starting source evidence

The review on 2026-09-11 inspected ModelCommons main at 4e90e463561a66379ed5bbfeca0a7cb087545c17. Current local source takes priority.

Read docs/DUAL-LOCAL-AI-CHECKPOINT.md, then these files and their direct dependencies:

ModelCommons native package:

* android/src/main/java/expo/modules/modelcommonsnative/service/ModelCommonsService.kt
* android/src/main/java/expo/modules/modelcommonsnative/client/AndroidHubClient.kt
* android/src/main/java/expo/modules/modelcommonsnative/security/CallerAuthorizer.kt
* android/src/main/java/expo/modules/modelcommonsnative/storage/HubStateStore.kt
* android/src/main/java/expo/modules/modelcommonsnative/ModelCommonsNativeModule.kt
* android/src/main/aidl and the existing ipc parcelable definitions
* src/index.ts, src/types.ts, existing native transport/connection wrappers
* app.plugin.js and package/build configuration

Also read services/modelcommons/modelStore.ts and Hub runtime composition; packages/client, protocol, model-store and runtime-llama-rn only where this call path requires them.

S&P: src/services/inference/localBridge.native.js, localDiagnostics.js, localCoordinator.js, localIdentityBoundary.js, src/components/LocalAISettings.js and the current configuration producing LOCAL_AI_POLICY.

Important observed facts:

* ModelCommonsService deliberately advertises centralizedInference=false and RUNTIME_NOT_READY.
* generate currently emits response.started followed by response.failed/RUNTIME_UNAVAILABLE.
* S&P's shared Android branch rejects before binding because no execution owner exists.
* CallerAuthorizer already checks OS-derived UID, package set, user, scope and certificate-bound approval. Reuse and strengthen that boundary.
* HubStateStore is only an inventory snapshot containing ID/revision/displayName/state/capabilities. It is NOT a validated artifact descriptor, hash check or native runtime.
* The prior source inspection found no supported standalone Service entry into llama.rn's React-owned JSI engine. Do not invent one.

## Architecture decision

Implement a Hub-only native inference host around a pinned, provenance-verified llama.cpp source revision, with a narrow JNI interface and a single execution coordinator. Keep the host build/runtime dependency optional and separate from the lightweight native connector used by clients.

Inspect the actual installed llama.rn 0.12.9 package for the embedded source/build provenance and supported model/template/tokenizer APIs. The existing adapter records llama.cpp b10256, but a build label alone is not sufficient to pin source or ABI. Record an exact source commit/archive digest and licenses for the new host. Do not guess symbols exported by llama.rn's private .so files or assume ABI compatibility with arbitrary upstream main.

Prefer building the required compatible source into the host with isolated symbols/library names over dynamically binding undocumented JSI internals. Prevent duplicate-symbol/ODR conflicts when an app also includes llama.rn. Do not vendor unreviewed binaries, pull unpinned source, or depend on the local D:\GitHub tree during EAS builds.

If the exact source/headers are unavailable within authorized reads, implement only what can be grounded and report the source acquisition/pinning blocker explicitly. Never enable the execution capability until the actual worker is implemented. Do not insert a dummy worker in the production route.

Suggested new responsibilities, adapting names to existing structure:

    optional Hub inference-host module/package
      NativeInferenceHost / JNI facade
      InferenceCoordinator
      VerifiedArtifactResolver
      canonical text request validator/mapper
      bounded event pump

Keep protocol/client packages platform-neutral. Third-party consumers should not inherit the heavy host merely by using Binder. S&P may still include llama.rn for its explicit private mode; prove it is not initialized in shared mode.

## 1. Build an actual service-owned worker

The worker must operate without a mounted React component or Hub Activity. It must support ordinary service process cold start once models and user approvals already exist.

Use a conservative CPU-only first slice: the currently approved SmolLM2 135M/360M text model, context 1024, bounded output 128, one active generation and one loaded context. Preserve model-specific limits and explicit profile negotiation; do not silently truncate evidence. Runtime settings are chosen by Hub policy, not arbitrary caller-provided native flags.

Implement actual model load, tokenizer/template rendering, prompt token budgeting including output reserve, evaluation, sampling, UTF-8 text emission, stop handling, cooperative cancellation and context destruction through real pinned APIs.

Use the GGUF's supported chat template and explicit system/user messages. Do not hardcode a blue bicycle response, rely on a developer-only transcript hack, or advertise tools/structured output/vision/embeddings before implementing their contracts. Reject unsupported capabilities and input fields explicitly.

Separate service/binder threading, worker execution, and callback delivery. Binder methods must return promptly rather than synchronously parsing/loading/generating on an inbound transaction thread. Keep cancellation on a control path that cannot queue behind an entire generation.

Clear context/KV state between unrelated requests and users. Initially destroy the context at request/session end if that is the simplest reliable isolation. Pooling is not required. Do not keep unbounded queues, prompt history or cross-client caches.

Use a distinct runtime identity for this host. Reusing compatible llama.cpp source does not make the new worker 'llama.rn 0.12.9'. Receipts must name the actual runtime and source/build identity.

## 2. Resolve and verify the Hub-owned artifact

Never accept a filesystem path, file:// URI, content URI, arbitrary download URL or checksum from a Binder caller as authority to open a model.

Resolve a stable approved model ID/revision through Hub-controlled catalog/policy and the authoritative installed store. Confine file opens to the actual owner root. Do not guess where Expo documentDirectory maps on Android; inspect its producer and native bootstrap.

If native cold start needs an owner-published root/descriptor, add an internal Hub-only publication path with strict root confinement and schema validation. Treat its persisted data as untrusted on reload and revalidate. A metadata snapshot's READY string is not enough.

Require regular local files, exact declared size and streamed SHA-256 against trusted pinned metadata before native parsing. Verify protocol/layout and licenses. Check published immutable revision identity, not a stale display-name list. Never download a missing model as a side effect of inference.

Keep an owner artifact lease for the complete native context lifetime. Hub deletion/replacement must coordinate with the same owner coordinator; in-use deletion is refused/deferred. A second JS-only lease counter must not decide the native worker is idle.

Do not copy model weights into S&P, put weights in Binder parcels, or load the entire file into a Java byte array. Failed integrity must not become a cloud or embedded retry.

## 3. Finish the Binder execution contract

Reuse existing AIDL/parcelables and version negotiation. Extend the interface deliberately where lifecycle/context requirements are missing, and bump the Binder API version if necessary. Do not change the core protocol version merely for an implementation change; use the repository's version policy.

The client needs sufficient validated descriptor metadata to satisfy the canonical transport/session contract, including model/revision, supported context/capabilities and actual runtime identity. Do not synthesize a full manifest from an ID alone or send unrestricted metadata blobs. Audit the existing createSession(modelId, profileId) contract for missing minimumContext/profile/output negotiation.

Define capability meanings precisely. Host implementation available, worker operational, artifact installed, session initialized and generation complete are different states. Do not set centralizedInference=true or runtimeState=READY simply because service binding succeeds.

Validate canonical JSON natively before execution: protocol, bounded depth/size, IDs, session/model association, supported roles, text-only content, sampling fields, context/output constraints and unsupported capabilities. Treat all external strings as untrusted.

Preserve approximately the existing 48 KiB request boundary and bounded event/metadata limits, checking exact current constants. Count UTF-8 bytes, not Java string characters. Bound before expensive allocation where Android parcel handling permits. Do not increase transaction limits to hide a broken design.

For each admitted request: one response.started, ordered text deltas, and exactly one terminal completion/failure. Never emit completed with stopReason=error as success. Keep event IDs and sequences consistent. Split strings at valid Unicode boundaries. Retain accurate usage/timing only when known.

Bound callback queues and in-flight data. On a dead/stalled consumer or backpressure limit, cancel work rather than dropping arbitrary tokens or growing memory. Don't let a synchronous callback to an untrusted client block the worker or service lock. Audit existing oneway behavior rather than assuming it provides flow control.

Prevent duplicate request IDs and cross-session event delivery. Remove death recipients and operations after terminal delivery or disconnection. Async iterator return in the client must cancel work and release resources even when the caller stops consuming without an explicit Cancel click.

## 4. Preserve both directions of trust

Capture Binder.getCallingUid on the incoming transaction before dispatching async work. Derive packages and signing identities through Android PackageManager; never trust an application ID supplied in request JSON.

Retain metadata/inference scope distinction and explicit user approval. Recheck identity/authorization before queued work starts, and bind sessions to captured user/UID/package/signing identity and service generation. Revocation while queued or running must stop admission, cancel the actual worker and suppress further response delivery.

Check and bound the pending approval list and idle sessions to prevent resource exhaustion by unauthenticated callers. A same-developer signing relationship does not replace explicit cross-app authorization in the reference workflow.

Add lifetime ownership for idle sessions as well as active callback binders. Client process death before its first generate must not leak a session permanently. Use a real lifecycle token/death recipient or equivalent versioned design; don't rely only on an active request's callback.

Also inspect consumer verification of the selected Hub package/component/signing identity. Explicit package selection alone is not a universal guarantee that a sideloaded service is the expected operator. Support an explicit trusted/approved Hub identity policy; a fork must configure its own identity, not inherit a private Uva credential or undisclosed hardcoded signer.

No implicit bind, exported diagnostic/admin methods, universal signature permission that prevents legitimate independently signed clients, or approvals made by the requesting app. The Hub admin UI uses an internal trusted path. Preserve the public transport's fail-closed behavior.

## 5. Make lifecycle support finite and truthful

Start with inference requested while the client is visibly in the foreground and bound. Use normal bound-service lifecycle. Do not claim uninterrupted background execution or survival of Android force-stop.

Cancel/drain when the client backgrounds, dies, revokes approval, changes account, disconnects, releases the session or closes its iterator. Distinguish ordinary OS process reclamation and cold service startup from force-stop, which can require user action.

Do not add a foreground service type casually. If a later feature genuinely requires a foreground service, explain the applicable current Android type, permission, user-visible notification and store-policy requirement before adding it. Do not label AI generation media playback or use a VPN to stay alive.

Initialize the native worker without booting a hidden Activity or forwarding prompts into a mounted JS screen. Service death yields a typed unavailable error; rebind/retry is explicit. No automatic replay of potentially sensitive requests, no START_STICKY promise of automatic conversation restoration, and no disk prompt queue.

Handle memory pressure and model-load failure without false success. An uninterruptible load must have bounded admission and an honest draining state; a UI timeout must not launch a second concurrent load. Do not claim all native OOMs or process kills are catchable.

## 6. Give Hub chat and remote clients one execution owner

When Android broker mode is enabled, Hub chat must use the same coordinator/worker as authorized clients, not independently keep a llama.rn context loaded against the same model.

Route Hub-local text requests through the same validated execution backend without requiring self-approval. Preserve identity/isolation rules for remote clients. Serialize or reject concurrent Hub and S&P requests with a clear busy state. Cross-client pooling and simultaneous decoding are out of scope.

Keep iOS Hub execution unchanged. Preserve the existing Android embedded route in consumer apps; selecting that mode remains the user's intentional alternative.

## 7. Wire the reusable client transport and S&P

Implement a ModelCommons transport around the real AndroidHubClient/native calls, not a S&P-only bypass. Reuse canonical client session and stream APIs, cancellation and provider-backend composition.

Replace S&P's unconditional shared-Android failure only when a functioning transport is present. Branch shared Android before getPrivateModelStore/createEmbeddedLocalAI; shared mode must not initialize llama.rn in the S&P process or require a private model inventory.

UX: select/locate Hub, request access, open Hub voluntarily to approve, return and reconnect, select a ready model, generate, cancel and disconnect. Denial or missing Hub is actionable and never switches providers. Do not demand that the user keep the Hub chat screen mounted after approval.

Use an explicit configurable Hub package list in Android queries; do not add QUERY_ALL_PACKAGES. S&P must not export its own Hub service. Keep broad storage permissions out of this task.

Client-facing language must explain that requests are processed in another authorized app on this device. That is a different trust boundary from private embedded inference even though there is no cloud inference request.

## 8. Evidence and tests

Extend sanitized diagnostics to identify android-binder, actual storage/execution owner, model revision, native-host runtime/version, resolved profile, first token, completion, cancellation, cleanup and service interruption. Unknown values remain unknown. Never report llama.rn's version as the host version.

For the synthetic owner test, observe that S&P private GGUF inventory stays empty, its private provisioning/copy APIs were not called and its embedded runtime was not initialized. Don't hardcode zeros. Matching model IDs/hashes and an IPC success response alone do not prove shared inference. Observe actual worker load and real token generation inside Hub.

Keep raw paths, prompts, model responses, customer data, stack traces, auth material and native error text out of exports/logs. No new telemetry or report endpoint. Cancellation and authorization failures have safe fixed categories.

Write, but do not run:

* Native/contract tests for approved/denied/revoked callers, spoofed identity, signing changes/shared UID, wrong Hub identity, session theft, duplicate IDs and limits.
* Worker mapping tests for real template/token budget requirements and unsupported capability rejection.
* Bounded request/event/queue and Unicode splitting tests.
* Correct start/terminal sequence, cancellation, iterator return, callback death, idle client death, service death and rejection after release.
* Artifact descriptor/size/hash/policy mismatch and deletion while leased.
* Host/S&P serialization and no state leak across clients or Hub chat.
* Consumer shared mode never calls embedded inference, private downloads or network fallback.
* Existing embedded Android and all iOS paths remain compatible.

A fake worker is acceptable only in unit tests, never the live application route or a 'verified' capability decision.

## 9. Owner-run acceptance and distribution

Write docs/verification/android-binder-inference-owner-run.md with exact build/package prerequisites, supported ABI/API floor and actual source pin/licensing. Provide PowerShell commands one per line. The owner runs tests, refreshes packages, builds and installs.

Minimal device experiment:

1. On the existing Samsung S22, record OS, app builds, signing channels, source commits, runtime and pinned starter model.
2. Hub downloads/verifies the GGUF once. No corresponding private GGUF in S&P.
3. A separately signed test client requests access; verify denied/pending first, then explicit approval of installed identity and scopes.
4. S&P connects, requests text offline with airplane mode and Wi-Fi off, receives real ordered tokens and a successful terminal event.
5. Verify Hub owns the engine and artifact; consumer private provisioning/runtime initialization counters remain untouched.
6. Cancel, retry, and run a second distinct synthetic conversation without context leakage.
7. Try Hub chat while S&P is active; one coordinator serializes/rejects safely.
8. Exercise revocation, client death, ordinary Hub process restart/cold bind and service death with synthetic inputs. Record force-stop separately and expected user recovery.
9. Confirm private embedded S&P still works with Hub absent when explicitly selected.

New native host dependencies require a real new Android binary. Update pack-local-packages dependency closure/provenance if adding packages, but keep host-only packages out of consumer dependencies unless explicitly required. Give the owner a coherent reinstall/lock verification procedure for every repacked archive. Never edit integrity hashes manually.

Record code-complete, locally tested, signed-device verified and public-release supported as separate statuses. Do not rewrite the README as if the owner acceptance already happened.

## Final response

Provide the actual architecture and source pin; files/packages changed; remaining native build/provenance risks; implemented versus still blocked paths; privacy and trust boundaries; Android lifecycle limits; test sources added but not run; exact owner commands; and the physical evidence required before claiming shared Android inference.

No placeholder execution owner, guessed JNI APIs, fake generation, success-by-flag, automatic cloud/private fallback, or claim of completed device testing is acceptable.

# Dual local AI implementation checkpoint — 2026-09-09

This is an incomplete implementation checkpoint, not a release or verification report. The master prompt remains the target. No tests, typechecks, package builds, installs, native builds, EAS operations, model downloads, signing, or Git writes were performed. Read-only inspection and `git diff --check` were performed. No physical-device evidence was produced.

## Workspace and authority

2026-09-11 iOS follow-up: [current implementation and owner-run acceptance](verification/ios-shared-models.md)
supersedes the iOS gap descriptions below. Files coordination, candidate validation
and an explicit App Group writer now have source changes, still untested/unbuilt
for this change. Android centralized inference remains unavailable. The current
consumer checkout is `D:\GitHub\spm`; embedded device success reported by the owner
does not establish cross-app reuse.

The inspected Git roots are `D:\GitHub\ModelCommons` and `D:\GitHub\sales-pricing-extension-platform\sales-pricing-mobile`. Both are readable and explicitly writable in this session's permission configuration; this was not inferred from reads. Git administration directories and `.agents`/`.codex` remain read-only. No additional repository access is required for the working-tree edits. Repository renames/transfers do not determine local directory names; no remote was changed.

Sales & Pricing's `.agents/AGENTS.md` declares repository-wide scope. The initial trees were inspected before edits. Existing business policy, authentication rules, model-free scenarios, identity, signing, model catalog digests, and the Hub's existing installed model were preserved. No app data was deleted. The Hub's old download/runtime path was not replaced wholesale.

## Checkpoint status

| Checkpoint | Code status | Missing work/evidence |
| --- | --- | --- |
| A — reusable foundations | Store/policy/embedded composition implemented, unverified | Hub still has its legacy owner-store and Zustand runtime composition; finish adapting these after regression checks. |
| B — app-contained Android/iOS | Native private storage, download/import, local runtime route and alpha diagnostic implemented, unverified | Generate tarballs/locks, compile Swift/Kotlin/TS, then E-A/E-I physical acceptance. |
| C — Android broker | **Not implemented** | Service still advertises `centralizedInference=false` / `RUNTIME_NOT_READY`. Sales & Pricing rejects shared Android before binding. |
| D — shared iOS | Read-only Files/App Group consumer and lease changes implemented, unverified | No Hub App Group writer; no shared-file presenter covering the entire mmap lifetime; no two-app device evidence. |
| E — compatibility/packaging | Pack script, provider backend, test sources and operator instructions implemented, unverified | Pack/install and all actual regression/device runs outstanding; official SDK mobile prerequisites need validation. |

Do not describe discovery, a file's existence, a successful bind, or an unloaded runtime import as completed inference.

## Public packages and graph

All packages below remain version `0.1.0`; locally generated tarball provenance identifies this unpublished working-tree revision. Consumers must regenerate/reinstall matching artifacts together, not mix old and new `0.1.0` artifacts.

| Package | Runtime dependencies within ModelCommons | Relevant public API |
| --- | --- | --- |
| `protocol` | None | Existing canonical types/validators/errors |
| `client` | protocol | Existing client/transports; new `createTextProviderBackend(transport, context)` |
| `model-store` | protocol | `createModelStore`, `createReadOnlyModelStore`, `parseBoundedMetadata`, port/policy types; `/registry`, `/catalog` exports |
| `device-profile` | protocol | Existing profile resolver |
| `runtime-llama-rn` | protocol | Existing runtime; optional `enforceContextBudget` session flag; optional `llama.rn` peer |
| `embedded` | protocol, client, model-store, device-profile, runtime-llama-rn | `createEmbeddedLocalAI` returns `{transport, release}` |
| `native` | protocol, model-store | Existing native connector; `createPrivateStorePort`, `createSharedStorePort`; config plugin |
| `provider-openai`, `provider-anthropic` | protocol | Existing injected-fetch adapters |

Protocol/client do not import React Native or llama.rn. Native storage/client code does not depend on a llama engine. The existing service scaffold is included but disabled/non-exported in consumers; this is not a separately packaged native execution host. An actual broker must keep heavy host dependencies optional/separate.

The pack script compiles pure packages to CommonJS JavaScript plus declarations. The native archive also retains RN source entry points, Swift/Kotlin/AIDL, podspec, module config, plugin, installer check and MIT license. Compiler aliases exist only inside the producer build. Consumer package references are project-relative tarballs, not sibling paths or npm links.

## Storage, readiness and ownership

- Android private: native `Context.noBackupFilesDir/ModelCommonsPrivate`; not exported/external storage.
- iOS private: native `Library/Application Support/ModelCommonsPrivate`, excluded from backup, complete-until-first-user-authentication protection. Not exposed through Files.
- Existing Hub owner: `Documents/ModelCommons`, unchanged. Existing weights are not moved or redownloaded.
- iOS shared Files: explicitly picked store root containing `protocol.json`, `registry.json`, immutable per-model manifests and artifacts. Bookmarks, not sandbox UUID-dependent paths, identify the connection.
- iOS App Group consumer: configured group container's `ModelCommons` child. The Hub does **not yet provision into this root**, even if its group entitlement is configured. Do not claim S-I-G support is complete.

Readiness retains actual required-file existence, regular-file and exact-size checks. Before loading, required hashes are streamed natively and matched against independently trusted pinned catalog metadata. READY metadata alone is insufficient. A raw GGUF with no approved manifest/store metadata is not an authorized shared store. Listing is an artifact check, not a model-load test.

Provisioning is explicit: staged `.part` → exact size/hash → immutable file → manifest → atomic READY registry. Per-root mutation queues and lease counts prevent private deletion during a live context, including through multiple facades. Failed partials remain bounded by approved size; explicit retry restarts partial transfers and reuses only verified immutable files. A corrupt existing final artifact fails integrity rather than being overwritten: release it and explicitly delete/reinstall. This is not byte-range resume.

Private import invokes a fresh native document picker, streams a COPY into private staging, verifies the selected pinned manifest and discards source authority. Shared connection never copies weights or exposes provisioning/deletion methods. Source URIs are not accepted from imported settings. iOS cloud-backed/ubiquitous items are rejected; local availability of third-party File Provider items still needs device validation.

iOS metadata/stat/hash operations use the authorized connection, pin the security scope during I/O and coordinate reads without holding the connector-wide lock through hashing. Context release precedes lease release. Legacy atomic/hash APIs now accept only known owner model areas, never a shared read lease or the whole home directory. Hub deletion is deferred on iOS because another app may be mapping the file.

Limits: security scopes do not stop another permitted app or Files user from altering/deleting a file. No OS-wide mandatory lock or full-lifetime file presenter is implemented. Hash verification precedes the runtime's own path open, so adversarial replacement remains a residual shared-storage race. An Expo teardown with outstanding contexts deliberately retains scopes; if explicit cleanup is lost, recovery requires process exit. Do not run shared deletion/replacement experiments with business data.

## Runtime lifecycle

Composition is lazy and text-only, with one context/session per backend. Sales & Pricing also has a process-local coordinator spanning both modes. Mode/model/profile changes abort the prior request and deny new work until drain; backend account changes suspend admission until cancellation and identity activation finish. Obsolete callbacks/results are rejected. Backgrounding requests cancellation. There is no provider, model-owner, or network fallback.

Each local request destroys its context; shared-session runtime tests also assert `clearCache` before each completion, including recurrent state. The budget uses native template rendering/tokenization with system instructions and output reserve; it rejects overflow rather than trimming evidence. Safe defaults are context 1024/output 128, CPU, mmap, no mlock; resolved parameters are reported after successful load, not measured memory guarantees.

Native model initialization, hashing, file-provider reads and some cleanup cannot currently be interrupted instantly. New requests remain denied while drain is unresolved. A failed cleanup poisons the coordinator until process restart. There is no cleanup deadline or claim that all OOMs are catchable. A minimal pending-load marker supports manual recovery; an interrupted marker does not establish OOM.

## Android broker decision and next code step

Inspected pinned llama.rn `0.12.9` Android Java/JNI/JSI implementation: the current bridge installs JSI into a React runtime and the Java module depends on ReactApplicationContext. No supported standalone Service inference entry was identified. The adapter identifies embedded upstream build `b10256`; a future host implementation must independently establish exact source commit/build provenance before linking JNI. Existing artifact digests are recorded in `scripts/ensure-llama-payload.cjs` in the native package.

No JNI worker, guessed native symbols, hidden Activity, or UI-forwarding workaround was added. Next step: a separately packaged Hub-owned worker around the pinned compatible llama.cpp/template/tokenization/sampling APIs, followed by an actual native client transport and bounded descriptor contract. It must share the single execution owner with Hub chat. Preserve captured Binder UID/certificate/user/scope authorization, recheck before execution, cancel on revocation, bound sessions/chunks, validate canonical requests, handle both idle/active client death and exactly one terminal event. Current auth/service scaffolding is not proof of these runtime guarantees. C remains not implemented, not a signing or filesystem-access blocker.

## Provider compatibility

`createTextProviderBackend` supplies the same OpenAI Responses/Chat Completions/model-listing and Anthropic Messages adapters for private and shared-file transports. See `examples/reference-client/dual-local.ts` and the dual-composition test fixture. Only text/streaming is advertised here; tools, embeddings, vision and schema guarantees fail explicitly. Injected fetch remains synthetic-origin allowlisted; no global fetch replacement or unknown-origin forwarding.

Sales & Pricing's first native smoke uses the canonical client, not an official SDK. SDK/fetch adapters require suitable Response, ReadableStream and TextEncoder primitives. Node fixtures do not prove Hermes support; a verified per-client primitive injection/mobile SDK smoke is still needed. No polyfill/native/SDK dependency was installed speculatively.

## Changed areas

- `packages/model-store/**`, `packages/embedded/**`: new reusable foundations and test sources.
- `packages/client/src/provider-backend.ts`, index and `examples/reference-client/dual-local.ts`: backend-neutral provider composition.
- `packages/runtime-llama-rn/src/{runtime,types}.ts` and runtime tests: template-aware budget/cancellation/isolation checks.
- `modules/model-commons-native/{src,ios,android,scripts}/**`: private provisioning/import, authorized shared reads and native payload check.
- `services/modelcommons/{catalog,registry}.ts`: reexports of extracted pure data/helpers. `modelStore.ts`: iOS shared-deletion deferral.
- Root/package manifests, tsconfig, `.gitignore`, pack script and this checkpoint. Lockfiles and generated native projects unchanged.

## Owner commands and first acceptance step

Full Windows commands, physical acceptance matrix and evidence template are in the Sales & Pricing repository's `docs/DUAL-LOCAL-AI-OWNER-RUN.md`. Producer commands, to run only when ready:

```powershell
Set-Location -LiteralPath 'D:\GitHub\ModelCommons'
npm install --package-lock-only --ignore-scripts
npm ci
npm run typecheck
npm run test -- packages/model-store/src/__tests__/store.test.ts packages/embedded/src/__tests__/embedded.test.ts packages/runtime-llama-rn/src/__tests__/runtime.test.ts
npm run test -- packages/client packages/protocol packages/provider-openai packages/provider-anthropic packages/device-profile
npm run packages:pack-local -- 'D:\GitHub\sales-pricing-extension-platform\sales-pricing-mobile\vendor\modelcommons'
```

`npm ci` and the EAS post-install hook may download checksum-verified ENGINE artifacts; never model weights. Review the dependency/lock changes and artifact provenance before building. Packing is a build and has not been run. The first physical test is an app-contained iPhone release with no Hub, one explicit starter download, a cold restart in airplane mode, synthetic streaming generation and a sanitized receipt with `fallback=false`/`cleanup=released`.

Platform references: [Apple directory access](https://developer.apple.com/documentation/uikit/providing-access-to-directories), [Android bound services](https://developer.android.com/develop/background-work/services/bound-services), [Expo TestFlight workflow](https://docs.expo.dev/submit/testflight/). These references do not constitute device verification of this implementation.

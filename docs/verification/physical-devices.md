# Physical-device verification

Last updated: 2026-09-14. The [iOS Files record](ios-shared-models.md) contains
an owner-verified offline test on a physical iPhone SE. The broader matrix below
remains an acceptance plan, not a list of completed tests. That one result does
not establish App Group, unrelated-team, Android SAF/descriptors, experimental
Binder, or lifecycle coverage.

Simulator/emulator tests remain useful for UI and protocol failures, but they do
not validate native memory pressure, signing/entitlements, SAF grants,
descriptor mapping, Binder identity, security-scoped files, accelerator
selection, thermals, or lifecycle cleanup.

## Build identity and reproducibility

For every run record:

- commit/release identifier and whether the tree was clean;
- app version/build, application/package/bundle ID, signing channel, and
  entitlement/manifest summary (never private keys or provisioning profiles);
- device marketing model, OS version/build, physical memory tier, free disk, and
  power/thermal starting conditions;
- model ID, immutable revision, artifact size and SHA-256, license acceptance
  path, runtime version, requested profile, and accepted runtime settings; and
- cold/warm state plus the exact test case ID.

The root scripts are `npm run prebuild`, `npm run android`, `npm run ios`,
`npm run lint`, `npm run typecheck`, and `npm test`. `prebuild:clean` regenerates
native projects and can discard manual native changes; use it only in an
intentional clean-generation verification flow. Passing static/unit checks is
necessary but not a substitute for this matrix.

`npm run android` first checks that llama.rn's arm64 native payload is present. If
an install skipped llama.rn's lifecycle hook, the pre-build step runs the
dependency's version-pinned, SHA-256-verifying artifact installer and aborts
before Gradle if the bindings are still unavailable. A device already running
an APK without those libraries needs a replacement native build; refreshing
Metro JavaScript cannot add native libraries to an installed APK.

## Minimum device matrix

Choose real devices available to the project and record their exact identifiers.
At minimum cover:

| Platform | Low/constrained tier | Current representative tier | High-memory tier |
|---|---|---|---|
| Android | supported minimum OS / ≤8 GiB class | current Android / common chipset | ≥16 GiB class with documented backend probe |
| iOS/iPadOS | oldest supported OS/device memory class | current iPhone | highest-memory iPhone/iPad available |

Expo SDK 54 targets Android 7+ and iOS 15.1+, but llama.rn/backend behavior may
impose a narrower evidence-based support floor. Include at least two backend
families where possible (for example Qualcomm and a non-Qualcomm Android). Never
generalize one GPU/NPU result to all devices.

## Baseline model flow

Run the checksum-pinned SmolLM2 360M Instruct Q4_K_M starter entry first. It is
the recommended initial physical-device smoke test and follows the same
download, verification, registry, profile, and llama.rn path as larger models.
It is a text-only infrastructure test, not a quality or device-support claim.
After that flow, run MedGemma 4B IT Q4_K_M separately. Vision adds an mmproj and
image path, so certify text and vision separately. The current llama.rn adapter
does not initialize mmproj; every vision case below is blocked until that runtime
path is implemented, then must pass independently of text.

For the first Samsung Galaxy S22 test: select SmolLM2 360M, download and allow
the SHA-256 check to complete, select it, choose Safe, then send `Reply with
exactly: ModelCommons works offline.` Confirm generation; send a simple normal
question and confirm streaming; cancel a generation; then leave the chat so its
context is released. Record memory/thermal behavior and any crash, OOM, or
cleanup failure. Repeat the same GGUF flow later on signed iOS hardware.

- First launch with no store; registry/protocol creation and catalog display.
- For entries requiring acceptance (such as MedGemma), license review decline,
  then explicit acceptance; no download/load before it. Prove acceptance is
  bound to model ID/revision plus license ID/URL, changed identity requires
  acceptance again, and record the residual same-URL terms-content/version
  gap. Separately verify that the Apache-2.0 starter entries, which are not
  gated and do not require interactive acceptance, can proceed directly to the
  verified download.
- Insufficient disk preflight.
- Download start, progress, background/foreground, cancel, process kill, resume,
  network interruption, server/range mismatch, checksum mismatch, and retry.
- Distinguish cancellation during download from cancellation during
  `VERIFYING`: confirm pause/resume metadata, aborted native rejection maps to
  `USER_CANCELLED`, no later file/`READY` publication occurs, and the current
  native SHA pass finishes before cancellation can take effect.
- Cold startup repair with missing/truncated/replaced artifact and corrupt
  registry swap files. Prove startup checks existence/declared size, then prove
  the first load per process performs full SHA-256 before native parsing and a
  same-size replacement is demoted. Measure startup and first-load hashing
  separately, including the large MoE candidate when enabled.
- `safe` cold load, first token, bounded generation, stop sequence, cancellation,
  release, repeated load/release, and app termination.
- `balanced` only after `safe`; compare requested vs actual backend/devices,
  GPU layers, context, batches and KV types.
- Long prompt, maximum allowed output, rapid cancellation, memory warning,
  screen lock/unlock, background/foreground, and sustained thermal run.
- Vision: valid image, oversized/unsupported image, missing mmproj, cancellation,
  and release. Do not infer vision support from text success.
- Delete while idle and while a session is active; prove the deletion hook
  releases/blocks runtime use before removing files and removes the model record
  from the registry. Verify the documented retention of license acceptance.
- Start an operation on one model and attempt another row operation; prove the
  global UI lock prevents controller replacement and Cancel targets only the
  active operation.

## Adult notice and voluntary output reporting

Run this checklist on the release-signed Android build before enabling its store
track. Use only synthetic model output and notes:

- First launch shows the full adult-use notice before Hub access. Confirm the
  button with TalkBack, accept, restart, and verify it stays accepted. Change
  the policy version in a test build and verify the notice returns. Inspect
  storage to confirm only boolean acknowledgement, policy version, and time.
- With TalkBack, navigate from a completed assistant bubble to **Report output**;
  verify its label, hint, button role, focus order, selected-category radio state,
  note counter/warning, privacy-policy link, Cancel, Send, errors, success
  reference, and at least 44dp touch targets. User/system/error/temporary
  streaming messages must have no action.
- Repeat at the largest supported font scale. Text, category choices, warning,
  preview, buttons, receipt, and errors must remain readable and reachable by
  scrolling without clipped controls.
- Repeat in light and dark mode. Confirm contrast, focus, selected/disabled/busy
  states, plain-text preview, and the system privacy-policy handoff.
- Open a report and press Cancel at multiple points. Confirm no request is made,
  no report history/queue appears, and the selected response remains only in the
  memory-only chat.
- Submit successfully to the approved test receiver. Confirm one `POST` with
  only the documented fields, the displayed reference exactly matches the
  receipt, and the administrator preview remains inert.
- Disable networking and submit. Confirm the bounded failure message preserves
  category/note for manual retry, creates no queue, and reconnecting plus retry
  reuses the same report ID and timestamp.
- Tap Send repeatedly/rapidly. Confirm one in-flight request, one receipt, and
  disabled Cancel/Send controls while it is in progress.
- Report synthetic output longer than 12,000 Unicode characters. Confirm the UI
  warns before sending, previews the exact submitted first 12,000 characters,
  sends `responseTruncated: true`, and does not silently add the remainder.
- After a recoverable failure, change category, note, or response in an
  instrumented test and confirm the next attempt receives a new report ID.
- Restart during/after a failed report. Confirm no draft, content, report ID,
  history, or offline request is restored. Only the adult acknowledgement may
  persist.
- Instrument normal chat usage without opening Send report. Confirm zero report
  receiver requests, including generation, cancellation, navigation, background,
  restart, and ordinary diagnostic logging.
- Evaluate and install a separate build with `MODELCOMMONS_REPORT_URL` absent.
  Confirm configuration succeeds, the form says diagnostic reporting is not
  configured, Send remains disabled, no fallback request occurs, and model
  download, verification, inference, and platform sharing remain functional.
- Inspect logs/crash capture for the synthetic response and note. Confirm neither
  appears, raw server responses are not printed, and the reporting module never
  calls `diagnosticLogger`.

Record cold initialization milliseconds, prompt/generation tokens per second,
peak process memory where platform tooling permits, OS memory/thermal warnings,
cancellation latency, accepted accelerator, and failures. Prompts/responses and
user filenames must not enter the artifact.

## Runtime and canonical API

- Protocol negotiation accepts compatible `0.x` rules exactly as documented and
  rejects an incompatible major/minor.
- Selection uses capabilities and explicit aliases, never provider-name
  impersonation.
- Text streaming orders `response.started`, deltas, usage/completion correctly;
  a failed stream emits one terminal failure and performs cleanup.
- Abort and early return from the async iterator propagate into native
  completion; release is idempotent and no callbacks arrive after terminal
  completion/release.
- Structured-output diagnostics truthfully distinguish `grammar` from
  `prompt-only`; malformed output is rejected by the application.
- Tool support is probed from the loaded template/runtime. Unknown tools and
  invalid arguments never execute.
- A native crash/restart does not leave a model falsely in-use or reuse a stale
  session ID.
- A sanitized runtime failure survives Hub restart, history stays capped at 20,
  and no prompt/native exception text is persisted. The UI recommends `safe`
  but never retries or changes profile without the user's selection.

## Android cross-app matrix

Run two separately signed test clients plus an attacker fixture:

- service absent, disabled, incompatible, and then installed/upgraded;
- explicit bind only; implicit/spoofed intents rejected;
- initial approval, denial, later approval, revocation, and hub/client restart;
- correct package with wrong certificate, certificate rotation policy, and
  multiple packages/shared UID ambiguity;
- authorization rechecked on every AIDL method and caller-scoped IDs;
- malformed parcelables, unknown enum/version, the configured 48 KiB request
  boundary, larger/over-64-KiB input, concurrent transactions, and paginated
  model lists;
- one-way event chunks remain ≤8–16 KiB and preserve ordering/backpressure;
- the current scaffold emits `response.started` at sequence 0 followed by
  `response.failed` / `RUNTIME_UNAVAILABLE` at sequence 1; a future runtime
  broker preserves one start and one matching completed/failed terminal event;
- client process death/callback binder death cancels and releases; and
- service process death yields a typed error, rebinds only under explicit retry,
  and never sends data to a network fallback.

Inspect the release manifest for exported components and permissions. Verify
package/signing identity on a release-signed build, not only debug certificates.

## iOS matrix

Test same-team App Group and unrelated-developer document-picker flows as
separate products:

- missing/mistyped entitlement, provisioning mismatch, valid container, app
  upgrade, reinstall, and both peer apps accessing immutable revisions;
- directory select/cancel, `asCopy: false`, minimal bookmark persistence, moved
  folder, stale bookmark, revoked permission, deleted/replaced file, symlink/root
  escape, protected-data lock state, and coordinated concurrent access;
- reference-counted security-scope lease remains active for the full
  descriptor/mmap/context lifetime and is released after the context;
- repeated load/cancel/release does not leak security-scope handles; and
- sharing a file never appears as shared inference: the consuming app proves its
  own runtime and memory allocation or reports unavailable.

Validate on signed hardware. A simulator App Group folder is not entitlement
evidence.

## Provider-shaped clients

Run the exact supported OpenAI and Anthropic wire fixtures through their custom
fetch implementations:

- only the synthetic `https://modelcommons.local` origin and exact allowlisted
  paths are accepted;
- wrong origin, path, method, version, content type, or unsupported field fails
  locally; instrument global/network fetch and prove zero fallthrough;
- retry is disabled, abort reaches native work, and a disconnected stream
  releases it;
- SSE bytes split across arbitrary boundaries still decode correctly;
- IDs, usage, finish/stop reasons, errors, tools, and structured output match the
  documented subset; and
- official SDK smoke tests use pinned versions and a real React Native runtime,
  since neither vendor currently promises general React Native support; verify
  retries are zero, SDK logging is off, and browser allowance is used only with
  the dummy credential and origin-locked local fetch.

## MoE experiment gate

Do not start Qwen3 30B-A3B on a device below its manifest minimum or without
experimental confirmation. Verify checksum/free space first. Compare `safe`,
static CPU-MoE placement, and any accelerator placement against the same token
budget. Record memory, thermal behavior, initialization, throughput, cancellation,
and process survival. `n_cpu_moe` results must be described as static placement,
never elastic caching.

A result is publishable only when repeatable, the exact model/runtime/device are
named, regressions and failed devices remain visible, and no private user data is
included. A crash, OS kill, severe sustained thermal throttling, or inability to
cancel/release is a failed configuration.

## Sign-off template

```text
Case ID:
Date / operator:
Build and signing channel:
Device / OS / memory / free disk:
Model / revision / SHA-256:
Runtime and requested/accepted profile:
Expected result:
Observed result and measurements:
Logs reviewed for sensitive content: yes/no
Evidence attachment location:
Pass / fail / blocked:
Residual risk / follow-up:
```

Support documentation may be updated only from reviewed evidence. “Works on my
device” and successful prebuild are not support claims.

# iOS shared-model verification

Recorded: **2026-09-12**. Status: **owner-verified physical-device proof of concept**.
This page records the owner's reported test and distinguishes it from source
inspection, automated tests, and acceptance cases still to be run.

## Result

On a physical **iPhone SE**, Sales & Pricing Mobile generated a real response in
airplane mode using a model downloaded only in ModelCommons. The owner deleted
the consumer app's private local model, connected using the **Files folder
picker**, and selected **Shared with ModelCommons**. The result details displayed
**`Provider: LOCAL_MODELCOMMONS`**.

Storage owner: **ModelCommons shared storage**.
Execution owner: **Sales & Pricing Mobile**.

The reported setup and result demonstrate reuse of the shared model file without
a second consumer download in that test. The consumer still owns its runtime,
context, and memory allocations. This was a Files test, not an App Group test.

## Recorded setup

| Field | Recorded value |
| --- | --- |
| Device | Physical iPhone SE; generation not recorded |
| iOS version | Not recorded |
| Hub | ModelCommons; exact version/build not recorded |
| Consumer | Sales & Pricing Mobile; exact version/build not recorded |
| Model / quantization / revision / SHA-256 | Not recorded |
| Connection | iOS Files folder picker |
| Transport | `ios-shared-files`, identified from the confirmed connection path; raw diagnostic export not attached |
| Consumer mode | Shared with ModelCommons |
| Provider shown | `LOCAL_MODELCOMMONS` |
| Starting state | Owner reports deleting the consumer's private local model |
| Provisioning | Model downloaded only in ModelCommons |
| Connectivity | Airplane mode, reported offline by the owner; separate radio states not recorded |
| Outcome | Real response generated successfully |
| Test date/time and source/build identity | Exact run timestamp and commit identities not recorded; report preserved on 2026-09-12 |

No model identity or SE generation is inferred from the timings or the catalog.
Repository versions alone do not establish the identity of the installed binaries.

## Observed timings

The owner supplied these values from one successful turn:

| Displayed metric | Time |
| --- | ---: |
| First text | 1,547 ms |
| Inference | 1,774 ms |
| Whole turn | 1,840 ms |

These are observations from one run, not a benchmark or a speed guarantee.
Cold/warm state, token counts, model identity, and repeat-run variation were not
recorded. The metrics have different boundaries and must not be added together.

## Test sequence reported by the owner

1. Delete the local model in Sales & Pricing Mobile.
2. Download the model in ModelCommons only.
3. Connect Sales & Pricing Mobile to the shared store through the Files folder
   picker and select **Shared with ModelCommons**.
4. Enable airplane mode.
5. Run the synthetic test in Sales & Pricing Mobile.
6. Observe the real generated response and `LOCAL_MODELCOMMONS` provider details.

The source has no automatic fallback from this shared route to private or network
inference. A raw `fallback=false` diagnostic and before/after private-store
counters have not been attached; they are not represented here as captured fields.

## Evidence to attach

This record currently contains the owner's report and transcribed timing values.
Screenshots, a screen recording, and a sanitized diagnostic export are **not yet
attached**. Preserve the originals privately; commit only reviewed copies showing
synthetic content and no customer data, credentials, bookmarks, container paths,
or device identifiers.

Useful additions are the exact SE generation and iOS version, both app build
numbers, model/revision/checksum, screenshot of shared mode and result details,
and a same-request diagnostic export showing acquisition, cleanup, and the
consumer's private-store inventory/counters before and after the turn. Missing
measurements stay unknown rather than being recorded as zero.

## Reproduce and extend

Use native builds with matching ModelCommons consumer packages. See
[getting started](../getting-started.md) and the [iOS platform contract](../platforms/ios.md).

1. Use a test consumer installation without a private GGUF, or remove its model
   explicitly through the app. Inspect any legacy model locations separately.
2. Install a compatible catalog model in ModelCommons' default Documents store.
3. In the consumer's Files picker, choose the exact `ModelCommons` folder that
   contains `protocol.json` and `registry.json`; choose the installed model.
4. Enable airplane mode and explicitly turn Wi-Fi off. Generate a synthetic
   prompt. Save the result and sanitized diagnostics through the app's controls.
5. Record the build/device/model identities, shared acquisition and transport,
   successful completion, cleanup, private artifact inventory, and download/import
   counters. Counters cover SDK entry points, not OS-wide I/O.
6. Repeat after restarting the consumer and closing the Hub. Test cancellation,
   background/foreground, stale or revoked access, and reconnection separately.

The full [implementation handoff](ios-implementation-handoff.md) preserves the
original package-refresh instructions and extended acceptance cases.

## Limits of this milestone

App Groups, unrelated-team signing, other devices, restart/bookmark persistence,
Hub-closed operation, cancellation, memory pressure, revocation, and destructive
file-mutation cases are not established by this one successful turn. Android
Binder inference has a [separate verification gate](android-binder-inference-owner-run.md).

A matching hash proves equal bytes, not a physical-copy count. The reported
no-second-download result rests on the owner's clean consumer setup, explicit
shared route, and offline completion; no filesystem forensic or RAM-deduplication
claim is made. This evidence supports a pre-alpha proof of concept, not production
readiness or a completed privacy/security assessment.

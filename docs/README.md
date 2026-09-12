# ModelCommons documentation

Current status: **2026-09-12 — pre-alpha / developer preview**.

Start with the [project overview](../README.md), [getting-started guide](getting-started.md),
and [owner-verified iOS Files test](verification/ios-shared-models.md).

## Current status

| Area | Status and evidence boundary |
| --- | --- |
| iOS Files shared-model generation | Owner-verified on a physical iPhone SE in airplane mode with Sales & Pricing Mobile; exact build/model metadata and attachments pending |
| Local app-owned text inference | Reported working by the owner; the shared flow records storage and execution ownership separately |
| iOS App Group sharing | Implemented; separate provisioning and device test pending |
| Unrelated-team iOS sharing | Design path; separately signed client verification pending |
| Android Binder inference | API 2 and Hub-only CPU host implemented; native library compiled/linked locally; two-app device acceptance pending |
| Canonical protocol and client | Implemented; protocol 0.1.0, validation, selection, lifecycle, errors and transport contracts |
| Model store and embedded composition | Reusable packages implemented; trusted catalog, integrity, leases, private and shared-reader paths |
| llama.rn adapter | Exact 0.12.9; local text path used in the iOS milestone; broad model/backend/lifecycle coverage pending |
| Device/runtime profiles | Implemented heuristics; no performance or device certification |
| Provider-shaped fetch | Contract-tested subsets; official SDK/device acceptance pending; current llama.rn stream lacks the early usage required for Anthropic streaming |
| Package distribution | Local pack script emits nine consumer archives with JS/declarations and provenance; public npm release pending |
| Tools, structured output, embeddings, vision | Protocol/adapter declarations are not Hub feature support; current shared demo is text only |
| Elastic MoE expert cache | Research direction, not implemented |

**Implemented** means code exists. **Compiled** means a build check passed.
**Owner-verified** means a specific physical test was reported by the owner;
its record states what was and was not captured. None of these labels implies
all-platform production support.

## Guides

- [Getting started](getting-started.md)
- [Roadmap](ROADMAP.md)
- [Architecture](architecture/overview.md)
- [Protocol and versioning](protocol/versioning.md)
- [Provider compatibility](providers/compatibility.md)
- [iOS sharing contract](platforms/ios.md)
- [Android service](platforms/android.md)
- [Model store](models/store.md)
- [Memory and Elastic MoE](models/memory-and-moe.md)
- [Sales & Pricing integration](integrations/sales-and-pricing.md)
- [Partidito integration proposal](integrations/partidito.md)
- [Threat model](security/threat-model.md)
- [Physical-device test matrix](verification/physical-devices.md)
- [Public-preview preparation record](verification/public-preview-readiness.md)

## Historical material

The [iOS implementation handoff](verification/ios-implementation-handoff.md),
[dual-local checkpoint](DUAL-LOCAL-AI-CHECKPOINT.md), dated implementation briefs,
[migration notes](migration/tatru-medgemma.md), and
[upstream research ledger](research/upstream-2026-08-27.md) preserve earlier
reasoning. Their dates and outstanding-work statements describe those snapshots;
the status table above and current verification records take precedence.

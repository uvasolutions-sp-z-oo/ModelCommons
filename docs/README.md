# ModelCommons documentation

Documentation snapshot: **2026-08-27**.

This documentation distinguishes four statuses:

- **IMPLEMENTED** — code exists in this repository.
- **IMPLEMENTED; DEVICE VERIFICATION REQUIRED** — code exists, but native
  behavior has not been demonstrated on representative physical hardware.
- **SCAFFOLDED** — types or interfaces exist without an end-to-end implementation.
- **NOT IMPLEMENTED** — design only.

Qualifiers such as **PARTIAL**, **HEURISTIC**, **UNVERIFIED**, and
**VERIFICATION PENDING** narrow an implemented status; they are not support
claims.

## Current status

| Area | Status | Notes |
|---|---|---|
| Canonical protocol/types | IMPLEMENTED | `@modelcommons/protocol` 0.1.0, dependency-free |
| npm package artifacts | NOT IMPLEMENTED | Package exports point to TypeScript source; no compiled JS/declarations or build/prepack pipeline for ordinary npm consumers |
| Protocol runtime validation | IMPLEMENTED, PARTIAL | Core manifests/registry/config/path/basic request fields; not every nested field |
| Host catalog/model store | IMPLEMENTED, PARTIAL; DEVICE VERIFICATION REQUIRED | App service with revision-bound license gating, resume, checksum, recovery, deletion and migration; startup checks size/existence and first load performs full SHA once/process, but hashing is non-interruptible; not a standalone package |
| Provider-neutral client | IMPLEMENTED | Pure package; enforced configuration/active transport, deterministic selection, single-flight sessions, stream identity/lifecycle validation, clean unavailable state; no multi-factory broker |
| Native ModelCommons connectors | SCAFFOLDED; DEVICE VERIFICATION REQUIRED | Android IPC/security and iOS App Group/bookmark/lease code exist; Android inference broker is explicitly not ready |
| llama.rn runtime adapter | IMPLEMENTED; DEVICE VERIFICATION REQUIRED | Text, lifecycle, cancellation, capability probes and grammar/tools gates; no mmproj or device evidence |
| Hub in-process composition | IMPLEMENTED; DEVICE VERIFICATION REQUIRED | Store/profile/client/runtime/provider backend wired; provider tool/schema discovery remains conservatively disabled and physical evidence is absent |
| Device profile resolver | IMPLEMENTED, HEURISTIC; DEVICE VERIFICATION REQUIRED | Host/native collection and pure resolver exist; runtime version is attached only after adapter availability, while measurement accuracy/certification remain open |
| Runtime profiles | IMPLEMENTED, UNVERIFIED | Safe/balanced/performance/experimental-MoE recommendations; no physical evidence |
| OpenAI compatibility | IMPLEMENTED; VERIFICATION PENDING | Strict local fetch for Responses, Chat, Models and gated Embeddings; fixtures exist, official-SDK/device acceptance remains |
| Anthropic compatibility | IMPLEMENTED; VERIFICATION PENDING | Strict local Messages fetch; fixtures exist, official-SDK/device acceptance remains |
| Android Binder | SCAFFOLDED; DEVICE VERIFICATION REQUIRED | Real bounded/authorized AIDL and client bridge; ordered start/failure callback reports `RUNTIME_NOT_READY` / `RUNTIME_UNAVAILABLE`, but centralized inference is not implemented |
| iOS App Group/shared-file | IMPLEMENTED, PARTIAL; DEVICE VERIFICATION REQUIRED | Native connector/leases and sanitized canonical JS errors exist; file coordination, signed entitlement/bookmark lifecycle, and device evidence remain |
| Elastic MoE expert cache | NOT IMPLEMENTED | Research direction only |
| MedGemma reference | SCAFFOLDED | Isolated metadata/safety example; no weights |

The host store, pure client, profile resolver, text runtime adapter, and Hub
in-process composition now exist, but that does not make Android cross-app
inference, native device support, or npm-ready package artifacts complete.

## Guide

- [Architecture overview](architecture/overview.md)
- [Protocol and versioning](protocol/versioning.md)
- [Provider compatibility matrix](providers/compatibility.md)
- [Android service architecture](platforms/android.md)
- [iOS sharing architecture](platforms/ios.md)
- [Threat model](security/threat-model.md)
- [Model store](models/store.md)
- [Memory and Elastic MoE](models/memory-and-moe.md)
- [Sales & Pricing integration](integrations/sales-and-pricing.md)
- [Partidito integration](integrations/partidito.md)
- [TatruMedGemma migration](migration/tatru-medgemma.md)
- [Physical-device verification](verification/physical-devices.md)
- [Upstream research ledger](research/upstream-2026-08-27.md)

## Status-writing rule

Documentation and UI must not convert “schema supports,” “upstream supports,” or
“compiled” into “ModelCommons supports.” Provider compatibility requires fixture
and official-SDK acceptance tests. Native support requires physical-device
evidence. Model capability requires both a compatible runtime and the selected
model/artifacts.

# Memory profiles and the Elastic-MoE experiment

Status as of 2026-08-27: the protocol models device/runtime profiles,
`@modelcommons/device-profile` implements deterministic heuristics, the host
catalog includes an explicitly experimental Qwen3 MoE candidate, and
`@modelcommons/runtime-llama-rn` implements a text runtime adapter. There is no
benchmark collector, adaptive controller, expert-residency controller, or
FreeToken port in this repository yet, and the runtime adapter has no physical
device evidence.

## Three different resources

Mobile inference planning must keep these resources separate:

1. **Storage** holds the GGUF and metadata. Sharing storage avoids duplicate disk
   bytes only.
2. **File-backed mappings and DRAM** hold model pages, runtime buffers, and the KV
   cache. `mmap` can reduce copies and allow paging; it does not make resident
   pages free or create more physical memory.
3. **Accelerator memory/resources** hold backend-selected tensors and buffers.
   Availability and accepted offload settings must be reported by the runtime,
   not inferred from a GPU/NPU marketing name.

Peak memory includes more than the model file: mappings/resident pages, KV cache,
compute/scratch buffers, graph allocations, image projection where applicable,
prompt/output objects, and OS/application headroom. Context length, batch size,
KV data type, and concurrent sessions can dominate the margin.

## Current profiles

`createRuntimeProfiles()` currently emits four recommendation objects:

| Profile | Current intent | Important caveat |
|---|---|---|
| `safe` | CPU-first, small context/batches, mmap, no extra buffers | Slow can still be safer than an unverified accelerator path. |
| `balanced` | Moderate context/batches and GPU-layer suggestion when a GPU is reported | A suggestion is not proof the native runtime accepted it. |
| `performance` | Larger context/batches and maximum GPU-layer suggestion | Requires device-specific evidence; may increase heat and termination risk. |
| `experimental-moe` | Conservative context with static CPU placement for MoE layers | The current name is aspirational: it is **not** elastic expert caching. |

The resolver considers physical/available memory, disk, manifest estimates,
context, model experimental state, and previous memory failures. Unknown
available memory produces a warning; it is not treated as free memory. A prior
OOM downgrades an implicit choice to `safe`. Current heuristics mark MoE models
below 24 GiB physical memory as not recommended and require confirmation for an
experimental profile.

The Hub persists at most 20 sanitized runtime-failure records and attaches them
to each refreshed device profile. However, it passes the user's explicit profile
to the resolver, so it deliberately does not take the resolver's implicit
auto-safe branch. The UI recommends `safe` after a failure and the user selects
it; automatic retry/profile switching remains Stage 1 and is not implemented.

These are guardrails, not device certification. The host must compare requested
options with the runtime's actual initialization result and place that evidence
in response diagnostics/benchmarks.

## llama.rn controls that are realistic now

The root and optional runtime peer now pin exact `llama.rn` 0.12.9. Released
2026-08-04, it embeds llama.cpp b10256 and documents New Architecture support,
cancellation fixes, mmap/mlock, batching, KV types, backend devices, and
`n_cpu_moe`. The adapter maps the current profile fields, defaults to one loaded
context, serializes completions, probes the loaded chat template and accepted
accelerator, propagates cancellation to `stopCompletion()`, and releases a model
lease only after context destruction.

The adapter currently advertises text only; it does not initialize mmproj.
Tools require the loaded Jinja template's tool input/output flags. JSON object/
schema requests require a grammar guarantee; prompt-only structured output is
rejected. These are code properties, not device support claims.

`n_cpu_moe` is static MoE layer placement. It is not a per-token/per-expert LRU,
does not page experts according to routing decisions, and must not be presented
as a FreeToken-equivalent mechanism. Design only against flags exposed by the
pinned llama.rn/llama.cpp version, not options available solely on llama.cpp
`master`.

## FreeToken research boundary

[FreeToken](https://arxiv.org/abs/2608.16157) describes a host expert pool,
GPU-side LRU expert cache, double-buffered prefill, adaptive fetch-vs-CPU miss
handling, dynamic KV/VRAM management, and semantic state caching. Its current
[implementation](https://github.com/FlashML-org/FreeToken) targets Linux x86-64,
NVIDIA GPUs, CUDA 13/r580, Python/JIT kernels, and primarily safetensors. That is
useful systems research, not mobile code that ModelCommons can import or claim.

The honest experiment is staged:

### Stage 0 — implemented metadata/heuristics

- represent dense vs sparse architecture, total/active parameters, experts and
  approximate memory in manifests;
- recommend bounded profiles and force confirmation for experimental MoE;
- use mmap, conservative context/batches/KV types, and static `n_cpu_moe` only
  where the pinned runtime supports them; and
- record initialization outcome, accepted settings, throughput, cancellation,
  and coarse failure category without prompt content.

The schemas, resolver, and static runtime option mapping exist. Measurement and
adaptive policy do not.

### Stage 1 — benchmark-driven adaptation

On a physical device, probe one option at a time, retain the last known-good
profile, react to memory/thermal signals, and persist a non-sensitive failure
history. Never retry an OOM loop automatically. This stage is not implemented.

### Stage 2 — true elastic expert residency

Proceed only if the pinned native stack exposes observable expert routing,
controllable expert residency/eviction, safe synchronization with compute, and
backend-specific memory accounting. Require reproducible improvements over
static placement without unacceptable latency, energy, or correctness loss.
None of those hooks currently exist in this repository.

## Catalog experiment, not a phone-class promise

The catalog's research candidate is Qwen3 30B-A3B Q4_K_M: 30.5B total / about
3.3B active parameters, 128 experts with 8 active per token, and an
18,556,685,824-byte checksum-pinned GGUF. Its manifest requires explicit license
acceptance and experimental confirmation, estimates at least 20 GiB RAM,
recommends 24 GiB, and makes no phone-feasibility claim. It is a reproducible
experiment definition, not a supported device result.

Total model bytes still must be stored and generally mapped/addressable, routed
experts are not the only active tensors, KV/scratch memory remains, and mobile
thermal limits matter. The candidate needs results across the physical-device
matrix before it can be recommended. Until then, MedGemma 4B Q4_K_M is the
reference baseline and MoE is an opt-in research track, not a product fallback.

## Measurement protocol

For every benchmark record model/revision, device/OS, runtime version, requested
and accepted profile, cold/warm initialization time, prompt/generation tokens per
second, context/batch/ubatch/GPU and CPU-MoE layers, cancellation outcome,
thermal/memory warnings, and crash/termination evidence. Do not record prompts,
responses, filenames that reveal user data, or stable advertising identifiers.

Compare against the same prompt/token budget and restart conditions. A profile
becomes stable only after repeatable signed physical-device runs; a single
simulator, emulator, or desktop result is insufficient.

## Primary references

- [llama.rn 0.12.9 release](https://github.com/mybigday/llama.rn/releases/tag/v0.12.9)
- [llama.rn 0.12.9 configuration and runtime notes](https://github.com/mybigday/llama.rn/blob/v0.12.9/README.md)
- [llama.rn 0.12.9 exported types](https://github.com/mybigday/llama.rn/blob/v0.12.9/src/types.ts)
- [FreeToken paper](https://arxiv.org/abs/2608.16157)
- [FreeToken Apache-2.0 implementation](https://github.com/FlashML-org/FreeToken)

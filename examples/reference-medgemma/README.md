# MedGemma reference configuration

This directory keeps one medical use case at the edge of ModelCommons. It is
metadata and product-policy guidance, not core protocol behavior, a clinical
device, or a distribution of model weights.

Status as of 2026-08-27:

- the host catalog contains the same checksum-pinned MedGemma 4B IT Q4_K_M model
  and F16 multimodal projection metadata as `model-manifest.json`;
- the host store can license-gate, download, verify, and inventory those files;
- a generic Hub in-process llama.rn transport now exists, but physical-device
  evidence is still required and that adapter is text-only; and
- `system-prompt.txt` is an application policy example, not a guarantee that the
  model will follow it.

## Model and license

The source is
[`unsloth/medgemma-4b-it-GGUF`](https://huggingface.co/unsloth/medgemma-4b-it-GGUF)
at immutable revision `f98438176483313640920de5aec435f2d52bfc46`. The manifest
pins the Q4_K_M model and F16 mmproj by size and SHA-256. No weight is committed
to this repository.

MedGemma use is governed by Google's
[Health AI Developer Foundations terms and guidance](https://developers.google.com/health-ai-developer-foundations/medgemma),
not the ModelCommons MIT license. The manifest marks acceptance required, gated,
and redistribution restricted. The host must show the current terms and capture
explicit acceptance before download or load; this example is not legal advice.
The implemented acceptance record is bound to model ID/revision plus license
ID/URL. It does not snapshot the terms content, so the owner must verify that the
URL is immutable or rotate identity when terms change.

## Safety boundary

MedGemma output can be incomplete, wrong, biased, or unsafe. Do not use this
reference as a diagnosis, emergency service, autonomous clinical workflow, or
replacement for a qualified professional. Vision capability in a schema does
not certify medical image quality, modality support, or clinical performance.

The consuming application owns:

- a conspicuous limitation/consent experience and emergency guidance;
- input quality, supported modality and intended-use validation;
- human review, uncertainty display, citations/source handling, and escalation;
- tool authorization and deterministic validation; and
- privacy, retention, regulated-data, clinical evaluation, and jurisdictional
  compliance.

Do not place medical text/images in diagnostics, analytics, error details, crash
breadcrumbs, provider headers, or benchmark fixtures. “Local” does not mean data
is absent from device backups, screenshots, logs, shared directories, or another
authorized process.

## Using the metadata

`model-manifest.json` is a readable reference copy of the host catalog record;
`services/modelcommons/catalog.ts` is what the current Hub actually imports.
Keep them byte-metadata-equivalent during review. `client-config.json` requests
text+vision from the exact model with no fallback. A text-only product should
create a separate configuration requesting only `text` rather than pretending
the mmproj path was certified. The pure client now enforces those requirements,
so applying this reference configuration to the current text-only runtime must
fail with a capability error; it must not silently drop `vision`.

Before any supported claim, run the complete
[physical-device matrix](../../docs/verification/physical-devices.md), including
text and vision as separate gates, memory/thermal pressure, cancellation,
integrity failure, and deletion.

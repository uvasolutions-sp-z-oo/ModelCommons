# Third-Party Notices and Review Ledger

Source-preview ledger updated: **2026-09-12**. Model-source references below
retain their earlier review dates; this update is not a fresh upstream-model audit.

This file is a publication review aid. It is not a complete software bill of
materials, attribution file, or legal opinion. Before public release, the owner
must regenerate an SBOM from the final lockfile, inspect bundled native binaries
and generated assets, reproduce required license texts/notices, and confirm the
provenance of every donor file.

## ModelCommons source provenance

ModelCommons is being extracted from the TatruMedGemma donor application. The
repository declares the MIT License and preserves this donor copyright exactly:

> Copyright (c) 2026 asierraserna

Owner review is still required to confirm copyright authority, contribution
history, third-party snippets, generated image rights, and whether every donor
file can be distributed under the declared license. Do not treat the presence of
[LICENSE](LICENSE) as completion of that review.

## Principal software dependencies

The repository includes a committed workspace `package-lock.json`. The
2026-09-12 preparation run passed lint, typecheck and 214 tests, then built and
inspected all nine consumer archives. Their JS/declarations, MIT license file,
source provenance hashes, and native connector source/configuration were checked.
The eight non-native entry points loaded from an extracted consumer layout.
This is local package validation, not public npm distribution or native binary
license certification.

| Component | Root declaration | Declared license | Upstream |
| --- | --- | --- | --- |
| Expo | ~54.0.33 | MIT | [expo/expo](https://github.com/expo/expo) |
| React Native | 0.81.5 | MIT | [facebook/react-native](https://github.com/facebook/react-native) |
| React | 19.1.0 | MIT | [facebook/react](https://github.com/facebook/react) |
| llama.rn | 0.12.9, exact | MIT | [mybigday/llama.rn](https://github.com/mybigday/llama.rn) |
| Zustand | ^5.0.11 | MIT | [pmndrs/zustand](https://github.com/pmndrs/zustand) |
| TypeScript | ~5.9.2 | Apache-2.0 | [microsoft/TypeScript](https://github.com/microsoft/TypeScript) |

A CycloneDX 1.5 inventory generated from the committed lockfile using npm's
`sbom --package-lock-only` contains **1,007 components**, including development
dependencies. It was retained in ignored local verification output rather than
committed as a claim about shipped app binaries. `qrcode-terminal` and `requireg`
have no license entry in that generated inventory; their source/license files
need separate inspection for a final distribution. Declared transitive licenses
include MIT, ISC, Apache-2.0, BSD variants, MPL-2.0 and others; the root MIT license
does not replace those terms.

To reproduce a lockfile inventory with an npm version that supports `sbom`:

```sh
npm sbom --sbom-format=cyclonedx --package-lock-only --sbom-type=application
```

The existing `npm run sbom` command is a separate CycloneDX CLI workflow. Review
the inventory of the actual distribution and preserve its required notices.
Native engine binaries are downloaded separately during installation/builds;
this source-only inventory does not fully enumerate their embedded components.

`llama.rn` embeds patched [llama.cpp](https://github.com/ggml-org/llama.cpp)
source. The pinned package identifies build b10256 / 6c8dcaa. The Hub's optional
Android host has its own full source inventory and reproduced MIT notices,
linked below. No native dependency version was changed for public preparation.

## Model weights and model metadata

No model weights are licensed by the ModelCommons MIT License. No GGUF file,
projection file, tokenizer, model card, or generated output should be committed
without an explicit provenance and redistribution review.

The MedGemma reference points to:

- Google's [MedGemma model card](https://huggingface.co/google/medgemma-4b-it);
- Unsloth's [MedGemma GGUF conversion](https://huggingface.co/unsloth/medgemma-4b-it-GGUF).

Those pages identify the **Health AI Developer Foundations terms** as the model
license. Users must review and accept the applicable terms themselves. The
reference does not assert redistribution rights, clinical suitability, or
equivalence between a conversion and the original publisher artifact.

The bundled starter metadata also points to separately downloaded Apache-2.0
weights; none are included in this repository:

- Hugging Face's original [SmolLM2 135M Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct)
  and [SmolLM2 360M Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct)
  models, distributed as GGUF conversions by
  [Unsloth](https://huggingface.co/unsloth/SmolLM2-135M-Instruct-GGUF) and
  [Unsloth](https://huggingface.co/unsloth/SmolLM2-360M-Instruct-GGUF),
  respectively; and
- Qwen's official [Qwen2.5 0.5B Instruct GGUF](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF)
  distribution.

Catalog inclusion is not an endorsement, quality claim, or representation that
these artifacts are suitable for a particular device or use. The pinned
manifest, upstream source, and model license remain authoritative for each
download.

Model catalogs must record source repository, exact revision, license URL,
gating, acceptance requirement, and integrity digest where available. A source
code license never overrides model terms.

## Provider compatibility names

OpenAI, ChatGPT, GPT, Anthropic, Claude, Google, Gemma, MedGemma, Hugging Face,
and other names may be trademarks of their respective owners. They are used only
to identify independently implemented API shapes, upstream projects, or model
sources.

ModelCommons is independent and is not affiliated with or endorsed by those
organizations. “OpenAI-compatible” and “Anthropic-compatible” do not mean that a
local model is, behaves like, or is marketed as a proprietary provider model.

## Research projects

The Elastic MoE design discussion cites
[FreeToken](https://github.com/FlashML-org/FreeToken), licensed Apache-2.0, and
its [research paper](https://arxiv.org/abs/2608.16157). ModelCommons does not
copy, bundle, or claim to implement FreeToken. Any future reuse must preserve
the upstream license and notices.

## Release checklist

Before publication:

1. Confirm donor provenance and the exact MIT copyright line with the owner.
2. Replace or document generated/template assets.
3. Review updates to the committed lock and regenerate the distribution
   inventory without publishing secrets or local paths.
4. Collect license texts and notices for shipped JavaScript and native code.
5. Inspect `llama.rn` release artifacts and the embedded `llama.cpp` revision.
6. Verify every model catalog entry against the exact upstream revision.
7. Confirm that no model weights or gated artifacts are present.
8. Review trademarks and compatibility wording.
9. Before public npm publishing, repeat the local pack/consumer checks and
   review versioning and export conditions; do not publish source manifests directly.
## Optional Android inference host

`@modelcommons/inference-host` compiles a separate CPU/JNI library from the exact
`llama.rn@0.12.9` npm source archive, including its llama.cpp/ggml patches. The
archive and complete source file hashes are recorded in
[`source-pin.json`](modules/model-commons-inference-host/source-pin.json); the
two MIT source notices are reproduced in
[`NOTICE`](modules/model-commons-inference-host/NOTICE). This host is included
only in the Hub, and is distinct from the existing embedded llama.rn binary.
The complete arm64-v8a CPU library compiled and linked on 2026-09-12 with NDK
27.0.12077973. Distribution inspection and signed two-app device verification
remain separate from that compile result.

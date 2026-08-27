# Third-Party Notices and Review Ledger

Last reviewed: **2026-08-27**.

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

All first-party workspace manifests currently declare version 0.1.0 and MIT:
the protocol has no dependencies; the client and device-profile packages depend
only on the protocol; provider adapters peer on the protocol; the runtime
depends on the protocol and peers optionally on exact llama.rn 0.12.9 plus the
React Native 0.81 line; and the native Expo module peers on Expo/React Native and
depends on the protocol plus Expo config plugins. These declarations still need
to be reconciled with the generated lock/publish artifacts described below.

The root manifest currently declares the following direct foundations. These
versions are declarations, not a verified installed tree: the donor lockfile was
removed because it described the old application and could not truthfully lock
the new workspace graph.

| Component | Version in manifest | Declared license | Upstream |
|---|---:|---|---|
| Expo | ~54.0.33 | MIT | [expo/expo](https://github.com/expo/expo) |
| React Native | 0.81.5 | MIT | [facebook/react-native](https://github.com/facebook/react-native) |
| React | 19.1.0 | MIT | [facebook/react](https://github.com/facebook/react) |
| llama.rn | 0.12.9 (exact) | MIT | [mybigday/llama.rn](https://github.com/mybigday/llama.rn) |
| Zustand | ^5.0.11 | MIT | [pmndrs/zustand](https://github.com/pmndrs/zustand) |
| TypeScript | ~5.9.2 | Apache-2.0 | [microsoft/TypeScript](https://github.com/microsoft/TypeScript) |

The missing lockfile is a publication/reproducibility blocker. A 2026-08-27
lock-only attempt could not resolve through the local TLS-certificate/offline-
cache environment; that is not a dependency audit. Run `npm install` in a
properly configured environment and commit the generated lock only after checking
that the workspace graph, installed native artifacts, embedded llama.cpp build,
notices, and runtime adapter all agree.

`llama.rn` packages native binaries and embeds/synchronizes
[llama.cpp](https://github.com/ggml-org/llama.cpp), which declares MIT. Native
release artifacts and their included notices must be inspected for the exact
version ultimately distributed. The runtime adapter targets llama.rn 0.12.9 and
its embedded llama.cpp b10256.

No transitive dependency ledger is claimed until the new lockfile and SBOM are
generated. Their licenses and native payloads require final-distribution review
and, where applicable, attribution or source-availability compliance.

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
3. Generate/review the workspace lock, then run `npm run sbom` and archive the
   result without publishing secrets or local paths.
4. Collect license texts and notices for shipped JavaScript and native code.
5. Inspect `llama.rn` release artifacts and the embedded `llama.cpp` revision.
6. Verify every model catalog entry against the exact upstream revision.
7. Confirm that no model weights or gated artifacts are present.
8. Review trademarks and compatibility wording.
9. Build and inspect package tarballs; current manifests expose TypeScript
   source and are not ready for ordinary npm/Node consumers.

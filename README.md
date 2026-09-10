# ModelCommons

**Download once. Run locally. Use everywhere.**

ModelCommons is an independent open-source project exploring an open protocol,
model hub, runtime abstraction, and compatibility layer for sharing on-device AI
models across applications.

Applications express intent—such as “text generation with tool calling”—and
ModelCommons resolves the installed model, runtime, transport, and conservative
device profile. The design keeps provider-shaped APIs separate from transport:
OpenAI-compatible and Anthropic-compatible requests translate into a neutral
ModelCommons request, which can then travel in-process, through Android Binder,
or through an iOS shared-file connector.

ModelCommons is not affiliated with, endorsed by, or sponsored by OpenAI,
Anthropic, Google, Meta, Hugging Face, or any model publisher. Compatibility
describes supported request and response shapes; it does not imply model
equivalence, vendor identity, or affiliation.

## Status

This repository is an early prototype being extracted from the TatruMedGemma
donor application. It is **not a public v0.1 release**.

Implemented in the current source tree:

- a dependency-free `@modelcommons/protocol` package at protocol version
  `0.1.0`;
- canonical messages, tools, structured-output declarations, responses, usage,
  and stream events;
- stable ModelCommons error codes;
- versioned model manifest, registry, client configuration, device profile,
  runtime profile, and benchmark types;
- runtime validation for manifests, registries, client configurations, paths,
  HTTPS artifact URLs, and basic canonical request fields;
- a pure `@modelcommons/client` with configuration, capability/model selection,
  exact aliases, enforced format/runtime/context and transport-access policy,
  request defaults, in-process transport abstraction, sessions,
  cancellation/release, and clean unavailable behavior without a transport;
- a pure `@modelcommons/device-profile` heuristic profile resolver;
- strict offline OpenAI-shaped and Anthropic Messages-shaped fetch adapters with
  wire fixtures, pending pinned official-SDK and device acceptance;
- a host-side generic catalog/model store with license gating, resumable
  downloads, size/SHA-256 checks, recovery, deletion, and legacy migration;
- an exact `llama.rn` 0.12.9 dependency and generic text runtime adapter with
  lifecycle/cancellation and loaded-template capability probes;
- Hub-side in-process composition from the verified store through profile
  resolution, client sessions, llama.rn, and provider-shaped backends; and
- optional Android Binder and iOS shared-storage native connector code, with the
  Android broker advertising `RUNTIME_NOT_READY` and generation failing with
  canonical `RUNTIME_UNAVAILABLE` after an ordered `response.started`; the
  centralized runtime broker remains unimplemented.

Not yet verified as an end-to-end ModelCommons system:

- npm package distribution: workspace package manifests currently export
  TypeScript source (`./src/index.ts`) and have no compiled JS/declaration output
  or package build/prepack pipeline, so ordinary Node/npm consumers are not yet
  supported;
- physical-device support for the llama.rn adapter or native connectors;
- certified official OpenAI/Anthropic SDK compatibility on React Native;
- provider features outside the documented local subsets;
- centralized Android inference over Binder (the secured contract exists; the
  service runtime broker does not);
- verified iOS App Group or security-scoped shared-file access;
- tool/structured-output requests through the current Hub (its backend exposes
  neither yet), embeddings (no catalog runtime implements them), or vision (the
  llama.rn adapter does not initialize mmproj);
- Elastic MoE expert caching;
- any native behavior on a physical device.

See [documentation status](docs/README.md) and the
[provider compatibility matrix](docs/providers/compatibility.md) before relying
on a feature.

## Client API

The pure client API exists. It needs an application-supplied transport; connecting
without one intentionally reports unavailable and never falls back to a network.
The Hub registers its in-process transport during initialization; other
applications must register or pass their own.

```ts
import { ModelCommons } from '@modelcommons/client';
import { ModelCommonsError } from '@modelcommons/protocol';

const ai = await ModelCommons.connect({ transport });
const session = await ai.createSession({ capabilities: ['text'] });

try {
  for await (const event of session.stream({
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'Summarize this locally.' }] },
    ],
  })) {
    if (event.type === 'text.delta') onText(event.delta);
    else if (event.type === 'response.failed') {
      throw new ModelCommonsError(event.error.code, event.error.message, {
        retryable: event.error.retryable,
        details: event.error.details,
      });
    } else if (
      event.type === 'response.completed'
      && (event.response.stopReason === 'cancelled' || event.response.stopReason === 'error')
    ) {
      throw new ModelCommonsError(
        event.response.stopReason === 'cancelled' ? 'USER_CANCELLED' : 'RUNTIME_INITIALIZATION_FAILED',
        `Local generation ended with ${event.response.stopReason}.`
      );
    }
  }
} finally {
  await session.release();
}
```

Provider compatibility is intended to use an injected `fetch`, never a hidden
network fallback:

```ts
import { createOpenAIProviderFetch } from '@modelcommons/provider-openai';

const modelCommonsFetch = createOpenAIProviderFetch({ backend });
const openai = new OpenAI({
  apiKey: 'modelcommons-local',
  baseURL: 'https://modelcommons.local/v1',
  fetch: modelCommonsFetch,
  maxRetries: 0,
  dangerouslyAllowBrowser: true,
  logLevel: 'off',
});
```

The synthetic origin is a routing marker. A ModelCommons fetch implementation
must intercept it and must not resolve DNS or delegate unmatched requests to the
network. `dangerouslyAllowBrowser` is acceptable here only because the credential
is a dummy, the origin is synthetic, and the injected fetch is fail-closed; never
copy that setting to a real provider credential or network client. The official
SDK path remains unsupported on React Native pending explicit device evidence.

## Architecture

```text
MedGemma reference app        Existing application
          |                            |
          +---------- intent ----------+
                       |
               ModelCommons client
                       |
          canonical request / events
             /         |          \
      OpenAI shape  native API  Anthropic shape
                       |
          in-process / Binder / shared-file
                       |
                  runtime adapter
                       |
                    llama.rn
```

MedGemma may depend on ModelCommons. ModelCommons core must never depend on
MedGemma, medical prompts, medical guardrails, or Tatru branding.

## Platform reality

- **Android:** the long-term design can share both storage and execution through
  a user-authorized, UID-validated bound service. The current repository does
  not yet prove centralized inference.
- **iOS, same developer:** App Groups can share immutable artifacts between apps
  signed by the same developer team.
- **iOS, unrelated developers:** a user-selected directory and persistent
  security-scoped bookmark can share the model file, but each client app still
  needs its own optional runtime and memory context. iOS does not provide the
  Android-style third-party inference daemon assumed by this design.
- **Web:** protocol/provider packages should remain importable; local native
  inference must report unavailable rather than crash.

## Privacy and safety principles

- No hidden cloud fallback.
- No prompt, response, chat, customer object, medical data, or tool payload in
  diagnostics.
- No automatic execution of model-generated tools or code.
- Hub model output is inert selectable text; it does not render Markdown, open
  links, or fetch model-supplied remote images.
- Model artifacts use stable IDs and relative paths, with HTTPS downloads and
  SHA-256 verification when a digest is declared.
- Applications, not the Hub, execute tools under application-controlled policy.
- The user controls installed models, licenses, authorized clients, storage, and
  deletion.

The Hub also provides an explicit **Report output** action on every completed,
persisted assistant response. It previews and sends only that selected response,
a required safety category, an optional note, and model/app/runtime metadata to
the configured operator-controlled receiver after final confirmation. It never
sends the prompt, surrounding conversation, chat/session identity, diagnostics,
or device identity, and never queues a failed report. See [PRIVACY.md](PRIVACY.md).

`MODELCOMMONS_REPORT_URL` is optional public build configuration, not a
credential. When configured, Expo validates it and exposes it as
`extra.modelCommons.reportUrl`; HTTPS is required except for `localhost`,
`127.0.0.1`, and Android-emulator `10.0.2.2` loopback development receivers.
Operators can provide their own receiver through an EAS environment or other
build environment, for example:

```text
MODELCOMMONS_REPORT_URL=https://reports.example.org/modelcommons
```

The official deployment keeps its receiver URL in the EAS `production`
environment rather than this repository. An operator can set and verify its own
public value with EAS, for example:

```sh
eas env:set --name MODELCOMMONS_REPORT_URL --value "https://reports.example.org/modelcommons" --environment production --visibility plaintext
eas env:list --environment production
```

When the variable is absent or blank, Expo config still resolves, `reportUrl` is
omitted, and the report form neutrally explains that diagnostic reporting is not
configured. Production and community builds remain fully functional without a
receiver; model storage, verification, inference, and platform sharing are
unaffected. There is no fallback reporting endpoint. A configured malformed or
disallowed URL still fails Expo configuration.

On first run, and whenever the acknowledgement-policy version changes, the Hub
gates access with an adult-use notice. Confirmation stores only a boolean, the
policy version, and acknowledgement time. It is a disclosure/access gate, not
proof of age, and does not collect a date of birth or identity.

Hub chats are now memory-only, legacy remote-provider settings are removed, and
diagnostics use a metadata allowlist. Persisted settings, authorization,
license, and bookmark records still need explicit retention/deletion policy and
signed-device review; see [PRIVACY.md](PRIVACY.md).

## Models and licenses

ModelCommons software and model weights are licensed separately. Installing
ModelCommons does not grant rights to download, use, modify, or redistribute any
model. Each manifest records the model source and license metadata, and the user
must satisfy any gating or acceptance requirement.

MedGemma is retained only as a reference configuration. Its use is governed by
the Health AI Developer Foundations terms, and its outputs require appropriate
validation for the intended use. No model weights are committed here.

### Small test models

The built-in catalog intentionally includes checksum-pinned, small GGUF text
models so a contributor can exercise the real local path without first
downloading a multi-gigabyte artifact. They are ordinary ModelCommons entries:
the weights are downloaded separately, verified, and published through the
same immutable store/registry/runtime path as every other model.

The starter ladder is SmolLM2 135M (ultra-tiny infrastructure smoke test),
SmolLM2 360M (recommended first local-chat test), and Qwen2.5 0.5B (small
practical baseline). Catalog inclusion is not an endorsement, performance
claim, or quality guarantee. Model weights remain outside the ModelCommons MIT
license and each entry records its own upstream source and license.

## Repository guide

- [`packages/protocol`](packages/protocol): implemented dependency-free protocol
  types and validators.
- [`packages/client`](packages/client): provider-neutral client, configuration,
  selection, sessions, and in-process transport contract.
- [`packages/device-profile`](packages/device-profile): pure profile generation
  and compatibility heuristics; recommendations, not certification.
- [`packages/runtime-llama-rn`](packages/runtime-llama-rn): optional text runtime
  adapter pinned to llama.rn 0.12.9, pending device verification.
- [`modules/model-commons-native`](modules/model-commons-native): optional Android
  IPC and iOS shared-storage connector; scaffolded/unverified as documented.
- [`packages/provider-openai`](packages/provider-openai) and
  [`packages/provider-anthropic`](packages/provider-anthropic): strict
  provider-shaped local fetch adapters, pending acceptance verification.
- [`services/modelcommons`](services/modelcommons): host catalog/store and legacy
  migration pending physical-device verification and package extraction.
- [`examples/reference-medgemma`](examples/reference-medgemma): isolated
  MedGemma metadata and safety context; not core architecture.
- [`examples/reference-client`](examples/reference-client): native, OpenAI-shaped,
  and Anthropic-shaped examples, each labeled with its current execution status.
- [`docs`](docs): architecture, compatibility, platform security, model store,
  memory, migration, integrations, research, and verification.
- [`.env.example`](.env.example): optional `MODELCOMMONS_APP_GROUP` and optional
  operator-controlled `MODELCOMMONS_REPORT_URL` build-time configuration; no
  entitlement identifier, credential, deployment receiver, or report token is
  hardcoded.
- `app`, `components`, and `store`: generic Hub UI/state rebuilt from the donor
  shell; chat content is memory-only. MedGemma remains confined to catalog,
  migration, tests, and the reference example.

## Development

Prerequisites are Node.js 20.19.x or newer within the Expo SDK 54 supported Node
20 line, npm, and platform tooling for native development.

```sh
npm install
npm run lint
npm run typecheck
npm test
```

This refactor snapshot intentionally omits the obsolete donor lockfile. The first
successful `npm install` must generate a workspace-aware `package-lock.json`;
review and commit it, then use `npm ci` for reproducible checks. A local
2026-08-27 lock-only attempt was blocked by the TLS-certificate/offline-cache
environment, so dependency installation and the SBOM remain publication gates.

Do not interpret clean lint/typecheck/unit results as native verification. See
[physical-device verification](docs/verification/physical-devices.md) for the
required Android and iOS evidence.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md),
[PRIVACY.md](PRIVACY.md), and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before
contributing. Please report vulnerabilities privately through the repository's
GitHub Security Advisory workflow.

## License and provenance review

The repository declares the MIT License; see [LICENSE](LICENSE). The donor
copyright is preserved exactly as `Copyright (c) 2026 asierraserna`.

Publication still requires owner review of donor-code provenance, copyright
authority, generated assets, dependency notices, and model references. The
current [third-party notices](THIRD-PARTY-NOTICES.md) are a review aid, not a
complete legal or SBOM audit.

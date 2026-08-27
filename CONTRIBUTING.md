# Contributing to ModelCommons

ModelCommons is an early protocol and reference implementation. Contributions
should make the boundary between protocol, provider shape, transport, storage,
and runtime clearer—not encode a single application or model into core.

By contributing, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before opening a change

1. Search existing issues and security advisories.
2. For protocol, storage, provider-compatibility, or native IPC changes, open a
   design issue before substantial implementation.
3. Report suspected vulnerabilities privately as described in
   [SECURITY.md](SECURITY.md); do not open a public issue with exploit details.
4. Confirm that code, fixtures, images, and model metadata are yours to
   contribute under compatible terms.

Do not commit model weights, access tokens, production prompts, conversations,
customer data, medical data, device identifiers, signing material, or captured
tool payloads.

## Architecture rules

- MedGemma/reference applications may depend on ModelCommons packages.
  ModelCommons packages must not import MedGemma or medical application code.
- `@modelcommons/protocol` remains dependency-free and free of React Native,
  provider SDK, and runtime dependencies.
- `@modelcommons/client` must not require `llama.rn`; native runtimes are
  optional adapters.
- Provider adapters translate to and from canonical ModelCommons types. They do
  not translate directly into one another.
- Transport selection must never cause implicit network fallback.
- Tools are declarative. Tool execution remains explicit and application-owned.
- Unsupported fields must produce stable errors; never silently discard tools,
  modalities, schemas, reasoning controls, or sampling settings.
- Protocol and storage paths are relative to a validated ModelCommons root.
- Native features are not “verified” until exercised on representative physical
  devices.

## Local checks

This refactor snapshot intentionally has no reviewed workspace lock. Generate it
once in a correctly configured environment:

```sh
npm install
npm run lint
npm run typecheck
npm test
```

Review and commit the generated `package-lock.json` before publication. After a
reviewed lock exists, contributors should use `npm ci` rather than silently
changing resolution. A local 2026-08-27 lock-only attempt failed at the
TLS-certificate/offline-cache boundary, so dependency checks were not completed.
See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Run any additional package-specific contract check documented by the package you
change. Do not substitute Expo Go for a development build when testing native
modules or `llama.rn`.

For native work, record:

- OS and device model;
- app build and protocol version;
- runtime and model revision;
- resolved runtime profile;
- initialization/cancellation result;
- sanitized timing and failure category.

Never record prompt or response content. Follow the
[physical-device checklist](docs/verification/physical-devices.md).

## Protocol changes

The implemented protocol version is `0.1.0`. Follow
[protocol versioning](docs/protocol/versioning.md):

- patch changes clarify or fix behavior without adding protocol surface;
- minor changes are backward-compatible additions;
- major changes may be incompatible.

Every protocol change should include:

- type and runtime-validator changes together;
- positive and negative fixtures;
- a compatibility statement;
- provider mappings where applicable;
- privacy and security impact;
- migration behavior for persisted data.

## Pull request quality

A pull request should explain:

- the user-visible outcome;
- which layer owns the change;
- implemented versus scaffolded behavior;
- dependencies added or removed and why;
- compatibility or migration impact;
- checks run and devices used;
- model/runtime licenses affected;
- remaining risks.

Use `implemented; requires physical-device verification` when that is the most
accurate status. Do not report a native capability as working based only on
TypeScript compilation or generated native projects.

Do not publish a workspace package directly from its current manifest. Exports
still target TypeScript source and there is no build/prepack pipeline. Package
publication requires reviewed compiled JS/declarations, export conditions,
files/tarball inspection, consumer smoke tests, and the reviewed lock/SBOM.

## Provenance

This project is being extracted from TatruMedGemma donor code. The donor
copyright in [LICENSE](LICENSE) must remain intact. Before public publication,
the owner must review contributor authority, donor provenance, generated assets,
third-party notices, and model references. Contributors should call out any file
whose origin or licensing is uncertain.

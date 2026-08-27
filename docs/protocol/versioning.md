# Protocol and versioning

## Implemented identity

The current package exports:

```ts
MODELCOMMONS_PROTOCOL = 'modelcommons.protocol'
PROTOCOL_VERSION = '0.1.0'
```

Persisted objects identify their schema separately and carry
`protocolVersion`. Implemented schema identifiers are:

- `modelcommons.model-manifest`, schema version 1;
- `modelcommons.registry`, schema version 1;
- `modelcommons.client-config`, schema version 1;
- `modelcommons.device-profile`, schema version 1;
- `modelcommons.runtime-profile`, schema version 1;
- `modelcommons.benchmark`, schema version 1.

## Compatibility algorithm

`isProtocolVersionCompatible(offered, required)` currently accepts an offered
version when:

1. both strings are exactly `major.minor.patch` with numeric components;
2. the major versions are equal;
3. the offered minor version is at least the required minor version.

Patch is deliberately ignored for compatibility because patch releases may not
add protocol surface.

Although the major version is currently zero, the implementation still treats
minor versions as backward-compatible additions. Contributors must follow this
project rule rather than assuming npm's conventional pre-1.0 breakage semantics.

## Change policy

| Change | Version | Rule |
|---|---|---|
| Clarification, validator bug fix, no new field/meaning | Patch | Must not require peer changes |
| Optional field/event/error or backward-compatible capability | Minor | Older peers safely ignore or reject by documented rules |
| Removed/renamed field, changed meaning, incompatible validation | Major | Migration and negotiation required |

New union members can break exhaustive consumers even when wire-compatible.
Minor additions therefore require release notes, fixture updates, and guidance
for safe unknown-event handling.

## Canonical inference

The implemented canonical model supports:

- roles: `system`, `developer`, `user`, `assistant`;
- content blocks: text, image URI, audio URI/data, tool call, tool result;
- declared capabilities: text, vision, audio, embeddings, tools,
  structured-output;
- model selection by optional ID, required capabilities, and optional profile;
- tools and tool choice;
- text, JSON object, or JSON Schema response declarations;
- temperature, top-p, stop strings, token limit, and string metadata;
- response diagnostics that identify offline execution, resolved model, runtime,
  and profile;
- canonical streaming lifecycle and tool argument deltas.

These types describe protocol surface. They do not mean any runtime currently
implements vision, audio, embeddings, tools, or constrained output.

## Streaming invariants

A successful stream has one `response.started`, zero or more deltas and usage
updates, then exactly one `response.completed`. A failed stream ends with exactly
one `response.failed`. No events follow a terminal event. The implemented client
enforces this lifecycle, stable response/model/diagnostic identity, and one
active inference per session; missing, mismatched, unknown, or trailing events
are protocol violations.

Tool arguments may arrive as string fragments. Consumers concatenate fragments
by call ID/index and parse only after `tool_call.completed`. They never execute
partial or completed arguments automatically.

Cancellation should produce a canonical cancellation outcome and release the
runtime exactly once. Returning early from the client async iterator cancels and
closes the transport iterator. Provider adapters may express cancellation using
their own transport conventions without changing the canonical reason.

## Stable errors

The implemented codes are:

```text
HUB_NOT_FOUND
PERMISSION_REQUIRED
CLIENT_NOT_AUTHORIZED
MODEL_NOT_FOUND
MODEL_NOT_READY
MODEL_INCOMPATIBLE
RUNTIME_UNAVAILABLE
RUNTIME_INITIALIZATION_FAILED
INSUFFICIENT_MEMORY
STORAGE_UNAVAILABLE
PROTOCOL_VERSION_UNSUPPORTED
USER_CANCELLED
INTEGRITY_FAILED
LICENSE_ACCEPTANCE_REQUIRED
FEATURE_UNSUPPORTED
CAPABILITY_UNAVAILABLE
TRANSPORT_UNAVAILABLE
```

Applications parse `code`, not English messages. Provider adapters translate
codes into valid provider-shaped bodies/statuses and may expose the stable code
in `x-modelcommons-error-code`.

`details` must never contain prompt, response, chat, customer, medical, or tool
payload content.

## Runtime validation status

Implemented validators currently cover:

- top-level schemas/protocol versions;
- required manifest identity fields, capabilities, artifact paths, HTTPS URLs,
  SHA-256 metadata shape, model-card/license URLs;
- registry revision/models/aliases/license-acceptance container shape;
- client identity and requested capabilities;
- positive token limits and bounded temperature/top-p;
- traversal, absolute paths, URI schemes, malformed encoding, unsafe storage IDs,
  embedded URL credentials, and non-HTTPS artifact URLs.

Validation is intentionally incomplete today. Canonical requests now guard
nested records/arrays, known keys, content variants, object-shaped tool/JSON
schemas, media detail enums, and basic values, but they do not validate JSON
Schema dialect semantics, remote media provenance/size, or application tool
policy. Manifest/registry/client validators still do not semantically validate
every nested architecture, lifecycle, source, license, access, alias, and
timestamp relationship or reject all unknown properties. Treat parsed output as
safer—not fully trusted—until those validators are completed and tested.

## Negotiation

Every transport handshake should exchange the protocol version before model or
session operations. An incompatible peer returns
`PROTOCOL_VERSION_UNSUPPORTED` with sanitized offered/required versions. No
transport may silently downgrade semantic features.

Schema migrations operate on copies or temporary files and publish atomically.
Unknown future schema versions are rejected; they are never rewritten in place
by an older client.

## Client-configuration contract

`modelcommons.client-config` is an enforceable client policy, not descriptive
metadata. The implemented client reparses and deep-freezes it at connection and
applies these rules:

- configured required capabilities are unioned with each session intent;
- allowed artifact formats, runtime IDs, and the greater of configured/requested
  minimum context constrain resolution and are post-validated for custom
  transports;
- inference profile, context, and maximum output are defaults when the caller
  omits them;
- aliases match exact own keys only and an alias profile takes precedence over
  the general profile default;
- an unavailable preferred model falls back only when
  `selection.fallback` is `best-compatible` and the failure is a selection,
  model, capability, or runtime failure; an explicit per-call model never falls
  back; and
- once a transport reports `AVAILABLE`, the access preference declared by the
  transport, availability result, or connect options must be consistent and
  allowed by `access.transports`.

A session canonicalizes requests to the loaded model/profile and rejects a
different ID/profile or a capability outside the session contract. These are
client-side checks; a cross-process Hub must independently authenticate and
authorize the caller.

The current client classifies one active transport; `access.transports` is an
allowlist, not an ordered multi-factory broker. A custom transport receives the
format/runtime/context constraints and its returned model is checked again, but
the client cannot force the transport's internal runtime choice. Context is a
capacity/preflight requirement forwarded to session creation, not client-side
proof of the native context actually allocated.

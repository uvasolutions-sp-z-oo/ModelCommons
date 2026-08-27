# Threat model

This threat model covers the intended ModelCommons client, model store, local
runtime, provider adapters, and native sharing connectors. It does not assert
that unimplemented components are secure. Current implementation status is
tracked in [Documentation status](../README.md).

## Assets and trust boundaries

Protected assets include prompts, responses, tool inputs/results, medical or
commercial data, model artifacts, model-license acceptance, client approvals,
signing identities, provider configuration, and device diagnostics.

Trust changes at five boundaries:

1. application code to the provider-neutral client;
2. client to an in-process or cross-app transport;
3. runtime to model/store files;
4. generated output to application tools or UI; and
5. app sandbox to user-selected or App Group storage.

The model and its output are untrusted content. A downloaded GGUF is also
untrusted input even when its source is reputable.

## Threats and required controls

| Threat | Required controls | Fail-closed result |
|---|---|---|
| Unapproved Android app invokes inference | Caller UID captured per entry; all packages resolved; package + signing identity + user approval checked on every call; scoped sessions | `CLIENT_NOT_AUTHORIZED` |
| Binder confused deputy or identity loss | Authenticate before coroutine/identity clearing; never trust supplied package name, PID, or WorkSource | reject request |
| Binder resource exhaustion | request cap no greater than 64 KiB (current scaffold: 48 KiB), 8–16 KiB stream chunks, pagination, bounded sessions/queues, client-death cleanup | typed capacity/transport error |
| Path traversal, symlink escape, or malicious manifest | Relative normalized paths only; no schemes/backslashes/traversal; canonical-root confinement in native code; schema and size checks | `INTEGRITY_FAILED` |
| Truncated, replaced, or poisoned model | HTTPS source, immutable revision, temporary download, size + SHA-256 before atomic publication and again before sensitive load | never mark `READY` |
| License bypass | Acceptance is bound to model ID/revision plus license ID/URL; no download/load before acceptance; publishers use immutable terms or rotate identity when content changes | `LICENSE_ACCEPTANCE_REQUIRED` |
| iOS bookmark theft/revocation/lifetime bug | Bookmark bytes app-private; opaque IDs in JS; resolve/staleness checks; balanced reference-counted security-scope lease | permission/storage error |
| Provider adapter leaks to internet | Exact synthetic origin/path router, custom fetch only, `maxRetries: 0`, no fallthrough to global/network fetch | wrong origin throws `TypeError`; sentinel-origin misuse returns a local provider error; no network |
| Provider incompatibility interpreted as success | Reject unsupported fields; truthful structured-output/tool capability; deterministic error mapping | `FEATURE_UNSUPPORTED` |
| Prompt/tool injection causes side effects | Model never directly executes tools; application validates name, schema, authorization, confirmation, and result size | tool not executed |
| Model output triggers link/image egress | Current Hub renders output as inert selectable text, without Markdown, remote images, or active links; downstream renderers impose their own URL policy | no automatic request/navigation |
| Tampered persisted preferences/approvals | Rehydration validates bounded identities, capabilities and authorization shape, clamps numeric settings, and drops malformed failure records | invalid state discarded/defaulted |
| Sensitive logs/telemetry | Data minimization; content logging off; coarse opt-in benchmarks; local retention/deletion controls | omit data |
| Memory/thermal denial of service | Compatibility preflight, bounded context/output, conservative default profile, cancellation, release, prior-OOM downgrade | `INSUFFICIENT_MEMORY` |

## Provider adapter invariant

The URL `https://modelcommons.local` is a non-network routing sentinel. A
provider adapter may handle only an explicit allowlist of exact local paths.
Unknown methods, paths, or fields must return a local error and must never be
passed to `globalThis.fetch`. Abort signals must reach the canonical session,
and streaming adapters must stop work when their consumer disconnects.

Provider compatibility does not make a local model an OpenAI or Anthropic model.
Aliases exist only when the client explicitly configures them, and diagnostics
must still disclose the actual model, revision, runtime, and profile.

## Model-generated tool calls

Treat every generated tool name and argument as attacker-controlled:

- expose only an application-owned allowlist;
- validate arguments against the application's schema, not only model output;
- enforce authorization and business rules again at execution time;
- require a user confirmation for payments, messages, destructive changes, or
  disclosure of sensitive data;
- limit tool output before returning it to the model; and
- prevent tool results from smuggling new privileged instructions.

`prompt-only` JSON is not schema enforcement. A parsed object still requires
validation. Even grammar-constrained output says nothing about semantic safety.

## Privacy and medical/commercial use

ModelCommons is designed for local inference, not for silently becoming a data
processor. The repository currently has no analytics service. Applications must
document any logging, crash reporting, backups, shared storage, or cloud fallback
they add. Medical output is not a diagnosis, and commercial estimates are not
authoritative offers; both require domain-specific review and human control.

The current acceptance record is bound to model ID/revision plus license ID/URL,
but not a terms-content digest/version. Catalog owners must use immutable terms
or rotate an identity field when content changes; binding to immutable content is
still required before a strong audit claim.

## Security release gate

Before calling a native connector supported:

- complete the relevant platform checklist on physical devices;
- review exported components, entitlements, signing and upgrade behavior;
- fuzz or property-test validators, URL routing, path boundaries and stream
  parsers;
- prove cancel/release/client-death cleanup under load;
- scan the shipped dependency graph and archive license/provenance evidence; and
- document residual risks and an incident/revocation process.

Report suspected vulnerabilities as described in [SECURITY.md](../../SECURITY.md).

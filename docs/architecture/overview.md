# Architecture overview

## Dependency direction

TatruMedGemma is donor/reference code. It is not the architecture:

```text
MedGemma reference/demo
          |
          v
   ModelCommons client API
          |
  canonical protocol/events
     /       |        \
provider  transport  runtime
 adapters             registry
     |       |        |
 OpenAI   in-process  llama.rn
Anthropic   Binder    future engines
          shared-file
```

Core packages must not import MedGemma defaults, medical prompts, medical
guardrails, MedSigLIP behavior, Tatru branding, or application UI. A reference
application may import all generic layers and add its domain policy at the edge.

## Layers and ownership

### Protocol

`@modelcommons/protocol` owns provider-neutral data:

- protocol/version constants;
- canonical messages and extensible content blocks;
- tools, calls, and results;
- structured-output declarations and guarantee level;
- request, response, usage, stop reason, and stream events;
- stable errors;
- model manifests, registry records, aliases, and license acceptances;
- client configurations and authorized-client records;
- device/runtime profiles and sanitized benchmark records;
- runtime validators and path/HTTPS defenses.

It has no React Native, runtime, provider SDK, network, or filesystem dependency.

### Client

`@modelcommons/client` expresses intent and selects a transport. It implements
configuration, capability/model selection, sessions, canonical request
validation, cancellation/release, an in-process transport contract, and a typed
unavailable fallback instead of leaking `NativeModules` errors. Installing it
does not install `llama.rn` or any model runtime.

Each client session is single-flight. The wrapper validates non-streaming
response identity and streaming start/response IDs/model diagnostics/one terminal
event, rejects missing or trailing lifecycle events, and cancels the underlying
transport when a consumer returns early. Release is retryable if transport
cleanup fails and cannot race active inference.

At connection time the client parses and deep-freezes a snapshot of the supplied
client configuration. Its required capabilities are unioned into every session;
allowed formats/runtime IDs and the effective minimum context constrain model
resolution and are checked again after a custom transport resolves. Configuration
profile/context/output values are defaults, while an explicit request may narrow
capabilities but may not claim a different loaded model/profile. Aliases are exact
own-key mappings. A configured preferred model can fall back to deterministic
best-compatible selection only when that policy is explicit; a per-call model ID
always fails closed.

Configured access paths are also enforced. An available transport must declare
its `TransportPreference` on the transport or availability result (or the caller
must provide one at connection), and it must be in the configuration's allowlist.
Conflicting declarations fail unavailable. The built-in unavailable transport
keeps its original unavailable state, so an absent transport is not misreported
as a policy error.

This is classification/authorization of one active transport, not a preference
broker. `connect()` chooses the explicitly supplied transport, one factory, the
configured default factory, or the unavailable transport; it does not try every
entry in `access.transports` in order. Custom transports receive resolution
constraints and their resolved result is post-validated fail-closed, but the
client cannot force an actual runtime/context allocation inside a transport that
ignores the hint. In particular, configured context is enforced as model-capacity
preflight and forwarded in the session intent; native allocation remains the
host/runtime's responsibility.

### Provider adapters

Provider adapters translate between provider wire shapes and the canonical
request/events. They do not own execution and never translate OpenAI directly to
Anthropic or vice versa.

The custom-fetch path treats `https://modelcommons.local` as a synthetic origin.
It returns real `Response` objects but does not require localhost HTTP. An
optional loopback server may be added for desktop/development without becoming a
mobile prerequisite.

### Transport

Transport answers “how does this request reach execution?”

- in-process transport for the Hub or an app with an optional runtime;
- Android Binder/AIDL for cross-application Hub execution;
- iOS App Group or user-granted shared-file access for artifacts;
- future system-model transports.

Authorization belongs at the transport/native boundary. Provider dummy API keys
are not authorization.

### Runtime

A runtime adapter answers “how is a resolved model executed?” It declares
availability and capabilities, maps a runtime profile, owns context lifecycle,
streams canonical events, propagates cancellation, and releases partial
resources after failure.

`llama.rn` belongs in an optional adapter. A transport exposes the client's
typed availability states, while a runtime adapter reports its own typed
availability/reason record; neither layer may turn a missing binding or
unsupported platform into an apparent success.

### Store

The Hub owns the durable, versioned registry and immutable artifacts. Protocol
records contain relative paths only. A model becomes READY only after all
required artifacts are present and verified and the registry update is
atomically published.

## Canonical request flow

```text
application intent
  -> optional provider request parser
  -> canonical request validation
  -> client authorization
  -> alias and capability resolution
  -> device/runtime profile resolution
  -> session creation
  -> runtime execution
  -> canonical events
  -> optional provider event translation
  -> application
```

Cancellation follows the reverse ownership chain and is idempotent:

```text
AbortSignal / client cancel
  -> provider adapter
  -> transport
  -> session
  -> runtime stop
  -> context/resource release
```

## Tools and structured output

Tools use the neutral `ToolDefinition`, `ToolCall`, and `ToolResult` types. The
model may request a call; the consuming application validates policy, executes
the tool, and supplies the result. The Hub never turns arguments into arbitrary
code or grants unrestricted filesystem/network access.

Structured output records its guarantee:

- `grammar`: runtime-constrained output;
- `prompt-only`: best effort, not schema compliance.

A provider request for strict schema output must fail with
`FEATURE_UNSUPPORTED` unless the chosen runtime actually constrains decoding.

## Platform asymmetry

Android can centralize both storage and inference in the Hub. iOS App Groups can
share storage between same-team apps; unrelated iOS apps can share a user-granted
file but generally execute in their own process. This asymmetry is intentional
and must not be concealed behind capability claims.

## Trust boundaries

The major boundaries are:

- Internet/model host -> downloader and verifier;
- manifest/client config -> parser and path resolver;
- client process -> Android Hub Binder service;
- Files provider/bookmark -> iOS consuming app;
- model output -> application tool host;
- provider wire request -> compatibility adapter;
- diagnostics -> persistent store or exported report.

See the [threat model](../security/threat-model.md) for required controls.

## Current implementation boundary

Protocol, client, device profiles, model store, embedded composition, runtime and
provider adapters are reusable workspace packages. The local pack script creates
nine consumer archives with compiled JavaScript and declarations; public npm
publishing remains a separate milestone.

The owner verified the iOS Files flow on a physical iPhone SE: ModelCommons owns
the shared model storage and Sales & Pricing Mobile owns offline execution.
See the [evidence record](../verification/ios-shared-models.md) for captured facts
and missing metadata. App Groups and separately signed clients are unverified.

Android has a Binder API 2 connector and optional Hub-owned CPU host built from
pinned llama.rn source. The native library compiles and links; signed two-app
inference and security/lifecycle acceptance remain pending. Availability alone
does not prove successful model loading or generation.

The Hub is generic. MedGemma-specific material remains confined to catalog,
migration/tests and an isolated reference example. Provider-shaped adapters have
contract tests, but official mobile SDK acceptance is pending. The current
llama.rn stream also lacks the early input usage required for Anthropic streaming;
that adapter fails explicitly rather than fabricating token counts.

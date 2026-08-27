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

The protocol, pure client, device-profile resolver, llama.rn runtime adapter,
and both provider adapters are generic packages. The Expo host also has a
generic catalog/store service with integrity and migration behavior, but it is
not yet extracted as a reusable package and needs physical-device verification.

These are source-workspace packages today. Their manifests export
`./src/index.ts` directly and no package has a compiled JS/declaration output or
build/prepack pipeline. Metro/TypeScript-aware workspace consumption is the
current boundary; ordinary Node/npm package publication is not implemented.

The generic text-only llama.rn runtime adapter and Android/iOS native connector
code are present but unverified. Android Binder execution explicitly remains
`RUNTIME_NOT_READY`; iOS shares storage, not execution. The current Hub UI and
inference path are generic; MedGemma-specific material is confined to a catalog
entry, the legacy migration/tests, and the reference example. None of that is
proof that native security or physical-device behavior works.

The Hub now composes its model store, device/profile resolution, in-process
client transport, llama.rn sessions, and both provider backends. That is a real
vertical slice in code, but it has not passed static/unit/native verification in
this work and must not be called supported on a device.

# Reference clients

These examples show integration boundaries over the current workspace packages:

1. [`native.ts`](native.ts) — canonical ModelCommons client over an in-process
   llama.rn runtime;
2. [`openai.ts`](openai.ts) — OpenAI-shaped local fetch and client options;
3. [`anthropic.ts`](anthropic.ts) — Anthropic Messages-shaped local fetch and
   client options; and
4. [`dual-local.ts`](dual-local.ts) — private/shared-store composition with the
   reusable embedded backend.

They do not contain a fake model, fake output, cloud fallback, embedded API key,
or provider-name alias. Callers supply a verified model URI/lease or a real
`ModelCommonsProviderBackend` that resolves authorized local execution.

## Native/canonical example

`runNativeReference()` composes the implemented packages:

```text
@modelcommons/client -> InProcessTransport -> @modelcommons/runtime-llama-rn
```

It creates a profile from `@modelcommons/device-profile`, reports the selected
model as ready only for this process, streams text, propagates an `AbortSignal`,
and releases the session/runtime in `finally`. The application must obtain the
model URI from the verified store. On iOS it may pass a `ModelFileLease` from
`@modelcommons/native`; the runtime releases that lease only after the llama
context is destroyed. The helper also releases a pre-acquired lease when
availability/profile preflight fails before ownership reaches the runtime.
It returns text only after `response.completed` with a non-cancelled/non-error
stop reason; failed, cancelled, or missing-terminal streams reject instead of
presenting partial output as success.

The runtime adapter is text-only today. It does not initialize mmproj, so the
MedGemma manifest's vision capability is not available through this example.
Tool calls are accepted only when the loaded Jinja template reports the required
tool capabilities, and structured output only with a real grammar guarantee.

This helper deliberately creates a text-only session without applying the
separate MedGemma `client-config.json`, because that configuration requires both
text and vision and must fail against today's text-only runtime. When an
application supplies a client configuration, the client enforces its capability,
format, runtime, context, fallback, alias, defaults, and declared transport-access
policy; it is not merely advisory.

These helper functions have not independently been exercised on physical devices.
The separate [Sales & Pricing iOS Files run](../../docs/verification/ios-shared-models.md)
verifies that application's canonical shared-model integration.

## Provider-shaped examples

The OpenAI and Anthropic adapters are lightweight fetch routers. A backend owns
model discovery and canonical execution; the adapter owns strict provider-shape
validation/translation and never executes generated tools.

The direct `request*Wire()` functions are the recommended lightweight React
Native style in this unverified prototype. If an application explicitly
installs the corresponding official SDK, it can use the returned options:

```ts
import OpenAI from 'openai';
import { createOpenAIReference } from './openai';

const local = createOpenAIReference(backend);
const openai = new OpenAI(local.clientOptions);
```

```ts
import Anthropic from '@anthropic-ai/sdk';
import { createAnthropicReference } from './anthropic';

const local = createAnthropicReference(backend);
const anthropic = new Anthropic(local.clientOptions);
```

Neither official SDK is a ModelCommons dependency and neither vendor currently
supports React Native generally. Their use needs a pinned-version device smoke
test. The dummy API key only satisfies the SDK constructor; Android/iOS transport
identity remains the authorization boundary.

The returned SDK options set `maxRetries: 0`, `logLevel: 'off'`, and
`dangerouslyAllowBrowser: true`. The last setting is deliberately limited to the
dummy credential plus exact synthetic origin and fail-closed injected fetch; do
not reuse these options with a real provider key or network client.

Both adapters refuse any origin other than exact
`https://modelcommons.local`, have no delegate fetch, set client retry to zero,
and fail unknown routes/fields locally. Never patch `globalThis.fetch` or add a
catch-all network fallback.

The current llama.rn runtime supplies usage at completion. Its Anthropic streaming
composition therefore fails the early-usage contract; see the
[adapter requirements](../../packages/provider-anthropic/README.md).

## Backend requirements

A provider backend must list stable real IDs, mark not-ready models honestly,
declare only features the loaded runtime/model actually supports, propagate the
provided abort signal, preserve canonical event ordering/IDs, report usage as
required by the provider shape, and release each execution exactly once.

The OpenAI adapter implements its documented subset of Responses, Chat
Completions, Models, and capability-gated Embeddings. The Anthropic adapter
implements its documented Messages subset and requires API version `2023-06-01`.
See the [compatibility matrix](../../docs/providers/compatibility.md) for exact
unsupported fields and the remaining official-SDK/device verification gates.

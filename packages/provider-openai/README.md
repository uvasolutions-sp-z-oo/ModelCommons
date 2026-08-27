# @modelcommons/provider-openai

An offline wire adapter for OpenAI-shaped clients. It translates provider JSON and SSE into the neutral request, response, and stream types from `@modelcommons/protocol`.

The adapter recognizes only the exact origin `https://modelcommons.local`. It has no delegate fetch and never falls back to a network request.

## Integration

Implement `ModelCommonsProviderBackend`, then create one fetch function:

```ts
import { createOpenAIProviderFetch } from '@modelcommons/provider-openai';

const modelCommonsFetch = createOpenAIProviderFetch({
  backend,
  aliases: {
    'my-explicit-alias': { modelId: 'local/model-id', profile: 'balanced' },
  },
});
```

The backend owns model discovery and execution. The adapter owns provider validation, model/alias resolution, capability enforcement, wire serialization, errors, and cancellation. Tool calls are returned to the client for execution; the adapter never executes tools.

The backend must:

- return stable model IDs and only declare features it can actually provide;
- return accurate input/output usage when available;
- keep `response.started.responseId` and the terminal response ID consistent;
- emit complete UTF-8 JSON argument fragments for tool calls;
- observe the supplied `AbortSignal` and release an execution exactly once;
- provide `embed` only for a real embedding operation.

`streaming`, `jsonObject`, `jsonSchema`, `strictTools`, sampling controls, stop sequences, parallel tools, and adjustable embedding dimensions all require explicit feature flags. A generic `structured-output` capability alone does not claim JSON Schema enforcement.

For constrained output, the backend remains responsible for enforcing the complete schema during decoding. The adapter additionally verifies that a completed non-tool result is valid JSON with an object root; it does not substitute post-generation repair for constrained decoding.

## Routes

- `POST /v1/responses`
- `POST /v1/chat/completions`
- `GET /v1/models`
- `POST /v1/embeddings`, capability-gated per backend and model

Unknown routes, query parameters, request fields, nested content types, and semantic options are rejected. Exact no-ops such as `store:false`, `stream:false`, and Chat `n:1` are accepted. `store:true`, provider cloud controls, unsupported modalities, reasoning fields, and prompt-only substitutions for strict schemas are not.

OpenAI errors use the standard `{ error: { message, type, param, code } }` envelope plus `x-request-id` and `x-modelcommons-error-code`. Local diagnostics never include prompt, output, or tool payloads.

## Official SDK

The package does not depend on the official SDK. The current compatibility fixture baseline is `openai@7.5.0`:

```ts
const client = new OpenAI({
  apiKey: 'modelcommons-local',
  baseURL: 'https://modelcommons.local/v1',
  fetch: modelCommonsFetch,
  maxRetries: 0,
  dangerouslyAllowBrowser: true,
  logLevel: 'off',
});
```

`maxRetries:0` prevents accidental duplicate local inference, and `logLevel:'off'` keeps provider payloads out of SDK diagnostics. `dangerouslyAllowBrowser:true` only permits the SDK to use the injected offline fetch; it does not make browser-delivered credentials safe. Use the dummy key only with the exact pseudo-origin and this non-delegating fetch. The API key only satisfies the SDK constructor; authorization belongs at the ModelCommons transport/IPC boundary.

The official SDK does not support React Native. The recommended in-scope RN path is to call this lightweight fetch adapter directly, but that path still requires physical-device acceptance. Supply standards-compatible `Response`, `ReadableStream`, and `TextEncoder` constructors through `web` when the environment does not expose them globally. Streaming still requires a fetch/stream implementation with a readable response body; do not patch global fetch.

## Stream contract

Responses streams use named events and a monotonic `sequence_number`; they finish with `response.completed` or `response.incomplete`, not Chat's `[DONE]`. Chat streams use data-only SSE and end with `data: [DONE]`. Cancelling the response body or aborting the request aborts the canonical execution.

`test/provider.test.ts` is an executable Vitest contract test for the public adapter and adds no provider-package runtime dependency. Run it from the repository with `npx --no-install vitest run packages/provider-openai/test/provider.test.ts`. The remaining fixtures are inputs for future pinned-SDK tests. Tests must install a network trap and verify that every request remains on the pseudo-origin.

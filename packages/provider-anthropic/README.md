# @modelcommons/provider-anthropic

An offline Anthropic Messages wire adapter over the neutral protocol types from `@modelcommons/protocol`.

The adapter recognizes only `https://modelcommons.local`, exposes only `POST /v1/messages`, and has no delegate/network fallback.

## Integration

```ts
import { createAnthropicProviderFetch } from '@modelcommons/provider-anthropic';

const modelCommonsFetch = createAnthropicProviderFetch({
  backend,
  aliases: {
    'my-explicit-alias': { modelId: 'local/model-id', profile: 'balanced' },
  },
});
```

`ModelCommonsProviderBackend` owns model discovery and canonical execution. The adapter owns Messages validation, explicit alias resolution, capability checks, content/tool translation, provider errors, SSE, and cancellation. It never executes a generated tool.

The backend must:

- declare only real model/runtime features;
- return accurate input/output token usage for every completed Messages response;
- emit `usage.updated` with `inputTokens` after `response.started` and before the first streamed content event;
- keep the started and terminal response IDs consistent;
- emit JSON tool-argument deltas that are a prefix of the completed `rawArguments`;
- observe the supplied `AbortSignal` and release execution exactly once.

The early usage requirement avoids fabricating `message_start.usage.input_tokens`. A violation becomes a streamed `api_error`. The current ModelCommons llama.rn runtime only emits usage at completion, so streaming through the embedded/shared-files composition does not yet satisfy this contract. The canonical iOS demo and non-streaming Messages do not establish Anthropic streaming support.

The adapter accepts only API version `2023-06-01`. It rejects missing/unknown versions and `anthropic-beta` rather than silently accepting beta semantics.

## Supported subset

- user/assistant text messages and top-level `system` text;
- client-executed `tool_use` and `tool_result` blocks;
- custom tools with object `input_schema`;
- `auto`, `any`, `none`, and named tool choices;
- maximum tokens and explicitly supported stop/sampling controls;
- structured output through `output_config.format:{type:'json_schema',schema}` only when schema-constrained decoding is real;
- Anthropic named-event SSE, including `input_json_delta` tool arguments and streamed errors.

Images, audio, thinking blocks, citations, server tools, prompt caching, cloud service controls, deprecated `output_format`, beta headers, and unknown fields are rejected. Strict tools require an explicit constrained-decoding feature. Provider-only options preserved outside the protocol (`topK` and the parallel-tool allowance) are passed through the neutral execution options.

The backend enforces the complete schema during decoding. The adapter verifies valid JSON with an object root on completed non-tool results; it never presents post-generation repair or prompt-only JSON as strict structured output.

Errors use the standard `{type:'error',error:{type,message},request_id}` envelope, the `request-id` header, and a stable `x-modelcommons-error-code` header. Local/cloud-only usage properties are `null`; the adapter does not invent service tiers, cache usage, or inference geography.

## Official SDK

The package does not depend on the official SDK. The current fixture baseline is `@anthropic-ai/sdk@0.120.0`:

```ts
const client = new Anthropic({
  apiKey: 'modelcommons-local',
  baseURL: 'https://modelcommons.local',
  fetch: modelCommonsFetch,
  maxRetries: 0,
  dangerouslyAllowBrowser: true,
  logLevel: 'off',
});
```

`maxRetries:0` prevents duplicate local inference, and `logLevel:'off'` keeps provider payloads out of SDK diagnostics. `dangerouslyAllowBrowser:true` only permits the SDK to use the injected offline fetch; it does not make browser-delivered credentials safe. Use the dummy key only with the exact pseudo-origin and this non-delegating fetch. The API key is not the security boundary; authorization belongs to ModelCommons IPC/transport identity.

The official SDK does not support React Native. Direct use of this lightweight adapter is the recommended in-scope RN path, but it still requires physical-device acceptance. Standards-compatible `Response`, `ReadableStream`, and `TextEncoder` constructors can be passed through `web`; never patch global fetch. Streaming requires a readable response body implementation.

`test/provider.test.ts` is an executable Vitest contract test for the public adapter and adds no provider-package runtime dependency. Run it from the repository with `npx --no-install vitest run packages/provider-anthropic/test/provider.test.ts`. The remaining fixtures support future pinned-SDK tests. All such tests must trap network access and prove that a non-pseudo-origin request rejects.

# Provider compatibility

Research and implementation snapshot: **2026-08-27**.

ModelCommons is independent of OpenAI and Anthropic. “Compatible” means an
intentional subset of request/response wire shapes can map to the neutral
ModelCommons protocol. It does not imply affiliation, full API coverage, model
identity, output equivalence, or permission to use provider trademarks as local
model aliases.

## Current implementation matrix

Legend:

- **SCHEMA** — canonical protocol type exists; no runtime guarantee.
- **IMPLEMENTED** — wire parsing/serialization code exists in the adapter.
- **CAPABILITY GATED** — adapter code exists but accepts the operation only when
  its backend/model declares the required real feature.
- **VERIFICATION PENDING** — implementation has fixtures but the pinned official
  SDK and physical React Native acceptance matrix has not been completed.
- **NOT IMPLEMENTED** — no working endpoint/adapter in this repository.
- **RUNTIME DEPENDENT** — can only become supported when the selected runtime
  exposes the operation.
- **MODEL DEPENDENT** — can only become supported when model/template behavior
  has been verified.

| Feature | Canonical protocol | OpenAI Responses | Chat Completions | Anthropic Messages |
|---|---|---|---|---|
| Text messages | SCHEMA | IMPLEMENTED; VERIFICATION PENDING | IMPLEMENTED; VERIFICATION PENDING | IMPLEMENTED; VERIFICATION PENDING |
| Streaming lifecycle | SCHEMA | IMPLEMENTED; backend stream required | IMPLEMENTED; backend stream required | IMPLEMENTED; backend stream/early usage required |
| Cancellation | SCHEMA/stop reason | IMPLEMENTED through abort/body cancel | IMPLEMENTED through abort/body cancel | IMPLEMENTED through abort/body cancel |
| Usage metadata | SCHEMA, optional counts | IMPLEMENTED; backend truth required | IMPLEMENTED; backend truth required | IMPLEMENTED; input/output counts required |
| Tools/function calls | SCHEMA | IMPLEMENTED; CAPABILITY/MODEL GATED | IMPLEMENTED; CAPABILITY/MODEL GATED | IMPLEMENTED; CAPABILITY/MODEL GATED |
| Client-side tool results | SCHEMA | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED |
| JSON object mode | SCHEMA | IMPLEMENTED; CAPABILITY GATED | IMPLEMENTED; CAPABILITY GATED | N/A as direct mode |
| Strict JSON Schema | SCHEMA with guarantee | IMPLEMENTED; CAPABILITY GATED | IMPLEMENTED; CAPABILITY GATED | IMPLEMENTED; CAPABILITY GATED |
| Vision/audio | SCHEMA | REJECTED in current adapter | REJECTED in current adapter | REJECTED in current adapter |
| Model listing | Model registry schema | IMPLEMENTED at shared `/v1/models` | IMPLEMENTED at shared `/v1/models` | No equivalent route |
| Embeddings | Capability name only | IMPLEMENTED route; real backend/model required | Shared `/v1/embeddings` | No route |
| Reasoning controls | No canonical field | REJECTED | REJECTED | REJECTED |
| Server-hosted tools | Deliberately excluded | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED |
| Prompt caching/service tiers | No canonical semantics | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED |

The two adapter packages now implement the subset below. “Implemented” describes
code, not completed compatibility certification: deterministic fixtures exist,
but pinned official-SDK contract tests and React Native physical-device evidence
remain outstanding.

The Hub supplies a backend for both adapters. Its current descriptor exposes
text/streaming/sampling controls but conservatively sets tools, strict tools,
parallel tools, JSON object, and JSON Schema to false. The llama.rn adapter can
probe some of those capabilities only after loading the GGUF/template, but that
probe is not yet fed back into provider discovery. Provider-shaped tool and
structured-output requests through the Hub therefore remain unavailable rather
than being over-advertised.

## SDK research

As of the research date:

- the official OpenAI TypeScript package reports `openai@7.5.0` as latest;
- the official Anthropic TypeScript package reports
  `@anthropic-ai/sdk@0.120.0` as latest.

Both clients accept `baseURL` and an injected `fetch`:

```ts
const openai = new OpenAI({
  apiKey: 'modelcommons-local',
  baseURL: 'https://modelcommons.local/v1',
  fetch: modelCommonsFetch,
  maxRetries: 0,
  dangerouslyAllowBrowser: true,
  logLevel: 'off',
});

const anthropic = new Anthropic({
  apiKey: 'modelcommons-local',
  baseURL: 'https://modelcommons.local',
  fetch: modelCommonsFetch,
  maxRetries: 0,
  dangerouslyAllowBrowser: true,
  logLevel: 'off',
});
```

`maxRetries: 0` is required for local acceptance tests so a transient local
failure does not duplicate an inference request. The dummy API key satisfies an
SDK constructor and is not client authorization. `dangerouslyAllowBrowser: true`
permits that dummy credential in a browser-like runtime and is safe only at the
synthetic origin with the fail-closed injected fetch; it must never be copied to
a real provider key or network client. `logLevel: 'off'` prevents SDK logging,
but does not replace application/native log review.

Neither official SDK declares React Native as a supported runtime. Their stream
implementations call out limitations of React Native's default fetch body. The
official-SDK path on Expo/React Native is therefore experimental even after wire
tests pass. The small ModelCommons client is the recommended RN integration path
in this prototype, but it still requires physical-device verification; no code
may patch global fetch.

Primary sources:

- OpenAI SDK [configuration](https://github.com/openai/openai-node/blob/main/docs/configuration.md),
  [Responses guide](https://github.com/openai/openai-node/blob/main/docs/responses.md),
  and [tools guide](https://github.com/openai/openai-node/blob/main/docs/tools.md);
- OpenAI [Responses API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)
  and [Chat Completions API](https://developers.openai.com/api/reference/cli/resources/chat/subresources/completions);
- Anthropic [TypeScript SDK](https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript),
  [Messages API](https://platform.claude.com/docs/en/api/http/messages/create),
  [streaming](https://platform.claude.com/docs/en/build-with-claude/streaming),
  and [tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls).

## Custom-fetch transport contract

The fetch returned by `createOpenAIProviderFetch()` or
`createAnthropicProviderFetch()` must:

1. accept `string | URL | Request` and correctly merge `RequestInit`;
2. match the exact `https://modelcommons.local` origin;
3. route only documented method/path pairs;
4. parse `Headers`, JSON bodies, and `AbortSignal`;
5. never call DNS, global fetch, or a delegate for an unmatched route;
6. return actual `Response` objects;
7. stream UTF-8 SSE through `ReadableStream<Uint8Array>` where available;
8. propagate abort and stream cancellation to the canonical session/runtime;
9. release session resources exactly once;
10. omit prompts, responses, and tool payloads from headers/logs.

A request for a different origin is rejected with `TypeError` before provider
routing and is never delegated. A request at the sentinel origin with an
unsupported field, method, or path returns the adapter's provider-shaped local
error (normally HTTP 400 for input/feature errors).

Implemented routes are:

```text
POST /v1/responses
POST /v1/chat/completions
GET  /v1/models
POST /v1/embeddings       only with a real embedding runtime/model
POST /v1/messages
```

Useful diagnostic headers may include:

```text
x-modelcommons-offline: true
x-modelcommons-resolved-model: <stable local ID>
x-modelcommons-runtime: <runtime ID>
x-modelcommons-error-code: <stable error code>
```

## OpenAI Responses subset

The intentional subset for `POST /v1/responses` is:

- `model`;
- string input or text message items with user/assistant/system/developer roles;
- `instructions`;
- `max_output_tokens`;
- `stream`;
- function tools, tool choice, and function-call outputs;
- `text.format` for text, JSON object, or JSON Schema only when the runtime
  guarantee matches;
- temperature/top-p only when honored;
- explicit `previous_response_id` behavior or a clear unsupported error.

Responses function tools are flat (`type`, `name`, `parameters`); unlike Chat
Completions, they are not nested below `function`. Function results match
`call_id`.

Target SSE lifecycle for text is:

```text
response.created
response.in_progress
response.output_item.added
response.content_part.added
response.output_text.delta ...
response.output_text.done
response.content_part.done
response.output_item.done
response.completed
```

Tool argument streams use `response.function_call_arguments.delta` and a done
event. Responses streams do not depend on Chat Completions' `[DONE]` marker.

## OpenAI Chat Completions subset

The intentional subset for `POST /v1/chat/completions` is:

- system/developer/user/assistant messages plus tool-result messages;
- `stream` and `stream_options.include_usage`;
- `max_completion_tokens` and legacy `max_tokens`, rejecting conflicting values;
- stop, temperature, and top-p only when honored;
- function tools and indexed tool-call deltas;
- `response_format` text, JSON object, or JSON Schema subject to runtime
  guarantees;
- `n: 1` only.

Chat streaming is data-only SSE. It begins with an assistant role chunk, emits
content/tool deltas, emits a finish chunk, optionally emits a final empty-choice
usage chunk, then `data: [DONE]`.

## Models and aliases

`GET /v1/models` exposes stable installed ModelCommons model IDs. `owned_by`
should be `modelcommons`, not a provider brand. Model aliases are explicit
developer/user routing configuration. No proprietary provider-name alias is
created by default, and an alias never asserts model equivalence.

## Embeddings

`POST /v1/embeddings` stays unavailable until an installed model and runtime
provide a real embedding operation. A generation model is not automatically an
embedding model.

The current OpenAI SDK may default an omitted encoding format to base64 and
decode little-endian float32 bytes. Compatibility must either implement that
encoding correctly or reject it explicitly; returning float JSON while claiming
the default SDK path works is not acceptable.

## Anthropic Messages subset

The intentional subset for `POST /v1/messages` is:

- top-level `system` text;
- user/assistant messages with text, `tool_use`, and `tool_result` blocks;
- required `max_tokens`;
- streaming, stop sequences, temperature/top-p/top-k when honored;
- tools and tool choice;
- `output_config.format` JSON Schema only with constrained decoding;
- usage and stop-reason translation.

Anthropic does not place a system role inside `messages`. Tool JSON arrives as
`input_json_delta` fragments and must be concatenated before parsing.

Target SSE lifecycle is:

```text
message_start
content_block_start
content_block_delta ...
content_block_stop
message_delta
message_stop
```

Anthropic streams use named events and no `[DONE]` marker. Unknown future event
types should be ignored safely. Cloud-only server tools, deferred tool loading,
prompt-cache controls, service tiers, and reasoning/thinking blocks remain
unsupported unless separately specified and implemented.

## Structured-output rule

Provider envelopes differ:

- Responses: `text.format`;
- Chat Completions: `response_format`;
- Anthropic: `output_config.format`.

All map to canonical `ResponseFormat`. `strict: true` is accepted only when the
runtime uses grammar/schema-constrained decoding and supports the submitted JSON
Schema subset. Prompting for JSON is `prompt-only`, never strict. Unsupported
schemas fail before response headers or inference start.

## Error translation

Pre-stream failures return non-2xx provider-shaped JSON. Failures after a stream
begins use that provider's stream error semantics. Stable ModelCommons codes are
preserved in `x-modelcommons-error-code`; clients never parse English text.

Suggested status mapping:

| ModelCommons condition | HTTP |
|---|---:|
| malformed/unsupported field | 400 |
| unknown model | 404 |
| unavailable transport/runtime | 503 |
| unexpected runtime failure | 500 |

Abort must cancel execution and reject as cancellation; it must not become an
invented successful provider response.

## Unsupported-field policy

Adapters validate each endpoint strictly and report the exact unsupported path.
They do not silently discard tools, modalities, schemas, logprobs, reasoning,
caching, service tiers, parallel generation, or sampling fields. Exact semantic
no-ops such as `stream: false`, Chat `n: 1`, or a documented `store: false` may
be accepted only when explicitly tested.

## Acceptance threshold

The wire adapters are implemented but publication-grade compatibility remains
unverified until offline tests using deterministic canonical fixtures demonstrate:

- official OpenAI and Anthropic SDK non-streaming calls;
- exact stream event ordering and terminal behavior;
- tool-call fragmentation and tool-result continuation;
- structured-output capability-on/off behavior;
- provider-shaped error subclasses and request IDs;
- abort cancels the fake runtime exactly once;
- arbitrary byte boundaries, CRLF, and split multibyte UTF-8;
- a network spy records zero delegated requests.

React Native official-SDK smoke tests are additional, experimental physical-device
evidence; they do not replace verification of the lightweight client.

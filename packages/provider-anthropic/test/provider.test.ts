import {
  ModelCommonsError,
  type ModelCommonsErrorCode,
  type ModelCommonsRequest,
  type ModelCommonsResponse,
  type ModelCommonsStreamEvent,
  type ToolCall,
} from '@modelcommons/protocol';
import { describe, it } from 'vitest';
import {
  createAnthropicProviderFetch,
  type ModelCommonsProviderBackend,
} from '../src/index';
import {
  ANTHROPIC_FIXTURE_VERSION,
  anthropicModelFixture,
  anthropicStructuredRequestFixture,
  anthropicTextRequestFixture,
  canonicalAnthropicResponseFixture,
  canonicalAnthropicStreamFixture,
} from './fixtures';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function equal(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message}; expected ${String(expected)}, received ${String(actual)}`);
  }
}

function object(value: unknown, message: string): Record<string, unknown> {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), message);
  return value as Record<string, unknown>;
}

function array(value: unknown, message: string): unknown[] {
  assert(Array.isArray(value), message);
  return value;
}

async function rejects(action: () => Promise<unknown>, name: string): Promise<void> {
  let caught: unknown;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  assert(caught instanceof Error && caught.name === name, `expected rejection ${name}`);
}

const headers = {
  'content-type': 'application/json',
  'anthropic-version': ANTHROPIC_FIXTURE_VERSION,
  'x-api-key': 'modelcommons-local',
};

export async function runAnthropicProviderContractTests(): Promise<void> {
  let sequence = 0;
  let completeCalls = 0;
  let capturedRequest: ModelCommonsRequest | undefined;
  let nextResponse: ModelCommonsResponse = canonicalAnthropicResponseFixture;
  let streamFixture: readonly ModelCommonsStreamEvent[] = canonicalAnthropicStreamFixture;

  const backend: ModelCommonsProviderBackend = {
    listModels: () => [anthropicModelFixture],
    async complete(request) {
      completeCalls += 1;
      capturedRequest = request;
      return {
        ...nextResponse,
        modelId: request.model.id ?? nextResponse.modelId,
      };
    },
    async *stream(request) {
      capturedRequest = request;
      for (const event of streamFixture) yield event;
    },
  };

  const fetch = createAnthropicProviderFetch({
    backend,
    aliases: { fixture_alias: { modelId: anthropicModelFixture.id, profile: 'test' } },
    idFactory: (prefix) => `${prefix}_fixture_${++sequence}`,
  });

  const textResponse = await fetch('https://modelcommons.local/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...anthropicTextRequestFixture, model: 'fixture_alias' }),
  });
  assert(textResponse instanceof Response, 'Messages route returns a Response');
  equal(textResponse.status, 200, 'Messages status');
  const textBody = object(await textResponse.json(), 'Messages body');
  equal(textBody.type, 'message', 'Messages object type');
  equal(textBody.role, 'assistant', 'Messages role');
  equal(textBody.model, anthropicModelFixture.id, 'resolved response model');
  equal(object(array(textBody.content, 'Messages content')[0], 'text block').text, 'Hello!', 'Messages text');
  equal(capturedRequest?.instructions, 'Be concise.', 'system maps to canonical instructions');
  equal(capturedRequest?.model.profile, 'test', 'explicit alias profile');

  const streamResponse = await fetch('https://modelcommons.local/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...anthropicTextRequestFixture, stream: true }),
  });
  equal(streamResponse.headers.get('content-type'), 'text/event-stream; charset=utf-8', 'SSE content type');
  const textSse = await streamResponse.text();
  const startAt = textSse.indexOf('event: message_start');
  const blockAt = textSse.indexOf('event: content_block_start');
  const deltaAt = textSse.indexOf('event: content_block_delta');
  const stopAt = textSse.indexOf('event: message_stop');
  assert(startAt >= 0 && startAt < blockAt && blockAt < deltaAt && deltaAt < stopAt, 'Anthropic event order');
  assert(!textSse.includes('[DONE]'), 'Anthropic stream has no DONE marker');

  nextResponse = {
    ...canonicalAnthropicResponseFixture,
    content: [{ type: 'text', text: '{"result":"ok"}' }],
  };
  const structuredResponse = await fetch('https://modelcommons.local/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify(anthropicStructuredRequestFixture),
  });
  equal(structuredResponse.status, 200, 'structured output status');
  equal(capturedRequest?.responseFormat?.type, 'json_schema', 'output_config maps to canonical schema');

  const toolCall: ToolCall = {
    id: 'toolu_fixture',
    name: 'get_weather',
    arguments: { city: 'Warsaw' },
    rawArguments: '{"city":"Warsaw"}',
  };
  const toolResponse: ModelCommonsResponse = {
    ...canonicalAnthropicResponseFixture,
    id: 'fixture-tool-message',
    content: [{
      type: 'tool_call',
      call: toolCall,
    }],
    stopReason: 'tool_call',
    usage: { inputTokens: 4, outputTokens: 3, totalTokens: 7 },
  };
  streamFixture = [
    {
      type: 'response.started',
      responseId: toolResponse.id,
      createdAt: toolResponse.createdAt,
      modelId: toolResponse.modelId,
      diagnostics: toolResponse.diagnostics,
    },
    {
      type: 'usage.updated',
      responseId: toolResponse.id,
      usage: { inputTokens: 4, outputTokens: 0 },
    },
    {
      type: 'tool_call.started',
      responseId: toolResponse.id,
      callId: 'toolu_fixture',
      name: 'get_weather',
      index: 0,
    },
    {
      type: 'tool_call.arguments.delta',
      responseId: toolResponse.id,
      callId: 'toolu_fixture',
      delta: '{"city":',
      index: 0,
    },
    {
      type: 'tool_call.arguments.delta',
      responseId: toolResponse.id,
      callId: 'toolu_fixture',
      delta: '"Warsaw"}',
      index: 0,
    },
    {
      type: 'tool_call.completed',
      responseId: toolResponse.id,
      call: toolCall,
      index: 0,
    },
    { type: 'response.completed', response: toolResponse },
  ];
  const toolStream = await fetch('https://modelcommons.local/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: anthropicModelFixture.id,
      max_tokens: 32,
      messages: [{ role: 'user', content: 'Weather?' }],
      tools: [{
        name: 'get_weather',
        input_schema: {
          type: 'object',
          properties: { city: { type: 'string' } },
          required: ['city'],
        },
      }],
      stream: true,
    }),
  });
  const toolSse = await toolStream.text();
  assert(toolSse.includes('"type":"tool_use"'), 'tool-use block');
  assert(toolSse.includes('"type":"input_json_delta"'), 'tool JSON delta');
  assert(toolSse.includes('"stop_reason":"tool_use"'), 'tool-use stop reason');

  const unsupported = await fetch('https://modelcommons.local/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...anthropicTextRequestFixture, thinking: { type: 'enabled', budget_tokens: 1024 } }),
  });
  equal(unsupported.status, 400, 'unsupported field status');
  equal(unsupported.headers.get('x-modelcommons-error-code'), 'FEATURE_UNSUPPORTED', 'unsupported field code');
  equal(completeCalls, 2, 'unsupported request never executes the backend');

  const prototypeAlias = await fetch('https://modelcommons.local/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...anthropicTextRequestFixture, model: 'constructor' }),
  });
  equal(prototypeAlias.status, 404, 'inherited object names never resolve as aliases');
  equal(completeCalls, 2, 'prototype alias request never executes the backend');

  const errorCases: readonly [ModelCommonsErrorCode, number, string][] = [
    ['HUB_NOT_FOUND', 500, 'api_error'],
    ['PERMISSION_REQUIRED', 403, 'permission_error'],
    ['CLIENT_NOT_AUTHORIZED', 401, 'authentication_error'],
    ['MODEL_NOT_FOUND', 404, 'not_found_error'],
    ['MODEL_NOT_READY', 500, 'api_error'],
    ['MODEL_INCOMPATIBLE', 400, 'invalid_request_error'],
    ['RUNTIME_UNAVAILABLE', 500, 'api_error'],
    ['RUNTIME_INITIALIZATION_FAILED', 500, 'api_error'],
    ['INSUFFICIENT_MEMORY', 500, 'api_error'],
    ['STORAGE_UNAVAILABLE', 500, 'api_error'],
    ['PROTOCOL_VERSION_UNSUPPORTED', 400, 'invalid_request_error'],
    ['USER_CANCELLED', 500, 'api_error'],
    ['INTEGRITY_FAILED', 500, 'api_error'],
    ['LICENSE_ACCEPTANCE_REQUIRED', 403, 'permission_error'],
    ['FEATURE_UNSUPPORTED', 400, 'invalid_request_error'],
    ['CAPABILITY_UNAVAILABLE', 400, 'invalid_request_error'],
    ['TRANSPORT_UNAVAILABLE', 500, 'api_error'],
  ];
  for (const [code, status, type] of errorCases) {
    const mappedFetch = createAnthropicProviderFetch({
      backend: {
        ...backend,
        async complete() {
          throw new ModelCommonsError(code, `trusted ${code}`);
        },
      },
    });
    const mappedResponse = await mappedFetch('https://modelcommons.local/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(anthropicTextRequestFixture),
    });
    equal(mappedResponse.status, status, `${code} HTTP status`);
    equal(mappedResponse.headers.get('x-modelcommons-error-code'), code, `${code} diagnostic code`);
    const mappedBody = object(await mappedResponse.json(), `${code} body`);
    equal(object(mappedBody.error, `${code} error`).type, type, `${code} provider error type`);
  }
  const sanitizedFetch = createAnthropicProviderFetch({
    backend: {
      ...backend,
      async complete() {
        throw new Error('secret backend detail');
      },
    },
  });
  const sanitizedResponse = await sanitizedFetch('https://modelcommons.local/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify(anthropicTextRequestFixture),
  });
  const sanitizedBody = object(await sanitizedResponse.json(), 'sanitized error body');
  equal(
    object(sanitizedBody.error, 'sanitized error').message,
    'The local ModelCommons runtime failed.',
    'unknown backend error is sanitized'
  );

  const missingVersion = await fetch('https://modelcommons.local/v1/messages', {
    method: 'POST',
    body: JSON.stringify(anthropicTextRequestFixture),
  });
  equal(missingVersion.status, 400, 'missing API version status');

  const beta = await fetch('https://modelcommons.local/v1/messages', {
    method: 'POST',
    headers: { ...headers, 'anthropic-beta': 'fixture-beta' },
    body: JSON.stringify(anthropicTextRequestFixture),
  });
  equal(beta.status, 400, 'beta header status');

  await rejects(
    () => fetch('https://example.invalid/v1/messages', { method: 'POST', headers }),
    'TypeError'
  );

  const aborted = new AbortController();
  aborted.abort();
  await rejects(
    () => fetch('https://modelcommons.local/v1/messages', {
      method: 'POST',
      headers,
      signal: aborted.signal,
      body: JSON.stringify(anthropicTextRequestFixture),
    }),
    'AbortError'
  );

  let streamCancellationObserved = false;
  const cancellationBackend: ModelCommonsProviderBackend = {
    ...backend,
    async *stream(_request, options) {
      if (options.signal.aborted) streamCancellationObserved = true;
      else options.signal.addEventListener('abort', () => {
        streamCancellationObserved = true;
      }, { once: true });
      yield canonicalAnthropicStreamFixture[0];
      yield canonicalAnthropicStreamFixture[1];
    },
  };
  const cancellationFetch = createAnthropicProviderFetch({ backend: cancellationBackend });
  const cancellableResponse = await cancellationFetch('https://modelcommons.local/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...anthropicTextRequestFixture, stream: true }),
  });
  const cancellableBody = cancellableResponse.body;
  assert(cancellableBody, 'stream body is readable');
  const reader = cancellableBody.getReader();
  await reader.read();
  await reader.cancel('fixture cancellation');
  await Promise.resolve();
  await Promise.resolve();
  assert(streamCancellationObserved, 'response-body cancellation reaches the backend signal');
}

describe('@modelcommons/provider-anthropic', () => {
  it('enforces the offline Anthropic fetch contract', async () => {
    await runAnthropicProviderContractTests();
  });
});

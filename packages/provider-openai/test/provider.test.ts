import {
  ModelCommonsError,
  type ModelCommonsErrorCode,
  type ModelCommonsRequest,
  type ModelCommonsResponse,
  type ModelCommonsStreamEvent,
} from '@modelcommons/protocol';
import { describe, it } from 'vitest';
import {
  createOpenAIProviderFetch,
  type ModelCommonsProviderBackend,
  type ProviderEmbeddingRequest,
  type ProviderModelDescriptor,
} from '../src/index';
import {
  canonicalTextResponseFixture,
  canonicalTextStreamFixture,
  openAIModelFixture,
  responsesTextRequestFixture,
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

const embeddingModel: ProviderModelDescriptor = {
  id: 'local/test-embedding',
  createdAt: 1_700_000_000,
  capabilities: ['embeddings'],
  state: 'ready',
  runtimeId: 'fixture',
  profileId: 'test',
  features: { embeddingDimensions: [1] },
};

export async function runOpenAIProviderContractTests(): Promise<void> {
  let sequence = 0;
  let completeCalls = 0;
  let capturedRequest: ModelCommonsRequest | undefined;
  let capturedEmbedding: ProviderEmbeddingRequest | undefined;
  let streamFixture: readonly ModelCommonsStreamEvent[] = canonicalTextStreamFixture;

  const backend: ModelCommonsProviderBackend = {
    listModels: () => [openAIModelFixture, embeddingModel],
    async complete(request) {
      completeCalls += 1;
      capturedRequest = request;
      return {
        ...canonicalTextResponseFixture,
        modelId: request.model.id ?? canonicalTextResponseFixture.modelId,
      };
    },
    async *stream(request) {
      capturedRequest = request;
      for (const event of streamFixture) yield event;
    },
    async embed(request) {
      capturedEmbedding = request;
      return {
        modelId: request.model.id,
        embeddings: [[1]],
        usage: { inputTokens: 1, outputTokens: 0, totalTokens: 1 },
      };
    },
  };

  const fetch = createOpenAIProviderFetch({
    backend,
    aliases: { fixture_alias: { modelId: openAIModelFixture.id, profile: 'test' } },
    idFactory: (prefix) => `${prefix}_fixture_${++sequence}`,
  });

  const modelsResponse = await fetch('https://modelcommons.local/v1/models');
  assert(modelsResponse instanceof Response, 'models route returns a Response');
  equal(modelsResponse.status, 200, 'models status');
  const modelsBody = object(await modelsResponse.json(), 'models body');
  equal(modelsBody.object, 'list', 'models object');
  equal(array(modelsBody.data, 'models data').length, 2, 'ready model count');

  const responsesResponse = await fetch('https://modelcommons.local/v1/responses', {
    method: 'POST',
    body: JSON.stringify({ ...responsesTextRequestFixture, model: 'fixture_alias' }),
  });
  equal(responsesResponse.status, 200, 'Responses status');
  const responsesBody = object(await responsesResponse.json(), 'Responses body');
  equal(responsesBody.object, 'response', 'Responses object');
  equal(responsesBody.model, openAIModelFixture.id, 'resolved response model');
  const output = object(array(responsesBody.output, 'Responses output')[0], 'message output item');
  const outputText = object(array(output.content, 'message content')[0], 'output text part');
  equal(outputText.text, 'Hello!', 'Responses text');
  equal(capturedRequest?.model.profile, 'test', 'explicit alias profile');

  const responsesStream = await fetch('https://modelcommons.local/v1/responses', {
    method: 'POST',
    body: JSON.stringify({ ...responsesTextRequestFixture, stream: true }),
  });
  equal(responsesStream.headers.get('content-type'), 'text/event-stream; charset=utf-8', 'Responses SSE content type');
  const responsesSse = await responsesStream.text();
  assert(responsesSse.includes('event: response.created'), 'Responses stream created event');
  assert(responsesSse.includes('event: response.output_text.delta'), 'Responses text delta');
  assert(responsesSse.includes('event: response.completed'), 'Responses terminal event');
  assert(!responsesSse.includes('data: [DONE]'), 'Responses stream has no Chat DONE marker');

  const chatStream = await fetch('https://modelcommons.local/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: openAIModelFixture.id,
      messages: [{ role: 'user', content: 'Hello' }],
      stream: true,
      stream_options: { include_usage: true },
    }),
  });
  const chatSse = await chatStream.text();
  assert(chatSse.includes('"object":"chat.completion.chunk"'), 'Chat chunks');
  assert(chatSse.includes('"choices":[]'), 'Chat final usage chunk');
  assert(chatSse.endsWith('data: [DONE]\n\n'), 'Chat DONE marker');

  const unsupportedResponse = await fetch('https://modelcommons.local/v1/responses', {
    method: 'POST',
    body: JSON.stringify({ ...responsesTextRequestFixture, reasoning: { effort: 'high' } }),
  });
  equal(unsupportedResponse.status, 400, 'unsupported field status');
  equal(unsupportedResponse.headers.get('x-modelcommons-error-code'), 'FEATURE_UNSUPPORTED', 'unsupported field code');
  equal(completeCalls, 1, 'unsupported request never executes the backend');

  const prototypeAliasResponse = await fetch('https://modelcommons.local/v1/responses', {
    method: 'POST',
    body: JSON.stringify({ ...responsesTextRequestFixture, model: 'constructor' }),
  });
  equal(prototypeAliasResponse.status, 404, 'inherited object names never resolve as aliases');
  equal(completeCalls, 1, 'prototype alias request never executes the backend');

  const errorCases: readonly [ModelCommonsErrorCode, number, string][] = [
    ['HUB_NOT_FOUND', 503, 'server_error'],
    ['PERMISSION_REQUIRED', 403, 'permission_error'],
    ['CLIENT_NOT_AUTHORIZED', 401, 'authentication_error'],
    ['MODEL_NOT_FOUND', 404, 'invalid_request_error'],
    ['MODEL_NOT_READY', 503, 'server_error'],
    ['MODEL_INCOMPATIBLE', 400, 'invalid_request_error'],
    ['RUNTIME_UNAVAILABLE', 503, 'server_error'],
    ['RUNTIME_INITIALIZATION_FAILED', 500, 'server_error'],
    ['INSUFFICIENT_MEMORY', 503, 'server_error'],
    ['STORAGE_UNAVAILABLE', 503, 'server_error'],
    ['PROTOCOL_VERSION_UNSUPPORTED', 400, 'invalid_request_error'],
    ['USER_CANCELLED', 499, 'server_error'],
    ['INTEGRITY_FAILED', 500, 'server_error'],
    ['LICENSE_ACCEPTANCE_REQUIRED', 403, 'permission_error'],
    ['FEATURE_UNSUPPORTED', 400, 'invalid_request_error'],
    ['CAPABILITY_UNAVAILABLE', 400, 'invalid_request_error'],
    ['TRANSPORT_UNAVAILABLE', 503, 'server_error'],
  ];
  for (const [code, status, type] of errorCases) {
    const mappedFetch = createOpenAIProviderFetch({
      backend: {
        ...backend,
        async complete() {
          throw new ModelCommonsError(code, `trusted ${code}`);
        },
      },
    });
    const mappedResponse = await mappedFetch('https://modelcommons.local/v1/responses', {
      method: 'POST',
      body: JSON.stringify(responsesTextRequestFixture),
    });
    equal(mappedResponse.status, status, `${code} HTTP status`);
    equal(mappedResponse.headers.get('x-modelcommons-error-code'), code, `${code} diagnostic code`);
    const mappedBody = object(await mappedResponse.json(), `${code} body`);
    equal(object(mappedBody.error, `${code} error`).type, type, `${code} provider error type`);
  }
  const sanitizedFetch = createOpenAIProviderFetch({
    backend: {
      ...backend,
      async complete() {
        throw new Error('secret backend detail');
      },
    },
  });
  const sanitizedResponse = await sanitizedFetch('https://modelcommons.local/v1/responses', {
    method: 'POST',
    body: JSON.stringify(responsesTextRequestFixture),
  });
  const sanitizedBody = object(await sanitizedResponse.json(), 'sanitized error body');
  equal(
    object(sanitizedBody.error, 'sanitized error').message,
    'The local ModelCommons runtime failed.',
    'unknown backend error is sanitized'
  );

  const embeddingResponse = await fetch('https://modelcommons.local/v1/embeddings', {
    method: 'POST',
    body: JSON.stringify({
      model: embeddingModel.id,
      input: ['hello'],
      encoding_format: 'base64',
      dimensions: 1,
    }),
  });
  equal(embeddingResponse.status, 200, 'embedding status');
  const embeddingBody = object(await embeddingResponse.json(), 'embedding body');
  const embeddingData = object(array(embeddingBody.data, 'embedding data')[0], 'embedding item');
  equal(embeddingData.embedding, 'AACAPw==', 'little-endian float32 base64');
  equal(capturedEmbedding?.dimensions, 1, 'embedding dimensions reach the backend');

  await rejects(
    () => fetch('https://example.invalid/v1/models'),
    'TypeError'
  );

  const aborted = new AbortController();
  aborted.abort();
  await rejects(
    () => fetch('https://modelcommons.local/v1/models', { signal: aborted.signal }),
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
      yield canonicalTextStreamFixture[0];
    },
  };
  const cancellationFetch = createOpenAIProviderFetch({ backend: cancellationBackend });
  const cancellableResponse = await cancellationFetch('https://modelcommons.local/v1/responses', {
    method: 'POST',
    body: JSON.stringify({ ...responsesTextRequestFixture, stream: true }),
  });
  const cancellableBody = cancellableResponse.body;
  assert(cancellableBody, 'stream body is readable');
  const reader = cancellableBody.getReader();
  await reader.read();
  await reader.cancel('fixture cancellation');
  await Promise.resolve();
  await Promise.resolve();
  assert(streamCancellationObserved, 'response-body cancellation reaches the backend signal');

  const lengthResponse: ModelCommonsResponse = {
    ...canonicalTextResponseFixture,
    stopReason: 'length',
  };
  streamFixture = [
    canonicalTextStreamFixture[0],
    canonicalTextStreamFixture[1],
    canonicalTextStreamFixture[2],
    canonicalTextStreamFixture[3],
    { type: 'response.completed', response: lengthResponse },
  ];
  const incompleteStream = await fetch('https://modelcommons.local/v1/responses', {
    method: 'POST',
    body: JSON.stringify({ ...responsesTextRequestFixture, stream: true }),
  });
  assert((await incompleteStream.text()).includes('event: response.incomplete'), 'length stop uses response.incomplete');
}

describe('@modelcommons/provider-openai', () => {
  it('enforces the offline OpenAI fetch contract', async () => {
    await runOpenAIProviderContractTests();
  });
});

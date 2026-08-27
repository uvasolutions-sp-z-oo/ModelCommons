import type {
  ModelCommonsResponse,
  ModelCommonsStreamEvent,
} from '@modelcommons/protocol';
import type { ProviderModelDescriptor } from '../src/types';

export const OPENAI_FIXTURE_ORIGIN = 'https://modelcommons.local';
export const OPENAI_SDK_COMPATIBILITY_FIXTURE = {
  package: 'openai',
  version: '7.5.0',
  baseURL: 'https://modelcommons.local/v1',
  apiKey: 'modelcommons-local',
  maxRetries: 0,
  dangerouslyAllowBrowser: true,
  logLevel: 'off',
} as const;

export const openAIModelFixture: ProviderModelDescriptor = {
  id: 'local/test-text',
  createdAt: 1_700_000_000,
  capabilities: ['text', 'tools', 'structured-output'],
  state: 'ready',
  profileId: 'test',
  runtimeId: 'fixture',
  features: {
    streaming: true,
    stopSequences: true,
    temperature: true,
    topP: true,
    tools: true,
    strictTools: true,
    parallelTools: true,
    jsonObject: true,
    jsonSchema: true,
  },
};

export const responsesTextRequestFixture = {
  model: openAIModelFixture.id,
  input: [{ role: 'user', content: [{ type: 'input_text', text: 'Hello' }] }],
  max_output_tokens: 16,
};

export const chatToolRequestFixture = {
  model: openAIModelFixture.id,
  messages: [{ role: 'user', content: 'Weather?' }],
  tools: [{
    type: 'function',
    function: {
      name: 'get_weather',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
      },
      strict: true,
    },
  }],
  stream: true,
  stream_options: { include_usage: true },
};

export const embeddingBase64RequestFixture = {
  model: 'local/test-embedding',
  input: ['hello'],
  encoding_format: 'base64',
};

export const canonicalTextResponseFixture: ModelCommonsResponse = {
  id: 'fixture-response',
  createdAt: 1_700_000_000,
  modelId: openAIModelFixture.id,
  content: [{ type: 'text', text: 'Hello!' }],
  stopReason: 'stop',
  usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
  diagnostics: {
    offline: true,
    resolvedModelId: openAIModelFixture.id,
    runtimeId: 'fixture',
    profileId: 'test',
  },
};

export const canonicalTextStreamFixture: readonly ModelCommonsStreamEvent[] = [
  {
    type: 'response.started',
    responseId: canonicalTextResponseFixture.id,
    createdAt: canonicalTextResponseFixture.createdAt,
    modelId: canonicalTextResponseFixture.modelId,
    diagnostics: canonicalTextResponseFixture.diagnostics,
  },
  { type: 'text.delta', responseId: canonicalTextResponseFixture.id, delta: 'Hel' },
  { type: 'text.delta', responseId: canonicalTextResponseFixture.id, delta: 'lo!' },
  {
    type: 'usage.updated',
    responseId: canonicalTextResponseFixture.id,
    usage: canonicalTextResponseFixture.usage,
  },
  { type: 'response.completed', response: canonicalTextResponseFixture },
];

export const rejectedOpenAIFieldsFixture = [
  { endpoint: '/v1/responses', field: 'reasoning' },
  { endpoint: '/v1/responses', field: 'store', value: true },
  { endpoint: '/v1/chat/completions', field: 'n', value: 2 },
  { endpoint: '/v1/chat/completions', field: 'logprobs', value: true },
] as const;

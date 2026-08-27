import type {
  ModelCommonsResponse,
  ModelCommonsStreamEvent,
} from '@modelcommons/protocol';
import type { ProviderModelDescriptor } from '../src/types';

export const ANTHROPIC_FIXTURE_ORIGIN = 'https://modelcommons.local';
export const ANTHROPIC_FIXTURE_VERSION = '2023-06-01';
export const ANTHROPIC_SDK_COMPATIBILITY_FIXTURE = {
  package: '@anthropic-ai/sdk',
  version: '0.120.0',
  baseURL: 'https://modelcommons.local',
  apiKey: 'modelcommons-local',
  maxRetries: 0,
  dangerouslyAllowBrowser: true,
  logLevel: 'off',
} as const;

export const anthropicModelFixture: ProviderModelDescriptor = {
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
    topK: true,
    tools: true,
    strictTools: true,
    parallelTools: true,
    jsonSchema: true,
  },
};

export const anthropicTextRequestFixture = {
  model: anthropicModelFixture.id,
  max_tokens: 16,
  system: 'Be concise.',
  messages: [{ role: 'user', content: 'Hello' }],
};

export const anthropicToolRequestFixture = {
  model: anthropicModelFixture.id,
  max_tokens: 32,
  messages: [{ role: 'user', content: 'Weather?' }],
  tools: [{
    name: 'get_weather',
    description: 'Read local fixture weather.',
    input_schema: {
      type: 'object',
      properties: { city: { type: 'string' } },
      required: ['city'],
    },
    strict: true,
  }],
  stream: true,
};

export const anthropicStructuredRequestFixture = {
  model: anthropicModelFixture.id,
  max_tokens: 16,
  messages: [{ role: 'user', content: 'Return a result.' }],
  output_config: {
    format: {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: { result: { type: 'string' } },
        required: ['result'],
        additionalProperties: false,
      },
    },
  },
};

export const canonicalAnthropicResponseFixture: ModelCommonsResponse = {
  id: 'fixture-message',
  createdAt: 1_700_000_000,
  modelId: anthropicModelFixture.id,
  content: [{ type: 'text', text: 'Hello!' }],
  stopReason: 'stop',
  usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
  diagnostics: {
    offline: true,
    resolvedModelId: anthropicModelFixture.id,
    runtimeId: 'fixture',
    profileId: 'test',
  },
};

export const canonicalAnthropicStreamFixture: readonly ModelCommonsStreamEvent[] = [
  {
    type: 'response.started',
    responseId: canonicalAnthropicResponseFixture.id,
    createdAt: canonicalAnthropicResponseFixture.createdAt,
    modelId: canonicalAnthropicResponseFixture.modelId,
    diagnostics: canonicalAnthropicResponseFixture.diagnostics,
  },
  {
    type: 'usage.updated',
    responseId: canonicalAnthropicResponseFixture.id,
    usage: { inputTokens: 1, outputTokens: 0 },
  },
  { type: 'text.delta', responseId: canonicalAnthropicResponseFixture.id, delta: 'Hel' },
  { type: 'text.delta', responseId: canonicalAnthropicResponseFixture.id, delta: 'lo!' },
  { type: 'response.completed', response: canonicalAnthropicResponseFixture },
];

export const rejectedAnthropicFieldsFixture = [
  { field: 'thinking' },
  { field: 'output_format' },
  { field: 'cache_control' },
  { header: 'anthropic-beta' },
] as const;

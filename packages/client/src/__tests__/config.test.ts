import { describe, expect, it } from 'vitest';
import { anthropicClientOptions, createClientConfiguration, openAIClientOptions } from '../config';

describe('client configuration', () => {
  it('contains no secrets and preserves explicit aliases', () => {
    const config = createClientConfiguration({
      id: 'com.example.client',
      displayName: 'Example',
      capabilities: ['text'],
      transports: ['hub-service', 'local-runtime'],
      aliases: { legacy: { modelId: 'local/text' } },
    });
    expect(config.aliases.legacy.modelId).toBe('local/text');
    expect(JSON.stringify(config)).not.toContain('apiKey');
  });

  it('configures the official SDK contract without network fallback', () => {
    const fetch = async () => new Response();
    const config = openAIClientOptions(fetch);
    expect(config.baseURL).toBe('https://modelcommons.local/v1');
    expect(config.fetch).toBe(fetch);
    expect(config.maxRetries).toBe(0);
    expect(config.dangerouslyAllowBrowser).toBe(true);
    expect(config.logLevel).toBe('off');

    const anthropic = anthropicClientOptions(fetch);
    expect(anthropic.baseURL).toBe('https://modelcommons.local');
    expect(anthropic.dangerouslyAllowBrowser).toBe(true);
    expect(anthropic.logLevel).toBe('off');
  });

  it('does not silently omit invalid zero-valued inference fields', () => {
    expect(() => createClientConfiguration({
      id: 'com.example.invalid',
      displayName: 'Invalid',
      capabilities: ['text'],
      transports: ['local-runtime'],
      context: 0,
    })).toThrowError(expect.objectContaining({ code: 'INTEGRITY_FAILED' }));
  });

  it('does not silently omit an invalid preferred model ID', () => {
    expect(() => createClientConfiguration({
      id: 'com.example.invalid-preference',
      displayName: 'Invalid preference',
      capabilities: ['text'],
      transports: ['local-runtime'],
      preferredModelId: '',
    })).toThrowError(expect.objectContaining({ code: 'INTEGRITY_FAILED' }));
  });
});

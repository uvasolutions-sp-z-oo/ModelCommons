import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelCommons, createTextProviderBackend } from '@modelcommons/client';
import { ModelCommonsError, PROTOCOL_VERSION, type ModelCommonsResponse, type ModelCommonsStreamEvent } from '@modelcommons/protocol';
import { SMOLLM2_360M_INSTRUCT as manifest } from '@modelcommons/model-store/catalog';
import { createOpenAIProviderFetch } from '@modelcommons/provider-openai';
import { createAnthropicProviderFetch } from '@modelcommons/provider-anthropic';
import { createEmbeddedLocalAI } from '../index';
import type { CreateLlamaRnSessionOptions } from '@modelcommons/runtime-llama-rn';

afterEach(() => vi.unstubAllGlobals());
function fixture(ownership: 'app-private' | 'shared-files', failLoad = false) {
  const lifecycle: string[] = [];
  let serial = 0;
  let pendingLease: { release(): Promise<void> } | undefined;
  const runtime = {
    getAvailability: vi.fn(async () => ({ available: true, runtimeVersion: '0.12.9' })),
    createSession: vi.fn(async ({ model, profile }: CreateLlamaRnSessionOptions) => {
      pendingLease = model.lease;
      if (failLoad) throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'Synthetic load failure.');
      const id = `session-${++serial}`;
      let released = false;
      const response = (): ModelCommonsResponse => ({
        id, createdAt: 1, modelId: model.id, content: [{ type: 'text', text: 'A blue bicycle.' }],
        stopReason: 'stop', usage: { inputTokens: 5, outputTokens: 4 },
        diagnostics: { offline: true, resolvedModelId: model.id, runtimeId: 'llama.rn', profileId: profile.id },
      });
      return {
        id,
        async complete() { return response(); },
        async *stream(): AsyncIterable<ModelCommonsStreamEvent> {
          const result = response();
          yield { type: 'response.started', responseId: id, createdAt: 1, modelId: model.id, diagnostics: result.diagnostics };
          yield { type: 'text.delta', responseId: id, delta: 'A blue bicycle.' };
          yield { type: 'response.completed', response: result };
        },
        async cancel() { lifecycle.push('cancel'); },
        async release() {
          if (released) return;
          released = true; lifecycle.push(`context:${id}`);
          await model.lease!.release(); pendingLease = undefined;
        },
      };
    }),
    async release() { lifecycle.push('engine'); await pendingLease?.release(); pendingLease = undefined; },
  };
  const modelStore = {
    identity: ownership,
    async list() { return [manifest]; },
    async acquire(id: string) {
      expect(id).toBe(manifest.id);
      lifecycle.push('lease');
      return { manifest, lease: { id: `lease-${serial}`, uri: 'file:///synthetic/model.gguf',
        async release() { lifecycle.push('lease-release'); } } };
    },
  };
  const runtimeFactory = vi.fn(() => runtime as never);
  const backend = createEmbeddedLocalAI({ modelStore, ownership, runtimeFactory,
    policy: { maxContext: 1024, maxOutput: 128 },
    deviceProvider: async () => ({ schema: 'modelcommons.device-profile', schemaVersion: 1,
      protocolVersion: PROTOCOL_VERSION, platform: 'ios', physicalMemoryBytes: 8 * 1024 ** 3,
      availableMemoryBytes: 4 * 1024 ** 3, accelerators: [{ id: 'cpu', kind: 'cpu' }], runtimeVersions: {}, collectedAt: 1 }),
  });
  return { backend, runtime, runtimeFactory, lifecycle };
}
const request = { model: { id: manifest.id, capabilities: ['text'] as ['text'] },
  messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'Synthetic question' }] }], maxOutputTokens: 16 };

describe.each(['app-private', 'shared-files'] as const)('%s composition without another inference boundary', (ownership) => {
  it('is lazy, returns resolved identity, serializes contexts, and releases context before lease', async () => {
    const f = fixture(ownership);
    const network = vi.fn(() => { throw Error('Unexpected network inference'); });
    vi.stubGlobal('fetch', network);
    expect(f.runtimeFactory).not.toHaveBeenCalled();
    const client = await ModelCommons.connect({ transport: f.backend.transport });
    const session = await client.createSession({ capabilities: ['text'], modelId: manifest.id, profile: 'safe' });
    await expect(client.createSession({ capabilities: ['text'], modelId: manifest.id })).rejects.toMatchObject({ code: 'RUNTIME_UNAVAILABLE' });
    expect((await session.generate(request)).modelId).toBe(manifest.id);
    await Promise.all([session.release(), session.release()]);
    expect(f.lifecycle.indexOf('context:session-1')).toBeLessThan(f.lifecycle.indexOf('lease-release'));
    const next = await client.createSession({ capabilities: ['text'], modelId: manifest.id });
    expect(next.id).not.toBe(session.id);
    await next.release(); await f.backend.release(); await f.backend.release();
    expect(network).not.toHaveBeenCalled();
  });
  it('rejects unsupported features and policy expansion without another provider', async () => {
    const f = fixture(ownership);
    const client = await ModelCommons.connect({ transport: f.backend.transport });
    await expect(client.createSession({ capabilities: ['text'], modelId: manifest.id, minimumContext: 4096 })).rejects.toBeDefined();
    const session = await client.createSession({ capabilities: ['text'], modelId: manifest.id });
    await expect(session.generate({ ...request, maxOutputTokens: 512 })).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' });
    await expect(session.generate({ ...request, responseFormat: { type: 'json_object', guarantee: 'grammar' } })).rejects.toBeDefined();
    await session.release(); await f.backend.release();
  });
  it('drains failed initialization and does not reuse a potentially damaged engine', async () => {
    const f = fixture(ownership, true);
    const client = await ModelCommons.connect({ transport: f.backend.transport });
    await expect(client.createSession({ capabilities: ['text'], modelId: manifest.id })).rejects.toMatchObject({ code: 'RUNTIME_INITIALIZATION_FAILED' });
    expect(f.lifecycle).toContain('lease-release');
    await expect(client.createSession({ capabilities: ['text'], modelId: manifest.id })).rejects.toMatchObject({ code: 'RUNTIME_UNAVAILABLE' });
    await f.backend.release();
  });
  it('feeds the same OpenAI and Anthropic text adapters without global fetch or fallback', async () => {
    const f = fixture(ownership);
    const network = vi.fn(() => { throw Error('Network forbidden'); });
    vi.stubGlobal('fetch', network);
    const backend = createTextProviderBackend(f.backend.transport);
    const openai = createOpenAIProviderFetch({ backend });
    const anthropic = createAnthropicProviderFetch({ backend });
    const headers = { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' };
    const cases = [
      [openai, '/v1/responses', { model: manifest.id, input: 'Synthetic', max_output_tokens: 16 }],
      [openai, '/v1/chat/completions', { model: manifest.id, messages: [{ role: 'user', content: 'Synthetic' }], max_tokens: 16 }],
      [anthropic, '/v1/messages', { model: manifest.id, messages: [{ role: 'user', content: 'Synthetic' }], max_tokens: 16 }],
    ] as const;
    for (const [fetcher, route, body] of cases) {
      const result = await fetcher(`https://modelcommons.local${route}`, { method: 'POST', headers, body: JSON.stringify(body) });
      expect(result.status).toBe(200); expect(await result.text()).toContain(manifest.id);
      const stream = await fetcher(`https://modelcommons.local${route}`, { method: 'POST', headers, body: JSON.stringify({ ...body, stream: true }) });
      expect(stream.status).toBe(200); expect(await stream.text()).toContain('bicycle');
    }
    const invalid = await openai('https://modelcommons.local/v1/responses', {
      method: 'POST', headers, body: JSON.stringify({ model: manifest.id, input: 'Synthetic', tools: [{ type: 'web_search' }] }),
    });
    expect(invalid.status).toBeGreaterThanOrEqual(400);
    await expect(openai('https://unapproved.example/v1/models')).rejects.toBeDefined();
    expect(network).not.toHaveBeenCalled();
    await f.backend.release();
  });
});

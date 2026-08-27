import { describe, expect, it, vi } from 'vitest';
import {
  PROTOCOL_VERSION,
  type ModelCommonsRequest,
  type ModelManifest,
} from '@modelcommons/protocol';
import { ModelCommons } from '../client';
import { createClientConfiguration } from '../config';
import { InProcessTransport, type InProcessHost } from '../in-process';
import type { ResolvedModel, SessionIntent, TransportSession } from '../types';

function manifest(
  id: string,
  options: {
    capabilities?: ModelManifest['capabilities'];
    context?: number;
    runtimeId?: string;
  } = {}
): ModelManifest {
  return {
    schema: 'modelcommons.model-manifest',
    schemaVersion: 1,
    protocolVersion: PROTOCOL_VERSION,
    id,
    revision: 'r1',
    storageId: id.replaceAll('/', '-'),
    displayName: id,
    family: 'fixture',
    architecture: { type: 'dense' },
    format: 'gguf',
    files: [{ role: 'model', path: 'model.gguf', required: true }],
    source: { provider: 'user' },
    license: {
      id: 'fixture',
      url: 'https://example.com/license',
      acceptanceRequired: false,
      gated: false,
    },
    capabilities: options.capabilities ?? ['text'],
    compatibleRuntimes: [{ id: options.runtimeId ?? 'runtime-good' }],
    context: {
      recommended: Math.min(options.context ?? 8192, 2048),
      maximum: options.context ?? 8192,
    },
    recommendedProfiles: ['balanced'],
  };
}

function configuredHost() {
  const models = [
    {
      manifest: manifest('local/preferred', {
        capabilities: ['text', 'tools'],
        context: 1024,
        runtimeId: 'runtime-bad',
      }),
      state: 'READY' as const,
      runtimeIds: ['runtime-bad'],
    },
    {
      manifest: manifest('local/compatible', {
        capabilities: ['text', 'tools'],
        context: 8192,
        runtimeId: 'runtime-good',
      }),
      state: 'READY' as const,
      runtimeIds: ['runtime-good'],
    },
  ];
  let sessionIntent: SessionIntent | undefined;
  let canonicalRequest: ModelCommonsRequest | undefined;
  const release = vi.fn(async () => undefined);
  const host: InProcessHost = {
    protocolVersion: PROTOCOL_VERSION,
    async listModels() {
      return models;
    },
    async createSession(model, intent): Promise<TransportSession> {
      sessionIntent = intent;
      const loaded: ResolvedModel = { ...model };
      return {
        id: 'session-1',
        model: loaded,
        async generate(request) {
          canonicalRequest = request;
          return {
            id: 'response-1',
            createdAt: 1,
            modelId: loaded.manifest.id,
            content: [],
            stopReason: 'stop',
            usage: {},
            diagnostics: {
              offline: true,
              resolvedModelId: loaded.manifest.id,
              runtimeId: loaded.runtimeId,
              profileId: loaded.profileId,
            },
          };
        },
        async *stream() {},
        async cancel() {},
        release,
      };
    },
  };
  return {
    host,
    getSessionIntent: () => sessionIntent,
    getCanonicalRequest: () => canonicalRequest,
    release,
  };
}

describe('ModelCommonsClient configuration semantics', () => {
  it('enforces requirements, falls back, and applies inference defaults', async () => {
    const fixture = configuredHost();
    const configuration = createClientConfiguration({
      id: 'com.example.configured',
      displayName: 'Configured client',
      capabilities: ['tools'],
      preferredModelId: 'local/preferred',
      fallback: 'best-compatible',
      formats: ['gguf'],
      runtimes: ['runtime-good'],
      minimumContext: 4096,
      profile: 'safe',
      context: 2048,
      maxOutput: 73,
      transports: ['local-runtime'],
    });
    const client = await ModelCommons.connect({
      transport: new InProcessTransport(fixture.host),
      clientConfiguration: configuration,
    });
    configuration.inference.profile = 'performance';
    expect(client.clientConfiguration?.inference.profile).toBe('safe');
    expect(Object.isFrozen(client.clientConfiguration?.requirements)).toBe(true);

    const resolved = await client.resolve({ capabilities: ['text'] });
    expect(resolved.manifest.id).toBe('local/compatible');
    expect(resolved.runtimeId).toBe('runtime-good');
    expect(Object.isFrozen(resolved)).toBe(true);
    expect(Object.isFrozen(resolved.manifest.context)).toBe(true);

    const session = await client.createSession({ capabilities: ['text'] });
    expect(fixture.getSessionIntent()).toMatchObject({
      modelId: 'local/compatible',
      profile: 'safe',
      minimumContext: 4096,
      capabilities: expect.arrayContaining(['text', 'tools']),
    });
    expect(session.model.profileId).toBe('safe');
    expect(Object.isFrozen(session.model.manifest)).toBe(true);

    await session.generate({
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
    });
    expect(fixture.getCanonicalRequest()).toMatchObject({
      maxOutputTokens: 73,
      model: {
        id: 'local/compatible',
        profile: 'safe',
        capabilities: expect.arrayContaining(['text', 'tools']),
      },
    });

    await expect(session.generate({
      model: { capabilities: ['text'], profile: 'balanced' },
      messages: [],
    })).rejects.toMatchObject({ code: 'MODEL_INCOMPATIBLE' });
    await expect(session.generate({
      model: { capabilities: ['vision'] },
      messages: [],
    })).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' });
    await session.release();
    expect(fixture.release).toHaveBeenCalledOnce();
  });

  it('does not fall back when configuration requires preferred-model unavailability', async () => {
    const fixture = configuredHost();
    const configuration = createClientConfiguration({
      id: 'com.example.strict',
      displayName: 'Strict client',
      capabilities: ['text'],
      preferredModelId: 'local/missing',
      fallback: 'unavailable',
      transports: ['local-runtime'],
    });
    const client = await ModelCommons.connect({
      transport: new InProcessTransport(fixture.host),
      clientConfiguration: configuration,
    });

    await expect(client.resolve({ capabilities: ['text'] })).rejects.toMatchObject({
      code: 'MODEL_NOT_FOUND',
    });
  });

  it('never falls back from an explicit per-session model', async () => {
    const fixture = configuredHost();
    const configuration = createClientConfiguration({
      id: 'com.example.explicit',
      displayName: 'Explicit client',
      capabilities: ['text'],
      preferredModelId: 'local/compatible',
      fallback: 'best-compatible',
      transports: ['local-runtime'],
    });
    const client = await ModelCommons.connect({
      transport: new InProcessTransport(fixture.host),
      clientConfiguration: configuration,
    });

    await expect(client.resolve({
      capabilities: ['text'],
      modelId: 'local/missing',
    })).rejects.toMatchObject({ code: 'MODEL_NOT_FOUND' });
  });

  it('uses only exact configuration aliases and lets alias profiles beat defaults', async () => {
    const fixture = configuredHost();
    const configuration = createClientConfiguration({
      id: 'com.example.alias',
      displayName: 'Alias client',
      capabilities: ['text'],
      aliases: { legacy: { modelId: 'local/compatible', profile: 'safe' } },
      preferredModelId: 'legacy',
      fallback: 'unavailable',
      profile: 'balanced',
      transports: ['local-runtime'],
    });
    const client = await ModelCommons.connect({
      transport: new InProcessTransport(fixture.host),
      clientConfiguration: configuration,
    });

    await expect(client.resolve({ capabilities: ['text'], modelId: 'toString' }))
      .rejects.toMatchObject({ code: 'MODEL_NOT_FOUND' });
    const resolved = await client.resolve({ capabilities: ['text'] });
    expect(resolved).toMatchObject({ alias: 'legacy', profileId: 'safe' });
  });

  it('reports and enforces a disallowed active access path', async () => {
    const fixture = configuredHost();
    const configuration = createClientConfiguration({
      id: 'com.example.hub-only',
      displayName: 'Hub-only client',
      capabilities: ['text'],
      transports: ['hub-service'],
    });
    const client = await ModelCommons.connect({
      transport: new InProcessTransport(fixture.host),
      clientConfiguration: configuration,
    });

    await expect(client.getAvailability()).resolves.toMatchObject({
      state: 'TRANSPORT_UNAVAILABLE',
      transportPreference: 'local-runtime',
    });
    await expect(client.listModels()).rejects.toMatchObject({ code: 'TRANSPORT_UNAVAILABLE' });
  });

  it('releases and rejects a session whose artifact or profile identity changed during loading', async () => {
    const fixture = configuredHost();
    const createSession = fixture.host.createSession.bind(fixture.host);
    fixture.host.createSession = async (model, intent) => {
      const session = await createSession(model, intent);
      return {
        ...session,
        model: {
          ...session.model,
          manifest: { ...session.model.manifest, storageId: 'different-storage-id' },
          profileId: 'different-profile',
        },
      };
    };
    const client = await ModelCommons.connect({
      transport: new InProcessTransport(fixture.host),
    });

    await expect(client.createSession({ capabilities: ['text'] })).rejects.toMatchObject({
      code: 'RUNTIME_INITIALIZATION_FAILED',
    });
    expect(fixture.release).toHaveBeenCalledOnce();
  });
});

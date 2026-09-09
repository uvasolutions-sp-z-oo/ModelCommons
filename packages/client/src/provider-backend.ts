import { ModelCommons } from './client';
import type { ModelCommonsTransport } from './types';
import type { ModelCommonsRequest, ModelCommonsResponse, ModelCommonsStreamEvent } from '@modelcommons/protocol';

/** Structural backend shared by both wire adapters. No SDK, RN or runtime import. */
export function createTextProviderBackend(transport: ModelCommonsTransport, context = 1024) {
  async function sessionFor(request: ModelCommonsRequest) {
    const client = await ModelCommons.connect({ transport });
    return client.createSession({ capabilities: request.model.capabilities,
      modelId: request.model.id, profile: request.model.profile ?? 'safe', minimumContext: context });
  }
  return {
    async listModels() {
      return (await transport.listModels()).map((model) => ({
        id: model.manifest.id, createdAt: 0,
        capabilities: model.manifest.capabilities.filter((item) => item === 'text'),
        state: model.state === 'READY' && model.runtimeIds.length ? 'ready' as const : 'not_ready' as const,
        profileId: 'safe', runtimeId: model.runtimeIds[0],
        features: { streaming: true, stopSequences: true, temperature: true, topP: true,
          tools: false, strictTools: false, parallelTools: false, jsonObject: false, jsonSchema: false },
      }));
    },
    async complete(request: ModelCommonsRequest, options: { signal: AbortSignal }): Promise<ModelCommonsResponse> {
      const session = await sessionFor(request);
      let failed = false;
      try { return await session.generate(request, options); }
      catch (error) { failed = true; throw error; }
      finally { try { await session.release(); } catch (error) { if (!failed) throw error; } }
    },
    async *stream(request: ModelCommonsRequest, options: { signal: AbortSignal }): AsyncIterable<ModelCommonsStreamEvent> {
      const session = await sessionFor(request);
      let failed = false;
      try { yield* session.stream(request, options); }
      catch (error) { failed = true; throw error; }
      finally { try { await session.release(); } catch (error) { if (!failed) throw error; } }
    },
  };
}

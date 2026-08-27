import {
  InProcessTransport,
  ModelCommons,
  type AvailableModel,
  type InProcessHost,
  type ResolvedModel,
  type SessionIntent,
  type TransportSession,
} from '@modelcommons/client';
import {
  ModelCommonsError,
  PROTOCOL_VERSION,
  type ModelAliasTarget,
  type ModelCommonsRequest,
  type ModelCommonsResponse,
  type ModelCommonsStreamEvent,
} from '@modelcommons/protocol';
import { resolveRuntimeProfile } from '@modelcommons/device-profile';
import { createLlamaRnRuntime, type LlamaRnSession } from '@modelcommons/runtime-llama-rn';
import { createOpenAIProviderFetch, type ModelCommonsProviderBackend as OpenAIBackend } from '@modelcommons/provider-openai';
import { createAnthropicProviderFetch, type ModelCommonsProviderBackend as AnthropicBackend } from '@modelcommons/provider-anthropic';
import { collectDeviceProfile } from './deviceProfile';
import { modelStore } from './modelStore';
import { createHubAvailableModels, selectHubTextRecord } from './selection';
import { registerHubTransport } from './inference';
import { useHubStore } from '../../store/inferenceStore';

let runtime = createLlamaRnRuntime({ maxLoadedContexts: 1 });
let transport: InProcessTransport | undefined;
let transportInitialization: Promise<InProcessTransport> | undefined;

class RuntimeTransportSession implements TransportSession {
  readonly id: string;
  readonly model: ResolvedModel;
  readonly #runtime: LlamaRnSession;

  constructor(model: ResolvedModel, session: LlamaRnSession) {
    this.model = model;
    this.#runtime = session;
    this.id = session.id;
  }

  generate(request: ModelCommonsRequest, options?: { signal?: AbortSignal }): Promise<ModelCommonsResponse> {
    return this.#runtime.complete(request, options?.signal);
  }

  stream(request: ModelCommonsRequest, options?: { signal?: AbortSignal }): AsyncIterable<ModelCommonsStreamEvent> {
    return this.#runtime.stream(request, options?.signal);
  }

  cancel(): Promise<void> {
    return this.#runtime.cancel();
  }

  release(): Promise<void> {
    return this.#runtime.release();
  }
}

class HubHost implements InProcessHost {
  protocolVersion = PROTOCOL_VERSION;

  async listModels(): Promise<AvailableModel[]> {
    await modelStore.initialize();
    const availability = await runtime.getAvailability();
    return createHubAvailableModels(modelStore.registry, {
      runtimeAvailable: availability.available,
      runtimeVersion: availability.runtimeVersion,
      experimentalEnabled: useHubStore.getState().experimentalEnabled,
    });
  }

  async createSession(model: ResolvedModel, intent: SessionIntent): Promise<TransportSession> {
    const record = modelStore.registry.models.find((entry) =>
      entry.manifest.id === model.manifest.id
      && entry.manifest.revision === model.manifest.revision
      && entry.manifest.storageId === model.manifest.storageId
    );
    if (!record || record.state !== 'READY') {
      throw new ModelCommonsError('MODEL_NOT_READY', 'The selected immutable model revision is not ready.');
    }
    if (!modelStore.isLicenseAccepted(record.manifest)) {
      throw new ModelCommonsError('LICENSE_ACCEPTANCE_REQUIRED', 'The selected model license has not been accepted.');
    }
    const experimentalEnabled = useHubStore.getState().experimentalEnabled;
    if (record.manifest.experimental && !experimentalEnabled) {
      throw new ModelCommonsError('PERMISSION_REQUIRED', 'Enable experimental model execution explicitly in the Hub.');
    }
    const availability = await runtime.getAvailability();
    if (!availability.available) {
      throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'The llama.rn runtime is unavailable in this build.', {
        retryable: true,
      });
    }
    const collected = useHubStore.getState().deviceProfile ?? await collectDeviceProfile();
    const device = {
      ...collected,
      runtimeVersions: { ...collected.runtimeVersions, 'llama.rn': availability.runtimeVersion },
    };
    const resolution = resolveRuntimeProfile({
      device,
      model: record.manifest,
      requestedProfile: intent.profile ?? model.profileId,
      requestedContext: intent.minimumContext,
      artifactInstalled: true,
    });
    if (resolution.compatibility === 'UNSUPPORTED' || resolution.compatibility === 'NOT_RECOMMENDED') {
      throw new ModelCommonsError('INSUFFICIENT_MEMORY', 'The device profile rejected this model/profile before loading.', {
        details: { compatibility: resolution.compatibility, reasons: resolution.reasons },
      });
    }
    if (resolution.compatibility === 'EXPERIMENTAL' && !experimentalEnabled) {
      throw new ModelCommonsError('PERMISSION_REQUIRED', 'Enable experimental model execution explicitly in the Hub.');
    }
    await modelStore.verifyReadyModel(record.manifest);
    const modelUri = modelStore.artifactUri(record.manifest, 'model');
    if (!modelUri) throw new ModelCommonsError('MODEL_NOT_READY', 'The model artifact path is missing.');

    try {
      const session = await runtime.createSession({
        model: { id: record.manifest.id, revision: record.manifest.revision, uri: modelUri },
        profile: resolution.profile,
      });
      useHubStore.getState().actions.clearRuntimeFailure(record.manifest.id, resolution.profile.id);
      return new RuntimeTransportSession({ ...model, profileId: resolution.profile.id }, session);
    } catch (error) {
      const category = error instanceof ModelCommonsError && error.code === 'INSUFFICIENT_MEMORY'
        ? 'OOM_OR_ALLOCATION'
        : 'INITIALIZATION_FAILED';
      useHubStore.getState().actions.recordRuntimeFailure({
        modelId: record.manifest.id,
        profileId: resolution.profile.id,
        category,
        occurredAt: Date.now(),
      });
      throw error;
    }
  }
}

export async function initializeHubRuntime(): Promise<InProcessTransport> {
  if (transport) return transport;
  if (!transportInitialization) {
    transportInitialization = (async () => {
      await modelStore.initialize();
      const nextTransport = new InProcessTransport(new HubHost(), {
        aliases: modelStore.registry.aliases,
      });
      transport = nextTransport;
      registerHubTransport(nextTransport);
      ModelCommons.configureDefaultTransport(() => initializeHubRuntime());
      modelStore.setBeforeDelete(async () => {
        // The mobile prototype keeps at most one context. Releasing the runtime
        // before deletion guarantees no artifact being mmap'd is removed.
        await runtime.release();
        runtime = createLlamaRnRuntime({ maxLoadedContexts: 1 });
        transport = undefined;
      });
      return nextTransport;
    })().finally(() => {
      transportInitialization = undefined;
    });
  }
  return transportInitialization!;
}

export function getHubRuntimeAvailability() {
  return runtime.getAvailability();
}

async function providerAliases(): Promise<Record<string, ModelAliasTarget>> {
  await initializeHubRuntime();
  const availability = await runtime.getAvailability();
  const state = useHubStore.getState();
  const device = state.deviceProfile ?? await collectDeviceProfile();
  const effectiveDevice = {
    ...device,
    runtimeVersions: availability.available
      ? { ...device.runtimeVersions, 'llama.rn': availability.runtimeVersion }
      : device.runtimeVersions,
  };
  const ready = selectHubTextRecord(modelStore.registry, undefined, {
    runtimeAvailable: availability.available,
    runtimeVersion: availability.runtimeVersion,
    experimentalEnabled: state.experimentalEnabled,
    deviceProfile: effectiveDevice,
  });
  return {
    ...modelStore.registry.aliases,
    ...(ready ? {
      'modelcommons:auto': { modelId: ready.manifest.id },
      'modelcommons:best-text': { modelId: ready.manifest.id },
      'modelcommons:offline': { modelId: ready.manifest.id },
    } : {}),
  };
}

function providerBackend(): OpenAIBackend & AnthropicBackend {
  return {
    async listModels() {
      await initializeHubRuntime();
      const availability = await runtime.getAvailability();
      const models = createHubAvailableModels(modelStore.registry, {
        runtimeAvailable: availability.available,
        runtimeVersion: availability.runtimeVersion,
        experimentalEnabled: useHubStore.getState().experimentalEnabled,
      });
      return models.map((model) => {
        const record = modelStore.registry.models.find((candidate) =>
          candidate.manifest.id === model.manifest.id
          && candidate.manifest.revision === model.manifest.revision
          && candidate.manifest.storageId === model.manifest.storageId
        )!;
        return {
          id: model.manifest.id,
          createdAt: record.readyAt ?? record.installedAt ?? 0,
          capabilities: model.manifest.capabilities,
          state: model.state === 'READY' ? 'ready' as const : 'not_ready' as const,
          profileId: model.manifest.recommendedProfiles?.[0] ?? 'balanced',
          runtimeId: model.runtimeIds[0],
          features: {
            streaming: true,
            stopSequences: true,
            temperature: true,
            topP: true,
            // A manifest can describe model intent, but tool/template and grammar
            // support are only known after llama.rn has probed the loaded GGUF.
            // Provider discovery therefore stays conservative instead of claiming
            // guarantees based on catalog metadata alone.
            tools: false,
            strictTools: false,
            parallelTools: false,
            jsonObject: false,
            jsonSchema: false,
          },
        };
      });
    },
    async complete(request, options) {
      const hubTransport = await initializeHubRuntime();
      const client = await ModelCommons.connect({ transport: hubTransport });
      const session = await client.createSession({
        capabilities: request.model.capabilities,
        modelId: request.model.id,
        profile: request.model.profile,
      });
      let primaryError: unknown;
      try {
        return await session.generate(request, { signal: options.signal });
      } catch (error) {
        primaryError = error;
        throw error;
      } finally {
        try { await session.release(); }
        catch (releaseError) { if (!primaryError) throw releaseError; }
      }
    },
    async *stream(request, options) {
      const hubTransport = await initializeHubRuntime();
      const client = await ModelCommons.connect({ transport: hubTransport });
      const session = await client.createSession({
        capabilities: request.model.capabilities,
        modelId: request.model.id,
        profile: request.model.profile,
      });
      let primaryError: unknown;
      try {
        yield* session.stream(request, { signal: options.signal });
      } catch (error) {
        primaryError = error;
        throw error;
      } finally {
        try { await session.release(); }
        catch (releaseError) { if (!primaryError) throw releaseError; }
      }
    },
  };
}

export function createHubOpenAIFetch() {
  const backend = providerBackend();
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const fetch = createOpenAIProviderFetch({ backend, aliases: await providerAliases() });
    return fetch(input, init);
  };
}

export function createHubAnthropicFetch() {
  const backend = providerBackend();
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const fetch = createAnthropicProviderFetch({ backend, aliases: await providerAliases() });
    return fetch(input, init);
  };
}

export async function releaseHubRuntime(): Promise<void> {
  await runtime.release();
  runtime = createLlamaRnRuntime({ maxLoadedContexts: 1 });
  transport = undefined;
}

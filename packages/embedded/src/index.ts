import { InProcessTransport, type InProcessHost, type TransportSession } from '@modelcommons/client';
import { ModelCommonsError, PROTOCOL_VERSION, validateCanonicalRequest,
  type DeviceProfile, type ModelCommonsRequest, type RuntimeProfile } from '@modelcommons/protocol';
import { resolveRuntimeProfile } from '@modelcommons/device-profile';
import { createLlamaRnRuntime, type LlamaRnRuntime, type LlamaRnSession } from '@modelcommons/runtime-llama-rn';
import type { ModelResourceStore, ResourceLease } from '@modelcommons/model-store';
import type { ModelManifest } from '@modelcommons/protocol';

export interface EmbeddedOptions {
  modelStore: ModelResourceStore;
  deviceProvider: () => Promise<DeviceProfile>;
  runtimeFactory?: () => LlamaRnRuntime;
  policy: { maxContext: number; maxOutput: number };
  ownership: 'app-private' | 'shared-files';
  /** Opt-in GGUF metadata probe for an explicit synthetic diagnostic. */
  diagnosticModelInfo?: boolean;
  /** Fired after verified acquisition, even if later profile/init fails. No URI. */
  onResource?: (manifest: ModelManifest) => void;
  /** Metadata only; supplied by the application, never a global logger. */
  onLoad?: (value: { pending: boolean; modelId: string; profile: RuntimeProfile }) => Promise<void>;
}

export function createEmbeddedLocalAI(options: EmbeddedOptions) {
  const { maxContext, maxOutput } = options.policy;
  if (![maxContext, maxOutput].every((value) => Number.isSafeInteger(value) && value > 0)
    || maxOutput >= maxContext) throw new ModelCommonsError('PERMISSION_REQUIRED', 'Invalid local runtime ceilings.');
  let runtime: LlamaRnRuntime | undefined;
  let active: TransportSession | undefined;
  let loading: Promise<TransportSession> | undefined;
  let closed = false;
  let poisoned = false;
  let closeAttempt: Promise<void> | undefined;
  let orphanedLease: ResourceLease | undefined;
  let unresolvedStoreCleanup = false;
  const engine = () => runtime ??= (options.runtimeFactory ?? createLlamaRnRuntime)();
  const host: InProcessHost = {
    protocolVersion: PROTOCOL_VERSION,
    async listModels() {
      if (closed || poisoned) throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'Local backend is closed or awaiting cleanup.');
      const availability = await engine().getAvailability();
      return (await options.modelStore.list()).map((manifest) => ({
        manifest: { ...manifest, capabilities: manifest.capabilities.filter((capability) => capability === 'text') },
        state: 'READY' as const, runtimeIds: availability.available ? ['llama.rn'] : [],
      }));
    },
    async createSession(model, intent) {
      if (closed || poisoned || active || loading) throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'Local backend is busy or requires cleanup.');
      const job = (async (): Promise<TransportSession> => {
        const context = intent.minimumContext ?? Math.min(1024, maxContext);
        if (context > maxContext || context <= maxOutput || intent.capabilities.some((item) => item !== 'text')) {
          throw new ModelCommonsError('CAPABILITY_UNAVAILABLE', 'The request exceeds the local text policy.');
        }
        const profileId = intent.profile ?? 'safe';
        if (!['safe', 'balanced'].includes(profileId)) throw new ModelCommonsError('PERMISSION_REQUIRED', 'Only safe and balanced local profiles are permitted.');
        const availability = await engine().getAvailability();
        if (!availability.available) throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'The native text runtime is unavailable in this build.');
        const device = await options.deviceProvider();
        const resource = await options.modelStore.acquire(model.manifest.id).catch((error) => {
          if (error instanceof ModelCommonsError && error.details?.resourceCleanupFailed === true) {
            poisoned = true; unresolvedStoreCleanup = true;
          }
          throw error;
        });
        let session: LlamaRnSession;
        let handedToRuntime = false;
        let profile: RuntimeProfile;
        try {
          options.onResource?.(resource.manifest);
          if (resource.manifest.revision !== model.manifest.revision || resource.manifest.experimental) {
            throw new ModelCommonsError('MODEL_INCOMPATIBLE', 'Selected model revision is incompatible with this backend.');
          }
          const resolution = resolveRuntimeProfile({
            device: { ...device, runtimeVersions: { ...device.runtimeVersions, 'llama.rn': availability.runtimeVersion } },
            model: resource.manifest, requestedProfile: profileId, requestedContext: context, artifactInstalled: true,
          });
          if (['UNSUPPORTED', 'NOT_RECOMMENDED', 'EXPERIMENTAL'].includes(resolution.compatibility)) {
            throw new ModelCommonsError('INSUFFICIENT_MEMORY', 'Device profile rejected the selected model or context.');
          }
          profile = resolution.profile;
          await options.onLoad?.({ pending: true, modelId: resource.manifest.id, profile });
          if (closed) throw new ModelCommonsError('USER_CANCELLED', 'Backend changed before model initialization.');
          handedToRuntime = true;
          session = await engine().createSession({
            model: {
              id: resource.manifest.id,
              revision: resource.manifest.revision,
              uri: resource.lease.uri,
              lease: resource.lease,
              ...(resource.lease.resource ? { resource: resource.lease.resource } : {}),
            }, profile,
            enforceContextBudget: true,
            diagnosticModelInfo: options.diagnosticModelInfo === true,
          });
          await options.onLoad?.({ pending: false, modelId: resource.manifest.id, profile });
        } catch (error) {
          // Runtime owns the lease as soon as initialization is handed over.
          try {
            if (handedToRuntime) await engine().release();
            else {
              orphanedLease = resource.lease;
              await resource.lease.release();
              orphanedLease = undefined;
            }
          } catch { poisoned = true; }
          if (handedToRuntime) { poisoned = true; }
          throw error;
        }
        let released = false;
        let releaseAttempt: Promise<void> | undefined;
        function request(value: ModelCommonsRequest): ModelCommonsRequest {
          validateCanonicalRequest(value);
          if (value.tools?.length || (value.responseFormat && value.responseFormat.type !== 'text')
            || value.messages.some((message) => message.content.some((part) => part.type !== 'text'))
            || value.model.capabilities.some((item) => item !== 'text')) {
            throw new ModelCommonsError('FEATURE_UNSUPPORTED', 'This backend supports text only.');
          }
          const output = value.maxOutputTokens ?? maxOutput;
          if (output > maxOutput || output >= context) throw new ModelCommonsError('CAPABILITY_UNAVAILABLE', 'Output exceeds the configured ceiling.');
          return { ...value, maxOutputTokens: output };
        }
        const wrapper: TransportSession = {
          id: session.id, model: { ...model, manifest: resource.manifest, profileId: profile.id },
          generate: (value, settings) => session.complete(request(value), settings?.signal),
          stream: (value, settings) => session.stream(request(value), settings?.signal),
          cancel: () => session.cancel(),
          release() {
            if (released) return Promise.resolve();
            if (!releaseAttempt) releaseAttempt = session.release().then(() => {
              released = true; if (active === wrapper) active = undefined;
            }).catch((error) => { poisoned = true; throw error; }).finally(() => { releaseAttempt = undefined; });
            return releaseAttempt;
          },
        };
        active = wrapper;
        return wrapper;
      })();
      loading = job;
      try { return await job; } finally { if (loading === job) loading = undefined; }
    },
  };
  const transport = new InProcessTransport(host, {
    id: `embedded:${options.ownership}`,
    preference: options.ownership === 'app-private' ? 'local-runtime' : 'shared-file',
  });
  return {
    transport,
    async release() {
      closed = true;
      if (!closeAttempt) closeAttempt = (async () => {
        if (loading) { try { await loading; } catch { /* runtime cleanup below */ } }
        await active?.release();
        await runtime?.release();
        await orphanedLease?.release();
        orphanedLease = undefined;
        if (unresolvedStoreCleanup) throw new ModelCommonsError('STORAGE_UNAVAILABLE', 'Model resource cleanup remains unresolved; restart the application.');
      })().catch((error) => { poisoned = true; throw error; });
      return closeAttempt;
    },
  };
}

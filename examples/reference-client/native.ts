import {
  ModelCommonsError,
  PROTOCOL_VERSION,
  type DeviceProfile,
  type ModelManifest,
} from '@modelcommons/protocol';
import {
  InProcessTransport,
  ModelCommons,
  type InProcessHost,
  type ModelCommonsSession,
  type TransportSession,
} from '@modelcommons/client';
import { resolveRuntimeProfile } from '@modelcommons/device-profile';
import {
  createLlamaRnRuntime,
  type ModelResourceLease,
} from '@modelcommons/runtime-llama-rn';

export interface NativeReferenceInput {
  manifest: ModelManifest;
  /** Verified app-owned path/file URI, or the URI held by `lease`. */
  modelUri: string;
  /** Optional iOS security-scope lease. Do not release it separately. */
  lease?: ModelResourceLease;
  device: DeviceProfile;
  prompt: string;
  profileId?: 'safe' | 'balanced' | 'performance' | 'experimental-moe';
  confirmExperimental?: boolean;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  onText?: (delta: string) => void;
}

/**
 * Runs one text request through the canonical client and the optional llama.rn
 * adapter. Model download, license acceptance and integrity verification must
 * already have succeeded in the host store.
 */
export async function runNativeReference(input: NativeReferenceInput): Promise<string> {
  const runtime = createLlamaRnRuntime({ maxLoadedContexts: 1 });
  let session: ModelCommonsSession | undefined;
  let leaseHandedToRuntime = false;

  try {
    const availability = await runtime.getAvailability();
    if (!availability.available) {
      throw new ModelCommonsError(
        'RUNTIME_UNAVAILABLE',
        `llama.rn ${availability.runtimeVersion} is unavailable: ${availability.reason ?? 'unknown reason'}.`
      );
    }

    const device: DeviceProfile = {
      ...input.device,
      // Report a runtime version only after the optional peer/native binding
      // has actually passed its availability probe.
      runtimeVersions: {
        ...input.device.runtimeVersions,
        [availability.runtimeId]: availability.runtimeVersion,
      },
    };
    const resolution = resolveRuntimeProfile({
      device,
      model: input.manifest,
      requestedProfile: input.profileId ?? 'safe',
      artifactInstalled: true,
    });
    if (resolution.compatibility === 'UNSUPPORTED' || resolution.compatibility === 'NOT_RECOMMENDED') {
      throw new ModelCommonsError('MODEL_INCOMPATIBLE', resolution.reasons.join(' '), {
        details: { compatibility: resolution.compatibility },
      });
    }
    if (resolution.compatibility === 'EXPERIMENTAL' && !input.confirmExperimental) {
      throw new ModelCommonsError('PERMISSION_REQUIRED', 'This runtime profile requires explicit experimental confirmation.');
    }
    const profile = resolution.profile;

    const host: InProcessHost = {
      protocolVersion: PROTOCOL_VERSION,
      async listModels() {
        return [{
          manifest: input.manifest,
          state: 'READY',
          runtimeIds: [availability.runtimeId],
        }];
      },
      async createSession(resolved): Promise<TransportSession> {
        // From this point the runtime owns cleanup on both initialization
        // success and failure.
        leaseHandedToRuntime = input.lease !== undefined;
        const nativeSession = await runtime.createSession({
          model: {
            id: input.manifest.id,
            revision: input.manifest.revision,
            uri: input.modelUri,
            ...(input.lease ? { lease: input.lease } : {}),
          },
          profile,
        });
        return {
          id: nativeSession.id,
          model: resolved,
          generate(request, options) {
            return nativeSession.complete(request, options?.signal);
          },
          stream(request, options) {
            return nativeSession.stream(request, options?.signal);
          },
          cancel() {
            return nativeSession.cancel();
          },
          release() {
            return nativeSession.release();
          },
        };
      },
    };

    const client = await ModelCommons.connect({
      transport: new InProcessTransport(host),
    });
    session = await client.createSession({
      modelId: input.manifest.id,
      capabilities: ['text'],
      profile: profile.id,
    });

    let text = '';
    let completed = false;
    for await (const event of session.stream({
      messages: [{
        role: 'user',
        content: [{ type: 'text', text: input.prompt }],
      }],
      maxOutputTokens: input.maxOutputTokens ?? 256,
      responseFormat: { type: 'text' },
    }, { signal: input.signal })) {
      if (event.type === 'text.delta') {
        text += event.delta;
        input.onText?.(event.delta);
      } else if (event.type === 'response.completed') {
        completed = true;
        if (event.response.stopReason === 'cancelled') {
          throw new ModelCommonsError('USER_CANCELLED', 'Local generation was cancelled.');
        }
        if (event.response.stopReason === 'error') {
          throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'Local generation ended with an error.');
        }
      } else if (event.type === 'response.failed') {
        throw new ModelCommonsError(event.error.code, event.error.message, {
          retryable: event.error.retryable,
          details: event.error.details,
        });
      }
    }
    if (!completed) {
      throw new ModelCommonsError(
        'RUNTIME_INITIALIZATION_FAILED',
        'Local generation ended without a successful terminal response.'
      );
    }
    return text;
  } finally {
    try {
      await session?.release();
    } finally {
      try {
        await runtime.release();
      } finally {
        // Availability/profile failures occur before createSession transfers
        // ownership of a pre-acquired security-scope lease.
        if (input.lease && !leaseHandedToRuntime) await input.lease.release();
      }
    }
  }
}

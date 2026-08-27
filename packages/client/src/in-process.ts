import {
  PROTOCOL_VERSION,
  ModelCommonsError,
  isProtocolVersionCompatible,
  type ModelAliasTarget,
  type ModelSelection,
  type TransportPreference,
} from '@modelcommons/protocol';
import { selectCompatibleModel } from './selection';
import type {
  AvailableModel,
  ModelCommonsAvailability,
  ModelResolutionRequirements,
  ModelCommonsTransport,
  ResolvedModel,
  SessionIntent,
  TransportSession,
} from './types';

export interface InProcessHost {
  protocolVersion: string;
  listModels(): Promise<AvailableModel[]>;
  createSession(model: ResolvedModel, intent: SessionIntent): Promise<TransportSession>;
}

export interface InProcessTransportOptions {
  id?: string;
  aliases?: Record<string, ModelAliasTarget>;
  preference?: TransportPreference;
}

function snapshotAliases(aliases: Record<string, ModelAliasTarget>): Record<string, ModelAliasTarget> {
  const snapshot = Object.create(null) as Record<string, ModelAliasTarget>;
  for (const [alias, target] of Object.entries(aliases)) {
    if (alias === '__proto__' || alias === 'prototype' || alias === 'constructor') {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'Transport aliases contain a reserved key.');
    }
    const ownsModelId = !!target && Object.prototype.hasOwnProperty.call(target, 'modelId');
    const ownsProfile = !!target && Object.prototype.hasOwnProperty.call(target, 'profile');
    const modelId = ownsModelId ? target.modelId : undefined;
    const profile = ownsProfile ? target.profile : undefined;
    if (!alias.trim() || typeof modelId !== 'string' || !modelId.trim()) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'Transport aliases must map non-empty names to model IDs.');
    }
    if (profile !== undefined && (typeof profile !== 'string' || !profile.trim())) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'Transport alias profiles must be non-empty strings.');
    }
    snapshot[alias] = Object.freeze({
      modelId,
      ...(profile === undefined ? {} : { profile }),
    });
  }
  return Object.freeze(snapshot) as Record<string, ModelAliasTarget>;
}

export class InProcessTransport implements ModelCommonsTransport {
  readonly id: string;
  readonly preference: TransportPreference;
  readonly #host: InProcessHost;
  readonly #aliases: Record<string, ModelAliasTarget>;

  constructor(host: InProcessHost, options: InProcessTransportOptions = {}) {
    this.#host = host;
    this.id = options.id ?? 'in-process';
    this.preference = options.preference ?? 'local-runtime';
    this.#aliases = snapshotAliases(options.aliases ?? {});
  }

  async getAvailability(): Promise<ModelCommonsAvailability> {
    if (!isProtocolVersionCompatible(this.#host.protocolVersion, PROTOCOL_VERSION)) {
      return {
        state: 'TRANSPORT_UNAVAILABLE',
        transportId: this.id,
        transportPreference: this.preference,
        protocolVersion: this.#host.protocolVersion,
        message: 'The in-process host uses an incompatible ModelCommons protocol version.',
      };
    }
    return {
      state: 'AVAILABLE',
      transportId: this.id,
      transportPreference: this.preference,
      protocolVersion: this.#host.protocolVersion,
    };
  }

  async listModels(): Promise<AvailableModel[]> {
    await this.#assertProtocolAvailable();
    return this.#host.listModels();
  }

  async resolve(
    selection: ModelSelection,
    requirements: ModelResolutionRequirements = {}
  ): Promise<ResolvedModel> {
    const result = selectCompatibleModel(await this.listModels(), selection, this.#aliases, requirements);
    return {
      manifest: result.model.manifest,
      runtimeId: result.runtimeId,
      profileId: result.profileId,
      alias: result.alias,
    };
  }

  async createSession(model: ResolvedModel, intent: SessionIntent): Promise<TransportSession> {
    await this.#assertProtocolAvailable();
    return this.#host.createSession(model, intent);
  }

  async #assertProtocolAvailable(): Promise<void> {
    const availability = await this.getAvailability();
    if (availability.state !== 'AVAILABLE') {
      throw new ModelCommonsError(
        'PROTOCOL_VERSION_UNSUPPORTED',
        availability.message ?? 'The in-process host protocol version is unsupported.',
        {
          details: {
            offeredProtocolVersion: this.#host.protocolVersion,
            requiredProtocolVersion: PROTOCOL_VERSION,
          },
        }
      );
    }
  }
}

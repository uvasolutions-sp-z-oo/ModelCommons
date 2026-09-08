import {
  ModelCommonsError,
  type ModelAliasTarget,
  type ModelCapability,
  type ModelManifest,
  type ModelSelection,
} from '@modelcommons/protocol';
import type { AvailableModel, ModelResolutionRequirements } from './types';

export interface SelectionResult {
  model: AvailableModel;
  runtimeId: string;
  profileId: string;
  alias?: string;
}

function supportsAll(have: ModelCapability[], required: ModelCapability[]): boolean {
  return required.every((capability) => have.includes(capability));
}

function supportedContext(manifest: ModelManifest): number {
  return manifest.context.maximum ?? manifest.context.trained ?? manifest.context.recommended;
}

function matchingRuntime(
  model: AvailableModel,
  allowedRuntimeIds: readonly string[] | undefined
): string | undefined {
  if (allowedRuntimeIds === undefined) return model.runtimeIds[0];
  return model.runtimeIds.find((runtimeId) => allowedRuntimeIds.includes(runtimeId));
}

function resolveRequestedId(
  requestedId: string | undefined,
  aliases: Record<string, ModelAliasTarget>
): { id?: string; profile?: string; alias?: string } {
  if (!requestedId) {
    return {};
  }

  const target = Object.prototype.hasOwnProperty.call(aliases, requestedId)
    ? aliases[requestedId]
    : undefined;
  if (target) {
    return { id: target.modelId, profile: target.profile, alias: requestedId };
  }

  return { id: requestedId };
}

/**
 * Deterministic, provider-neutral model resolution. Aliases are exact and
 * opt-in; no provider-branded names are installed by this function.
 */
export function selectCompatibleModel(
  models: AvailableModel[],
  selection: ModelSelection,
  aliases: Record<string, ModelAliasTarget> = {},
  requirements: ModelResolutionRequirements = {}
): SelectionResult {
  const requested = resolveRequestedId(selection.id, aliases);
  const ready = models.filter((entry) => entry.state === 'READY');
  const candidates = requested.id
    ? ready.filter((entry) => entry.manifest.id === requested.id)
    : ready;

  if (requested.id && candidates.length === 0) {
    const exists = models.some((entry) => entry.manifest.id === requested.id);
    throw new ModelCommonsError(exists ? 'MODEL_NOT_READY' : 'MODEL_NOT_FOUND',
      exists ? 'The selected model is not ready.' : 'The selected model is not installed.', {
        details: { modelId: requested.id },
      });
  }

  if (candidates.length === 0) {
    throw new ModelCommonsError('MODEL_NOT_READY', 'No installed model is ready for selection.');
  }

  const capabilityCompatible = candidates
    .filter((entry) => supportsAll(entry.manifest.capabilities, selection.capabilities));
  if (capabilityCompatible.length === 0) {
    throw new ModelCommonsError('CAPABILITY_UNAVAILABLE', 'No ready model satisfies the requested capabilities.', {
      details: { capabilities: selection.capabilities, modelId: requested.id },
    });
  }

  const formatCompatible = requirements.formats === undefined
    ? capabilityCompatible
    : capabilityCompatible.filter((entry) => requirements.formats!.includes(entry.manifest.format));
  if (formatCompatible.length === 0) {
    throw new ModelCommonsError('MODEL_INCOMPATIBLE', 'No ready model uses an allowed artifact format.', {
      details: { formats: requirements.formats, modelId: requested.id },
    });
  }

  const contextCompatible = requirements.minimumContext === undefined
    ? formatCompatible
    : formatCompatible.filter((entry) => supportedContext(entry.manifest) >= requirements.minimumContext!);
  if (contextCompatible.length === 0) {
    throw new ModelCommonsError('MODEL_INCOMPATIBLE', 'No ready model provides the required context capacity.', {
      details: { minimumContext: requirements.minimumContext, modelId: requested.id },
    });
  }

  const runtimeCompatible = contextCompatible
    .filter((entry) => matchingRuntime(entry, requirements.runtimeIds) !== undefined)
    .sort((a, b) => {
      const experimentalOrder = Number(a.manifest.experimental === true) - Number(b.manifest.experimental === true);
      if (experimentalOrder !== 0) return experimentalOrder;
      const aBytes = a.manifest.memory?.fileBytes ?? Number.MAX_SAFE_INTEGER;
      const bBytes = b.manifest.memory?.fileBytes ?? Number.MAX_SAFE_INTEGER;
      if (aBytes !== bBytes) return aBytes - bBytes;
      return a.manifest.id.localeCompare(b.manifest.id);
    });

  const model = runtimeCompatible[0];
  if (!model) {
    throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'No allowed runtime is available for a compatible model.', {
      details: { runtimeIds: requirements.runtimeIds, modelId: requested.id },
    });
  }

  const runtimeId = matchingRuntime(model, requirements.runtimeIds);
  if (!runtimeId) {
    // The filter above makes this unreachable, but keep the public contract
    // fail-closed if a caller mutates its model list concurrently.
    throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'The selected model has no available runtime.');
  }

  return {
    model,
    runtimeId,
    profileId: selection.profile ?? requested.profile ?? model.manifest.recommendedProfiles?.[0] ?? 'balanced',
    alias: requested.alias,
  };
}

import { selectCompatibleModel, type AvailableModel } from '@modelcommons/client';
import {
  ModelCommonsError,
  type DeviceProfile,
  type ModelManifest,
  type ModelRegistry,
  type ModelRegistryRecord,
} from '@modelcommons/protocol';
import { isRuntimeVersionAtLeast, resolveRuntimeProfile } from '@modelcommons/device-profile';

export interface HubExecutionPolicy {
  runtimeAvailable: boolean;
  runtimeVersion?: string;
  experimentalEnabled: boolean;
  deviceProfile?: DeviceProfile;
  profileId?: string;
  context?: number;
}

export function isRegistryLicenseAccepted(
  registry: ModelRegistry,
  manifest: ModelManifest
): boolean {
  return !manifest.license.acceptanceRequired || registry.licenseAcceptances.some(
    (entry) => entry.modelId === manifest.id
      && entry.modelRevision === manifest.revision
      && entry.licenseId === manifest.license.id
      && entry.licenseUrl === manifest.license.url
  );
}

function supportsAvailableLlamaRuntime(
  manifest: ModelManifest,
  policy: Pick<HubExecutionPolicy, 'runtimeAvailable' | 'runtimeVersion'>
): boolean {
  if (!policy.runtimeAvailable || !policy.runtimeVersion) return false;
  const requirement = manifest.compatibleRuntimes.find((runtime) => runtime.id === 'llama.rn');
  if (!requirement) return false;
  return !requirement.minimumVersion
    || isRuntimeVersionAtLeast(policy.runtimeVersion, requirement.minimumVersion);
}

export function createHubAvailableModels(
  registry: ModelRegistry,
  policy: Pick<HubExecutionPolicy, 'runtimeAvailable' | 'runtimeVersion' | 'experimentalEnabled'>
): AvailableModel[] {
  return registry.models.map((record) => {
    const runtimeSupported = supportsAvailableLlamaRuntime(record.manifest, policy);
    return {
      manifest: {
        ...record.manifest,
        // This adapter currently initializes text-only GGUF contexts. Catalog
        // metadata remains intact in the registry and Models UI.
        capabilities: record.manifest.capabilities.filter((capability) => capability === 'text'),
      },
      state: record.state === 'READY'
        && isRegistryLicenseAccepted(registry, record.manifest)
        && runtimeSupported
        && (!record.manifest.experimental || policy.experimentalEnabled)
        ? 'READY'
        : 'NOT_READY',
      runtimeIds: runtimeSupported ? ['llama.rn'] : [],
    };
  });
}

function executionEligible(record: ModelRegistryRecord, registry: ModelRegistry, policy: HubExecutionPolicy): boolean {
  if (
    record.state !== 'READY'
    || !record.manifest.capabilities.includes('text')
    || !isRegistryLicenseAccepted(registry, record.manifest)
    || (record.manifest.experimental && !policy.experimentalEnabled)
    || !supportsAvailableLlamaRuntime(record.manifest, policy)
  ) return false;

  if (!policy.deviceProfile) return true;
  try {
    const resolution = resolveRuntimeProfile({
      device: policy.deviceProfile,
      model: record.manifest,
      requestedProfile: policy.profileId,
      requestedContext: policy.context,
      artifactInstalled: true,
    });
    if (resolution.compatibility === 'EXPERIMENTAL' && !policy.experimentalEnabled) return false;
    return resolution.compatibility !== 'UNSUPPORTED'
      && resolution.compatibility !== 'NOT_RECOMMENDED';
  } catch {
    return false;
  }
}

/** Resolves generic IDs with the same deterministic ordering as the client SDK. */
export function selectHubTextRecord(
  registry: ModelRegistry,
  requestedId: string | undefined,
  policy: HubExecutionPolicy
): ModelRegistryRecord | undefined {
  const eligibleIds = new Set(
    registry.models
      .filter((record) => executionEligible(record, registry, policy))
      .map((record) => `${record.manifest.id}\u0000${record.manifest.revision}\u0000${record.manifest.storageId}`)
  );
  const models = createHubAvailableModels(registry, policy).map((model) => ({
    ...model,
    state: eligibleIds.has(`${model.manifest.id}\u0000${model.manifest.revision}\u0000${model.manifest.storageId}`)
      ? 'READY' as const
      : 'NOT_READY' as const,
  }));

  try {
    const selected = selectCompatibleModel(models, {
      id: requestedId,
      capabilities: ['text'],
      profile: policy.profileId,
    }, registry.aliases);
    return registry.models.find((record) =>
      record.manifest.id === selected.model.manifest.id
      && record.manifest.revision === selected.model.manifest.revision
      && record.manifest.storageId === selected.model.manifest.storageId
    );
  } catch (error) {
    if (error instanceof ModelCommonsError) return undefined;
    throw error;
  }
}

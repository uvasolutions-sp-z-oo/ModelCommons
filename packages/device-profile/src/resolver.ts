import {
  ModelCommonsError,
  type DeviceCompatibility,
  type DeviceProfile,
  type ModelManifest,
  type ProfileResolution,
  type RuntimeProfile,
} from '@modelcommons/protocol';
import { createRuntimeProfiles } from './profiles';

const GIB = 1024 ** 3;
const DOWNLOAD_SAFETY_BYTES = 512 * 1024 ** 2;

export interface ResolveProfileInput {
  device: DeviceProfile;
  model: ModelManifest;
  requestedProfile?: string;
  requestedContext?: number;
  /** True once immutable artifacts are already present and verified. */
  artifactInstalled?: boolean;
}

const ORDER: Record<DeviceCompatibility, number> = {
  SUPPORTED: 0,
  SUPPORTED_WITH_WARNING: 1,
  EXPERIMENTAL: 2,
  NOT_RECOMMENDED: 3,
  UNSUPPORTED: 4,
};

function worsen(current: DeviceCompatibility, next: DeviceCompatibility): DeviceCompatibility {
  return ORDER[next] > ORDER[current] ? next : current;
}

function findProfile(profiles: RuntimeProfile[], id: string): RuntimeProfile {
  const profile = profiles.find((candidate) => candidate.id === id);
  if (!profile) {
    throw new ModelCommonsError('MODEL_INCOMPATIBLE', `Unknown runtime profile: ${id}.`, {
      details: { profileId: id },
    });
  }
  return profile;
}

function parseVersion(value: string): [number, number, number] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
  if (!match) return undefined;
  const version = [Number(match[1]), Number(match[2]), Number(match[3])] as const;
  return version.every(Number.isSafeInteger) ? [...version] as [number, number, number] : undefined;
}

export function isRuntimeVersionAtLeast(offered: string, minimum: string): boolean {
  const left = parseVersion(offered);
  const right = parseVersion(minimum);
  if (!left || !right) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index];
  }
  return true;
}

export function resolveRuntimeProfile(input: ResolveProfileInput): ProfileResolution {
  const { device, model } = input;
  const profiles = createRuntimeProfiles(device, model);
  let requested = input.requestedProfile ?? model.recommendedProfiles?.[0] ?? 'balanced';
  if (model.architecture.type === 'moe' && !input.requestedProfile) requested = 'experimental-moe';
  let profile = findProfile(profiles, requested);
  const reasons: string[] = [];
  let compatibility: DeviceCompatibility = 'SUPPORTED';

  const runtimeRequirement = model.compatibleRuntimes.find((runtime) => runtime.id === 'llama.rn');
  const runtimeVersion = device.runtimeVersions['llama.rn'];
  if (!runtimeRequirement) {
    compatibility = 'UNSUPPORTED';
    reasons.push('The manifest does not declare compatibility with the llama.rn runtime.');
  } else if (!runtimeVersion) {
    compatibility = 'UNSUPPORTED';
    reasons.push('The llama.rn runtime is not available on this device.');
  } else if (
    runtimeRequirement.minimumVersion
    && !isRuntimeVersionAtLeast(runtimeVersion, runtimeRequirement.minimumVersion)
  ) {
    compatibility = 'UNSUPPORTED';
    reasons.push(`llama.rn ${runtimeVersion} is below the manifest minimum ${runtimeRequirement.minimumVersion}.`);
  }

  if (
    input.requestedContext !== undefined
    && (!Number.isSafeInteger(input.requestedContext) || input.requestedContext <= 0)
  ) {
    throw new ModelCommonsError('MODEL_INCOMPATIBLE', 'Requested context must be a positive safe integer.', {
      details: { requestedContext: input.requestedContext },
    });
  }
  let context = input.requestedContext ?? profile.llama.nCtx;
  if (model.context.maximum !== undefined && context > model.context.maximum) {
    compatibility = 'UNSUPPORTED';
    reasons.push(`Requested context ${context} exceeds the manifest maximum ${model.context.maximum}.`);
  } else if (context > model.context.recommended) {
    compatibility = worsen(compatibility, 'SUPPORTED_WITH_WARNING');
    reasons.push('The requested context exceeds the model recommendation and increases KV-cache memory.');
  }

  const physical = device.physicalMemoryBytes;
  const available = device.availableMemoryBytes;
  const minimum = model.memory?.estimatedMinimumRamBytes;
  const recommended = model.memory?.recommendedRamBytes;

  if (minimum !== undefined && physical !== undefined && physical < minimum) {
    compatibility = 'UNSUPPORTED';
    reasons.push('Physical memory is below the model manifest minimum.');
  }
  if (minimum !== undefined && available !== undefined && available < minimum) {
    compatibility = worsen(compatibility, 'NOT_RECOMMENDED');
    reasons.push('Currently available memory is below the estimated minimum; close other apps or use a smaller model.');
  }
  if (recommended !== undefined && physical !== undefined && physical < recommended) {
    compatibility = worsen(compatibility, 'SUPPORTED_WITH_WARNING');
    reasons.push('Physical memory is below the model recommendation.');
  }
  if (available === undefined) {
    compatibility = worsen(compatibility, 'SUPPORTED_WITH_WARNING');
    reasons.push('Available memory could not be measured; physical memory is not treated as free memory.');
  }

  const fileBytes = model.memory?.fileBytes;
  if (
    !input.artifactInstalled
    &&
    fileBytes !== undefined
    && device.freeDiskBytes !== undefined
    && device.freeDiskBytes < fileBytes + DOWNLOAD_SAFETY_BYTES
  ) {
    compatibility = 'UNSUPPORTED';
    reasons.push('Free disk space is below the artifact size plus the publication safety margin.');
  }

  const priorOomFailures = device.previousFailures?.filter(
    (failure) => failure.modelId === model.id && /oom|memory/i.test(failure.category)
  ) ?? [];
  if (priorOomFailures.length) {
    if (!input.requestedProfile) {
      profile = findProfile(profiles, 'safe');
      if (input.requestedContext === undefined) context = profile.llama.nCtx;
    }
    if (profile.id === 'safe') {
      compatibility = worsen(compatibility, 'SUPPORTED_WITH_WARNING');
      reasons.push('A previous memory-related load failure was recorded; Safe is selected for a cautious user-initiated retry.');
    } else if (priorOomFailures.some((failure) => failure.profileId === profile.id)) {
      compatibility = worsen(compatibility, 'NOT_RECOMMENDED');
      reasons.push('This profile previously failed with a memory-related error; choose Safe before retrying.');
    } else {
      compatibility = worsen(compatibility, 'SUPPORTED_WITH_WARNING');
      reasons.push('Another profile previously failed with a memory-related error; monitor this retry or choose Safe.');
    }
  }

  if (profile.stability === 'experimental' || model.experimental) {
    compatibility = worsen(compatibility, 'EXPERIMENTAL');
    reasons.push('This model or runtime profile is explicitly experimental and requires confirmation.');
  }

  if (model.architecture.type === 'moe') {
    if (physical !== undefined && physical < 24 * GIB) {
      compatibility = worsen(compatibility, 'NOT_RECOMMENDED');
      reasons.push('This large sparse MoE experiment is not recommended below 24 GiB physical memory.');
    }
    reasons.push('mmap reduces copies but resident model pages and KV cache still consume physical memory.');
  }

  if (reasons.length === 0) reasons.push('No obvious manifest, memory, disk, or prior-failure risk was detected.');

  return {
    compatibility,
    profile: {
      ...profile,
      llama: {
        ...profile.llama,
        nCtx: context,
        nBatch: Math.min(profile.llama.nBatch, context),
        nUbatch: Math.min(profile.llama.nUbatch, profile.llama.nBatch, context),
      },
    },
    reasons,
    model: {
      id: model.id,
      revision: model.revision,
      architecture: model.architecture,
    },
  };
}

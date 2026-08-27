import type { ModelManifest } from './model';

export type RuntimeAvailability = 'AVAILABLE' | 'UNAVAILABLE' | 'NOT_IMPLEMENTED' | 'UNSUPPORTED_PLATFORM';
export type DeviceCompatibility =
  | 'SUPPORTED'
  | 'SUPPORTED_WITH_WARNING'
  | 'EXPERIMENTAL'
  | 'NOT_RECOMMENDED'
  | 'UNSUPPORTED';

export interface DeviceProfile {
  schema: 'modelcommons.device-profile';
  schemaVersion: 1;
  protocolVersion: string;
  platform: 'android' | 'ios' | 'web' | 'windows' | 'macos' | 'linux' | 'unknown';
  osVersion?: string;
  physicalMemoryBytes?: number;
  availableMemoryBytes?: number;
  freeDiskBytes?: number;
  accelerators: Array<{
    id: string;
    kind: 'cpu' | 'gpu' | 'npu' | 'unknown';
    name?: string;
    memoryBytes?: number;
  }>;
  runtimeVersions: Record<string, string>;
  previousFailures?: Array<{
    modelId: string;
    profileId: string;
    category: string;
    occurredAt: number;
  }>;
  collectedAt: number;
}

export interface LlamaRuntimeOptions {
  nCtx: number;
  nBatch: number;
  nUbatch: number;
  nGpuLayers: number;
  nCpuMoe?: number;
  useMmap: boolean;
  useMlock: boolean;
  cacheTypeK: 'f16' | 'q8_0' | 'q4_0';
  cacheTypeV: 'f16' | 'q8_0' | 'q4_0';
  noExtraBuffers?: boolean;
  devices?: string[];
}

export interface RuntimeProfile {
  schema: 'modelcommons.runtime-profile';
  schemaVersion: 1;
  protocolVersion: string;
  id: 'safe' | 'balanced' | 'performance' | 'experimental-moe' | string;
  displayName: string;
  stability: 'stable' | 'experimental';
  llama: LlamaRuntimeOptions;
}

export interface ProfileResolution {
  compatibility: DeviceCompatibility;
  profile: RuntimeProfile;
  reasons: string[];
  model: Pick<ModelManifest, 'id' | 'revision' | 'architecture'>;
}

export interface DeviceBenchmark {
  schema: 'modelcommons.benchmark';
  schemaVersion: 1;
  protocolVersion: string;
  modelId: string;
  modelRevision: string;
  profileId: string;
  initialization: {
    succeeded: boolean;
    milliseconds: number;
    failureCategory?: string;
  };
  promptTokensPerSecond?: number;
  generationTokensPerSecond?: number;
  context: number;
  batch: number;
  ubatch: number;
  gpuLayers: number;
  cpuMoeLayers?: number;
  accelerator?: string;
  runtimeVersion: string;
  cancelled?: boolean;
  recordedAt: number;
}

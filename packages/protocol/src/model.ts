import type { ModelCapability } from './inference';

export type ModelArchitecture =
  | {
      type: 'dense';
      parametersBillions?: number;
    }
  | {
      type: 'moe';
      parametersBillions: {
        total: number;
        activeApprox: number;
      };
      experts?: {
        count: number;
        activePerToken: number;
      };
    };

export interface ArtifactIntegrity {
  algorithm: 'sha256';
  digest: string;
}

export interface ModelArtifactFile {
  role: 'model' | 'mmproj' | 'tokenizer' | 'license' | 'model-card' | 'other';
  path: string;
  required: boolean;
  sizeBytes?: number;
  download?: {
    url: string;
  };
  integrity?: ArtifactIntegrity;
}

export interface ModelLicense {
  id: string;
  name?: string;
  url: string;
  acceptanceRequired: boolean;
  gated: boolean;
  redistribution?: 'allowed' | 'restricted' | 'unknown';
}

export interface ModelManifest {
  schema: 'modelcommons.model-manifest';
  schemaVersion: 1;
  protocolVersion: string;
  id: string;
  revision: string;
  storageId: string;
  displayName: string;
  family: string;
  architecture: ModelArchitecture;
  format: 'gguf';
  quantization?: string;
  files: ModelArtifactFile[];
  source: {
    provider: 'huggingface' | 'url' | 'user';
    repository?: string;
    revision?: string;
    modelCardUrl?: string;
  };
  license: ModelLicense;
  capabilities: ModelCapability[];
  compatibleRuntimes: Array<{
    id: string;
    minimumVersion?: string;
  }>;
  context: {
    recommended: number;
    trained?: number;
    maximum?: number;
  };
  memory?: {
    fileBytes?: number;
    estimatedMinimumRamBytes?: number;
    recommendedRamBytes?: number;
    notes?: string[];
  };
  recommendedProfiles?: string[];
  experimental?: boolean;
}

export type ModelLifecycleState =
  | 'NOT_INSTALLED'
  | 'DOWNLOADING'
  | 'VERIFYING'
  | 'READY'
  | 'FAILED';

export interface ModelRegistryRecord {
  manifest: ModelManifest;
  state: ModelLifecycleState;
  relativeManifestPath?: string;
  installedAt?: number;
  readyAt?: number;
  failureCode?: string;
}

export interface ModelAliasTarget {
  modelId: string;
  profile?: string;
}

export interface LicenseAcceptance {
  modelId: string;
  modelRevision: string;
  licenseId: string;
  licenseUrl: string;
  acceptedAt: number;
}

export interface ModelRegistry {
  schema: 'modelcommons.registry';
  schemaVersion: 1;
  protocolVersion: string;
  revision: number;
  updatedAt: number;
  models: ModelRegistryRecord[];
  aliases: Record<string, ModelAliasTarget>;
  licenseAcceptances: LicenseAcceptance[];
}

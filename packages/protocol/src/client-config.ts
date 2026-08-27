import type { ModelAliasTarget } from './model';
import type { ModelCapability } from './inference';

export type TransportPreference =
  | 'hub-service'
  | 'app-group'
  | 'shared-file'
  | 'local-runtime'
  | 'system';

export interface ClientConfiguration {
  schema: 'modelcommons.client-config';
  schemaVersion: 1;
  protocolVersion: string;
  client: {
    id: string;
    displayName: string;
  };
  requirements: {
    capabilities: ModelCapability[];
    formats?: string[];
    runtimes?: string[];
    minimumContext?: number;
  };
  selection: {
    preferredModelId?: string;
    fallback: 'best-compatible' | 'unavailable';
  };
  aliases: Record<string, ModelAliasTarget>;
  inference: {
    profile: string;
    context?: number;
    maxOutput?: number;
  };
  access: {
    transports: TransportPreference[];
  };
}

export interface AuthorizedClient {
  id: string;
  displayName: string;
  platformPackageIds: string[];
  requestedCapabilities: ModelCapability[];
  authorizedAt: number;
  revokedAt?: number;
  /** Opaque-to-core platform binding used to perform exact, revocable authorization. */
  platformAuthorization?:
    | {
        platform: 'android';
        userId: number;
        certificateSha256: string;
        scopes: Array<'metadata' | 'inference'>;
      }
    | {
        platform: 'ios';
        connectionId: string;
        kind: 'security-scoped' | 'app-group';
      };
}

export type NativePlatform = 'android' | 'ios' | 'web' | 'unknown';

export interface NativeAvailability {
  available: boolean;
  platform: NativePlatform;
  androidHubConnected: boolean;
  androidSharedModels?: boolean;
  iosSharedModels: boolean;
  reason?: 'NATIVE_MODULE_MISSING' | 'UNSUPPORTED_PLATFORM';
}

export interface NativeDeviceProfile {
  physicalMemoryBytes?: number;
  availableMemoryBytes?: number;
  osVersion?: string;
  accelerators?: Array<{
    id: string;
    kind: 'cpu';
    name?: string;
  }>;
}

export interface SharedDirectoryConnection {
  id: string;
  kind: 'security-scoped' | 'app-group' | 'android-shared-files';
  displayName: string;
  groupIdentifier?: string;
}

export interface NativeLeaseDescriptor {
  id: string;
  connectionId: string;
  uri: string;
  resourceKind?: 'android-file-descriptor';
  coordinationVersion?: number;
}

export interface NativeRuntimeDescriptor {
  kind: 'android-file-descriptor';
  descriptor: number;
  descriptorVersion: 2;
  /** Canonical decimal native identity, kept as strings to preserve 64-bit values. */
  device: string;
  inode: string;
  size: string;
}

export interface AndroidServiceInfo {
  protocolVersion: string;
  apiVersion: number;
  centralizedInference: boolean;
  runtimeState: 'RUNTIME_NOT_READY' | 'READY';
  maxRequestBytes: number;
  maxEventBytes: number;
  runtimeId: string;
  runtimeVersion: string;
  sourceIdentity: string;
  contextSize: number;
  maxOutputTokens: number;
}

export interface AndroidModelDescriptor {
  manifestJson: string;
  id: string;
  revision: string;
  displayName: string;
  state: string;
  capabilities: string[];
}

export interface AndroidModelPage {
  models: AndroidModelDescriptor[];
  nextCursor?: string;
}

export interface AndroidOperationResult {
  ok: boolean;
  code?: string;
  message?: string;
}

export interface AndroidSessionResult extends AndroidOperationResult {
  sessionId?: string;
}

export interface AndroidStreamEvent {
  localFailure?: boolean;
  sessionId: string;
  requestId: string;
  sequence: number;
  eventJson: string;
}

export interface PendingAndroidClient {
  packageName: string;
  userId: number;
  certificateSha256: string[];
  lastSeenAt: number;
}

export interface AndroidHubModelSnapshot {
  id: string;
  revision: string;
  displayName: string;
  state: string;
  capabilities: string[];
}

export interface ModelCommonsNativeModuleShape {
  ownerAppGroupRoot?(): Promise<string>;
  privateModelEvidence?(): Promise<{ downloadAttempts: number; importAttempts: number; artifactCount: number; artifactBytes: number }>;
  privateModelOperation?(operation: string, path: string, value: string): Promise<unknown>;
  downloadPrivateModel?(id: string, source: string, path: string, expected: number, origins: string[]): Promise<void>;
  importPrivateModel?(id: string, path: string, expected: number): Promise<void>;
  getAvailability(): Promise<NativeAvailability>;
  getDeviceProfile(): Promise<NativeDeviceProfile>;
  atomicReplaceFile(stagedUri: string, destinationUri: string): Promise<void>;

  connectSharedDirectory?(): Promise<SharedDirectoryConnection>;
  connectAppGroup?(groupIdentifier: string): Promise<SharedDirectoryConnection>;
  listSharedConnections?(): Promise<SharedDirectoryConnection[]>;
  disconnectSharedDirectory?(connectionId: string): Promise<void>;
  acquireModelLease?(connectionId: string, relativePath: string): Promise<NativeLeaseDescriptor>;
  releaseModelLease?(leaseId: string): Promise<void>;
  sha256Lease?(leaseId: string): Promise<string>;
  readLeaseMetadata?(leaseId: string): Promise<string>;
  statLease?(leaseId: string): Promise<{ size: number; regular: boolean }>;
  prepareLeaseForRuntime?(leaseId: string): Promise<NativeRuntimeDescriptor>;

  connectAndroidHub?(packageName: string, certificates: string[]): Promise<AndroidServiceInfo>;
  androidAcknowledge?(sessionId: string, requestId: string, sequence: number): Promise<AndroidOperationResult>;
  androidIsSessionDrained?(sessionId: string): Promise<boolean>;
  androidHostAvailability?(): Promise<{ available: boolean; runtimeId: string; runtimeVersion: string; packageName: string }>;
  beginAndroidHubMutation?(): Promise<void>;
  endAndroidHubMutation?(): Promise<void>;
  disconnectAndroidHub?(): Promise<void>;
  openAndroidHub?(packageName: string, certificates: string[]): Promise<void>;
  androidListModels?(cursor: string | null, limit: number): Promise<AndroidModelPage>;
  androidCreateSession?(modelId: string, profileId: string): Promise<AndroidSessionResult>;
  androidGenerate?(sessionId: string, requestId: string, requestJson: string): Promise<AndroidOperationResult>;
  androidCancel?(sessionId: string, requestId: string): Promise<AndroidOperationResult>;
  androidReleaseSession?(sessionId: string): Promise<AndroidOperationResult>;
  publishAndroidHubState?(modelsJson: string): Promise<void>;
  listPendingAndroidClients?(): Promise<PendingAndroidClient[]>;
  setAndroidClientAuthorization?(
    packageName: string,
    userId: number,
    certificateSha256: string,
    approved: boolean,
    scopes: string[]
  ): Promise<void>;
  sha256File?(uri: string): Promise<string>;

  addListener?(eventName: 'onModelCommonsEvent', listener: (event: AndroidStreamEvent) => void): {
    remove(): void;
  };
}

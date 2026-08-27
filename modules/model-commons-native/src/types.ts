export type NativePlatform = 'android' | 'ios' | 'web' | 'unknown';

export interface NativeAvailability {
  available: boolean;
  platform: NativePlatform;
  androidHubConnected: boolean;
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
  kind: 'security-scoped' | 'app-group';
  displayName: string;
  groupIdentifier?: string;
}

export interface NativeLeaseDescriptor {
  id: string;
  connectionId: string;
  uri: string;
}

export interface AndroidServiceInfo {
  protocolVersion: string;
  apiVersion: number;
  centralizedInference: boolean;
  runtimeState: 'RUNTIME_NOT_READY' | 'READY';
  maxRequestBytes: number;
  maxEventBytes: number;
}

export interface AndroidModelDescriptor {
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

  connectAndroidHub?(packageName: string): Promise<AndroidServiceInfo>;
  disconnectAndroidHub?(): Promise<void>;
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

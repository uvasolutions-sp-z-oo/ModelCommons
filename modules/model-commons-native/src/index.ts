import { ModelCommonsError } from '@modelcommons/protocol';
import NativeModule from './nativeModule';
import { callNative, callNativeSync } from './nativeError';
import type {
  AndroidHubModelSnapshot,
  AndroidModelPage,
  AndroidOperationResult,
  AndroidServiceInfo,
  AndroidSessionResult,
  AndroidStreamEvent,
  ModelCommonsNativeModuleShape,
  NativeAvailability,
  NativeDeviceProfile,
  NativeLeaseDescriptor,
  PendingAndroidClient,
  SharedDirectoryConnection,
} from './types';

export * from './types';

/**
 * Reports whether an Expo Modules API method is present in this native build.
 *
 * Keep feature detection beside the Expo Modules API boundary.  Code using
 * `NativeModules` cannot reliably see Expo Kotlin/Swift modules when the new
 * architecture is enabled, even though `requireOptionalNativeModule` can.
 */
export function hasNativeMethod(name: keyof ModelCommonsNativeModuleShape): boolean {
  return typeof NativeModule?.[name] === 'function';
}

const NATIVE_ERRORS = {
  availability: {
    fallbackCode: 'RUNTIME_INITIALIZATION_FAILED',
    fallbackMessage: 'Native availability could not be read.',
  },
  deviceProfile: {
    fallbackCode: 'RUNTIME_INITIALIZATION_FAILED',
    fallbackMessage: 'The native device profile could not be read.',
  },
  atomicReplace: {
    fallbackCode: 'STORAGE_UNAVAILABLE',
    fallbackMessage: 'The staged file could not be published atomically.',
  },
  connectSharedDirectory: {
    fallbackCode: 'PERMISSION_REQUIRED',
    fallbackMessage: 'Shared directory access was not granted.',
  },
  connectAppGroup: {
    fallbackCode: 'PERMISSION_REQUIRED',
    fallbackMessage: 'The App Group container is unavailable or not authorized.',
  },
  listSharedConnections: {
    fallbackCode: 'STORAGE_UNAVAILABLE',
    fallbackMessage: 'Shared directory connections could not be read.',
  },
  disconnectSharedDirectory: {
    fallbackCode: 'STORAGE_UNAVAILABLE',
    fallbackMessage: 'The shared directory connection could not be removed.',
  },
  acquireLease: {
    fallbackCode: 'STORAGE_UNAVAILABLE',
    fallbackMessage: 'The model file lease could not be acquired.',
  },
  releaseLease: {
    fallbackCode: 'STORAGE_UNAVAILABLE',
    fallbackMessage: 'The model file lease could not be released.',
  },
  hashFile: {
    fallbackCode: 'INTEGRITY_FAILED',
    fallbackMessage: 'The model file could not be hashed.',
  },
  connectHub: {
    fallbackCode: 'HUB_NOT_FOUND',
    fallbackMessage: 'The requested ModelCommons Hub service is unavailable.',
  },
  disconnectHub: {
    fallbackCode: 'TRANSPORT_UNAVAILABLE',
    fallbackMessage: 'The ModelCommons Hub connection could not be closed.',
  },
  hubTransport: {
    fallbackCode: 'TRANSPORT_UNAVAILABLE',
    fallbackMessage: 'The ModelCommons Hub transport operation failed.',
  },
  publishHubState: {
    fallbackCode: 'STORAGE_UNAVAILABLE',
    fallbackMessage: 'The Android Hub model state could not be published.',
  },
  pendingClients: {
    fallbackCode: 'STORAGE_UNAVAILABLE',
    fallbackMessage: 'Pending Android client approvals could not be read.',
  },
  clientAuthorization: {
    fallbackCode: 'STORAGE_UNAVAILABLE',
    fallbackMessage: 'The Android client authorization state could not be updated.',
  },
  eventSubscription: {
    fallbackCode: 'TRANSPORT_UNAVAILABLE',
    fallbackMessage: 'The Android Hub event subscription could not be created.',
  },
} as const;

function requireModule(): NonNullable<typeof NativeModule> {
  if (!NativeModule) {
    throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'ModelCommons native support is not installed in this build.');
  }
  return NativeModule;
}

function requireMethod<K extends keyof NonNullable<typeof NativeModule>>(
  name: K
): NonNullable<NonNullable<typeof NativeModule>[K]> {
  const method = requireModule()[name];
  if (typeof method !== 'function') {
    throw new ModelCommonsError(
      'FEATURE_UNSUPPORTED',
      `ModelCommons native method ${String(name)} is unavailable on this platform.`
    );
  }
  return method as NonNullable<NonNullable<typeof NativeModule>[K]>;
}

export async function getNativeAvailability(): Promise<NativeAvailability> {
  if (!NativeModule) {
    return {
      available: false,
      platform: 'web',
      androidHubConnected: false,
      iosSharedModels: false,
      reason: 'NATIVE_MODULE_MISSING',
    };
  }
  return callNative(() => requireMethod('getAvailability')(), NATIVE_ERRORS.availability);
}

export async function getDeviceProfile(): Promise<NativeDeviceProfile> {
  return NativeModule
    ? callNative(() => requireMethod('getDeviceProfile')(), NATIVE_ERRORS.deviceProfile)
    : {};
}

/** Atomically publishes a staged sibling file inside an app-owned directory. */
export async function atomicReplaceFile(stagedUri: string, destinationUri: string): Promise<void> {
  await callNative(
    () => requireMethod('atomicReplaceFile')(stagedUri, destinationUri),
    NATIVE_ERRORS.atomicReplace
  );
}

export async function connectSharedDirectory(): Promise<SharedDirectoryConnection> {
  return callNative(
    () => (requireMethod('connectSharedDirectory') as () => Promise<SharedDirectoryConnection>)(),
    NATIVE_ERRORS.connectSharedDirectory
  );
}

export async function connectAppGroup(groupIdentifier: string): Promise<SharedDirectoryConnection> {
  return callNative(
    () => (requireMethod('connectAppGroup') as (value: string) => Promise<SharedDirectoryConnection>)(groupIdentifier),
    NATIVE_ERRORS.connectAppGroup
  );
}

/** Explicitly configured owner destination; unavailable groups never fall back. */
export async function resolveOwnerAppGroupRoot(): Promise<string> {
  return callNative(() => requireMethod('ownerAppGroupRoot')(), NATIVE_ERRORS.connectAppGroup);
}

/** Owner-requested synthetic evidence; no private store is created. */
export async function inspectPrivateModelEvidence() {
  return callNative(() => requireMethod('privateModelEvidence')(), NATIVE_ERRORS.acquireLease);
}

export async function listSharedConnections(): Promise<SharedDirectoryConnection[]> {
  return callNative(
    () => (requireMethod('listSharedConnections') as () => Promise<SharedDirectoryConnection[]>)(),
    NATIVE_ERRORS.listSharedConnections
  );
}

export async function disconnectSharedDirectory(connectionId: string): Promise<void> {
  await callNative(
    () => (requireMethod('disconnectSharedDirectory') as (value: string) => Promise<void>)(connectionId),
    NATIVE_ERRORS.disconnectSharedDirectory
  );
}

export class ModelFileLease {
  readonly id: string;
  readonly connectionId: string;
  readonly uri: string;
  private released = false;
  private releasePromise?: Promise<void>;

  constructor(descriptor: NativeLeaseDescriptor) {
    this.id = descriptor.id;
    this.connectionId = descriptor.connectionId;
    this.uri = descriptor.uri;
  }

  async sha256(): Promise<string> {
    if (this.released) {
      throw new ModelCommonsError('STORAGE_UNAVAILABLE', 'The model file lease has been released.');
    }
    return callNative(
      () => (requireMethod('sha256Lease') as (value: string) => Promise<string>)(this.id),
      NATIVE_ERRORS.hashFile
    );
  }

  async stat(): Promise<{ size: number; regular: boolean }> {
    if (this.released) throw new ModelCommonsError('STORAGE_UNAVAILABLE', 'The model file lease has been released.');
    return callNative(() => requireMethod('statLease')(this.id), NATIVE_ERRORS.acquireLease);
  }

  async release(): Promise<void> {
    if (this.released) return;
    if (this.releasePromise) return this.releasePromise;
    const pending = (async () => {
      await callNative(
        () => (requireMethod('releaseModelLease') as (value: string) => Promise<void>)(this.id),
        NATIVE_ERRORS.releaseLease
      );
      this.released = true;
    })();
    this.releasePromise = pending;
    try {
      await pending;
    } finally {
      if (this.releasePromise === pending) this.releasePromise = undefined;
    }
  }
}

export async function acquireModelLease(connectionId: string, relativePath: string): Promise<ModelFileLease> {
  const descriptor = await callNative(
    () => (requireMethod('acquireModelLease') as (
      connection: string,
      path: string
    ) => Promise<NativeLeaseDescriptor>)(connectionId, relativePath),
    NATIVE_ERRORS.acquireLease
  );
  const lease = new ModelFileLease(descriptor);
  if (descriptor.coordinationVersion !== 1) {
    await lease.release();
    throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'Shared models require a new native build with lifetime coordination.');
  }
  return lease;
}

export async function connectAndroidHub(packageName: string, trustedCertificateSha256: string[] = []): Promise<AndroidServiceInfo> {
  return callNative(
    () => requireMethod('connectAndroidHub')(packageName, trustedCertificateSha256),
    NATIVE_ERRORS.connectHub
  );
}

export async function androidHostAvailability() {
  return callNative(() => requireMethod('androidHostAvailability')(), NATIVE_ERRORS.hubTransport);
}
export async function openAndroidHub(packageName: string, certificates: string[]): Promise<void> {
  return callNative(() => requireMethod('openAndroidHub')(packageName, certificates), NATIVE_ERRORS.connectHub);
}
export async function beginAndroidHubMutation(): Promise<void> {
  return callNative(() => requireMethod('beginAndroidHubMutation')(), NATIVE_ERRORS.hubTransport);
}
export async function endAndroidHubMutation(): Promise<void> {
  return callNative(() => requireMethod('endAndroidHubMutation')(), NATIVE_ERRORS.hubTransport);
}
export async function androidAcknowledge(sessionId: string, requestId: string, sequence: number) {
  return callNative(() => requireMethod('androidAcknowledge')(sessionId, requestId, sequence), NATIVE_ERRORS.hubTransport);
}
export async function androidIsSessionDrained(sessionId: string) {
  return callNative(() => requireMethod('androidIsSessionDrained')(sessionId), NATIVE_ERRORS.hubTransport);
}

export { createAndroidBinderTransport } from './androidTransport';

export async function disconnectAndroidHub(): Promise<void> {
  await callNative(
    () => (requireMethod('disconnectAndroidHub') as () => Promise<void>)(),
    NATIVE_ERRORS.disconnectHub
  );
}

export async function androidListModels(cursor: string | null = null, limit = 25): Promise<AndroidModelPage> {
  return callNative(
    () => (requireMethod('androidListModels') as (
      cursor: string | null,
      limit: number
    ) => Promise<AndroidModelPage>)(cursor, limit),
    NATIVE_ERRORS.hubTransport
  );
}

export async function androidCreateSession(modelId: string, profileId: string): Promise<AndroidSessionResult> {
  return callNative(
    () => (requireMethod('androidCreateSession') as (
      model: string,
      profile: string
    ) => Promise<AndroidSessionResult>)(modelId, profileId),
    NATIVE_ERRORS.hubTransport
  );
}

export async function androidGenerate(
  sessionId: string,
  requestId: string,
  requestJson: string
): Promise<AndroidOperationResult> {
  return callNative(
    () => (requireMethod('androidGenerate') as (
      session: string,
      request: string,
      json: string
    ) => Promise<AndroidOperationResult>)(sessionId, requestId, requestJson),
    NATIVE_ERRORS.hubTransport
  );
}

export async function androidCancel(sessionId: string, requestId: string): Promise<AndroidOperationResult> {
  return callNative(
    () => (requireMethod('androidCancel') as (
      session: string,
      request: string
    ) => Promise<AndroidOperationResult>)(sessionId, requestId),
    NATIVE_ERRORS.hubTransport
  );
}

export async function androidReleaseSession(sessionId: string): Promise<AndroidOperationResult> {
  return callNative(
    () => (requireMethod('androidReleaseSession') as (
      session: string
    ) => Promise<AndroidOperationResult>)(sessionId),
    NATIVE_ERRORS.hubTransport
  );
}

export function addAndroidStreamListener(listener: (event: AndroidStreamEvent) => void): { remove(): void } {
  return callNativeSync(() => {
    const module = requireModule();
    if (!module.addListener) {
      throw new ModelCommonsError('FEATURE_UNSUPPORTED', 'Native event subscription is unavailable.');
    }
    const subscription = module.addListener('onModelCommonsEvent', listener);
    return {
      remove: () => callNativeSync(() => subscription.remove(), NATIVE_ERRORS.eventSubscription),
    };
  }, NATIVE_ERRORS.eventSubscription);
}

export async function publishAndroidHubState(models: AndroidHubModelSnapshot[]): Promise<void> {
  await callNative(
    () => (requireMethod('publishAndroidHubState') as (json: string) => Promise<void>)(JSON.stringify(models)),
    NATIVE_ERRORS.publishHubState
  );
}

export async function listPendingAndroidClients(): Promise<PendingAndroidClient[]> {
  return callNative(
    () => (requireMethod('listPendingAndroidClients') as () => Promise<PendingAndroidClient[]>)(),
    NATIVE_ERRORS.pendingClients
  );
}

export async function setAndroidClientAuthorization(options: {
  packageName: string;
  userId: number;
  certificateSha256: string;
  approved: boolean;
  scopes?: string[];
}): Promise<void> {
  await callNative(
    () => (requireMethod('setAndroidClientAuthorization') as (
      packageName: string,
      userId: number,
      certificate: string,
      approved: boolean,
      scopes: string[]
    ) => Promise<void>)(
      options.packageName,
      options.userId,
      options.certificateSha256,
      options.approved,
      options.scopes ?? ['metadata', 'inference']
    ),
    NATIVE_ERRORS.clientAuthorization
  );
}

export async function sha256File(uri: string): Promise<string> {
  return callNative(
    () => (requireMethod('sha256File') as (value: string) => Promise<string>)(uri),
    NATIVE_ERRORS.hashFile
  );
}
export { createPrivateStorePort } from './privateStore';
export { createSharedStorePort } from './sharedStore';

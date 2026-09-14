import type { ReadStorePort } from '@modelcommons/model-store';
import { ModelCommonsError, assertSafeRelativePath } from '@modelcommons/protocol';
import { acquireModelLease } from './index';
import nativeModule from './nativeModule';
import { callNative } from './nativeError';

/** Every read uses the same native authorized connection as the artifact. */
export function createSharedStorePort(
  connectionId: string,
  onAcquire?: () => void,
  connectionKind: 'security-scoped' | 'app-group' | 'android-shared-files' = 'security-scoped'
): ReadStorePort {
  if (!connectionId) throw new ModelCommonsError('PERMISSION_REQUIRED', 'Choose a shared model directory first.');
  const acquire = (path: string) => acquireModelLease(connectionId, assertSafeRelativePath(path));
  async function read<T>(path: string, operation: (leaseId: string) => Promise<T>): Promise<T> {
    const lease = await acquire(path);
    try {
      return await callNative(() => operation(lease.id), {
        fallbackCode: 'STORAGE_UNAVAILABLE', fallbackMessage: 'The connected shared model resource is unavailable.',
      });
    } finally { await lease.release(); }
  }
  return {
    identity: connectionKind === 'android-shared-files'
      ? `android-shared:${connectionId}`
      : connectionKind === 'app-group'
        ? `ios-app-group:${connectionId}`
        : `ios-shared:${connectionId}`,
    async acquire(path) {
      const lease = await acquire(path);
      try { onAcquire?.(); return lease; }
      catch (error) { await lease.release(); throw error; }
    },
    readText: (path) => read(path, (id) => {
      if (!nativeModule?.readLeaseMetadata) throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'Shared metadata access requires a new native build.');
      return nativeModule.readLeaseMetadata(id);
    }).catch(missing),
    stat: (path) => read(path, (id) => {
      if (!nativeModule?.statLease) throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'Shared file access requires a new native build.');
      return nativeModule.statLease(id);
    }).catch(missing),
    sha256: (path) => read(path, (id) => {
      if (!nativeModule?.sha256Lease) throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'Shared integrity verification is unavailable.');
      return nativeModule.sha256Lease(id);
    }),
  };
}

function missing(error: unknown): null {
  if (error instanceof ModelCommonsError && error.code === 'MODEL_NOT_READY') return null;
  throw error;
}

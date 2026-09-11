import { beforeEach, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({
  acquireModelLease: vi.fn(), releaseModelLease: vi.fn(), readLeaseMetadata: vi.fn(),
  statLease: vi.fn(), sha256Lease: vi.fn(),
}));
vi.mock('../nativeModule', () => ({ default: native }));
import { createSharedStorePort } from '../sharedStore';

beforeEach(() => {
  vi.resetAllMocks();
  native.acquireModelLease.mockResolvedValue({ id: 'lease', connectionId: 'connection', uri: 'file:///shared/model.gguf', coordinationVersion: 1 });
  native.releaseModelLease.mockResolvedValue(undefined);
  native.statLease.mockResolvedValue({ size: 3, regular: true });
  native.sha256Lease.mockResolvedValue('a'.repeat(64));
});
it('records only artifact acquisition and hashes/stats that lease without acquiring another resource', async () => {
  const observed = vi.fn(); const port = createSharedStorePort('connection', observed);
  native.readLeaseMetadata.mockResolvedValue('{}');
  await port.readText('protocol.json', 1024 * 1024);
  expect(observed).not.toHaveBeenCalled();
  const lease = await port.acquire('models/revision/model.gguf');
  await lease.stat!(); await lease.sha256!();
  expect(observed).toHaveBeenCalledOnce();
  expect(native.acquireModelLease).toHaveBeenCalledTimes(2);
  expect(native.statLease).toHaveBeenCalledWith('lease');
  await Promise.all([lease.release(), lease.release()]);
  expect(native.releaseModelLease).toHaveBeenCalledTimes(2);
});
it('treats missing artifacts as absent while preserving permission failures', async () => {
  const port = createSharedStorePort('connection');
  native.acquireModelLease.mockRejectedValue(Error('MODEL_NOT_READY: Missing file.'));
  expect(await port.stat('models/revision/model.gguf')).toBeNull();
  expect(await port.readText('protocol.json', 1024 * 1024)).toBeNull();
  native.acquireModelLease.mockRejectedValue(Error('PERMISSION_REQUIRED: Access revoked.'));
  await expect(port.stat('models/revision/model.gguf')).rejects.toMatchObject({ code: 'PERMISSION_REQUIRED' });
});
it('releases and rejects a lease from an older native binary', async () => {
  native.acquireModelLease.mockResolvedValue({ id: 'old-lease', connectionId: 'connection', uri: 'file:///shared/model.gguf' });
  await expect(createSharedStorePort('connection').acquire('model.gguf')).rejects.toMatchObject({ code: 'RUNTIME_UNAVAILABLE' });
  expect(native.releaseModelLease).toHaveBeenCalledWith('old-lease');
});
it('always releases failed metadata reads and does not convert cleanup failure into empty storage', async () => {
  const port = createSharedStorePort('connection');
  native.readLeaseMetadata.mockRejectedValue(Error('INTEGRITY_FAILED: Metadata too large.'));
  await expect(port.readText('registry.json', 1024 * 1024)).rejects.toMatchObject({ code: 'INTEGRITY_FAILED' });
  expect(native.releaseModelLease).toHaveBeenCalledOnce();
  native.releaseModelLease.mockRejectedValue(Error('RUNTIME_UNAVAILABLE: Lease still busy.'));
  await expect(port.readText('registry.json', 1024 * 1024)).rejects.toMatchObject({ code: 'RUNTIME_UNAVAILABLE' });
});

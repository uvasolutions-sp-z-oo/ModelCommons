import { describe, expect, it, vi } from 'vitest';
import { createModelStore, createReadOnlyModelStore, parseBoundedMetadata, type WriteStorePort } from '../store';
import { SMOLLM2_360M_INSTRUCT as model } from '../catalog';
import { assertDownloadOrigin, snapshotPolicy } from '../policy';
import { assertSafeRelativePath } from '@modelcommons/protocol';

let sequence = 0;
function fixture() {
  const files = new Map<string, { text?: string; size: number; digest?: string }>();
  const calls: string[] = [];
  let disk = 4 * 1024 ** 3;
  let failHash = false;
  let downloadHook = () => {};
  const artifact = { size: model.files[0].sizeBytes!, digest: model.files[0].integrity!.digest };
  const port: WriteStorePort = {
    identity: `test-private-${++sequence}`,
    async readText(path) { return files.get(assertSafeRelativePath(path))?.text ?? null; },
    async stat(path) { const file = files.get(path); return file ? { size: file.size, regular: true } : null; },
    async sha256(path) { return failHash ? '0'.repeat(64) : files.get(path)?.digest ?? ''; },
    async acquire(path) { calls.push('lease'); return { id: path, uri: `file:///${port.identity}/${path}`, async release() { calls.push('release'); } }; },
    async atomicText(path, text) { calls.push(`write:${path}`); files.set(path, { text, size: text.length }); },
    async mkdir() {},
    async remove(path) { calls.push('remove'); for (const key of files.keys()) if (key.startsWith(path + '/')) files.delete(key); },
    async move(from, to) { const file = files.get(from); if (!file) throw Error('Missing staging'); files.set(to, file); files.delete(from); },
    async freeBytes() { return disk; },
    async download(_url, path) { calls.push('download'); files.set(path, { ...artifact }); downloadHook(); },
    async importFile(_source, path) { calls.push('copy'); files.set(path, { ...artifact }); },
  };
  const policy = { provision: true, privateImport: true, downloadOrigins: ['https://huggingface.co'], approvedModels: [model] };
  const store = createModelStore({ port, policy });
  return { port, store, files, calls, policy,
    disk: (value: number) => { disk = value; }, badHash: () => { failHash = true; },
    onDownload: (callback: () => void) => { downloadHook = callback; } };
}

describe('verified store ownership and publication', () => {
  it.each([false, true])('provides a fresh leased stat without rehashing, shared=%s', async (shared) => {
    const f = fixture(); await f.store.install(model.id);
    const store = shared ? createReadOnlyModelStore(f.port, f.policy) : f.store;
    const { lease } = await store.acquire(model.id);
    const hash = vi.spyOn(f.port, 'sha256');
    const path = `models/${model.storageId}/model.gguf`;
    expect(await lease.inspectFile!()).toEqual({ present: true, regular: true, sizeMatches: true });
    f.files.set(path, { size: 1 });
    expect(await lease.inspectFile!()).toEqual({ present: true, regular: true, sizeMatches: false });
    f.files.delete(path);
    expect(await lease.inspectFile!()).toEqual({ present: false, regular: false, sizeMatches: false });
    expect(hash).not.toHaveBeenCalled();
    expect(f.calls.filter((call) => call === 'release')).toHaveLength(0);
    await lease.release();
    expect(f.calls.filter((call) => call === 'release')).toHaveLength(1);
  });
  it('never cross-resolves the same model ID between private roots', async () => {
    const a = fixture(), b = fixture();
    await a.store.install(model.id);
    expect(await a.store.list()).toHaveLength(1);
    expect(await b.store.list()).toHaveLength(0);
    await expect(b.store.acquire(model.id)).rejects.toMatchObject({ code: 'MODEL_NOT_READY' });
  });
  it('publishes READY only after verification and keeps live resources undeletable', async () => {
    const f = fixture(); await f.store.install(model.id);
    const { lease } = await f.store.acquire(model.id);
    await expect(f.store.remove(model.id)).rejects.toMatchObject({ code: 'RUNTIME_UNAVAILABLE' });
    const secondFacade = createModelStore({ port: f.port, policy: f.policy });
    await expect(secondFacade.remove(model.id)).rejects.toMatchObject({ code: 'RUNTIME_UNAVAILABLE' });
    await Promise.all([lease.release(), lease.release()]);
    expect(f.calls.filter((call) => call === 'release')).toHaveLength(1);
    await secondFacade.remove(model.id);
    expect(await f.store.list()).toHaveLength(0);
  });
  it('keeps file existence and exact size as readiness checks', async () => {
    const f = fixture(); await f.store.install(model.id);
    f.files.delete(`models/${model.storageId}/model.gguf`);
    expect(await f.store.list()).toHaveLength(0);
    await expect(f.store.acquire(model.id)).rejects.toMatchObject({ code: 'INTEGRITY_FAILED' });
  });
  it('rejects hash mismatch and never publishes READY', async () => {
    const f = fixture(); f.badHash();
    await expect(f.store.install(model.id)).rejects.toMatchObject({ code: 'INTEGRITY_FAILED' });
    expect(await f.store.list()).toHaveLength(0);
    expect(JSON.parse(f.files.get('registry.json')!.text!).models[0].state).toBe('FAILED');
  });
  it('checks disk before provisioning and observes cancellation before publication', async () => {
    const f = fixture(); f.disk(1);
    await expect(f.store.install(model.id)).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
    expect(f.calls).not.toContain('download');
    f.disk(4 * 1024 ** 3);
    const abort = new AbortController(); f.onDownload(() => abort.abort());
    await expect(f.store.install(model.id, { signal: abort.signal })).rejects.toMatchObject({ code: 'USER_CANCELLED' });
    expect(await f.store.list()).toHaveLength(0);
    f.onDownload(() => {});
    await f.store.install(model.id);
    expect(await f.store.list()).toHaveLength(1);
  });
  it('private import copies and verifies; shared consumption never copies or writes', async () => {
    const f = fixture(); await f.store.install(model.id, { source: 'user-selected-grant' });
    expect(f.calls).toContain('copy'); expect(f.calls).not.toContain('download');
    f.calls.length = 0;
    const shared = createReadOnlyModelStore(f.port, f.policy);
    expect('install' in shared || 'remove' in shared || 'acceptLicense' in shared).toBe(false);
    const { lease } = await shared.acquire(model.id);
    await lease.release();
    expect(f.calls).toEqual(['lease', 'release']);
  });
  it('rejects a changed shared revision despite a matching third-party checksum', async () => {
    const f = fixture(); await f.store.install(model.id);
    const registry = JSON.parse(f.files.get('registry.json')!.text!);
    registry.models[0].manifest.revision = 'untrusted-revision';
    await f.port.atomicText('registry.json', JSON.stringify(registry));
    await expect(createReadOnlyModelStore(f.port, f.policy).acquire(model.id)).rejects.toMatchObject({ code: 'INTEGRITY_FAILED' });
  });
  it('bounds hostile metadata and prevents mutation of the trust snapshot', () => {
    expect(() => parseBoundedMetadata('['.repeat(33) + '0' + ']'.repeat(33))).toThrow();
    expect(() => parseBoundedMetadata(' '.repeat(1024 * 1024 + 1))).toThrow();
    for (const path of ['../model.gguf', '%2e%2e/model.gguf', 'file:///private/model.gguf', 'a\\b']) {
      expect(() => assertSafeRelativePath(path)).toThrow();
    }
    const f = fixture(); const snapshot = snapshotPolicy(f.policy);
    f.policy.provision = false;
    expect(snapshot.provision).toBe(true);
    expect(() => assertDownloadOrigin(snapshot, 'https://evil.example/model.gguf')).toThrow();
    expect(() => assertDownloadOrigin(snapshot, 'http://huggingface.co/model.gguf')).toThrow();
  });
});

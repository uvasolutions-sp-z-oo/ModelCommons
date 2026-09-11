import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadOnlyModelStore, type ReadStorePort } from '@modelcommons/model-store';
import { SMOLLM2_135M_INSTRUCT } from '@modelcommons/model-store/catalog';

// Synthetic bytes, independently hashed trust catalog, actual Hub publication.
const f = vi.hoisted(() => ({
  files: new Map<string, string>(), downloads: [] as string[], platform: { OS: 'ios' },
  groupAvailable: true, root: 'file:///group/ModelCommons/',
}));
vi.mock('expo-constants', () => ({ default: { expoConfig: {} } }));
vi.mock('react-native', () => ({ Platform: f.platform }));
vi.mock('../catalog', async () => {
  const { SMOLLM2_135M_INSTRUCT: base } = await import('@modelcommons/model-store/catalog');
  const { createHash } = await import('node:crypto');
  return { MODEL_CATALOG: [{ ...base, files: base.files.map((file) => ({ ...file,
    sizeBytes: 3, integrity: { algorithm: 'sha256', digest: createHash('sha256').update('abc').digest('hex') },
  })) }] };
});
vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  getInfoAsync: async (uri: string) => ({ exists: f.files.has(uri), isDirectory: false,
    size: f.files.has(uri) ? Buffer.byteLength(f.files.get(uri)!) : undefined }),
  makeDirectoryAsync: async () => {},
  readAsStringAsync: async (uri: string) => f.files.get(uri),
  writeAsStringAsync: async (uri: string, text: string) => { f.files.set(uri, text); },
  deleteAsync: async (uri: string) => { f.files.delete(uri); },
  moveAsync: async ({ from, to }: { from: string; to: string }) => {
    f.files.set(to, f.files.get(from)!); f.files.delete(from);
  },
  getFreeDiskStorageAsync: async () => 64 * 1024 ** 3,
  createDownloadResumable: (_source: string, destination: string) => ({
    async downloadAsync() { f.downloads.push(destination); f.files.set(destination, 'abc'); return { uri: destination }; },
    async pauseAsync() { return {}; },
  }),
}));
vi.mock('@modelcommons/native', () => ({
  hasNativeMethod: () => true,
  resolveOwnerAppGroupRoot: async () => {
    if (!f.groupAvailable) throw Error('Group unavailable');
    return f.root;
  },
  atomicReplaceFile: async (from: string, to: string) => { f.files.set(to, f.files.get(from)!); f.files.delete(from); },
  sha256File: async (uri: string) => (await import('node:crypto')).createHash('sha256').update(f.files.get(uri)!).digest('hex'),
  publishAndroidHubState: async () => {},
}));
import { ModelStore } from '../modelStore';
import { MODEL_CATALOG } from '../catalog';

function reader(root: string) {
  const port: ReadStorePort = {
    identity: root,
    readText: async (path) => f.files.get(root + path) ?? null,
    stat: async (path) => f.files.has(root + path) ? { regular: true, size: Buffer.byteLength(f.files.get(root + path)!) } : null,
    sha256: async () => { throw Error('Artifact verification must use its lease'); },
    acquire: async (path) => {
      const bytes = f.files.get(root + path);
      return { id: path, uri: root + path, stat: async () => bytes === undefined ? null : { regular: true, size: Buffer.byteLength(bytes) },
        sha256: async () => createHash('sha256').update(bytes ?? '').digest('hex'), release: async () => {} };
    },
  };
  return createReadOnlyModelStore(port, { provision: false, privateImport: false, downloadOrigins: [], approvedModels: MODEL_CATALOG });
}

beforeEach(() => { f.files.clear(); f.downloads.length = 0; f.groupAvailable = true; });
describe('Hub writer / generic shared reader conformance', () => {
  it.each(['documents', 'app-group'] as const)('publishes and reads %s directly without a consumer copy', async (storageDestination) => {
    const hub = new ModelStore({ storageDestination });
    await hub.initialize();
    const shared = reader(hub.rootUri!);
    expect(await shared.list()).toEqual([]);
    await hub.download(SMOLLM2_135M_INSTRUCT.id);
    expect(f.downloads).toEqual([`${hub.rootUri}models/${MODEL_CATALOG[0].storageId}/model.gguf.part`]);
    expect(await shared.list()).toEqual(MODEL_CATALOG);
    expect(Object.keys(shared).sort()).toEqual(['acquire', 'identity', 'list']);
    const before = [...f.files];
    const resource = await shared.acquire(MODEL_CATALOG[0].id);
    expect(resource.manifest).toEqual(MODEL_CATALOG[0]);
    expect(resource.lease.uri).toBe(hub.artifactUri(MODEL_CATALOG[0], 'model'));
    expect(await resource.lease.inspectFile!()).toEqual({ present: true, regular: true, sizeMatches: true });
    await resource.lease.release();
    expect([...f.files]).toEqual(before);
    expect(f.downloads).toHaveLength(1);
    if (storageDestination === 'app-group') expect([...f.files.keys()].every((key) => key.startsWith(f.root))).toBe(true);
    await expect(hub.delete(MODEL_CATALOG[0].id)).rejects.toMatchObject({ code: 'FEATURE_UNSUPPORTED' });
  });
  it('fails an unavailable requested group without creating a Documents store', async () => {
    f.groupAvailable = false;
    await expect(new ModelStore({ storageDestination: 'app-group' }).initialize()).rejects.toThrow();
    expect(f.files.size).toBe(0); expect(f.downloads).toEqual([]);
  });
  it.each(['missing-marker', 'incompatible-marker', 'forged-ready', 'substituted-manifest', 'wrong-size', 'wrong-hash'])('rejects %s', async (failure) => {
    const hub = new ModelStore(); await hub.download(MODEL_CATALOG[0].id);
    const root = hub.rootUri!, artifact = hub.artifactUri(MODEL_CATALOG[0], 'model')!;
    if (failure === 'missing-marker') f.files.delete(root + 'protocol.json');
    if (failure === 'incompatible-marker') f.files.set(root + 'protocol.json', '{}');
    if (failure === 'forged-ready') f.files.delete(artifact);
    if (failure === 'wrong-size') f.files.set(artifact, 'ab');
    if (failure === 'wrong-hash') f.files.set(artifact, 'xyz');
    if (failure === 'substituted-manifest') {
      const path = root + `models/${MODEL_CATALOG[0].storageId}/manifest.json`;
      const manifest = JSON.parse(f.files.get(path)!); manifest.revision = 'substituted';
      f.files.set(path, JSON.stringify(manifest));
    }
    await expect(reader(root).acquire(MODEL_CATALOG[0].id)).rejects.toThrow();
  });
});

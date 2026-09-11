import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertSafeRelativePath } from '@modelcommons/protocol';

const memory = vi.hoisted(() => {
  const files = new Map<string, string>();
  const directories = new Set<string>();
  let downloadCalls = 0;
  const documentDirectory = 'file:///documents/';

  const directoryExists = (uri: string) => directories.has(uri)
    || [...files.keys()].some((path) => path.startsWith(uri));

  return {
    files,
    directories,
    documentDirectory,
    get downloadCalls() { return downloadCalls; },
    reset() {
      files.clear();
      directories.clear();
      directories.add(documentDirectory);
      downloadCalls = 0;
    },
    api: {
      documentDirectory,
      async getInfoAsync(uri: string) {
        const value = files.get(uri);
        if (value !== undefined) {
          return { exists: true, isDirectory: false, size: new TextEncoder().encode(value).byteLength, uri };
        }
        return { exists: directoryExists(uri), isDirectory: directoryExists(uri), uri };
      },
      async makeDirectoryAsync(uri: string) { directories.add(uri.endsWith('/') ? uri : `${uri}/`); },
      async readAsStringAsync(uri: string) {
        const value = files.get(uri);
        if (value === undefined) throw new Error(`Missing fixture file: ${uri}`);
        return value;
      },
      async writeAsStringAsync(uri: string, value: string) { files.set(uri, value); },
      async moveAsync({ from, to }: { from: string; to: string }) {
        const file = files.get(from);
        if (file !== undefined) {
          files.delete(from);
          files.set(to, file);
          return;
        }
        const movedFiles = [...files.entries()].filter(([path]) => path.startsWith(from));
        const movedDirectories = [...directories].filter((path) => path === from || path.startsWith(from));
        if (!movedFiles.length && !movedDirectories.length) throw new Error(`Missing move source: ${from}`);
        for (const [path, value] of movedFiles) {
          files.delete(path);
          files.set(`${to}${path.slice(from.length)}`, value);
        }
        for (const path of movedDirectories) {
          directories.delete(path);
          directories.add(`${to}${path.slice(from.length)}`);
        }
        directories.add(to.endsWith('/') ? to : `${to}/`);
      },
      async deleteAsync(uri: string) {
        files.delete(uri);
        for (const path of [...files.keys()]) if (path.startsWith(uri)) files.delete(path);
        for (const path of [...directories]) if (path === uri || path.startsWith(uri)) directories.delete(path);
      },
      async getFreeDiskStorageAsync() { return 64 * 1024 ** 3; },
      createDownloadResumable() {
        downloadCalls += 1;
        throw new Error('Migration must not download model artifacts.');
      },
    },
  };
});

vi.mock('expo-file-system/legacy', () => memory.api);
vi.mock('expo-constants', () => ({ default: { expoConfig: {} } }));
vi.mock('react-native', () => ({ NativeModules: {}, Platform: { OS: 'android' } }));
vi.mock('@modelcommons/native', () => ({
  hasNativeMethod: (name: string) => name === 'atomicReplaceFile',
  atomicReplaceFile: (from: string, to: string) => memory.api.moveAsync({ from, to }),
  publishAndroidHubState: vi.fn(),
  sha256File: vi.fn(),
}));

import { ModelStore } from '../modelStore';

describe('legacy MedGemma migration', () => {
  beforeEach(() => memory.reset());

  it.each(['../model.gguf', '/private/model.gguf', 'file:///private/model.gguf', 'models/%2e%2e/model.gguf'])(
    'rejects unsafe relative path %s',
    (value) => expect(() => assertSafeRelativePath(value)).toThrow()
  );

  it('moves donor artifacts into an immutable revision without redownloading', async () => {
    const legacyRoot = `${memory.documentDirectory}models/`;
    memory.directories.add(legacyRoot);
    memory.files.set(`${legacyRoot}legacy-Q4_K_M.gguf`, 'model-bytes');
    memory.files.set(`${legacyRoot}legacy-mmproj.gguf`, 'projection-bytes');
    memory.files.set(`${legacyRoot}download-manifest.json`, JSON.stringify({
      ggufUri: `${legacyRoot}legacy-Q4_K_M.gguf`,
      mmprojUri: `${legacyRoot}legacy-mmproj.gguf`,
    }));

    const registry = await new ModelStore().initialize();
    const migrated = registry.models.find((record) => record.manifest.id === 'local/migrated-medgemma-4b-it');

    expect(memory.downloadCalls).toBe(0);
    expect(migrated?.state).toBe('READY');
    expect(migrated?.manifest.revision).toBe('legacy-donor-v1');
    expect(migrated?.manifest.files.map((file) => file.path)).toEqual(['model.gguf', 'mmproj.gguf']);
    expect(migrated?.manifest.files.every((file) => file.integrity === undefined)).toBe(true);
    expect(memory.files.has(`${legacyRoot}legacy-Q4_K_M.gguf`)).toBe(false);
    expect([...memory.files.keys()].some((path) => path.endsWith('/model.gguf'))).toBe(true);
    expect([...memory.files.keys()].some((path) => path.endsWith('/mmproj.gguf'))).toBe(true);
    expect([...memory.files.keys()].some((path) => path.endsWith('legacy-medgemma.json'))).toBe(false);
  });

  it('rejects a donor manifest whose absolute URI escapes the donor directory', async () => {
    const legacyRoot = `${memory.documentDirectory}models/`;
    memory.directories.add(legacyRoot);
    memory.files.set(`${legacyRoot}download-manifest.json`, JSON.stringify({
      ggufUri: `${memory.documentDirectory}outside/model.gguf`,
    }));

    await expect(new ModelStore().initialize()).rejects.toMatchObject({ code: 'INTEGRITY_FAILED' });
    expect(memory.downloadCalls).toBe(0);
  });
});

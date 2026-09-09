import {
  ModelCommonsError, PROTOCOL_VERSION, assertSafeRelativePath, parseModelRegistry,
  parseModelManifest, isProtocolVersionCompatible, type ModelManifest, type ModelRegistry,
} from '@modelcommons/protocol';
import { acceptModelLicense, assertLicenseAccepted, artifactRelativePath, createEmptyRegistry,
  modelManifestRelativePath, removeModelRecord, updateModelState } from './registry';
import { assertDownloadOrigin, snapshotPolicy, trustedManifest, type StorePolicy } from './policy';

export interface ResourceLease {
  id: string;
  uri: string;
  release(): Promise<void>;
}

/** All paths are relative to a root granted by the owning native adapter.
 * Implementations MUST confine symlinks, bound reads before allocation, stream
 * hashing/copies, and validate every redirect before issuing a network request. */
export interface ReadStorePort {
  readonly identity: string;
  readText(path: string, maxBytes: number): Promise<string | null>;
  stat(path: string): Promise<{ size: number; regular: boolean } | null>;
  acquire(path: string): Promise<ResourceLease>;
  sha256(path: string): Promise<string>;
}
export interface WriteStorePort extends ReadStorePort {
  atomicText(path: string, text: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  freeBytes(): Promise<number>;
  download(url: string, path: string, options: {
    expectedBytes: number; origins: readonly string[]; signal?: AbortSignal;
    onProgress?: (written: number, total: number) => void;
  }): Promise<void>;
  /** The source is an explicit OS/user grant. It is never retained as the model. */
  importFile(source: string, path: string, signal?: AbortSignal, expectedBytes?: number): Promise<void>;
}
export interface ModelResourceStore {
  readonly identity: string;
  list(): Promise<ModelManifest[]>;
  acquire(modelId: string): Promise<{ manifest: ModelManifest; lease: ResourceLease }>;
}

const LIMIT = 1024 * 1024;
export function parseBoundedMetadata(text: string): unknown {
  // Hermes need not provide TextEncoder. Count UTF-8 without allocating a second
  // metadata-sized buffer; the native port has already bounded the original read.
  let bytes = 0;
  for (const char of text) {
    const point = char.codePointAt(0)!;
    bytes += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
    if (bytes > LIMIT) break;
  }
  if (text.length > LIMIT || bytes > LIMIT) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Model metadata is too large.');
  }
  // Bound nesting before JSON.parse; ignore brackets inside JSON strings.
  let depth = 0, quoted = false, escaped = false;
  for (const char of text) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') {
      if (++depth > 32) throw new ModelCommonsError('INTEGRITY_FAILED', 'Model metadata is nested too deeply.');
    } else if (char === '}' || char === ']') depth--;
  }
  try { return JSON.parse(text); }
  catch { throw new ModelCommonsError('INTEGRITY_FAILED', 'Model metadata is invalid.'); }
}
function cancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ModelCommonsError('USER_CANCELLED', 'Model operation cancelled.');
}

/** One queue and lease counter for every native root, even with multiple facades. */
const roots = new Map<string, { tail: Promise<void>; leases: Map<string, number> }>();
function rootState(identity: string) {
  let state = roots.get(identity);
  if (!state) {
    state = { tail: Promise.resolve(), leases: new Map() };
    roots.set(identity, state);
  }
  return state;
}

export function createModelStore(options: {
  port: WriteStorePort; policy: StorePolicy;
  onPublished?: (registry: ModelRegistry) => Promise<void>;
  diagnostic?: (event: 'PUBLICATION_HOOK_FAILED') => void;
}) {
  const { port } = options;
  const policy = snapshotPolicy(options.policy);
  const state = rootState(port.identity);
  async function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = state.tail;
    let release!: () => void;
    state.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await operation(); } finally { release(); }
  }
  async function publish(registry: ModelRegistry) {
    await port.atomicText('registry.json', JSON.stringify(parseModelRegistry(registry)));
    try { await options.onPublished?.(registry); }
    catch { options.diagnostic?.('PUBLICATION_HOOK_FAILED'); }
  }
  async function registry(): Promise<ModelRegistry> {
    const marker = await port.readText('protocol.json', LIMIT);
    if (marker !== null) validateMarker(parseBoundedMetadata(marker));
    else await port.atomicText('protocol.json', JSON.stringify({
      schema: 'modelcommons.protocol', schemaVersion: 1, protocolVersion: PROTOCOL_VERSION,
    }));
    const text = await port.readText('registry.json', LIMIT);
    const current = text === null ? createEmptyRegistry() : parseModelRegistry(parseBoundedMetadata(text));
    if (text === null) await publish(current);
    return current;
  }
  const modelStore: ModelResourceStore = {
    identity: port.identity,
    list: () => exclusive(async () => readyPresent(port, await registry(), policy)),
    acquire: (id) => exclusive(async () => {
      const current = await registry();
      const manifest = readyManifest(current, policy, id);
      assertLicenseAccepted(current, manifest);
      const result = await acquireVerified(port, manifest);
      state.leases.set(id, (state.leases.get(id) ?? 0) + 1);
      let released = false;
      let pending: Promise<void> | undefined;
      return { manifest, lease: {
        id: `${port.identity}:${result.id}`, uri: result.uri,
        release() {
          if (released) return Promise.resolve();
          if (!pending) pending = result.release().then(() => {
            released = true;
            state.leases.set(id, Math.max(0, (state.leases.get(id) ?? 1) - 1));
          }).finally(() => { pending = undefined; });
          return pending;
        },
      } };
    }),
  };
  async function install(id: string, settings: {
    source?: string; signal?: AbortSignal;
    onProgress?: (written: number, total: number) => void;
  } = {}) {
    return exclusive(async () => {
      cancelled(settings.signal);
      if (settings.source ? !policy.privateImport : !policy.provision) {
        throw new ModelCommonsError('PERMISSION_REQUIRED', 'This provisioning operation is disabled.');
      }
      const manifest = trustedManifest(policy, id);
      let current = await registry();
      assertLicenseAccepted(current, manifest);
      if (state.leases.get(id)) throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'Release the model before modifying its store.');
      if (current.models.some((entry) => entry.manifest.id === id && entry.state === 'READY')) {
        // READY metadata is not enough after file deletion/corruption. Verify
        // before treating an explicit reinstall as already satisfied.
        let verified: ResourceLease | undefined;
        try { verified = await acquireVerified(port, manifest); }
        catch { /* Missing files can be reprovisioned; corrupt finals fail below. */ }
        if (verified) { await verified.release(); return; }
      }
      const files = manifest.files.filter((file) => file.required);
      if (settings.source && (files.length !== 1 || files[0].role !== 'model')) {
        throw new ModelCommonsError('FEATURE_UNSUPPORTED', 'Private import currently accepts a single approved text GGUF.');
      }
      const bytes = files.reduce((total, file) => total + file.sizeBytes!, 0);
      if (await port.freeBytes() < bytes + 512 * 1024 ** 2) {
        throw new ModelCommonsError('STORAGE_UNAVAILABLE', 'Insufficient space for model provisioning.');
      }
      const directory = assertSafeRelativePath(`models/${manifest.storageId}`);
      await port.mkdir(directory);
      current = updateModelState(current, manifest, 'DOWNLOADING');
      await publish(current);
      try {
        for (const file of files) {
          cancelled(settings.signal);
          const destination = artifactRelativePath(manifest, file.path);
          const staged = `${destination}.part`;
          // Recovery reuses only already verified immutable artifacts. A partial
          // file is restarted explicitly; no untrusted resume metadata is used.
          if (await port.stat(destination)) {
            await verifyFile(port, destination, file);
            continue;
          }
          if (settings.source) await port.importFile(settings.source, staged, settings.signal, file.sizeBytes);
          else {
            assertDownloadOrigin(policy, file.download?.url ?? '');
            await port.download(file.download!.url, staged, {
              expectedBytes: file.sizeBytes!, origins: policy.downloadOrigins,
              signal: settings.signal, onProgress: settings.onProgress,
            });
          }
          cancelled(settings.signal);
          await verifyFile(port, staged, file);
          cancelled(settings.signal);
          await port.move(staged, destination);
        }
        current = updateModelState(current, manifest, 'VERIFYING');
        await publish(current);
        for (const file of files) await verifyFile(port, artifactRelativePath(manifest, file.path), file);
        cancelled(settings.signal);
        await port.atomicText(modelManifestRelativePath(manifest), JSON.stringify(manifest));
        cancelled(settings.signal);
        await publish(updateModelState(current, manifest, 'READY'));
      } catch (error) {
        try { await publish(updateModelState(current, manifest, 'FAILED', {
          failureCode: error instanceof ModelCommonsError ? error.code : 'STORAGE_UNAVAILABLE',
        })); } catch { /* preserve the operation failure */ }
        throw error;
      }
    });
  }
  return {
    ...modelStore,
    catalog: policy.approvedModels,
    install,
    acceptLicense: (id: string) => exclusive(async () => {
      await publish(acceptModelLicense(await registry(), trustedManifest(policy, id)));
    }),
    remove: (id: string) => exclusive(async () => {
      const current = await registry();
      const manifest = trustedManifest(policy, id);
      if (state.leases.get(id)) throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'The model is in use. Release it before deletion.');
      // Withdraw READY before deleting files; a failed delete leaves only orphans.
      await publish(removeModelRecord(current, manifest));
      await port.remove(assertSafeRelativePath(`models/${manifest.storageId}`));
    }),
  };
}

function validateMarker(value: unknown) {
  const marker = value as Record<string, unknown>;
  if (!marker || marker.schema !== 'modelcommons.protocol' || marker.schemaVersion !== 1
    || typeof marker.protocolVersion !== 'string'
    || !isProtocolVersionCompatible(marker.protocolVersion, PROTOCOL_VERSION)) {
    throw new ModelCommonsError('PROTOCOL_VERSION_UNSUPPORTED', 'Shared store protocol is incompatible.');
  }
}
function approvedReady(registry: ModelRegistry, policy: StorePolicy) {
  return registry.models.filter((entry) => entry.state === 'READY'
    && policy.approvedModels.some((model) => model.id === entry.manifest.id))
    .map((entry) => trustedManifest(policy, entry.manifest.id, entry.manifest));
}
async function readyPresent(port: ReadStorePort, registry: ModelRegistry, policy: StorePolicy) {
  const result: ModelManifest[] = [];
  for (const manifest of approvedReady(registry, policy)) {
    let present = true;
    try { assertLicenseAccepted(registry, manifest); } catch { present = false; }
    for (const file of manifest.files.filter((item) => item.required)) {
      const info = await port.stat(artifactRelativePath(manifest, file.path));
      if (!info?.regular || info.size !== file.sizeBytes) present = false;
    }
    if (present) result.push(manifest);
  }
  return result;
}
function readyManifest(registry: ModelRegistry, policy: StorePolicy, id: string) {
  const record = registry.models.find((entry) => entry.manifest.id === id && entry.state === 'READY');
  if (!record) throw new ModelCommonsError('MODEL_NOT_READY', 'The selected model is not installed and ready.');
  return trustedManifest(policy, id, record.manifest);
}
async function verifyFile(port: ReadStorePort, path: string, file: ModelManifest['files'][number]) {
  const info = await port.stat(path);
  if (!info?.regular || info.size !== file.sizeBytes || !file.integrity
    || (await port.sha256(path)).toLowerCase() !== file.integrity.digest.toLowerCase()) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Model artifact failed size or integrity verification.');
  }
}
async function acquireVerified(port: ReadStorePort, manifest: ModelManifest) {
  const file = manifest.files.find((item) => item.role === 'model' && item.required);
  if (!file) throw new ModelCommonsError('MODEL_NOT_READY', 'No required model artifact.');
  const lease = await port.acquire(artifactRelativePath(manifest, file.path));
  try {
    for (const item of manifest.files.filter((entry) => entry.required)) {
      await verifyFile(port, artifactRelativePath(manifest, item.path), item);
    }
    return lease;
  } catch (error) {
    try { await lease.release(); } catch { /* preserve integrity failure */ }
    throw error;
  }
}

/** Deliberately exposes no install, remove, accept-license, or recovery methods. */
export function createReadOnlyModelStore(port: ReadStorePort, input: StorePolicy): ModelResourceStore {
  const policy = snapshotPolicy(input);
  async function read() {
    const marker = await port.readText('protocol.json', LIMIT);
    if (marker === null) throw new ModelCommonsError('MODEL_NOT_READY', 'No protocol marker in the selected store.');
    validateMarker(parseBoundedMetadata(marker));
    const text = await port.readText('registry.json', LIMIT);
    if (text === null) throw new ModelCommonsError('MODEL_NOT_READY', 'No registry in the selected store.');
    return parseModelRegistry(parseBoundedMetadata(text));
  }
  return {
    identity: port.identity,
    list: async () => readyPresent(port, await read(), policy),
    acquire: async (id) => {
      const current = await read();
      const manifest = readyManifest(current, policy, id);
      assertLicenseAccepted(current, manifest);
      const stored = await port.readText(modelManifestRelativePath(manifest), LIMIT);
      if (stored === null) throw new ModelCommonsError('MODEL_NOT_READY', 'Shared model manifest is missing.');
      trustedManifest(policy, id, parseModelManifest(parseBoundedMetadata(stored)));
      return { manifest, lease: await acquireVerified(port, manifest) };
    },
  };
}

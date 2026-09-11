import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  atomicReplaceFile as nativeAtomicReplaceFile,
  hasNativeMethod,
  resolveOwnerAppGroupRoot,
  publishAndroidHubState as nativePublishAndroidHubState,
  sha256File as nativeSha256File,
} from '@modelcommons/native';
import {
  PROTOCOL_VERSION,
  ModelCommonsError,
  assertHttpsUrl,
  assertSafeRelativePath,
  assertSafeStorageId,
  isProtocolVersionCompatible,
  parseModelManifest,
  parseModelRegistry,
  toModelCommonsError,
  type ModelArtifactFile,
  type ModelManifest,
  type ModelRegistry,
} from '@modelcommons/protocol';
import { MODEL_CATALOG } from './catalog';
import { diagnosticLogger } from '../logger';
import {
  acceptModelLicense,
  assertLicenseAccepted,
  createEmptyRegistry,
  removeModelRecord,
  updateModelState,
} from './registry';

const STORE_DIRECTORY = 'ModelCommons';
const LEGACY_DIRECTORY = 'models';
const REGISTRY_FILE = 'registry.json';
const PROTOCOL_FILE = 'protocol.json';
const DOWNLOAD_MANIFEST_FILE = 'download-manifest.json';
const MIGRATION_JOURNAL_FILE = 'migrations/legacy-medgemma.json';
const DISK_SAFETY_BYTES = 512 * 1024 ** 2;

interface DownloadFileState {
  path: string;
  bytesWritten: number;
  bytesExpected?: number;
  resumeData?: string;
  completed: boolean;
}

interface DownloadManifest {
  schema: 'modelcommons.download';
  schemaVersion: 1;
  modelId: string;
  revision: string;
  files: DownloadFileState[];
  updatedAt: number;
}

interface LegacyMigrationJournal {
  schema: 'modelcommons.legacy-medgemma-migration';
  schemaVersion: 1;
  storageId: string;
  modelFileName: string;
  projectionFileName?: string;
  modelSizeBytes: number;
  projectionSizeBytes?: number;
}

export interface ModelDownloadProgress {
  modelId: string;
  fileRole: ModelArtifactFile['role'];
  phase: 'downloading' | 'verifying';
  bytesWritten: number;
  bytesExpected?: number;
  percent?: number;
}

export interface ModelStoreOptions {
  storageDestination?: 'documents' | 'app-group';
  beforeDelete?: (modelId: string) => Promise<void>;
}

type SizedFileInfo = FileSystem.FileInfo & { size?: number };

function documentRoot(): string {
  if (!FileSystem.documentDirectory) {
    throw new ModelCommonsError(
      Platform.OS === 'web' ? 'TRANSPORT_UNAVAILABLE' : 'STORAGE_UNAVAILABLE',
      'Persistent ModelCommons storage is unavailable on this platform.'
    );
  }
  return FileSystem.documentDirectory;
}

function basenameFromUri(uri: string): string {
  const withoutQuery = uri.split(/[?#]/, 1)[0];
  const encoded = withoutQuery.split('/').filter(Boolean).pop() ?? '';
  let value = encoded;
  try { value = decodeURIComponent(encoded); } catch { /* rejected below */ }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,254}$/.test(value) || value === '.' || value === '..') {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Legacy artifact filename is unsafe.');
  }
  return value;
}

function storedRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ModelCommonsError('INTEGRITY_FAILED', `${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function nonNegativeSafeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new ModelCommonsError('INTEGRITY_FAILED', `${label} must be a non-negative safe integer.`);
  }
  return Number(value);
}

function parseDownloadState(value: unknown, manifest: ModelManifest): DownloadManifest | null {
  if (value === null) return null;
  const candidate = storedRecord(value, 'Download metadata');
  if (
    candidate.schema !== 'modelcommons.download'
    || candidate.schemaVersion !== 1
    || candidate.modelId !== manifest.id
    || candidate.revision !== manifest.revision
    || !Array.isArray(candidate.files)
  ) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Download metadata identity or schema is invalid.');
  }
  const requiredPaths = new Set(
    manifest.files.filter((file) => file.required).map((file) => assertSafeRelativePath(file.path))
  );
  const seen = new Set<string>();
  const files = candidate.files.map((rawFile, index): DownloadFileState => {
    const file = storedRecord(rawFile, `Download metadata file ${index}`);
    const path = assertSafeRelativePath(typeof file.path === 'string' ? file.path : '');
    if (!requiredPaths.has(path) || seen.has(path)) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'Download metadata contains an unknown or duplicate path.');
    }
    seen.add(path);
    const bytesWritten = nonNegativeSafeInteger(file.bytesWritten, 'bytesWritten');
    const bytesExpected = file.bytesExpected === undefined
      ? undefined
      : nonNegativeSafeInteger(file.bytesExpected, 'bytesExpected');
    if (bytesExpected !== undefined && bytesWritten > bytesExpected) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'Download progress exceeds the expected artifact size.');
    }
    if (typeof file.completed !== 'boolean') {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'Download completion state must be a boolean.');
    }
    if (
      file.resumeData !== undefined
      && (typeof file.resumeData !== 'string' || file.resumeData.length > 4 * 1024 * 1024)
    ) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'Download resume metadata is invalid or too large.');
    }
    return {
      path,
      bytesWritten,
      ...(bytesExpected !== undefined ? { bytesExpected } : {}),
      ...(typeof file.resumeData === 'string' ? { resumeData: file.resumeData } : {}),
      completed: file.completed,
    };
  });
  if (seen.size !== requiredPaths.size) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Download metadata is missing a required artifact.');
  }
  const updatedAt = nonNegativeSafeInteger(candidate.updatedAt, 'updatedAt');
  return {
    schema: 'modelcommons.download',
    schemaVersion: 1,
    modelId: manifest.id,
    revision: manifest.revision,
    files,
    updatedAt,
  };
}

function parseMigrationJournal(value: unknown): LegacyMigrationJournal | null {
  if (value === null) return null;
  const candidate = storedRecord(value, 'Legacy migration journal');
  if (candidate.schema !== 'modelcommons.legacy-medgemma-migration' || candidate.schemaVersion !== 1) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Legacy migration journal schema is invalid.');
  }
  const storageId = assertSafeStorageId(typeof candidate.storageId === 'string' ? candidate.storageId : '');
  const modelFileName = typeof candidate.modelFileName === 'string' ? candidate.modelFileName : '';
  if (basenameFromUri(modelFileName) !== modelFileName || assertSafeRelativePath(modelFileName) !== modelFileName) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Legacy migration model filename is unsafe.');
  }
  const modelSizeBytes = nonNegativeSafeInteger(candidate.modelSizeBytes, 'modelSizeBytes');
  if (modelSizeBytes === 0) throw new ModelCommonsError('INTEGRITY_FAILED', 'Legacy model size must be positive.');
  let projectionFileName: string | undefined;
  let projectionSizeBytes: number | undefined;
  if (candidate.projectionFileName !== undefined) {
    if (
      typeof candidate.projectionFileName !== 'string'
      || basenameFromUri(candidate.projectionFileName) !== candidate.projectionFileName
      || assertSafeRelativePath(candidate.projectionFileName) !== candidate.projectionFileName
    ) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'Legacy projection filename is unsafe.');
    }
    projectionFileName = candidate.projectionFileName;
    projectionSizeBytes = nonNegativeSafeInteger(candidate.projectionSizeBytes, 'projectionSizeBytes');
    if (projectionSizeBytes === 0) throw new ModelCommonsError('INTEGRITY_FAILED', 'Legacy projection size must be positive.');
  } else if (candidate.projectionSizeBytes !== undefined) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Legacy projection size has no matching filename.');
  }
  return {
    schema: 'modelcommons.legacy-medgemma-migration',
    schemaVersion: 1,
    storageId,
    modelFileName,
    modelSizeBytes,
    ...(projectionFileName ? { projectionFileName, projectionSizeBytes } : {}),
  };
}

async function exists(uri: string): Promise<boolean> {
  return (await FileSystem.getInfoAsync(uri)).exists;
}

async function ensureDirectory(uri: string): Promise<void> {
  if (!(await exists(uri))) {
    await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
  }
}

async function readJson<T>(uri: string): Promise<T | null> {
  if (!(await exists(uri))) {
    const next = `${uri}.next`;
    const previous = `${uri}.previous`;
    if (await exists(next)) {
      await FileSystem.moveAsync({ from: next, to: uri });
    } else if (await exists(previous)) {
      await FileSystem.moveAsync({ from: previous, to: uri });
    } else {
      return null;
    }
  }
  try {
    return JSON.parse(await FileSystem.readAsStringAsync(uri)) as T;
  } catch (cause) {
    const previous = `${uri}.previous`;
    if (await exists(previous)) {
      try {
        const recovered = JSON.parse(await FileSystem.readAsStringAsync(previous)) as T;
        await FileSystem.deleteAsync(uri, { idempotent: true });
        await FileSystem.moveAsync({ from: previous, to: uri });
        return recovered;
      } catch {
        // Report the original corruption below without exposing stored content.
      }
    }
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Stored JSON is invalid.', {
      details: { file: basenameFromUri(uri) },
      cause,
    });
  }
}

async function atomicWriteJson(uri: string, value: unknown): Promise<void> {
  const temporary = `${uri}.next`;
  const previous = `${uri}.previous`;
  await FileSystem.deleteAsync(temporary, { idempotent: true });
  await FileSystem.writeAsStringAsync(temporary, JSON.stringify(value, null, 2));
  try {
    if (hasNativeMethod('atomicReplaceFile')) {
      await nativeAtomicReplaceFile(temporary, uri);
      return;
    }

    // Expo's legacy filesystem does not expose replaceItemAt. The fallback is
    // a recoverable two-phase swap: readJson promotes .next or restores
    // .previous after interruption. The native module provides true replace.
    await FileSystem.deleteAsync(previous, { idempotent: true });
    if (await exists(uri)) await FileSystem.moveAsync({ from: uri, to: previous });
    await FileSystem.moveAsync({ from: temporary, to: uri });
    await FileSystem.deleteAsync(previous, { idempotent: true });
  } catch (cause) {
    if (!(await exists(uri)) && await exists(previous)) {
      await FileSystem.moveAsync({ from: previous, to: uri });
    }
    throw new ModelCommonsError('STORAGE_UNAVAILABLE', 'Atomic metadata publication failed.', { cause });
  }
}

function nativeSha256(): ((uri: string) => Promise<string>) | undefined {
  // Expo Kotlin/Swift modules are resolved through Expo Modules Core, not
  // necessarily React Native's NativeModules object.  This must use the
  // shared bridge so Android's registered streaming verifier is discoverable
  // in new-architecture builds.
  return hasNativeMethod('sha256File') ? nativeSha256File : undefined;
}

async function publishAndroidHubSnapshot(registry: ModelRegistry): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (!hasNativeMethod('publishAndroidHubState')) return;
  const models = registry.models.map((record) => ({
    id: record.manifest.id,
    revision: record.manifest.revision,
    displayName: record.manifest.displayName,
    state: record.state === 'READY'
      && (!record.manifest.license.acceptanceRequired || registry.licenseAcceptances.some(
        (entry) => entry.modelId === record.manifest.id
          && entry.modelRevision === record.manifest.revision
          && entry.licenseId === record.manifest.license.id
          && entry.licenseUrl === record.manifest.license.url
      ))
      ? 'READY'
      : record.state === 'READY' ? 'NOT_READY' : record.state,
    // Binder discovery advertises executable adapter capabilities, not the
    // broader catalog metadata shown in the Hub UI.
    capabilities: record.manifest.capabilities.includes('text') ? ['text'] : [],
  }));
  try {
    await nativePublishAndroidHubState(models);
  } catch {
    // The immutable registry remains authoritative. This auxiliary Binder
    // discovery snapshot is retried on every mutation and Hub initialization.
    diagnosticLogger.warn('android_hub_snapshot_publish_failed', {
      platform: 'android',
      failureCategory: 'NATIVE_SNAPSHOT_UNAVAILABLE',
    });
  }
}

async function verifyArtifact(
  uri: string,
  file: ModelArtifactFile,
  options: { verifyIntegrity?: boolean } = {}
): Promise<void> {
  const info = (await FileSystem.getInfoAsync(uri)) as SizedFileInfo;
  if (!info.exists || !info.size || info.size <= 0) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'A required model artifact is missing or empty.', {
      details: { path: file.path },
    });
  }
  if (file.sizeBytes !== undefined && info.size !== file.sizeBytes) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Model artifact size does not match the manifest.', {
      details: { path: file.path, expected: file.sizeBytes, actual: info.size },
    });
  }
  if (file.integrity && options.verifyIntegrity !== false) {
    const hash = nativeSha256();
    if (!hash) {
      throw new ModelCommonsError(
        'INTEGRITY_FAILED',
        'SHA-256 verification is required for this artifact but the native verifier is unavailable.'
      );
    }
    const actual = (await hash(uri)).toLowerCase();
    if (actual !== file.integrity.digest.toLowerCase()) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'Model artifact SHA-256 verification failed.', {
        details: { path: file.path, expected: file.integrity.digest, actual },
      });
    }
  }
}

function createDownloadManifest(manifest: ModelManifest): DownloadManifest {
  return {
    schema: 'modelcommons.download',
    schemaVersion: 1,
    modelId: manifest.id,
    revision: manifest.revision,
    files: manifest.files.filter((file) => file.required).map((file) => ({
      path: file.path,
      bytesWritten: 0,
      bytesExpected: file.sizeBytes,
      completed: false,
    })),
    updatedAt: Date.now(),
  };
}

export class ModelStore {
  readonly storageDestination: 'documents' | 'app-group';
  #groupRoot?: string;
  #beforeDelete?: (modelId: string) => Promise<void>;
  #registry: ModelRegistry = createEmptyRegistry();
  #initialized = false;
  #initialization?: Promise<ModelRegistry>;
  #mutation: Promise<void> = Promise.resolve();
  #verifiedRevisions = new Set<string>();

  constructor(options: ModelStoreOptions = {}) {
    this.#beforeDelete = options.beforeDelete;
    this.storageDestination = options.storageDestination ?? 'documents';
  }

  setBeforeDelete(handler: (modelId: string) => Promise<void>): void {
    this.#beforeDelete = handler;
  }

  get rootUri(): string | undefined {
    return this.storageDestination === 'app-group' ? this.#groupRoot
      : FileSystem.documentDirectory ? this.#storeRoot() : undefined;
  }

  #storeRoot(): string {
    if (this.storageDestination === 'documents') return `${documentRoot()}${STORE_DIRECTORY}/`;
    if (!this.#groupRoot) throw new ModelCommonsError('MODEL_NOT_READY', 'Initialize the configured App Group store first.');
    return this.#groupRoot;
  }

  #storeUri(path: string): string { return `${this.#storeRoot()}${assertSafeRelativePath(path)}`; }
  #modelDirectory(manifest: ModelManifest): string {
    return `${this.#storeRoot()}models/${assertSafeStorageId(manifest.storageId)}/`;
  }

  get catalog(): readonly ModelManifest[] {
    return MODEL_CATALOG;
  }

  get registry(): ModelRegistry {
    return this.#registry;
  }

  async initialize(): Promise<ModelRegistry> {
    if (this.#initialized) return this.#registry;
    if (!this.#initialization) {
      this.#initialization = this.#initializeStore().catch((error) => {
        this.#initialization = undefined;
        throw error;
      });
    }
    return this.#initialization;
  }

  async #initializeStore(): Promise<ModelRegistry> {
    if (this.storageDestination === 'app-group') {
      if (Platform.OS !== 'ios') throw new ModelCommonsError('FEATURE_UNSUPPORTED', 'App Group ownership requires iOS.');
      const resolved = await resolveOwnerAppGroupRoot();
      this.#groupRoot = resolved.endsWith('/') ? resolved : `${resolved}/`;
    }
    if (!FileSystem.documentDirectory && this.storageDestination === 'documents') {
      this.#initialized = true;
      return this.#registry;
    }

    await ensureDirectory(this.#storeRoot());
    for (const directory of ['models', 'clients', 'profiles', 'device', 'migrations']) {
      await ensureDirectory(`${this.#storeRoot()}${directory}/`);
    }
    const protocolUri = this.#storeUri(PROTOCOL_FILE);
    const storedProtocol = await readJson<unknown>(protocolUri);
    if (storedProtocol) {
      const marker = storedRecord(storedProtocol, 'Stored protocol marker');
      if (
        marker.schema !== 'modelcommons.protocol'
        || marker.schemaVersion !== 1
        || typeof marker.protocolVersion !== 'string'
        || !isProtocolVersionCompatible(marker.protocolVersion, PROTOCOL_VERSION)
      ) {
        throw new ModelCommonsError(
          'PROTOCOL_VERSION_UNSUPPORTED',
          'The existing ModelCommons store uses an incompatible protocol version.'
        );
      }
    } else {
      await atomicWriteJson(protocolUri, {
        schema: 'modelcommons.protocol',
        schemaVersion: 1,
        protocolVersion: PROTOCOL_VERSION,
      });
    }

    const stored = await readJson<unknown>(this.#storeUri(REGISTRY_FILE));
    this.#registry = stored ? parseModelRegistry(stored) : createEmptyRegistry();
    if (!stored) await this.#publishRegistry(this.#registry);

    if (this.storageDestination === 'documents') await this.#migrateLegacyMedGemma();
    await this.#repairReadyStates();
    await publishAndroidHubSnapshot(this.#registry);
    this.#initialized = true;
    return this.#registry;
  }

  async acceptLicense(modelId: string): Promise<ModelRegistry> {
    return this.#exclusive(async () => {
      await this.initialize();
      const manifest = this.#resolveManifest(modelId);
      const next = acceptModelLicense(this.#registry, manifest);
      if (next !== this.#registry) await this.#publishRegistry(next);
      return this.#registry;
    });
  }

  isLicenseAccepted(manifest: ModelManifest): boolean {
    if (!manifest.license.acceptanceRequired) return true;
    return this.#registry.licenseAcceptances.some(
      (entry) => entry.modelId === manifest.id
        && entry.modelRevision === manifest.revision
        && entry.licenseId === manifest.license.id
        && entry.licenseUrl === manifest.license.url
    );
  }

  async download(
    modelId: string,
    options: {
      signal?: AbortSignal;
      onProgress?: (progress: ModelDownloadProgress) => void;
      confirmExperimental?: boolean;
    } = {}
  ): Promise<ModelRegistry> {
    return this.#exclusive(async () => {
      await this.initialize();
      const manifest = this.#resolveManifest(modelId);
      assertLicenseAccepted(this.#registry, manifest);
      const existing = this.#registry.models.find((entry) => entry.manifest.id === modelId);
      if (
        existing
        && (
          existing.manifest.revision !== manifest.revision
          || existing.manifest.storageId !== manifest.storageId
        )
      ) {
        throw new ModelCommonsError(
          'MODEL_INCOMPATIBLE',
          'This immutable model ID already belongs to another revision. Delete it and publish the new revision under a new model ID.',
          { details: { modelId } }
        );
      }
      if (existing?.state === 'READY') {
        return this.#registry;
      }
      if (manifest.experimental && !options.confirmExperimental) {
        throw new ModelCommonsError('PERMISSION_REQUIRED', 'Explicit confirmation is required for this large experimental model.', {
          details: { modelId },
        });
      }
      if (options.signal?.aborted) {
        throw new ModelCommonsError('USER_CANCELLED', 'Model download was cancelled.');
      }

      try {
        await this.#assertDownloadSpace(manifest);
        await ensureDirectory(this.#modelDirectory(manifest));
        await this.#publishRegistry(updateModelState(this.#registry, manifest, 'DOWNLOADING'));

        const downloadManifestUri = `${this.#modelDirectory(manifest)}${DOWNLOAD_MANIFEST_FILE}`;
        let state = parseDownloadState(await readJson<unknown>(downloadManifestUri), manifest);
        if (!state) {
          state = createDownloadManifest(manifest);
          await atomicWriteJson(downloadManifestUri, state);
        }

        for (const file of manifest.files.filter((candidate) => candidate.required)) {
          await this.#downloadArtifact(manifest, file, state, downloadManifestUri, options);
        }
        await this.#publishRegistry(updateModelState(this.#registry, manifest, 'VERIFYING'));
        for (const file of manifest.files.filter((candidate) => candidate.required)) {
          if (options.signal?.aborted) {
            throw new ModelCommonsError('USER_CANCELLED', 'Model verification was cancelled.');
          }
          options.onProgress?.({
            modelId: manifest.id,
            fileRole: file.role,
            phase: 'verifying',
            bytesWritten: file.sizeBytes ?? 0,
            bytesExpected: file.sizeBytes,
            percent: undefined,
          });
          await verifyArtifact(`${this.#modelDirectory(manifest)}${assertSafeRelativePath(file.path)}`, file);
          if (options.signal?.aborted) {
            throw new ModelCommonsError('USER_CANCELLED', 'Model verification was cancelled.');
          }
        }
        await atomicWriteJson(`${this.#modelDirectory(manifest)}manifest.json`, manifest);
        if (options.signal?.aborted) {
          throw new ModelCommonsError('USER_CANCELLED', 'Model publication was cancelled before READY.');
        }
        await this.#publishRegistry(updateModelState(this.#registry, manifest, 'READY'));
        this.#verifiedRevisions.add(this.#revisionKey(manifest));
        return this.#registry;
      } catch (error) {
        const converted = toModelCommonsError(error, 'INTEGRITY_FAILED');
        await this.#publishRegistry(updateModelState(this.#registry, manifest, 'FAILED', {
          failureCode: converted.code,
        }));
        throw converted;
      }
    });
  }

  async delete(modelId: string): Promise<ModelRegistry> {
    return this.#exclusive(async () => {
      await this.initialize();
      if (Platform.OS === 'ios') {
        throw new ModelCommonsError('FEATURE_UNSUPPORTED', 'Shared iOS model deletion is deferred until every consuming app has released its file. This Hub cannot revoke another app\'s live mmap.');
      }
      const record = this.#registry.models.find((entry) => entry.manifest.id === modelId);
      if (!record) return this.#registry;
      await this.#beforeDelete?.(modelId);
      const directory = this.#modelDirectory(record.manifest);
      await FileSystem.deleteAsync(directory, { idempotent: true });
      this.#verifiedRevisions.delete(this.#revisionKey(record.manifest));
      await this.#publishRegistry(removeModelRecord(this.#registry, record.manifest));
      return this.#registry;
    });
  }

  artifactUri(manifest: ModelManifest, role: ModelArtifactFile['role']): string | undefined {
    const file = manifest.files.find((candidate) => candidate.role === role);
    return file ? `${this.#modelDirectory(manifest)}${assertSafeRelativePath(file.path)}` : undefined;
  }

  /** Performs the full checksum gate once per immutable revision/process before load. */
  async verifyReadyModel(manifest: ModelManifest): Promise<void> {
    await this.#exclusive(async () => {
      await this.initialize();
      const record = this.#registry.models.find((entry) =>
        entry.manifest.id === manifest.id
        && entry.manifest.revision === manifest.revision
        && entry.manifest.storageId === manifest.storageId
      );
      if (!record || record.state !== 'READY') {
        throw new ModelCommonsError('MODEL_NOT_READY', 'The immutable model revision is not ready for verification.');
      }
      const key = this.#revisionKey(record.manifest);
      if (this.#verifiedRevisions.has(key)) return;
      try {
        for (const file of record.manifest.files.filter((candidate) => candidate.required)) {
          await verifyArtifact(`${this.#modelDirectory(record.manifest)}${assertSafeRelativePath(file.path)}`, file);
        }
        this.#verifiedRevisions.add(key);
      } catch (error) {
        const failure = toModelCommonsError(error, 'INTEGRITY_FAILED');
        await this.#publishRegistry(updateModelState(this.#registry, record.manifest, 'FAILED', {
          failureCode: failure.code,
        }));
        throw failure;
      }
    });
  }

  #resolveManifest(modelId: string): ModelManifest {
    const catalog = MODEL_CATALOG.find((candidate) => candidate.id === modelId);
    const installed = this.#registry.models.find((candidate) => candidate.manifest.id === modelId)?.manifest;
    const manifest = catalog ?? installed;
    if (!manifest) {
      throw new ModelCommonsError('MODEL_NOT_FOUND', 'The requested model is not in the catalog or registry.', {
        details: { modelId },
      });
    }
    return manifest;
  }

  async #downloadArtifact(
    manifest: ModelManifest,
    file: ModelArtifactFile,
    state: DownloadManifest,
    stateUri: string,
    options: {
      signal?: AbortSignal;
      onProgress?: (progress: ModelDownloadProgress) => void;
    }
  ): Promise<void> {
    if (!file.download) {
      throw new ModelCommonsError('MODEL_NOT_READY', 'Required catalog artifact has no download source.', {
        details: { modelId: manifest.id, path: file.path },
      });
    }
    const source = assertHttpsUrl(file.download.url);
    const destination = `${this.#modelDirectory(manifest)}${assertSafeRelativePath(file.path)}`;
    const partial = `${destination}.part`;
    const fileState = state.files.find((candidate) => candidate.path === file.path)
      ?? { path: file.path, bytesWritten: 0, bytesExpected: file.sizeBytes, completed: false };
    if (!state.files.includes(fileState)) state.files.push(fileState);

    if (await exists(destination)) {
      await verifyArtifact(destination, file);
      fileState.completed = true;
      fileState.resumeData = undefined;
      fileState.bytesWritten = file.sizeBytes ?? (await FileSystem.getInfoAsync(destination) as SizedFileInfo).size ?? 0;
      if (!state.files.includes(fileState)) state.files.push(fileState);
      state.updatedAt = Date.now();
      await atomicWriteJson(stateUri, state);
      return;
    }

    const resumable = FileSystem.createDownloadResumable(
      source,
      partial,
      {},
      (progress) => {
        fileState.bytesWritten = progress.totalBytesWritten;
        fileState.bytesExpected = progress.totalBytesExpectedToWrite || file.sizeBytes;
        const expected = fileState.bytesExpected;
        options.onProgress?.({
          modelId: manifest.id,
          fileRole: file.role,
          phase: 'downloading',
          bytesWritten: fileState.bytesWritten,
          bytesExpected: expected,
          percent: expected ? Math.min(100, Math.round(fileState.bytesWritten / expected * 100)) : undefined,
        });
      },
      fileState.resumeData
    );

    let pausePromise: Promise<void> | undefined;
    const onAbort = () => {
      pausePromise = resumable.pauseAsync().then(async (pause) => {
        fileState.resumeData = pause.resumeData;
        const partialInfo = await FileSystem.getInfoAsync(partial) as SizedFileInfo;
        if (partialInfo.exists && partialInfo.size !== undefined) {
          fileState.bytesWritten = partialInfo.size;
        }
        fileState.bytesExpected = file.sizeBytes ?? fileState.bytesExpected;
        state.updatedAt = Date.now();
        await atomicWriteJson(stateUri, state);
      }).catch(() => undefined);
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      if (options.signal?.aborted) {
        onAbort();
        await pausePromise;
        throw new ModelCommonsError('USER_CANCELLED', 'Model download was cancelled.');
      }
      const result = await resumable.downloadAsync();
      if (options.signal?.aborted) {
        await pausePromise;
        throw new ModelCommonsError('USER_CANCELLED', 'Model download was cancelled.');
      }
      if (!result?.uri) {
        throw new ModelCommonsError('STORAGE_UNAVAILABLE', 'Model download ended without a staged artifact.');
      }
      await verifyArtifact(partial, file);
      if (await exists(destination)) {
        throw new ModelCommonsError('INTEGRITY_FAILED', 'Immutable artifact destination already exists.');
      }
      await FileSystem.moveAsync({ from: partial, to: destination });
      fileState.completed = true;
      fileState.resumeData = undefined;
      fileState.bytesWritten = file.sizeBytes ?? fileState.bytesWritten;
      if (!state.files.includes(fileState)) state.files.push(fileState);
      state.updatedAt = Date.now();
      await atomicWriteJson(stateUri, state);
    } catch (error) {
      if (options.signal?.aborted) {
        await pausePromise;
        throw new ModelCommonsError('USER_CANCELLED', 'Model download was cancelled.');
      }
      throw error;
    } finally {
      options.signal?.removeEventListener('abort', onAbort);
    }
  }

  async #assertDownloadSpace(manifest: ModelManifest): Promise<void> {
    if (typeof FileSystem.getFreeDiskStorageAsync !== 'function') return;
    const free = await FileSystem.getFreeDiskStorageAsync();
    let required = 0;
    for (const file of manifest.files.filter((candidate) => candidate.required)) {
      if (file.sizeBytes === undefined) continue;
      const destination = `${this.#modelDirectory(manifest)}${assertSafeRelativePath(file.path)}`;
      const finalInfo = (await FileSystem.getInfoAsync(destination)) as SizedFileInfo;
      const partialInfo = (await FileSystem.getInfoAsync(`${destination}.part`)) as SizedFileInfo;
      const present = finalInfo.exists ? finalInfo.size ?? 0 : partialInfo.exists ? partialInfo.size ?? 0 : 0;
      required += Math.max(0, file.sizeBytes - present);
    }
    if (required > 0 && free < required + DISK_SAFETY_BYTES) {
      throw new ModelCommonsError('STORAGE_UNAVAILABLE', 'There is not enough free storage to stage and publish this model.', {
        details: { freeBytes: free, requiredBytes: required + DISK_SAFETY_BYTES },
      });
    }
  }

  async #repairReadyStates(): Promise<void> {
    for (const record of [...this.#registry.models]) {
      if (record.state !== 'READY') continue;
      try {
        for (const file of record.manifest.files.filter((candidate) => candidate.required)) {
          // Startup performs a cheap existence/size repair. Full SHA-256 runs
          // once per process immediately before the first model load.
          await verifyArtifact(
            `${this.#modelDirectory(record.manifest)}${assertSafeRelativePath(file.path)}`,
            file,
            { verifyIntegrity: false }
          );
        }
      } catch (error) {
        const failure = toModelCommonsError(error, 'INTEGRITY_FAILED');
        await this.#publishRegistry(updateModelState(this.#registry, record.manifest, 'FAILED', {
          failureCode: failure.code,
        }));
      }
    }
  }

  async #migrateLegacyMedGemma(): Promise<void> {
    const legacyRoot = `${documentRoot()}${LEGACY_DIRECTORY}/`;
    const journalUri = this.#storeUri(MIGRATION_JOURNAL_FILE);
    let journal = parseMigrationJournal(await readJson<unknown>(journalUri));
    const legacyExists = await exists(legacyRoot);
    if (!journal && !legacyExists) return;

    if (!journal) {
      const oldManifest = await readJson<Record<string, unknown>>(`${legacyRoot}download-manifest.json`);
      if (!oldManifest || typeof oldManifest.ggufUri !== 'string') return;
      if (!oldManifest.ggufUri.startsWith(legacyRoot)) {
        throw new ModelCommonsError('INTEGRITY_FAILED', 'Legacy model path escapes the donor model directory.');
      }
      const modelFileName = basenameFromUri(oldManifest.ggufUri);
      const modelInfo = (await FileSystem.getInfoAsync(`${legacyRoot}${modelFileName}`)) as SizedFileInfo;
      if (!modelInfo.exists || !modelInfo.size) return;

      let projectionFileName: string | undefined;
      let projectionSizeBytes: number | undefined;
      if (typeof oldManifest.mmprojUri === 'string' && oldManifest.mmprojUri) {
        if (!oldManifest.mmprojUri.startsWith(legacyRoot)) {
          throw new ModelCommonsError('INTEGRITY_FAILED', 'Legacy projection path escapes the donor model directory.');
        }
        projectionFileName = basenameFromUri(oldManifest.mmprojUri);
        const info = (await FileSystem.getInfoAsync(`${legacyRoot}${projectionFileName}`)) as SizedFileInfo;
        if (info.exists && info.size) projectionSizeBytes = info.size;
        else projectionFileName = undefined;
      }
      journal = {
        schema: 'modelcommons.legacy-medgemma-migration',
        schemaVersion: 1,
        storageId: 'medgemma-4b-it-legacy-donor-v1',
        modelFileName,
        projectionFileName,
        modelSizeBytes: modelInfo.size,
        projectionSizeBytes,
      };
      await atomicWriteJson(journalUri, journal);
    }

    const destination = `${this.#storeRoot()}models/${assertSafeStorageId(journal.storageId)}/`;
    const destinationExists = await exists(destination);
    if (legacyExists && !destinationExists) {
      await FileSystem.moveAsync({ from: legacyRoot, to: destination });
    } else if (legacyExists && destinationExists) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'Both legacy and migration-stage model directories exist; refusing to overwrite either.');
    }

    const sourceModel = `${destination}${journal.modelFileName}`;
    const targetModel = `${destination}model.gguf`;
    if (journal.modelFileName !== 'model.gguf' && await exists(sourceModel) && !(await exists(targetModel))) {
      await FileSystem.moveAsync({ from: sourceModel, to: targetModel });
    }
    let projectionPresent = false;
    if (journal.projectionFileName) {
      const sourceProjection = `${destination}${journal.projectionFileName}`;
      const targetProjection = `${destination}mmproj.gguf`;
      if (journal.projectionFileName !== 'mmproj.gguf' && await exists(sourceProjection) && !(await exists(targetProjection))) {
        await FileSystem.moveAsync({ from: sourceProjection, to: targetProjection });
      }
      projectionPresent = await exists(targetProjection);
    }
    if (!(await exists(targetModel))) return;

    const manifest = parseModelManifest({
      schema: 'modelcommons.model-manifest',
      schemaVersion: 1,
      protocolVersion: PROTOCOL_VERSION,
      id: 'local/migrated-medgemma-4b-it',
      revision: 'legacy-donor-v1',
      storageId: journal.storageId,
      displayName: 'Migrated MedGemma 4B (donor install)',
      family: 'MedGemma',
      architecture: { type: 'dense', parametersBillions: 4 },
      format: 'gguf',
      quantization: journal.modelFileName.match(/(Q\d[^.]+)/i)?.[1],
      files: [
        { role: 'model', path: 'model.gguf', required: true, sizeBytes: journal.modelSizeBytes },
        ...(projectionPresent
          ? [{ role: 'mmproj', path: 'mmproj.gguf', required: true, sizeBytes: journal.projectionSizeBytes }]
          : []),
      ],
      source: {
        provider: 'user',
        modelCardUrl: 'https://huggingface.co/unsloth/medgemma-4b-it-GGUF',
      },
      license: {
        id: 'health-ai-developer-foundations',
        name: 'Health AI Developer Foundations terms',
        url: 'https://developers.google.com/health-ai-developer-foundations/medgemma',
        acceptanceRequired: true,
        gated: true,
        redistribution: 'restricted',
      },
      capabilities: projectionPresent ? ['text', 'vision'] : ['text'],
      compatibleRuntimes: [{ id: 'llama.rn', minimumVersion: '0.11.2' }],
      context: { recommended: 768, maximum: 8192 },
      memory: {
        fileBytes: journal.modelSizeBytes + (journal.projectionSizeBytes ?? 0),
        estimatedMinimumRamBytes: 5 * 1024 ** 3,
        recommendedRamBytes: 8 * 1024 ** 3,
        notes: ['Imported without a published checksum; size was validated but cryptographic integrity was not claimed.'],
      },
      recommendedProfiles: ['safe'],
    });
    await atomicWriteJson(`${destination}manifest.json`, manifest);
    await this.#publishRegistry(updateModelState(this.#registry, manifest, 'READY'));
    await FileSystem.deleteAsync(journalUri, { idempotent: true });
  }

  async #publishRegistry(next: ModelRegistry): Promise<void> {
    await atomicWriteJson(this.#storeUri(REGISTRY_FILE), next);
    this.#registry = next;
    await publishAndroidHubSnapshot(next);
  }

  #revisionKey(manifest: Pick<ModelManifest, 'id' | 'revision' | 'storageId'>): string {
    return `${manifest.id}\u0000${manifest.revision}\u0000${manifest.storageId}`;
  }

  async #exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.#mutation;
    let release!: () => void;
    this.#mutation = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}

export const modelStore = new ModelStore({
  storageDestination: Platform.OS === 'ios'
    && Constants.expoConfig?.extra?.modelCommons?.storageDestination === 'app-group' ? 'app-group' : 'documents',
});

import {
  PROTOCOL_VERSION,
  ModelCommonsError,
  assertSafeRelativePath,
  parseModelRegistry,
  type ModelLifecycleState,
  type ModelManifest,
  type ModelRegistry,
  type ModelRegistryRecord,
} from '@modelcommons/protocol';

export function createEmptyRegistry(now = Date.now()): ModelRegistry {
  return {
    schema: 'modelcommons.registry',
    schemaVersion: 1,
    protocolVersion: PROTOCOL_VERSION,
    revision: 0,
    updatedAt: now,
    models: [],
    aliases: {},
    licenseAcceptances: [],
  };
}

export function modelManifestRelativePath(manifest: ModelManifest): string {
  return assertSafeRelativePath(`models/${manifest.storageId}/manifest.json`);
}

export function artifactRelativePath(manifest: ModelManifest, artifactPath: string): string {
  return assertSafeRelativePath(`models/${manifest.storageId}/${assertSafeRelativePath(artifactPath)}`);
}

export function updateModelState(
  current: ModelRegistry,
  manifest: ModelManifest,
  state: ModelLifecycleState,
  options: {
    now?: number;
    failureCode?: string;
    installedAt?: number;
    readyAt?: number;
  } = {}
): ModelRegistry {
  const now = options.now ?? Date.now();
  const previous = current.models.find((entry) => entry.manifest.id === manifest.id);
  if (
    previous
    && (
      previous.manifest.revision !== manifest.revision
      || previous.manifest.storageId !== manifest.storageId
    )
  ) {
    throw new ModelCommonsError(
      'MODEL_INCOMPATIBLE',
      'A model ID is immutable and cannot be reused for a different revision or storage identity.',
      { details: { modelId: manifest.id } }
    );
  }
  const entry: ModelRegistryRecord = {
    manifest,
    state,
    relativeManifestPath: modelManifestRelativePath(manifest),
    installedAt: state === 'NOT_INSTALLED'
      ? undefined
      : options.installedAt ?? previous?.installedAt ?? now,
    readyAt: state === 'READY' ? options.readyAt ?? previous?.readyAt ?? now : undefined,
    ...(options.failureCode ? { failureCode: options.failureCode } : {}),
  };

  const models = current.models.filter((candidate) => candidate.manifest.id !== manifest.id);
  return parseModelRegistry({
    ...current,
    revision: current.revision + 1,
    updatedAt: now,
    models: [...models, entry].sort((a, b) => a.manifest.id.localeCompare(b.manifest.id)),
  });
}

export function removeModelRecord(
  current: ModelRegistry,
  manifest: Pick<ModelManifest, 'id' | 'revision' | 'storageId'>,
  now = Date.now()
): ModelRegistry {
  const present = current.models.some((entry) =>
    entry.manifest.id === manifest.id
    && entry.manifest.revision === manifest.revision
    && entry.manifest.storageId === manifest.storageId
  );
  if (!present) return current;
  return parseModelRegistry({
    ...current,
    revision: current.revision + 1,
    updatedAt: now,
    models: current.models.filter((entry) => !(
      entry.manifest.id === manifest.id
      && entry.manifest.revision === manifest.revision
      && entry.manifest.storageId === manifest.storageId
    )),
  });
}

export function acceptModelLicense(
  current: ModelRegistry,
  manifest: ModelManifest,
  now = Date.now()
): ModelRegistry {
  const existing = current.licenseAcceptances.some(
    (acceptance) => acceptance.modelId === manifest.id
      && acceptance.modelRevision === manifest.revision
      && acceptance.licenseId === manifest.license.id
      && acceptance.licenseUrl === manifest.license.url
  );
  if (existing) return current;
  return parseModelRegistry({
    ...current,
    revision: current.revision + 1,
    updatedAt: now,
    licenseAcceptances: [
      ...current.licenseAcceptances,
      {
        modelId: manifest.id,
        modelRevision: manifest.revision,
        licenseId: manifest.license.id,
        licenseUrl: manifest.license.url,
        acceptedAt: now,
      },
    ],
  });
}

export function assertLicenseAccepted(registry: ModelRegistry, manifest: ModelManifest): void {
  if (!manifest.license.acceptanceRequired) return;
  const accepted = registry.licenseAcceptances.some(
    (entry) => entry.modelId === manifest.id
      && entry.modelRevision === manifest.revision
      && entry.licenseId === manifest.license.id
      && entry.licenseUrl === manifest.license.url
  );
  if (!accepted) {
    throw new ModelCommonsError('LICENSE_ACCEPTANCE_REQUIRED', 'Accept the model license before downloading or loading it.', {
      details: { modelId: manifest.id, licenseId: manifest.license.id, licenseUrl: manifest.license.url },
    });
  }
}

export function assertReadyRecordHasArtifacts(
  record: ModelRegistryRecord,
  artifactExists: (relativePath: string) => boolean
): void {
  if (record.state !== 'READY') return;
  for (const file of record.manifest.files.filter((candidate) => candidate.required)) {
    const path = artifactRelativePath(record.manifest, file.path);
    if (!artifactExists(path)) {
      throw new ModelCommonsError('MODEL_NOT_READY', 'A READY registry entry is missing a required artifact.', {
        details: { modelId: record.manifest.id, path },
      });
    }
  }
}

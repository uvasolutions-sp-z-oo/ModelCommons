import { ModelCommonsError, parseModelManifest, type ModelManifest } from '@modelcommons/protocol';

export interface StorePolicy {
  provision: boolean;
  privateImport: boolean;
  /** Exact HTTPS origins, including every allowed redirect target. */
  downloadOrigins: readonly string[];
  /** Independently supplied trust anchors; never taken from the connected store. */
  approvedModels: readonly ModelManifest[];
}

export function snapshotPolicy(input: StorePolicy): StorePolicy {
  if (!input || typeof input.provision !== 'boolean' || typeof input.privateImport !== 'boolean'
    || !Array.isArray(input.downloadOrigins) || !Array.isArray(input.approvedModels)) {
    throw new ModelCommonsError('PERMISSION_REQUIRED', 'Invalid model storage policy.');
  }
  const origins = input.downloadOrigins.map((origin) => {
    let parsed: URL;
    try { parsed = new URL(origin); }
    catch { throw new ModelCommonsError('PERMISSION_REQUIRED', 'Download policy contains an invalid origin.'); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.origin !== origin) {
      throw new ModelCommonsError('PERMISSION_REQUIRED', 'Download policy requires exact HTTPS origins.');
    }
    return origin;
  });
  const models = input.approvedModels.map((model) => parseModelManifest(JSON.parse(JSON.stringify(model))));
  for (const model of models) {
    for (const file of model.files.filter((item) => item.required)) {
      if (!file.sizeBytes || file.integrity?.algorithm !== 'sha256') {
        throw new ModelCommonsError('INTEGRITY_FAILED', 'Approved models require exact artifact sizes and SHA-256 digests.');
      }
    }
  }
  return deepFreeze({ provision: input.provision, privateImport: input.privateImport, downloadOrigins: origins, approvedModels: models });
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export function trustedManifest(policy: StorePolicy, id: string, observed?: ModelManifest): ModelManifest {
  const trusted = policy.approvedModels.find((model) => model.id === id);
  if (!trusted) throw new ModelCommonsError('PERMISSION_REQUIRED', 'The model is not approved by this application.');
  if (observed) {
    // Trust the independently supplied metadata in its entirety. Matching a file
    // checksum alone must not grant different capabilities or weaker memory limits.
    if (observed.id !== trusted.id || observed.revision !== trusted.revision || observed.storageId !== trusted.storageId
      || observed.files.length !== trusted.files.length
      || observed.files.some((file) => {
        const expected = trusted.files.find((item) => item.path === file.path);
        return !expected || expected.role !== file.role || expected.required !== file.required
          || expected.sizeBytes !== file.sizeBytes || expected.integrity?.digest !== file.integrity?.digest;
      })) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'Stored model identity does not match the approved revision.');
    }
  }
  return trusted;
}

export function assertDownloadOrigin(policy: StorePolicy, url: string): void {
  let parsed: URL;
  try { parsed = new URL(url); }
  catch { throw new ModelCommonsError('PERMISSION_REQUIRED', 'Model provisioning source is invalid.'); }
  if (!policy.provision || parsed.protocol !== 'https:' || parsed.username || parsed.password
    || !policy.downloadOrigins.includes(parsed.origin)) {
    throw new ModelCommonsError('PERMISSION_REQUIRED', 'Model provisioning source is not permitted.');
  }
}

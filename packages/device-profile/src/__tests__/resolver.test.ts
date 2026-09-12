import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, type DeviceProfile, type ModelManifest } from '@modelcommons/protocol';
import { resolveRuntimeProfile } from '../resolver';

const GIB = 1024 ** 3;
const device = (availableMemoryBytes?: number): DeviceProfile => ({
  schema: 'modelcommons.device-profile',
  schemaVersion: 1,
  protocolVersion: PROTOCOL_VERSION,
  platform: 'android',
  physicalMemoryBytes: 12 * GIB,
  availableMemoryBytes,
  freeDiskBytes: 30 * GIB,
  accelerators: [{ id: 'cpu', kind: 'cpu' }],
  runtimeVersions: { 'llama.rn': '0.12.9' },
  collectedAt: 1,
});

const model: ModelManifest = {
  schema: 'modelcommons.model-manifest', schemaVersion: 1, protocolVersion: PROTOCOL_VERSION,
  id: 'fixture/model', revision: 'r1', storageId: 'fixture-model', displayName: 'Fixture', family: 'fixture',
  architecture: { type: 'dense', parametersBillions: 4 }, format: 'gguf', quantization: 'Q4_K_M',
  files: [{ role: 'model', path: 'model.gguf', required: true }], source: { provider: 'user' },
  license: { id: 'fixture', url: 'https://example.com/license', acceptanceRequired: false, gated: false },
  capabilities: ['text'], compatibleRuntimes: [{ id: 'llama.rn' }], context: { recommended: 2048, maximum: 8192 },
  memory: { fileBytes: 3 * GIB, estimatedMinimumRamBytes: 5 * GIB, recommendedRamBytes: 8 * GIB },
};

describe('resolveRuntimeProfile', () => {
  it('does not substitute physical RAM for unknown available memory', () => {
    const result = resolveRuntimeProfile({ device: device(), model });
    expect(result.compatibility).toBe('SUPPORTED_WITH_WARNING');
    expect(result.reasons.join(' ')).toContain('Available memory could not be measured');
  });

  it('fails closed for impossible context', () => {
    const result = resolveRuntimeProfile({ device: device(8 * GIB), model, requestedContext: 9000 });
    expect(result.compatibility).toBe('UNSUPPORTED');
  });

  it('recommends safe after a prior OOM', () => {
    const withFailure = { ...device(8 * GIB), previousFailures: [{ modelId: model.id, profileId: 'balanced', category: 'OOM', occurredAt: 1 }] };
    const result = resolveRuntimeProfile({ device: withFailure, model });
    expect(result.profile.id).toBe('safe');
    expect(result.compatibility).toBe('SUPPORTED_WITH_WARNING');
  });

  it('does not require a second model-sized disk reserve after installation', () => {
    const lowDisk = { ...device(8 * GIB), freeDiskBytes: 100 };
    const input = { device: lowDisk, model, requestedContext: model.context.recommended };
    expect(resolveRuntimeProfile(input).compatibility).toBe('UNSUPPORTED');
    const installed = resolveRuntimeProfile({ ...input, artifactInstalled: true });
    expect(installed.compatibility).toBe('SUPPORTED');
    expect(installed.reasons.join(' ')).not.toContain('Free disk space');
  });

  it('fails closed when the declared runtime is missing or below minimum', () => {
    const requiringNewer = {
      ...model,
      compatibleRuntimes: [{ id: 'llama.rn', minimumVersion: '0.13.0' }],
    } satisfies ModelManifest;
    expect(resolveRuntimeProfile({ device: device(8 * GIB), model: requiringNewer }).compatibility).toBe('UNSUPPORTED');
    expect(resolveRuntimeProfile({ device: { ...device(8 * GIB), runtimeVersions: {} }, model }).compatibility).toBe('UNSUPPORTED');
  });

  it('rejects invalid contexts and clamps batch dimensions to a small context', () => {
    expect(() => resolveRuntimeProfile({ device: device(8 * GIB), model, requestedContext: 0 })).toThrow();
    const result = resolveRuntimeProfile({
      device: { ...device(12 * GIB), physicalMemoryBytes: 20 * GIB },
      model,
      requestedProfile: 'performance',
      requestedContext: 256,
      artifactInstalled: true,
    });
    expect(result.profile.llama.nBatch).toBeLessThanOrEqual(256);
    expect(result.profile.llama.nUbatch).toBeLessThanOrEqual(result.profile.llama.nBatch);
  });
});

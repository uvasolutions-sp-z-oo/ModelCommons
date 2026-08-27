import { PROTOCOL_VERSION, type DeviceProfile, type ModelManifest, type RuntimeProfile } from '@modelcommons/protocol';

const GIB = 1024 ** 3;

function hasAccelerator(device: DeviceProfile, kind: 'gpu' | 'npu'): boolean {
  return device.accelerators.some((accelerator) => accelerator.kind === kind);
}

/** Profiles are recommendations, not promises. The runtime must report the
 * settings and devices it actually accepted after initialization. */
export function createRuntimeProfiles(device: DeviceProfile, model?: ModelManifest): RuntimeProfile[] {
  const physical = device.physicalMemoryBytes;
  const available = device.availableMemoryBytes;
  const constrained =
    (physical !== undefined && physical < 8 * GIB)
    || (available !== undefined && available < 4 * GIB);
  const roomy =
    (physical !== undefined && physical >= 16 * GIB)
    && (available !== undefined && available >= 8 * GIB);
  const gpu = hasAccelerator(device, 'gpu');
  const moe = model?.architecture.type === 'moe';

  return [
    {
      schema: 'modelcommons.runtime-profile',
      schemaVersion: 1,
      protocolVersion: PROTOCOL_VERSION,
      id: 'safe',
      displayName: 'Safe',
      stability: 'stable',
      llama: {
        nCtx: constrained ? 768 : 2048,
        nBatch: constrained ? 64 : 128,
        nUbatch: 32,
        nGpuLayers: 0,
        ...(moe ? { nCpuMoe: 999 } : {}),
        useMmap: true,
        useMlock: false,
        cacheTypeK: 'f16',
        cacheTypeV: 'f16',
        noExtraBuffers: true,
      },
    },
    {
      schema: 'modelcommons.runtime-profile',
      schemaVersion: 1,
      protocolVersion: PROTOCOL_VERSION,
      id: 'balanced',
      displayName: 'Balanced',
      stability: 'stable',
      llama: {
        nCtx: constrained ? 1024 : 4096,
        nBatch: constrained ? 64 : 256,
        nUbatch: constrained ? 32 : 128,
        nGpuLayers: gpu ? (roomy ? 48 : 24) : 0,
        ...(moe ? { nCpuMoe: roomy ? 80 : 999 } : {}),
        useMmap: true,
        useMlock: false,
        cacheTypeK: 'q8_0',
        cacheTypeV: 'q8_0',
      },
    },
    {
      schema: 'modelcommons.runtime-profile',
      schemaVersion: 1,
      protocolVersion: PROTOCOL_VERSION,
      id: 'performance',
      displayName: 'Performance',
      stability: 'stable',
      llama: {
        nCtx: roomy ? 8192 : 4096,
        nBatch: roomy ? 512 : 256,
        nUbatch: roomy ? 256 : 128,
        nGpuLayers: gpu ? 999 : 0,
        ...(moe ? { nCpuMoe: roomy ? 32 : 999 } : {}),
        useMmap: true,
        useMlock: false,
        cacheTypeK: roomy ? 'f16' : 'q8_0',
        cacheTypeV: roomy ? 'f16' : 'q8_0',
      },
    },
    {
      schema: 'modelcommons.runtime-profile',
      schemaVersion: 1,
      protocolVersion: PROTOCOL_VERSION,
      id: 'experimental-moe',
      displayName: 'Experimental MoE (static placement)',
      stability: 'experimental',
      llama: {
        nCtx: roomy ? 4096 : 2048,
        nBatch: roomy ? 256 : 64,
        nUbatch: roomy ? 128 : 32,
        nGpuLayers: gpu && roomy ? 48 : 0,
        nCpuMoe: roomy ? 64 : 999,
        useMmap: true,
        useMlock: false,
        cacheTypeK: 'q8_0',
        cacheTypeV: 'q8_0',
        noExtraBuffers: true,
      },
    },
  ];
}

import { PROTOCOL_VERSION, parseModelManifest, type ModelManifest } from '@modelcommons/protocol';

const MEDGEMMA_REVISION = 'f98438176483313640920de5aec435f2d52bfc46';
const QWEN_MOE_REVISION = 'dae61f032d7880e6effe712505db4de5d06d6549';

export const MEDGEMMA_REFERENCE: ModelManifest = parseModelManifest({
  schema: 'modelcommons.model-manifest',
  schemaVersion: 1,
  protocolVersion: PROTOCOL_VERSION,
  id: 'unsloth/medgemma-4b-it-gguf:q4-k-m',
  revision: MEDGEMMA_REVISION,
  storageId: `medgemma-4b-it-q4-k-m-${MEDGEMMA_REVISION.slice(0, 12)}`,
  displayName: 'MedGemma 4B IT (Q4_K_M)',
  family: 'MedGemma',
  architecture: { type: 'dense', parametersBillions: 4 },
  format: 'gguf',
  quantization: 'Q4_K_M',
  files: [
    {
      role: 'model',
      path: 'model.gguf',
      required: true,
      sizeBytes: 2_489_894_720,
      download: {
        url: `https://huggingface.co/unsloth/medgemma-4b-it-GGUF/resolve/${MEDGEMMA_REVISION}/medgemma-4b-it-Q4_K_M.gguf`,
      },
      integrity: {
        algorithm: 'sha256',
        digest: 'd842e8d2aca3fc5e613c5f9255e693768eeccae729e5c2653159eb79afe751f3',
      },
    },
    {
      role: 'mmproj',
      path: 'mmproj.gguf',
      required: true,
      sizeBytes: 851_252_128,
      download: {
        url: `https://huggingface.co/unsloth/medgemma-4b-it-GGUF/resolve/${MEDGEMMA_REVISION}/mmproj-F16.gguf`,
      },
      integrity: {
        algorithm: 'sha256',
        digest: '13913a7e70893b09c40154cbd43456611ea58f12bfe1e5d4ad5b7e4875644dc3',
      },
    },
  ],
  source: {
    provider: 'huggingface',
    repository: 'unsloth/medgemma-4b-it-GGUF',
    revision: MEDGEMMA_REVISION,
    modelCardUrl: `https://huggingface.co/unsloth/medgemma-4b-it-GGUF/tree/${MEDGEMMA_REVISION}`,
  },
  license: {
    id: 'health-ai-developer-foundations',
    name: 'Health AI Developer Foundations terms',
    url: 'https://developers.google.com/health-ai-developer-foundations/medgemma',
    acceptanceRequired: true,
    gated: true,
    redistribution: 'restricted',
  },
  capabilities: ['text', 'vision'],
  compatibleRuntimes: [{ id: 'llama.rn', minimumVersion: '0.12.9' }],
  context: { recommended: 2048, trained: 128_000, maximum: 8192 },
  memory: {
    fileBytes: 3_341_146_848,
    estimatedMinimumRamBytes: 5 * 1024 ** 3,
    recommendedRamBytes: 8 * 1024 ** 3,
    notes: ['Reference estimate only; actual resident memory depends on context, backend, and OS pressure.'],
  },
  recommendedProfiles: ['safe', 'balanced'],
});

export const QWEN3_30B_A3B_EXPERIMENT: ModelManifest = parseModelManifest({
  schema: 'modelcommons.model-manifest',
  schemaVersion: 1,
  protocolVersion: PROTOCOL_VERSION,
  id: 'qwen/qwen3-30b-a3b-gguf:q4-k-m',
  revision: QWEN_MOE_REVISION,
  storageId: `qwen3-30b-a3b-q4-k-m-${QWEN_MOE_REVISION.slice(0, 12)}`,
  displayName: 'Qwen3 30B-A3B (Q4_K_M)',
  family: 'Qwen3',
  architecture: {
    type: 'moe',
    parametersBillions: { total: 30.5, activeApprox: 3.3 },
    experts: { count: 128, activePerToken: 8 },
  },
  format: 'gguf',
  quantization: 'Q4_K_M',
  files: [
    {
      role: 'model',
      path: 'model.gguf',
      required: true,
      sizeBytes: 18_556_685_824,
      download: {
        url: `https://huggingface.co/Qwen/Qwen3-30B-A3B-GGUF/resolve/${QWEN_MOE_REVISION}/Qwen3-30B-A3B-Q4_K_M.gguf`,
      },
      integrity: {
        algorithm: 'sha256',
        digest: '0d003f6662faee786ed5da3e31b29c978de5ae5d275c8794c606a7f3c01aa8f5',
      },
    },
  ],
  source: {
    provider: 'huggingface',
    repository: 'Qwen/Qwen3-30B-A3B-GGUF',
    revision: QWEN_MOE_REVISION,
    modelCardUrl: `https://huggingface.co/Qwen/Qwen3-30B-A3B-GGUF/tree/${QWEN_MOE_REVISION}`,
  },
  license: {
    id: 'Apache-2.0',
    name: 'Apache License 2.0',
    url: `https://huggingface.co/Qwen/Qwen3-30B-A3B-GGUF/blob/${QWEN_MOE_REVISION}/LICENSE`,
    acceptanceRequired: true,
    gated: false,
    redistribution: 'allowed',
  },
  capabilities: ['text', 'tools', 'structured-output'],
  compatibleRuntimes: [{ id: 'llama.rn', minimumVersion: '0.12.9' }],
  context: { recommended: 4096, trained: 32_768, maximum: 32_768 },
  memory: {
    fileBytes: 18_556_685_824,
    estimatedMinimumRamBytes: 20 * 1024 ** 3,
    recommendedRamBytes: 24 * 1024 ** 3,
    notes: [
      'Large opt-in experiment; active parameters do not make all model weights disappear from storage or memory pressure.',
      'No phone-feasibility claim is made.',
    ],
  },
  recommendedProfiles: ['experimental-moe'],
  experimental: true,
});

export const MODEL_CATALOG = [MEDGEMMA_REFERENCE, QWEN3_30B_A3B_EXPERIMENT] as const;

export function findCatalogModel(id: string): ModelManifest | undefined {
  return MODEL_CATALOG.find((manifest) => manifest.id === id);
}

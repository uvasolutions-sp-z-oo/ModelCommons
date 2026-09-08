import { PROTOCOL_VERSION, parseModelManifest, type ModelManifest } from '@modelcommons/protocol';

const MEDGEMMA_REVISION = 'f98438176483313640920de5aec435f2d52bfc46';
const QWEN_MOE_REVISION = 'dae61f032d7880e6effe712505db4de5d06d6549';
const SMOLLM2_135M_REVISION = '9e6855bc4be717fca1ef21360a1db4b29d5c559a';
const SMOLLM2_360M_REVISION = '391ed11137586e383b1be0fab9acf01d282c2e11';
const QWEN25_05B_REVISION = '9217f5db79a29953eb74d5343926648285ec7e67';

/**
 * Host-only explanations for the bundled catalog. Keep these outside the
 * protocol manifest: a manifest remains portable technical truth, whereas a
 * tier, badge, or recommendation is a ModelCommons Hub presentation choice.
 */
export interface CatalogPresentation {
  modelId: string;
  tier: 'starter' | 'general' | 'experimental';
  badge?: string;
  summary?: string;
  sortOrder: number;
  recommended?: boolean;
}

const MIB = 1024 ** 2;

export const SMOLLM2_135M_INSTRUCT: ModelManifest = parseModelManifest({
  schema: 'modelcommons.model-manifest',
  schemaVersion: 1,
  protocolVersion: PROTOCOL_VERSION,
  id: 'unsloth/smollm2-135m-instruct-gguf:q4-k-m',
  revision: SMOLLM2_135M_REVISION,
  storageId: `smollm2-135m-instruct-q4-k-m-${SMOLLM2_135M_REVISION.slice(0, 12)}`,
  displayName: 'SmolLM2 135M Instruct (Q4_K_M)',
  family: 'SmolLM2',
  architecture: { type: 'dense', parametersBillions: 0.135 },
  format: 'gguf',
  quantization: 'Q4_K_M',
  files: [{
    role: 'model',
    path: 'model.gguf',
    required: true,
    sizeBytes: 105_454_144,
    download: {
      url: `https://huggingface.co/unsloth/SmolLM2-135M-Instruct-GGUF/resolve/${SMOLLM2_135M_REVISION}/SmolLM2-135M-Instruct-Q4_K_M.gguf`,
    },
    integrity: { algorithm: 'sha256', digest: 'ed5fa30c487b282ec156c29062f1222e5c20875a944ac98289dbd242e947f747' },
  }],
  source: {
    provider: 'huggingface',
    repository: 'unsloth/SmolLM2-135M-Instruct-GGUF',
    revision: SMOLLM2_135M_REVISION,
    modelCardUrl: `https://huggingface.co/unsloth/SmolLM2-135M-Instruct-GGUF/tree/${SMOLLM2_135M_REVISION}`,
  },
  license: {
    id: 'Apache-2.0',
    name: 'Apache License 2.0',
    url: 'https://www.apache.org/licenses/LICENSE-2.0',
    acceptanceRequired: false,
    gated: false,
    redistribution: 'allowed',
  },
  capabilities: ['text'],
  compatibleRuntimes: [{ id: 'llama.rn', minimumVersion: '0.12.9' }],
  // The exact GGUF and original instruct config declare 8,192 positions. The
  // lower recommendation is deliberate for CPU-only mobile smoke tests.
  context: { recommended: 1024, trained: 8192, maximum: 8192 },
  memory: {
    fileBytes: 105_454_144,
    estimatedMinimumRamBytes: 512 * MIB,
    recommendedRamBytes: 1024 * MIB,
    notes: [
      'Conservative planning estimate for the Safe profile, not a measured resident-memory claim.',
      'Actual resident memory depends on context, KV cache, native buffers, backend placement, and OS pressure.',
    ],
  },
  recommendedProfiles: ['safe', 'balanced'],
});

export const SMOLLM2_360M_INSTRUCT: ModelManifest = parseModelManifest({
  schema: 'modelcommons.model-manifest',
  schemaVersion: 1,
  protocolVersion: PROTOCOL_VERSION,
  id: 'unsloth/smollm2-360m-instruct-gguf:q4-k-m',
  revision: SMOLLM2_360M_REVISION,
  storageId: `smollm2-360m-instruct-q4-k-m-${SMOLLM2_360M_REVISION.slice(0, 12)}`,
  displayName: 'SmolLM2 360M Instruct (Q4_K_M)',
  family: 'SmolLM2',
  architecture: { type: 'dense', parametersBillions: 0.36 },
  format: 'gguf',
  quantization: 'Q4_K_M',
  files: [{
    role: 'model',
    path: 'model.gguf',
    required: true,
    sizeBytes: 270_590_560,
    download: {
      url: `https://huggingface.co/unsloth/SmolLM2-360M-Instruct-GGUF/resolve/${SMOLLM2_360M_REVISION}/SmolLM2-360M-Instruct-Q4_K_M.gguf`,
    },
    integrity: { algorithm: 'sha256', digest: '16c7f1667fea34bacad196a57b548effcb37614db4ab5677a20c8c7b823b9e63' },
  }],
  source: {
    provider: 'huggingface',
    repository: 'unsloth/SmolLM2-360M-Instruct-GGUF',
    revision: SMOLLM2_360M_REVISION,
    modelCardUrl: `https://huggingface.co/unsloth/SmolLM2-360M-Instruct-GGUF/tree/${SMOLLM2_360M_REVISION}`,
  },
  license: {
    id: 'Apache-2.0',
    name: 'Apache License 2.0',
    url: 'https://www.apache.org/licenses/LICENSE-2.0',
    acceptanceRequired: false,
    gated: false,
    redistribution: 'allowed',
  },
  capabilities: ['text'],
  compatibleRuntimes: [{ id: 'llama.rn', minimumVersion: '0.12.9' }],
  // The exact GGUF and original instruct config declare 8,192 positions.
  context: { recommended: 1024, trained: 8192, maximum: 8192 },
  memory: {
    fileBytes: 270_590_560,
    estimatedMinimumRamBytes: 1024 * MIB,
    recommendedRamBytes: 2 * 1024 * MIB,
    notes: [
      'Conservative planning estimate for the Safe profile, not a measured resident-memory claim.',
      'Actual resident memory depends on context, KV cache, native buffers, backend placement, and OS pressure.',
    ],
  },
  recommendedProfiles: ['safe', 'balanced'],
});

export const QWEN25_05B_INSTRUCT: ModelManifest = parseModelManifest({
  schema: 'modelcommons.model-manifest',
  schemaVersion: 1,
  protocolVersion: PROTOCOL_VERSION,
  id: 'qwen/qwen2.5-0.5b-instruct-gguf:q4-k-m',
  revision: QWEN25_05B_REVISION,
  storageId: `qwen2.5-0.5b-instruct-q4-k-m-${QWEN25_05B_REVISION.slice(0, 12)}`,
  displayName: 'Qwen2.5 0.5B Instruct (Q4_K_M)',
  family: 'Qwen2.5',
  architecture: { type: 'dense', parametersBillions: 0.5 },
  format: 'gguf',
  quantization: 'Q4_K_M',
  files: [{
    role: 'model',
    path: 'model.gguf',
    required: true,
    sizeBytes: 491_400_032,
    download: {
      url: `https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/${QWEN25_05B_REVISION}/qwen2.5-0.5b-instruct-q4_k_m.gguf`,
    },
    integrity: { algorithm: 'sha256', digest: '74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db' },
  }],
  source: {
    provider: 'huggingface',
    repository: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF',
    revision: QWEN25_05B_REVISION,
    modelCardUrl: `https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/tree/${QWEN25_05B_REVISION}`,
  },
  license: {
    id: 'Apache-2.0',
    name: 'Apache License 2.0',
    url: `https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/blob/${QWEN25_05B_REVISION}/LICENSE`,
    acceptanceRequired: false,
    gated: false,
    redistribution: 'allowed',
  },
  capabilities: ['text'],
  compatibleRuntimes: [{ id: 'llama.rn', minimumVersion: '0.12.9' }],
  // The Qwen2.5 instruct config declares 32,768 positions; this GGUF records
  // an 8,192 runtime context. Keep the artifact's lower runtime maximum.
  context: { recommended: 1024, trained: 32_768, maximum: 8192 },
  memory: {
    fileBytes: 491_400_032,
    estimatedMinimumRamBytes: 1536 * MIB,
    recommendedRamBytes: 2 * 1024 * MIB,
    notes: [
      'Conservative planning estimate for the Safe profile, not a measured resident-memory claim.',
      'Actual resident memory depends on context, KV cache, native buffers, backend placement, and OS pressure.',
    ],
  },
  recommendedProfiles: ['safe', 'balanced'],
});

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

/** Technical manifests only. Runtime selection deliberately uses its own
 * capability/compatibility policy and must never infer a preference from this
 * display-oriented ordering. */
export const MODEL_CATALOG = [
  SMOLLM2_135M_INSTRUCT,
  SMOLLM2_360M_INSTRUCT,
  QWEN25_05B_INSTRUCT,
  MEDGEMMA_REFERENCE,
  QWEN3_30B_A3B_EXPERIMENT,
] as const;

export const MODEL_CATALOG_PRESENTATION: readonly CatalogPresentation[] = [
  {
    modelId: SMOLLM2_135M_INSTRUCT.id,
    tier: 'starter',
    badge: 'Ultra tiny',
    summary: 'Best for infrastructure testing on constrained devices.',
    sortOrder: 10,
  },
  {
    modelId: SMOLLM2_360M_INSTRUCT.id,
    tier: 'starter',
    badge: 'Recommended',
    summary: 'Recommended first download for basic local chat testing.',
    sortOrder: 20,
    recommended: true,
  },
  {
    modelId: QWEN25_05B_INSTRUCT.id,
    tier: 'starter',
    badge: 'Small',
    summary: 'Small practical text-model baseline for cross-platform testing.',
    sortOrder: 30,
  },
  {
    modelId: MEDGEMMA_REFERENCE.id,
    tier: 'general',
    badge: 'Medical reference',
    summary: 'Specialized medical reference model; includes a required projector.',
    sortOrder: 40,
  },
  {
    modelId: QWEN3_30B_A3B_EXPERIMENT.id,
    tier: 'experimental',
    badge: 'Experimental MoE',
    summary: 'Large sparse-MoE experiment for suitable hardware only.',
    sortOrder: 50,
  },
];

export function getCatalogPresentation(modelId: string): CatalogPresentation | undefined {
  return MODEL_CATALOG_PRESENTATION.find((presentation) => presentation.modelId === modelId);
}

export function findCatalogModel(id: string): ModelManifest | undefined {
  return MODEL_CATALOG.find((manifest) => manifest.id === id);
}

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseModelManifest, type ModelRegistry } from '@modelcommons/protocol';
import {
  getCatalogPresentation,
  MODEL_CATALOG,
  MODEL_CATALOG_PRESENTATION,
  QWEN3_30B_A3B_EXPERIMENT,
  QWEN25_05B_INSTRUCT,
  SMOLLM2_135M_INSTRUCT,
  SMOLLM2_360M_INSTRUCT,
} from '../catalog';
import { createEmptyRegistry, updateModelState } from '../registry';
import { selectHubTextRecord } from '../selection';

const runtimePolicy = {
  runtimeAvailable: true,
  runtimeVersion: '0.12.9',
  experimentalEnabled: false,
};

function readyRegistry(): ModelRegistry {
  return [SMOLLM2_360M_INSTRUCT, QWEN25_05B_INSTRUCT, SMOLLM2_135M_INSTRUCT]
    .reduce((registry, manifest, index) => updateModelState(registry, manifest, 'READY', { now: index + 1 }), createEmptyRegistry(1));
}

describe('built-in model catalog', () => {
  it('contains parseable, unique immutable manifests with complete GGUF integrity metadata', () => {
    expect(MODEL_CATALOG).toHaveLength(5);
    expect(new Set(MODEL_CATALOG.map((manifest) => manifest.id)).size).toBe(MODEL_CATALOG.length);
    expect(new Set(MODEL_CATALOG.map((manifest) => manifest.storageId)).size).toBe(MODEL_CATALOG.length);

    for (const manifest of MODEL_CATALOG) {
      expect(parseModelManifest(manifest)).toEqual(manifest);
      expect(manifest.revision).not.toBe('main');
      expect(manifest.source.revision).toBe(manifest.revision);
      expect(manifest.source.revision).toMatch(/^[a-f0-9]{40}$/);
      for (const file of manifest.files.filter((candidate) => candidate.required)) {
        expect(file.sizeBytes).toBeTypeOf('number');
        expect(file.sizeBytes).toBeGreaterThan(0);
        expect(file.integrity).toEqual({
          algorithm: 'sha256',
          digest: expect.stringMatching(/^[a-f0-9]{64}$/),
        });
        expect(file.download?.url).toContain(`/resolve/${manifest.revision}/`);
      }
    }
  });

  it('keeps starter entries non-experimental and the large Qwen3 MoE experimental', () => {
    for (const manifest of [SMOLLM2_135M_INSTRUCT, SMOLLM2_360M_INSTRUCT, QWEN25_05B_INSTRUCT]) {
      expect(manifest.experimental).not.toBe(true);
      expect(manifest.capabilities).toEqual(['text']);
      expect(manifest.recommendedProfiles).toEqual(['safe', 'balanced']);
    }
    expect(QWEN3_30B_A3B_EXPERIMENT.experimental).toBe(true);
  });

  it('uses deterministic Hub presentation metadata for actual catalog IDs', () => {
    const catalogIds = new Set(MODEL_CATALOG.map((manifest) => manifest.id));
    const sorted = [...MODEL_CATALOG_PRESENTATION].sort(
      (left, right) => left.sortOrder - right.sortOrder || left.modelId.localeCompare(right.modelId)
    );
    expect(MODEL_CATALOG_PRESENTATION).toEqual(sorted);
    expect(new Set(MODEL_CATALOG_PRESENTATION.map((presentation) => presentation.sortOrder)).size)
      .toBe(MODEL_CATALOG_PRESENTATION.length);
    for (const presentation of MODEL_CATALOG_PRESENTATION) {
      expect(catalogIds.has(presentation.modelId)).toBe(true);
    }
    expect(getCatalogPresentation(SMOLLM2_135M_INSTRUCT.id)?.tier).toBe('starter');
    expect(getCatalogPresentation(QWEN25_05B_INSTRUCT.id)?.tier).toBe('starter');
    expect(getCatalogPresentation('unsloth/medgemma-4b-it-gguf:q4-k-m')?.tier).toBe('general');
    expect(getCatalogPresentation(QWEN3_30B_A3B_EXPERIMENT.id)?.tier).toBe('experimental');
  });

  it('keeps the Android CPU host pins aligned with the catalog manifests', () => {
    const resolver = fs.readFileSync(path.join(
      process.cwd(),
      'modules/model-commons-inference-host/android/src/main/java/org/modelcommons/host/VerifiedArtifactResolver.kt'
    ), 'utf8');
    const pins = [...resolver.matchAll(
      /Pin\("([^"]+)",\s*"([a-f0-9]{40})",\s*"([^"]+)",\s*(\d+),\s*"([a-f0-9]{64})"/g
    )].map((match) => ({
      id: match[1],
      revision: match[2],
      storageId: match[3],
      sizeBytes: Number(match[4]),
      digest: match[5],
    }));

    expect(pins).not.toHaveLength(0);
    for (const pin of pins) {
      const manifest = MODEL_CATALOG.find((candidate) => candidate.id === pin.id);
      expect(manifest, `Missing catalog manifest for Android host pin ${pin.id}`).toBeDefined();
      expect(pin.revision).toBe(manifest?.revision);
      expect(pin.storageId).toBe(manifest?.storageId);
      expect(pin.sizeBytes).toBe(manifest?.files[0]?.sizeBytes);
      expect(pin.digest).toBe(manifest?.files[0]?.integrity?.digest);
    }
  });

  it('selects automatic text models deterministically and honors an explicit model ID', () => {
    const registry = readyRegistry();
    const reordered: ModelRegistry = { ...registry, models: [...registry.models].reverse() };

    expect(selectHubTextRecord(registry, 'modelcommons:auto', runtimePolicy)?.manifest.id)
      .toBe(SMOLLM2_135M_INSTRUCT.id);
    expect(selectHubTextRecord(reordered, 'modelcommons:auto', runtimePolicy)?.manifest.id)
      .toBe(SMOLLM2_135M_INSTRUCT.id);
    expect(selectHubTextRecord(registry, QWEN25_05B_INSTRUCT.id, runtimePolicy)?.manifest.id)
      .toBe(QWEN25_05B_INSTRUCT.id);
  });
});

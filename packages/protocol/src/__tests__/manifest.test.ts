import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION } from '../version';
import { parseModelManifest } from '../validation';

const fixture = {
  schema: 'modelcommons.model-manifest', schemaVersion: 1, protocolVersion: PROTOCOL_VERSION,
  id: 'example/model', revision: 'r1', storageId: 'example-model-r1', displayName: 'Example', family: 'example',
  architecture: { type: 'dense' }, format: 'gguf',
  files: [{ role: 'model', path: 'model.gguf', required: true, download: { url: 'https://example.com/model.gguf' } }],
  source: { provider: 'url' },
  license: { id: 'example', url: 'https://example.com/license', acceptanceRequired: false, gated: false },
  capabilities: ['text'], compatibleRuntimes: [{ id: 'fixture' }], context: { recommended: 1024 },
};

describe('manifest validation', () => {
  it('accepts a safe versioned manifest', () => expect(parseModelManifest(fixture).id).toBe('example/model'));
  it('rejects a traversal artifact', () => expect(() => parseModelManifest({ ...fixture, files: [{ ...fixture.files[0], path: '../model.gguf' }] })).toThrow());
  it('rejects insecure catalog downloads', () => expect(() => parseModelManifest({ ...fixture, files: [{ ...fixture.files[0], download: { url: 'http://example.com/model.gguf' } }] })).toThrow());
  it('rejects case-folded path collisions and multiple primary models', () => {
    expect(() => parseModelManifest({
      ...fixture,
      files: [fixture.files[0], { ...fixture.files[0], role: 'other', path: 'MODEL.gguf' }],
    })).toThrow();
    expect(() => parseModelManifest({
      ...fixture,
      files: [fixture.files[0], { ...fixture.files[0], path: 'other.gguf' }],
    })).toThrow();
  });

  it('rejects inconsistent memory totals', () => expect(() => parseModelManifest({
    ...fixture,
    files: [{ ...fixture.files[0], sizeBytes: 10 }],
    memory: { fileBytes: 9, estimatedMinimumRamBytes: 20, recommendedRamBytes: 10 },
  })).toThrow());
});

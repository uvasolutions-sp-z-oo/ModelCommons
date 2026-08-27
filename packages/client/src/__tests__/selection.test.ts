import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, type ModelManifest } from '@modelcommons/protocol';
import { selectCompatibleModel } from '../selection';

const manifest = (id: string, capabilities: ModelManifest['capabilities'], experimental = false): ModelManifest => ({
  schema: 'modelcommons.model-manifest',
  schemaVersion: 1,
  protocolVersion: PROTOCOL_VERSION,
  id,
  revision: 'r1',
  storageId: id.replaceAll('/', '-'),
  displayName: id,
  family: 'fixture',
  architecture: { type: 'dense' },
  format: 'gguf',
  files: [{ role: 'model', path: 'model.gguf', required: true }],
  source: { provider: 'user' },
  license: { id: 'fixture', url: 'https://example.com/license', acceptanceRequired: false, gated: false },
  capabilities,
  compatibleRuntimes: [{ id: 'fixture' }],
  context: { recommended: 1024 },
  experimental,
});

describe('selectCompatibleModel', () => {
  const models = [
    { manifest: manifest('local/text', ['text']), state: 'READY' as const, runtimeIds: ['runtime'] },
    { manifest: manifest('local/tools', ['text', 'tools'], true), state: 'READY' as const, runtimeIds: ['runtime'] },
  ];

  it('selects by capability without provider-name impersonation', () => {
    expect(selectCompatibleModel(models, { capabilities: ['text'] }).model.manifest.id).toBe('local/text');
  });

  it('resolves only explicitly supplied aliases', () => {
    const result = selectCompatibleModel(models, { id: 'existing-app-name', capabilities: ['text'] }, {
      'existing-app-name': { modelId: 'local/text', profile: 'safe' },
    });
    expect(result.alias).toBe('existing-app-name');
    expect(result.profileId).toBe('safe');
  });

  it('does not install implicit generic aliases', () => {
    expect(() => selectCompatibleModel(models, {
      id: 'modelcommons:auto',
      capabilities: ['text'],
    })).toThrowError(expect.objectContaining({ code: 'MODEL_NOT_FOUND' }));

    expect(selectCompatibleModel(models, {
      id: 'modelcommons:auto',
      capabilities: ['text'],
    }, {
      'modelcommons:auto': { modelId: 'local/text' },
    }).alias).toBe('modelcommons:auto');
  });

  it('ignores inherited alias keys', () => {
    const aliases = Object.create({
      inherited: { modelId: 'local/text' },
    }) as Record<string, { modelId: string }>;

    expect(() => selectCompatibleModel(models, {
      id: 'inherited',
      capabilities: ['text'],
    }, aliases)).toThrowError(expect.objectContaining({ code: 'MODEL_NOT_FOUND' }));
  });

  it('selects only an allowed available runtime', () => {
    const result = selectCompatibleModel([
      { manifest: manifest('local/text', ['text']), state: 'READY', runtimeIds: ['runtime-a', 'runtime-b'] },
    ], { capabilities: ['text'] }, {}, { runtimeIds: ['runtime-b'] });

    expect(result.runtimeId).toBe('runtime-b');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { ModelCommonsError, type RuntimeProfile } from '@modelcommons/protocol';
import { classifyInitFailure, llamaModelLocation, modelLocationKind } from '../initialization';
import { contextParams } from '../mapping';
import { createLlamaRnRuntime } from '../runtime';

const profile: RuntimeProfile = {
  schema: 'modelcommons.runtime-profile', schemaVersion: 1, protocolVersion: '0.1.0',
  id: 'balanced', displayName: 'Balanced', stability: 'stable',
  llama: { nCtx: 1024, nBatch: 64, nUbatch: 32, nGpuLayers: 0, useMmap: true, useMlock: false },
};

describe('llama.rn 0.12.9 file boundary', () => {
  it.each([
    ['file:///models/model.gguf', 'file:///models/model.gguf'],
    ['file:///Library/Application%20Support/model.gguf', '/Library/Application Support/model.gguf'],
    ['file:///models/%E8%93%9D%20bicycle%23%25.gguf', '/models/蓝 bicycle#%.gguf'],
    ['file:///models/literal%2520.gguf', '/models/literal%20.gguf'],
    ['file://localhost/models/model.gguf', '/models/model.gguf'],
    ['/models/literal%20.gguf', '/models/literal%20.gguf'],
    ['D:/models/model.gguf', 'D:/models/model.gguf'],
  ])('maps %s without a second decode or scheme prefix', (uri, expected) => {
    expect(llamaModelLocation(uri)).toBe(expected);
    expect(llamaModelLocation(llamaModelLocation(uri))).toBe(expected);
    // The exact upstream normalization is a seven-character string slice.
    const nativePath = expected.startsWith('file://') ? expected.slice(7) : expected;
    expect(contextParams(uri, profile).model.replace(/^file:\/\//, '')).toBe(nativePath);
  });
  it.each(['', 'relative.gguf', 'https://example.test/model', 'content://models/1',
    'file://remote/models/model.gguf', 'file:///model%ZZ', 'file:///model%00.gguf',
    'file:///model.gguf?private=query', 'file:///model.gguf#fragment', 'file:////remote/model'])
  ('rejects unsupported or malformed locations without exposing them: %s', (uri) => {
    try { llamaModelLocation(uri); throw new Error('Expected rejection'); }
    catch (error) {
      expect(error).toBeInstanceOf(ModelCommonsError);
      expect(classifyInitFailure(error)).toBe('MODEL_LOCATION_INVALID');
      expect((error as ModelCommonsError).toJSON()).toEqual({
        code: 'INTEGRITY_FAILED', message: 'The model location is invalid.', retryable: false,
        details: { initFailureKind: 'MODEL_LOCATION_INVALID' },
      });
    }
  });
  it('preserves the proven CPU parameters and every explicitly selected optional value', () => {
    const params = contextParams('file:///models/model.gguf', { ...profile, llama: {
      ...profile.llama, nCpuMoe: 0, cacheTypeK: 'q8_0', cacheTypeV: 'q8_0',
      noExtraBuffers: false, devices: [],
    } });
    expect(params).toEqual({ model: 'file:///models/model.gguf', n_ctx: 1024, n_batch: 64,
      n_ubatch: 32, n_parallel: 1, n_gpu_layers: 0, n_cpu_moe: 0, use_mmap: true,
      use_mlock: false, cache_type_k: 'q8_0', cache_type_v: 'q8_0', no_extra_bufts: false,
      devices: [], ctx_shift: true, kv_unified: true });
    expect(modelLocationKind(params.model)).toBe('file-uri');
    expect(modelLocationKind('/private/model')).toBe('absolute-path');
    expect(modelLocationKind('content://models/1')).toBe('other');
  });
});

describe('safe native initialization classification', () => {
  it.each([
    ['JSI bindings not installed', 'NATIVE_BINDING_UNAVAILABLE'],
    ['[RNLlama] Missing JSI bindings: llamaModelInfo', 'NATIVE_BINDING_UNAVAILABLE'],
    ["Cannot read property 'install' of null", 'NATIVE_BINDING_UNAVAILABLE'],
    ['dlopen failed: /private/library', 'NATIVE_BINDING_UNAVAILABLE'],
    ['TurboModuleRegistry: RNLlama could not be found', 'NATIVE_BINDING_UNAVAILABLE'],
    ['std::bad_alloc', 'MEMORY_ALLOCATION_FAILED'],
    ['failed to allocate buffer', 'MEMORY_ALLOCATION_FAILED'],
    ['out of memory', 'MEMORY_ALLOCATION_FAILED'],
    ['failed to open /private/model.gguf: Permission denied', 'MODEL_OPEN_FAILED'],
    ['failed to open /private/model.gguf: No such file or directory', 'MODEL_FILE_NOT_FOUND'],
    ['Failed to load model', 'MODEL_LOAD_FAILED'],
    ['Failed to load model info', 'MODEL_LOAD_FAILED'],
    ['invalid GGUF magic', 'MODEL_FORMAT_REJECTED'],
    ['unsupported model architecture', 'MODEL_FORMAT_REJECTED'],
    ['mmap failed: Cannot allocate memory', 'MMAP_FAILED'],
    ['invalid context parameter n_ctx', 'INVALID_RUNTIME_PARAMETER'],
    ['unable to initialize context', 'NATIVE_INIT_FAILED'],
    ['unrecognized private exception', 'UNKNOWN'],
    ['allocation policy selected', 'UNKNOWN'],
  ])('classifies %s conservatively', (message, expected) => {
    expect(classifyInitFailure(new Error(message))).toBe(expected);
    expect(classifyInitFailure({ message })).toBe(expected);
    expect(classifyInitFailure(message)).toBe(expected);
  });
  it('does not trust arbitrary error details or stringify an unknown object', () => {
    expect(classifyInitFailure({ details: { initFailureKind: '/private/native' } })).toBe('UNKNOWN');
    expect(classifyInitFailure(null)).toBe('UNKNOWN');
  });
});

describe('initialization diagnostics and lease ownership', () => {
  const uri = 'file:///synthetic/Library/Application%20Support/model.gguf';
  function fixture(diagnosticModelInfo = false) {
    const lifecycle: string[] = [];
    const inspectFile = vi.fn(async () => {
      lifecycle.push('stat'); return { present: true, regular: true, sizeMatches: true };
    });
    const lease = { id: 'diagnostic-lease', uri, inspectFile,
      release: vi.fn(async () => { lifecycle.push('lease.release'); }) };
    const loadLlamaModelInfo = vi.fn(async (_path: string) => {
      lifecycle.push('probe'); return { 'private.metadata': 'must not escape' };
    });
    const nativeError = new Error('Failed to load model at /private/synthetic-container');
    const initLlama = vi.fn(async (_params: unknown) => { lifecycle.push('init'); throw nativeError; });
    const runtime = createLlamaRnRuntime({ loadModule: async () => ({ initLlama, loadLlamaModelInfo } as never) });
    const start = () => runtime.createSession({ model: { id: 'synthetic', uri: '/ignored/model', lease }, profile, diagnosticModelInfo });
    return { start, runtime, lease, lifecycle, initLlama, loadLlamaModelInfo, nativeError };
  }
  it('uses the lease URI for both calls and exports only safe facts with cause internal', async () => {
    const f = fixture(true);
    const error = await f.start().catch((value: ModelCommonsError) => value);
    expect(error).toBeInstanceOf(ModelCommonsError);
    const failure = error as ModelCommonsError;
    expect(failure.cause).toBe(f.nativeError);
    expect(failure.details).toEqual({ failureStage: 'initLlama', initFailureKind: 'MODEL_LOAD_FAILED',
      modelLocationKind: 'file-uri', modelInfoProbe: 'passed', modelFilePresentBeforeInit: true,
      modelFileRegularBeforeInit: true, modelFileSizeMatchesBeforeInit: true });
    expect(f.loadLlamaModelInfo).toHaveBeenCalledWith('/synthetic/Library/Application Support/model.gguf');
    expect(f.initLlama).toHaveBeenCalledWith(expect.objectContaining({ model: '/synthetic/Library/Application Support/model.gguf' }));
    expect(JSON.stringify(failure)).not.toMatch(/private|synthetic-container|metadata|ignored|Application/);
    expect(f.lifecycle).toEqual(['stat', 'probe', 'init', 'lease.release']);
    await f.runtime.release();
    expect(f.lease.release).toHaveBeenCalledOnce();
  });
  it('does not probe normal production initialization', async () => {
    const f = fixture();
    await expect(f.start()).rejects.toMatchObject({ details: { modelInfoProbe: 'not-requested' } });
    expect(f.loadLlamaModelInfo).not.toHaveBeenCalled();
    await f.runtime.release();
  });
  it.each([
    ['[RNLlama] Missing JSI bindings: llamaInitContext', 'RUNTIME_UNAVAILABLE', 'NATIVE_BINDING_UNAVAILABLE'],
    ['std::bad_alloc', 'INSUFFICIENT_MEMORY', 'MEMORY_ALLOCATION_FAILED'],
    ['mmap failed', 'RUNTIME_INITIALIZATION_FAILED', 'MMAP_FAILED'],
    ['unknown error /private/synthetic', 'RUNTIME_INITIALIZATION_FAILED', 'UNKNOWN'],
  ])('preserves canonical codes with safe subcategories: %s', async (message, code, kind) => {
    const f = fixture();
    f.initLlama.mockRejectedValueOnce({ message });
    await expect(f.start()).rejects.toMatchObject({ code, details: { failureStage: 'initLlama', initFailureKind: kind } });
    await f.runtime.release();
  });
  it('keeps a successful probed context alive until context release, then releases scope', async () => {
    const lifecycle: string[] = [];
    const context = {
      gpu: false, devices: [], model: { desc: 'synthetic',
        chatTemplates: { llamaChat: false, jinja: { default: false, toolUse: false } } },
      isJinjaSupported: () => false, isLlamaChatSupported: () => false,
      release: async () => { lifecycle.push('context.release'); },
    };
    const lease = { id: 'scope', uri,
      inspectFile: async () => ({ present: true, regular: true, sizeMatches: true }),
      release: async () => { lifecycle.push('scope.release'); } };
    const runtime = createLlamaRnRuntime({ loadModule: async () => ({
      loadLlamaModelInfo: async () => { lifecycle.push('probe'); return {}; },
      initLlama: async () => { lifecycle.push('init'); return context; },
    } as never) });
    const session = await runtime.createSession({ model: { id: 'synthetic', uri, lease }, profile, diagnosticModelInfo: true });
    expect(lifecycle).toEqual(['probe', 'init']);
    await session.release();
    expect(lifecycle).toEqual(['probe', 'init', 'context.release', 'scope.release']);
    await runtime.release();
  });
  it('stops at a failed metadata probe and releases the lease', async () => {
    const f = fixture(true);
    f.loadLlamaModelInfo.mockRejectedValueOnce(new Error('Failed to load model info'));
    await expect(f.start()).rejects.toMatchObject({ details: {
      failureStage: 'loadLlamaModelInfo', modelInfoProbe: 'failed', initFailureKind: 'MODEL_LOAD_FAILED',
    } });
    expect(f.initLlama).not.toHaveBeenCalled();
    expect(f.lease.release).toHaveBeenCalledOnce();
    await f.runtime.release();
  });
  it.each([
    [{ present: false, regular: false, sizeMatches: false }, 'MODEL_NOT_FOUND'],
    [{ present: true, regular: false, sizeMatches: true }, 'INTEGRITY_FAILED'],
    [{ present: true, regular: true, sizeMatches: false }, 'INTEGRITY_FAILED'],
  ] as const)('rejects an invalid file before native reads: %j', async (facts, code) => {
    const f = fixture(true);
    f.lease.inspectFile.mockResolvedValueOnce(facts);
    await expect(f.start()).rejects.toMatchObject({ code, details: { failureStage: 'modelFileCheck' } });
    expect(f.initLlama).not.toHaveBeenCalled();
    expect(f.loadLlamaModelInfo).not.toHaveBeenCalled();
    expect(f.lease.release).toHaveBeenCalledOnce();
    await f.runtime.release();
  });
});

import { describe, expect, it, vi } from 'vitest';

// The build script is CommonJS because npm invokes it before Metro or TypeScript.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ensureLlamaRnNativeArtifacts, hasArm64NativePayload } = require('../ensure-llama-rn-native.cjs');

describe('ensure-llama-rn-native', () => {
  it('accepts an installed arm64 JNI binding without invoking the downloader', () => {
    const fsModule = {
      readdirSync: vi.fn(() => ['librnllama_v8_2.so']),
      existsSync: vi.fn(),
    };
    const spawn = vi.fn();

    expect(hasArm64NativePayload('D:/ModelCommons', fsModule)).toBe(true);
    const applyDescriptorPatch = vi.fn();
    ensureLlamaRnNativeArtifacts('D:/ModelCommons', {
      fsModule, spawn, applyDescriptorPatch, output: { log: vi.fn() },
    });
    expect(applyDescriptorPatch).toHaveBeenCalledOnce();
    expect(spawn).not.toHaveBeenCalled();
  });

  it('runs llama.rn’s own verified downloader when bindings are absent', () => {
    const fsModule = {
      readdirSync: vi
        .fn()
        .mockImplementationOnce(() => { throw new Error('missing'); })
        .mockReturnValue(['librnllama.so']),
      existsSync: vi.fn(() => true),
      rmSync: vi.fn(),
    };
    const spawn = vi.fn((_command: string, _args: string[], _options: unknown) => ({ status: 0 }));

    const applyDescriptorPatch = vi.fn();
    ensureLlamaRnNativeArtifacts('D:/ModelCommons', {
      fsModule, spawn, applyDescriptorPatch, output: { log: vi.fn() },
    });
    expect(applyDescriptorPatch).toHaveBeenCalledOnce();
    expect(spawn).toHaveBeenCalledOnce();
    expect(spawn).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining([expect.stringContaining('download-native-artifacts.js')]),
      expect.any(Object)
    );
    expect(fsModule.rmSync).toHaveBeenCalledWith(
      expect.stringContaining('.cxx'),
      { recursive: true, force: true }
    );
  });
});

import { describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { nativeArtifactEnv } = require('../../modules/model-commons-native/scripts/native-artifact-env.cjs');

describe('native artifact extraction environment', () => {
  it('puts Windows tar before Git Bash tar without mutating the parent environment', () => {
    const env = Object.freeze({ SystemRoot: 'C:\\Windows', Path: 'C:\\Git\\usr\\bin;C:\\nodejs',
      NODE_EXTRA_CA_CERTS: 'C:\\certs\\trusted.pem', RNLLAMA_SKIP_POSTINSTALL: '0' });
    const existsSync = vi.fn(() => true);
    const child = nativeArtifactEnv({ platform: 'win32', env, fsModule: { existsSync } });
    expect(existsSync).toHaveBeenCalledWith('C:\\Windows\\System32\\tar.exe');
    expect(child).toEqual({ ...env, Path: 'C:\\Windows\\System32;C:\\Git\\usr\\bin;C:\\nodejs' });
    expect(env.Path).toBe('C:\\Git\\usr\\bin;C:\\nodejs');
  });

  it('consolidates case variants of PATH and accepts uppercase SYSTEMROOT', () => {
    const child = nativeArtifactEnv({ platform: 'win32',
      env: { SYSTEMROOT: 'D:\\Windows', PATH: 'C:\\Git\\usr\\bin', Path: 'C:\\nodejs' },
      fsModule: { existsSync: () => true } });
    expect(Object.keys(child).filter((key) => key.toLowerCase() === 'path')).toEqual(['Path']);
    expect(child.Path).toBe('D:\\Windows\\System32;C:\\Git\\usr\\bin;C:\\nodejs');
  });

  it('fails before downloading when Windows tar is absent', () => {
    expect(() => nativeArtifactEnv({ platform: 'win32', env: { SystemRoot: 'C:\\Windows' },
      fsModule: { existsSync: () => false } })).toThrow('Windows System32 tar.exe is required');
    expect(() => nativeArtifactEnv({ platform: 'win32', env: {} })).toThrow('SystemRoot');
  });

  it.each(['linux', 'darwin'])('leaves %s extraction unchanged', (platform) => {
    const env = { PATH: '/usr/local/bin:/usr/bin' };
    const existsSync = vi.fn();
    expect(nativeArtifactEnv({ platform, env, fsModule: { existsSync } })).toBe(env);
    expect(existsSync).not.toHaveBeenCalled();
  });
});

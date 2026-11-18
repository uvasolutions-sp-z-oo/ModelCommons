import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const { checkEntry } = createRequire(import.meta.url)('../check-package-archive.cjs');

describe('npm archive allowlist', () => {
  it('rejects workspace source and Hub assets from the public preview', () => {
    expect(() => checkEntry('src/index.ts', Buffer.from('export {};'), false, true)).toThrow('Unexpected archive file');
    expect(() => checkEntry('assets/icon.png', Buffer.alloc(5), false, true)).toThrow('Unexpected archive file');
  });

  it('rejects signing files, weights, native binaries and traversals in local archives', () => {
    for (const file of ['android/signing.keystore', 'ios/Weights.gguf', 'ios/build/Generated.swift', 'android/src/main/jniLibs/core.so']) {
      expect(() => checkEntry(file, Buffer.alloc(5), true, false)).toThrow('Unexpected archive file');
    }
    expect(() => checkEntry('dist/../LICENSE', Buffer.from('text'), false, true)).toThrow('Unsafe archive path');
  });

  it('checks file contents even if the extension is allowed', () => {
    const fakeToken = 'npm_' + 'a'.repeat(36);
    expect(() => checkEntry('dist/index.js', Buffer.from(fakeToken), false, true)).toThrow('Possible signing material or credential');
    expect(() => checkEntry('dist/index.js', Buffer.from('GGUF\0'), false, true)).toThrow('Binary or encoded payload');
    expect(() => checkEntry('dist/index.mjs', Buffer.from('export const hello = 1;'), false, true)).not.toThrow();
  });
});

import { describe, expect, it, vi } from 'vitest';

const nativeModule = vi.hoisted(() => ({
  sha256File: vi.fn(),
}));

vi.mock('../nativeModule', () => ({ default: nativeModule }));

import { hasNativeMethod } from '../index';

describe('Expo native module feature detection', () => {
  it('detects the registered SHA-256 bridge through Expo Modules Core', () => {
    expect(hasNativeMethod('sha256File')).toBe(true);
    expect(hasNativeMethod('atomicReplaceFile')).toBe(false);
  });
});

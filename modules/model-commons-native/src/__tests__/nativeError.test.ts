import { describe, expect, it } from 'vitest';
import { ModelCommonsError } from '@modelcommons/protocol';
import { callNative, normalizeNativeError } from '../nativeError';

const fallback = {
  fallbackCode: 'STORAGE_UNAVAILABLE',
  fallbackMessage: 'The native storage operation failed.',
} as const;

describe('native error normalization', () => {
  it('accepts only a leading stable code and preserves its deliberate message', () => {
    const error = normalizeNativeError(
      new Error('PERMISSION_REQUIRED: Shared directory access was revoked.'),
      fallback
    );

    expect(error).toMatchObject({
      code: 'PERMISSION_REQUIRED',
      message: 'Shared directory access was revoked.',
      retryable: false,
    });
  });

  it('maps the native readiness sentinel into the stable error union', () => {
    const error = normalizeNativeError(
      new Error('RUNTIME_NOT_READY: The Hub broker has not started.'),
      fallback
    );

    expect(error).toMatchObject({
      code: 'RUNTIME_UNAVAILABLE',
      message: 'The Hub broker has not started.',
      retryable: true,
    });
  });

  it('does not expose untrusted Expo or localized native text', async () => {
    const rejected = callNative(
      () => Promise.reject(new Error('NSCocoaErrorDomain 257: secret filesystem details')),
      fallback
    );
    const error = await rejected.catch((value: unknown) => value);
    expect(error).toBeInstanceOf(ModelCommonsError);
    const failure = error as ModelCommonsError;
    expect(failure.code).toBe('STORAGE_UNAVAILABLE');
    expect(failure.message).toBe('The native storage operation failed.');
    // Error omits cause when none is supplied; do not require an own undefined property.
    expect(failure.cause).toBeUndefined();
    expect(JSON.parse(JSON.stringify(failure))).toEqual({
      code: 'STORAGE_UNAVAILABLE',
      message: 'The native storage operation failed.',
      retryable: true,
    });
  });

  it('preserves an existing protocol error', () => {
    const original = new ModelCommonsError('USER_CANCELLED', 'Cancelled.');
    expect(normalizeNativeError(original, fallback)).toBe(original);
  });
});

import { describe, expect, it } from 'vitest';
import { ModelCommonsError, toModelCommonsError } from '../errors';

describe('stable errors', () => {
  it('round-trips machine-readable codes', () => {
    const error = new ModelCommonsError('MODEL_NOT_READY', 'Not ready', { retryable: true });
    expect(toModelCommonsError(error).toJSON()).toEqual({ code: 'MODEL_NOT_READY', message: 'Not ready', retryable: true });
  });

  it('sanitizes malformed structured and unknown errors', () => {
    const malformed = toModelCommonsError({
      code: 'MODEL_NOT_READY',
      message: 'Not ready',
      retryable: 'yes',
      details: ['not', 'an', 'object'],
    });
    expect(malformed.retryable).toBe(false);
    expect(malformed.details).toBeUndefined();
    expect(toModelCommonsError(new Error('private/native/path')).message).not.toContain('private');
  });
});

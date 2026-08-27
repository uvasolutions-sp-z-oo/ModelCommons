import { describe, expect, it } from 'vitest';
import { assertHttpsUrl, assertSafeRelativePath } from '../path';

describe('untrusted paths', () => {
  it.each(['../secret', 'models/../secret', '/absolute', 'C:/absolute', 'file:///tmp/model', 'models/%2e%2e/secret', 'models\\secret', 'models/CON', 'models/name.'])('rejects %s', (value) => {
    expect(() => assertSafeRelativePath(value)).toThrow();
  });

  it('accepts a normalized store-relative path', () => {
    expect(assertSafeRelativePath('models/example/model.gguf')).toBe('models/example/model.gguf');
  });

  it('allows HTTPS and rejects catalog HTTP', () => {
    expect(assertHttpsUrl('https://example.com/model.gguf')).toContain('https://');
    expect(() => assertHttpsUrl('http://example.com/model.gguf')).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { validateCanonicalRequest } from '../validation';

const request = {
  model: { capabilities: ['text'] },
  messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
};

describe('canonical request validation', () => {
  it('accepts a structurally valid text request', () => {
    expect(validateCanonicalRequest(request).messages).toHaveLength(1);
  });

  it.each([
    { ...request, messages: [null] },
    { ...request, messages: [{ role: 'user', content: [null] }] },
    { ...request, messages: [{ role: 'assistant', content: [{ type: 'tool_call' }] }] },
    { ...request, tools: [{ name: 'x', inputSchema: [] }] },
    { ...request, responseFormat: { type: 'json_schema', name: 'x', schema: [], strict: true, guarantee: 'grammar' } },
    { ...request, messages: [{ role: 'user', content: [{ type: 'image', uri: 'local', detail: 'enormous' }] }] },
  ])('returns a stable validation error for malformed nested input', (value) => {
    expect(() => validateCanonicalRequest(value)).toThrowError(expect.objectContaining({ code: expect.any(String) }));
  });
});

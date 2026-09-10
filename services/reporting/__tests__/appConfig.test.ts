import { describe, expect, it } from 'vitest';
import { validateReportUrl } from '../../../app.config';

describe('report URL build configuration', () => {
  it('permits an absent endpoint only outside production', () => {
    expect(validateReportUrl(undefined, false)).toBeUndefined();
    expect(() => validateReportUrl(undefined, true)).toThrow('required for production');
  });

  it('requires HTTPS in production and rejects credentials/fragments', () => {
    expect(validateReportUrl('https://uva.solutions/report', true)).toBe('https://uva.solutions/report');
    expect(() => validateReportUrl('http://uva.solutions/report', true)).toThrow('HTTPS');
    expect(() => validateReportUrl('https://user:secret@uva.solutions/report', true)).toThrow('credentials');
    expect(() => validateReportUrl('https://uva.solutions/report#private', true)).toThrow('fragment');
  });

  it('allows HTTP only for local development receivers', () => {
    expect(validateReportUrl('http://10.0.2.2:8080/report', false)).toBe('http://10.0.2.2:8080/report');
    expect(() => validateReportUrl('http://example.test/report', false)).toThrow('HTTPS');
  });
});

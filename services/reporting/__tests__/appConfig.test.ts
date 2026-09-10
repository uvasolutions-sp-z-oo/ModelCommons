import { afterEach, describe, expect, it, vi } from 'vitest';
import resolveExpoConfig, { validateReportUrl } from '../../../app.config';

describe('report URL build configuration', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('treats an absent or blank endpoint as an optional capability', () => {
    expect(validateReportUrl(undefined)).toBeUndefined();
    expect(validateReportUrl('')).toBeUndefined();
    expect(validateReportUrl('   \t\r\n')).toBeUndefined();
  });

  it('resolves production-oriented config without exposing reportUrl when the endpoint is absent', () => {
    vi.stubEnv('EAS_BUILD_PROFILE', 'production');
    vi.stubEnv('MODELCOMMONS_REPORT_URL', '');
    const resolved = resolveExpoConfig({ config: {} } as Parameters<typeof resolveExpoConfig>[0]);
    expect(resolved.extra?.modelCommons).not.toHaveProperty('reportUrl');
  });

  it('exposes a normalized configured URL in extra.modelCommons', () => {
    vi.stubEnv('MODELCOMMONS_REPORT_URL', '  https://reports.example.test  ');
    const resolved = resolveExpoConfig({ config: {} } as Parameters<typeof resolveExpoConfig>[0]);
    expect(resolved.extra?.modelCommons).toMatchObject({ reportUrl: 'https://reports.example.test/' });
  });

  it('normalizes valid HTTPS URLs', () => {
    expect(validateReportUrl('  https://reports.example.test  ')).toBe('https://reports.example.test/');
  });

  it('allows HTTP only for supported local loopback receivers', () => {
    expect(validateReportUrl('http://localhost/report')).toBe('http://localhost/report');
    expect(validateReportUrl('http://127.0.0.1:8080/report')).toBe('http://127.0.0.1:8080/report');
    expect(validateReportUrl('http://10.0.2.2:8080/report')).toBe('http://10.0.2.2:8080/report');
    expect(() => validateReportUrl('http://example.test/report')).toThrow('HTTPS');
  });

  it('rejects malformed URLs, credentials, and fragments', () => {
    expect(() => validateReportUrl('not a URL')).toThrow('valid absolute URL');
    expect(() => validateReportUrl('https://user@example.test/report')).toThrow('credentials');
    expect(() => validateReportUrl('https://user:secret@example.test/report')).toThrow('credentials');
    expect(() => validateReportUrl('https://example.test/report#private')).toThrow('fragment');
  });
});

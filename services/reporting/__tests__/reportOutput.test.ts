import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReportOutputPayload } from '../contract';

vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: {} } } }));
vi.mock('expo-modules-core', () => ({ uuid: { v4: () => '69c90ba4-7f26-421f-a493-10a0c67e28ea' } }));

import {
  ReportTransportError,
  configuredReportUrl,
  createReportId,
  parseReportReceipt,
  submitReportOutput,
} from '../reportOutput';

const payload: ReportOutputPayload = {
  contractVersion: '1.0',
  reportId: '69c90ba4-7f26-421f-a493-10a0c67e28ea',
  category: 'other',
  responseText: '<script>alert(1)</script>',
  responseTruncated: false,
  modelId: 'org/model',
  modelRevision: 'immutable',
  appVersion: '0.1.0',
  runtimeVersion: '0.12.9',
  platform: 'android',
  locale: 'en-US',
  clientCreatedAt: '2026-09-10T12:30:00.000Z',
};
const url = 'https://example.test/report';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('report output transport', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('uses the platform UUID v4 generator', () => {
    expect(createReportId()).toBe(payload.reportId);
  });

  it('accepts only the exact documented successful receipt', () => {
    expect(parseReportReceipt({ success: true, data: { contractVersion: '1.0', reportId: payload.reportId } }, payload.reportId)).toEqual({
      contractVersion: '1.0', reportId: payload.reportId,
    });
    expect(() => parseReportReceipt({ success: true, data: { contractVersion: '1.0', reportId: payload.reportId }, extra: true }, payload.reportId)).toThrow(ReportTransportError);
    expect(() => parseReportReceipt({ success: false, error: {} }, payload.reportId)).toThrow(ReportTransportError);
  });

  it('posts JSON through only its scoped fetch and returns a receipt', async () => {
    const fetchImplementation = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      expect(init?.headers).toEqual({ Accept: 'application/json', 'Content-Type': 'application/json' });
      expect(JSON.parse(String(init?.body))).toEqual(payload);
      return jsonResponse({ success: true, data: { contractVersion: '1.0', reportId: payload.reportId } });
    });
    await expect(submitReportOutput(payload, { url, fetchImplementation })).resolves.toEqual({
      contractVersion: '1.0', reportId: payload.reportId,
    });
    expect(fetchImplementation).toHaveBeenCalledOnce();
  });

  it('maps timeout and network failures without exposing exception text', async () => {
    const timeoutFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('secret native path')));
    }));
    await expect(submitReportOutput(payload, { url, fetchImplementation: timeoutFetch, timeoutMs: 1 })).rejects.toMatchObject({ code: 'TIMEOUT' });
    await expect(submitReportOutput(payload, { url, fetchImplementation: async () => { throw new Error('secret raw response'); } })).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('maps malformed JSON, HTTP errors, and rejected 200 envelopes', async () => {
    await expect(submitReportOutput(payload, { url, fetchImplementation: async () => new Response('{', { status: 200 }) })).rejects.toMatchObject({ code: 'INVALID_RECEIPT' });
    await expect(submitReportOutput(payload, { url, fetchImplementation: async () => jsonResponse({ private: 'server body' }, 503) })).rejects.toMatchObject({ code: 'REJECTED', message: 'Reporting is temporarily unavailable. Please try again.' });
    await expect(submitReportOutput(payload, { url, fetchImplementation: async () => jsonResponse({ success: false, error: { code: 'NO' } }) })).rejects.toMatchObject({ code: 'INVALID_RECEIPT' });
  });

  it('is unavailable without a configured endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(configuredReportUrl()).toBeUndefined();
    await expect(submitReportOutput(payload)).rejects.toMatchObject({
      code: 'UNAVAILABLE',
      message: 'Diagnostic reporting is not configured in this build.',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not import diagnostics or log request content', () => {
    const source = readFileSync(fileURLToPath(new URL('../reportOutput.ts', import.meta.url).href), 'utf8');
    expect(source).not.toContain("services/logger");
    expect(source).not.toMatch(/console\.(log|info|warn|error)/u);
  });
});

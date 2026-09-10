import Constants from 'expo-constants';
import { uuid } from 'expo-modules-core';
import {
  REPORT_CONTRACT_VERSION,
  type ReportOutputPayload,
  type ReportReceipt,
} from './contract';

const DEFAULT_TIMEOUT_MS = 12_000;

export type ReportTransportErrorCode =
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'REJECTED'
  | 'INVALID_RECEIPT';

export class ReportTransportError extends Error {
  readonly code: ReportTransportErrorCode;

  constructor(code: ReportTransportErrorCode, message: string) {
    super(message);
    this.name = 'ReportTransportError';
    this.code = code;
  }
}

export function createReportId(): string {
  return uuid.v4().toLowerCase();
}

export function configuredReportUrl(): string | undefined {
  const modelCommons = Constants.expoConfig?.extra?.modelCommons;
  if (!modelCommons || typeof modelCommons !== 'object') return undefined;
  const value = (modelCommons as Record<string, unknown>).reportUrl;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function exactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === [...expected].sort()[index]);
}

export function parseReportReceipt(value: unknown, expectedReportId: string): ReportReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReportTransportError('INVALID_RECEIPT', 'The reporting service returned an invalid confirmation.');
  }
  const envelope = value as Record<string, unknown>;
  if (!exactKeys(envelope, ['success', 'data']) || envelope.success !== true) {
    throw new ReportTransportError('INVALID_RECEIPT', 'The reporting service returned an invalid confirmation.');
  }
  if (!envelope.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) {
    throw new ReportTransportError('INVALID_RECEIPT', 'The reporting service returned an invalid confirmation.');
  }
  const data = envelope.data as Record<string, unknown>;
  if (
    !exactKeys(data, ['contractVersion', 'reportId'])
    || data.contractVersion !== REPORT_CONTRACT_VERSION
    || data.reportId !== expectedReportId
  ) {
    throw new ReportTransportError('INVALID_RECEIPT', 'The reporting service returned an invalid confirmation.');
  }
  return { contractVersion: REPORT_CONTRACT_VERSION, reportId: expectedReportId };
}

function httpFailure(status: number): ReportTransportError {
  if (status === 429) {
    return new ReportTransportError('REJECTED', 'Too many reports were sent. Please try again later.');
  }
  if (status === 409) {
    return new ReportTransportError('REJECTED', 'This report reference conflicted with an earlier report. Change the form and try again.');
  }
  if (status === 413) {
    return new ReportTransportError('REJECTED', 'The report is too large to send.');
  }
  if (status >= 500) {
    return new ReportTransportError('REJECTED', 'Reporting is temporarily unavailable. Please try again.');
  }
  return new ReportTransportError('REJECTED', 'The reporting service did not accept this report.');
}

export async function submitReportOutput(
  payload: ReportOutputPayload,
  options: {
    url?: string;
    fetchImplementation?: typeof fetch;
    timeoutMs?: number;
  } = {}
): Promise<ReportReceipt> {
  const url = options.url ?? configuredReportUrl();
  if (!url) {
    throw new ReportTransportError('UNAVAILABLE', 'Reporting is unavailable in this build.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      // This is deliberately the normal scoped network fetch. ModelCommons'
      // injected provider fetch handles only the offline synthetic origin.
      response = await (options.fetchImplementation ?? fetch)(url, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new ReportTransportError('TIMEOUT', 'The report timed out. Check your connection and try again.');
      }
      throw new ReportTransportError('NETWORK', 'The report could not be sent. Check your connection and try again.');
    }
    if (!response.ok) throw httpFailure(response.status);
    let decoded: unknown;
    try {
      if (!response.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
        throw new Error('Unexpected receipt media type');
      }
      const receiptText = await response.text();
      if (receiptText.length > 4_096) throw new Error('Receipt is too large');
      decoded = JSON.parse(receiptText);
    } catch {
      throw new ReportTransportError('INVALID_RECEIPT', 'The reporting service returned an invalid confirmation.');
    }
    return parseReportReceipt(decoded, payload.reportId);
  } finally {
    clearTimeout(timeout);
  }
}

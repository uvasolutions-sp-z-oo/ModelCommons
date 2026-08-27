/** Privacy-preserving diagnostics. Payloads are reduced to an explicit
 * metadata allowlist; prompts, responses, and tool payloads are not accepted. */

export interface DiagnosticMetadata {
  modelId?: string;
  clientId?: string;
  runtimeVersion?: string;
  profileId?: string;
  durationMs?: number;
  status?: string;
  failureCategory?: string;
  platform?: string;
}

let diagnosticsEnabled = false;

export function configureDiagnosticLogging(enabled: boolean): void {
  diagnosticsEnabled = enabled === true;
}

function entry(level: 'info' | 'warn' | 'error', event: string, metadata: DiagnosticMetadata = {}): void {
  if (!diagnosticsEnabled) return;
  const safeEvent = typeof event === 'string' && /^[a-z0-9_.-]{1,80}$/i.test(event)
    ? event
    : 'invalid_event';
  const record: Record<string, string | number> = {
    event: safeEvent,
    at: new Date().toISOString(),
  };
  const addString = (key: keyof DiagnosticMetadata, maxLength: number) => {
    const value = metadata[key];
    if (typeof value === 'string' && value.length > 0 && value.length <= maxLength) {
      record[key] = value;
    }
  };
  addString('modelId', 256);
  addString('clientId', 256);
  addString('runtimeVersion', 64);
  addString('profileId', 128);
  addString('status', 64);
  addString('failureCategory', 64);
  addString('platform', 32);
  if (
    typeof metadata.durationMs === 'number'
    && Number.isFinite(metadata.durationMs)
    && metadata.durationMs >= 0
  ) {
    record.durationMs = Math.round(metadata.durationMs);
  }
  if (level === 'error') console.error('[ModelCommons]', record);
  else if (level === 'warn') console.warn('[ModelCommons]', record);
  else console.info('[ModelCommons]', record);
}

export const diagnosticLogger = {
  info: (event: string, metadata?: DiagnosticMetadata) => entry('info', event, metadata),
  warn: (event: string, metadata?: DiagnosticMetadata) => entry('warn', event, metadata),
  error: (event: string, metadata?: DiagnosticMetadata) => entry('error', event, metadata),
};

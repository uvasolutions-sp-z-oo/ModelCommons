export const REPORT_CONTRACT_VERSION = '1.0' as const;
export const MAX_REPORT_RESPONSE_CHARACTERS = 12_000;
export const MAX_REPORT_NOTE_CHARACTERS = 1_000;

export const REPORT_CATEGORIES = [
  'sexual_content',
  'violence_or_threats',
  'hate_or_harassment',
  'self_harm',
  'child_safety',
  'illegal_or_dangerous',
  'deception_or_fraud',
  'other',
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const REPORT_CATEGORY_LABELS: Readonly<Record<ReportCategory, string>> = {
  sexual_content: 'Sexual content',
  violence_or_threats: 'Violence or threats',
  hate_or_harassment: 'Hate or harassment',
  self_harm: 'Self-harm',
  child_safety: 'Child safety',
  illegal_or_dangerous: 'Illegal or dangerous instructions',
  deception_or_fraud: 'Deception or fraud',
  other: 'Other',
};

export interface ReportOutputContext {
  modelId: string;
  modelRevision: string;
  appVersion: string;
  runtimeVersion: string;
  platform: 'android' | 'ios';
  locale: string;
}

export interface ReportOutputDraft {
  responseText: string;
  category: ReportCategory;
  note: string;
  context: ReportOutputContext;
}

export interface ReportOutputPayload {
  contractVersion: typeof REPORT_CONTRACT_VERSION;
  reportId: string;
  category: ReportCategory;
  responseText: string;
  responseTruncated: boolean;
  note?: string;
  modelId: string;
  modelRevision: string;
  appVersion: string;
  runtimeVersion: string;
  platform: 'android' | 'ios';
  locale: string;
  clientCreatedAt: string;
}

export interface ReportReceipt {
  contractVersion: typeof REPORT_CONTRACT_VERSION;
  reportId: string;
}

export interface ReportAttemptState {
  fingerprint: string;
  reportId: string;
  clientCreatedAt: string;
}

export function countCharacters(value: string): number {
  return Array.from(value).length;
}

export function limitCharacters(value: string, maximum: number): string {
  if (countCharacters(value) <= maximum) return value;
  return Array.from(value).slice(0, maximum).join('');
}

export function isReportCategory(value: unknown): value is ReportCategory {
  return typeof value === 'string' && REPORT_CATEGORIES.includes(value as ReportCategory);
}

function requirePlainString(name: string, value: string, maximum: number): void {
  if (
    typeof value !== 'string'
    || value.length === 0
    || countCharacters(value) > maximum
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new ReportContractError(`${name} is invalid.`);
  }
}

export class ReportContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportContractError';
  }
}

export function reportDraftFingerprint(draft: ReportOutputDraft): string {
  const submitted = limitCharacters(draft.responseText, MAX_REPORT_RESPONSE_CHARACTERS);
  return JSON.stringify([draft.category, draft.note, submitted]);
}

export function nextReportAttempt(
  draft: ReportOutputDraft,
  previous: ReportAttemptState | undefined,
  createId: () => string,
  createTimestamp: () => string = () => new Date().toISOString()
): ReportAttemptState {
  const fingerprint = reportDraftFingerprint(draft);
  return previous?.fingerprint === fingerprint
    ? previous
    : { fingerprint, reportId: createId(), clientCreatedAt: createTimestamp() };
}

export function buildReportPayload(
  draft: ReportOutputDraft,
  reportId: string,
  clientCreatedAt = new Date().toISOString()
): ReportOutputPayload {
  if (!isReportCategory(draft.category)) throw new ReportContractError('Select a report category.');
  if (typeof draft.responseText !== 'string' || countCharacters(draft.responseText) < 1) {
    throw new ReportContractError('The selected response is empty.');
  }
  if (typeof draft.note !== 'string' || countCharacters(draft.note) > MAX_REPORT_NOTE_CHARACTERS) {
    throw new ReportContractError('The optional note is too long.');
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(draft.note)) {
    throw new ReportContractError('The optional note contains unsupported characters.');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(reportId)) {
    throw new ReportContractError('The report reference is invalid.');
  }
  requirePlainString('Model ID', draft.context.modelId, 256);
  requirePlainString('Model revision', draft.context.modelRevision, 128);
  requirePlainString('App version', draft.context.appVersion, 32);
  requirePlainString('Runtime version', draft.context.runtimeVersion, 64);
  requirePlainString('Locale', draft.context.locale, 32);
  if (draft.context.platform !== 'android' && draft.context.platform !== 'ios') {
    throw new ReportContractError('Reporting is supported only on Android and iOS.');
  }
  if (Number.isNaN(Date.parse(clientCreatedAt)) || !/^\d{4}-\d{2}-\d{2}T/u.test(clientCreatedAt)) {
    throw new ReportContractError('The report time is invalid.');
  }

  const responseText = limitCharacters(draft.responseText, MAX_REPORT_RESPONSE_CHARACTERS);
  return {
    contractVersion: REPORT_CONTRACT_VERSION,
    reportId,
    category: draft.category,
    responseText,
    responseTruncated: responseText !== draft.responseText,
    ...(draft.note.length > 0 ? { note: draft.note } : {}),
    modelId: draft.context.modelId,
    modelRevision: draft.context.modelRevision,
    appVersion: draft.context.appVersion,
    runtimeVersion: draft.context.runtimeVersion,
    platform: draft.context.platform,
    locale: draft.context.locale,
    clientCreatedAt,
  };
}

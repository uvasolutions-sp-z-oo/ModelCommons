import { describe, expect, it } from 'vitest';
import {
  MAX_REPORT_NOTE_CHARACTERS,
  MAX_REPORT_RESPONSE_CHARACTERS,
  REPORT_CATEGORIES,
  buildReportPayload,
  countCharacters,
  isReportCategory,
  nextReportAttempt,
  type ReportOutputDraft,
} from '../contract';

const idA = '69c90ba4-7f26-421f-a493-10a0c67e28ea';
const idB = '4a31593d-fd99-4bfd-b781-099478baf390';
const created = '2026-09-10T12:30:00.000Z';

function draft(overrides: Partial<ReportOutputDraft> = {}): ReportOutputDraft {
  return {
    responseText: 'Selected local model response',
    category: 'other',
    note: '',
    context: {
      modelId: 'org/model',
      modelRevision: 'sha256:immutable',
      appVersion: '0.1.0',
      runtimeVersion: '0.12.9',
      platform: 'android',
      locale: 'en-US',
    },
    ...overrides,
  };
}

describe('report output contract', () => {
  it('builds only the exact allowed payload fields', () => {
    const hostile = {
      ...draft({ note: 'Reviewer context' }),
      prompt: 'must not leave device',
      session: { messages: ['must not leave device'] },
      conversationTitle: 'private title',
    } as ReportOutputDraft & Record<string, unknown>;
    const payload = buildReportPayload(hostile, idA, created);
    expect(payload).toEqual({
      contractVersion: '1.0',
      reportId: idA,
      category: 'other',
      responseText: 'Selected local model response',
      responseTruncated: false,
      note: 'Reviewer context',
      modelId: 'org/model',
      modelRevision: 'sha256:immutable',
      appVersion: '0.1.0',
      runtimeVersion: '0.12.9',
      platform: 'android',
      locale: 'en-US',
      clientCreatedAt: created,
    });
    expect(JSON.stringify(payload)).not.toContain('must not leave device');
    expect(JSON.stringify(payload)).not.toContain('private title');
  });

  it('recognizes every and only server category', () => {
    for (const category of REPORT_CATEGORIES) expect(isReportCategory(category)).toBe(true);
    expect(isReportCategory('spam')).toBe(false);
    expect(() => buildReportPayload(draft({ category: 'spam' as never }), idA, created)).toThrow('Select a report category');
  });

  it('enforces note limits by Unicode characters', () => {
    expect(() => buildReportPayload(draft({ note: 'x'.repeat(MAX_REPORT_NOTE_CHARACTERS + 1) }), idA, created)).toThrow('too long');
    expect(buildReportPayload(draft({ note: '🙂'.repeat(MAX_REPORT_NOTE_CHARACTERS) }), idA, created).note).toHaveLength(MAX_REPORT_NOTE_CHARACTERS * 2);
  });

  it('visibly truncates only the submitted response at 12,000 Unicode characters', () => {
    const long = `start-${'🙂'.repeat(MAX_REPORT_RESPONSE_CHARACTERS)}-end`;
    const payload = buildReportPayload(draft({ responseText: long }), idA, created);
    expect(payload.responseTruncated).toBe(true);
    expect(countCharacters(payload.responseText)).toBe(MAX_REPORT_RESPONSE_CHARACTERS);
    expect(payload.responseText.startsWith('start-')).toBe(true);
    expect(payload.responseText.endsWith('-end')).toBe(false);
  });

  it('reuses report ID and timestamp for unchanged retry, and rotates after edits', () => {
    const ids = [idA, idB];
    const createId = () => ids.shift()!;
    const first = nextReportAttempt(draft(), undefined, createId, () => created);
    const retry = nextReportAttempt(draft(), first, createId, () => 'later');
    expect(retry).toBe(first);
    expect(retry.clientCreatedAt).toBe(created);
    const changed = nextReportAttempt(draft({ note: 'changed' }), retry, createId, () => '2026-09-10T12:31:00.000Z');
    expect(changed.reportId).toBe(idB);
    expect(changed.clientCreatedAt).not.toBe(created);

    for (const variant of [
      draft({ category: 'self_harm' }),
      draft({ note: 'edited note' }),
      draft({ responseText: 'edited response' }),
    ]) {
      const original = nextReportAttempt(draft(), undefined, () => idA, () => created);
      const edited = nextReportAttempt(variant, original, () => idB, () => '2026-09-10T12:31:00.000Z');
      expect(edited.reportId).toBe(idB);
    }
  });

  it('rejects empty responses, invalid UUIDs, controls, and oversized metadata', () => {
    expect(() => buildReportPayload(draft({ responseText: '' }), idA, created)).toThrow('empty');
    expect(() => buildReportPayload(draft(), 'not-a-uuid', created)).toThrow('reference');
    expect(() => buildReportPayload(draft({ note: 'bad\u0000note' }), idA, created)).toThrow('unsupported');
    expect(() => buildReportPayload(draft({ context: { ...draft().context, modelId: 'x'.repeat(257) } }), idA, created)).toThrow('Model ID');
  });
});

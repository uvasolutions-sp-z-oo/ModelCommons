import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));

import { ADULT_NOTICE_POLICY_VERSION, parseAdultNoticeRecord } from '../adultNotice';

describe('adult notice persistence', () => {
  const valid = JSON.stringify({
    acknowledged: true,
    policyVersion: ADULT_NOTICE_POLICY_VERSION,
    acknowledgedAt: '2026-09-10T12:30:00.000Z',
  });

  it('accepts only the minimal current-policy acknowledgement', () => {
    expect(parseAdultNoticeRecord(valid)).toEqual({
      acknowledged: true,
      policyVersion: ADULT_NOTICE_POLICY_VERSION,
      acknowledgedAt: '2026-09-10T12:30:00.000Z',
    });
    expect(parseAdultNoticeRecord(JSON.stringify({ ...JSON.parse(valid), dateOfBirth: '2000-01-01' }))).toBeUndefined();
  });

  it('gates again after a policy-version change and drops malformed legacy state', () => {
    expect(parseAdultNoticeRecord(valid, '2.0')).toBeUndefined();
    expect(parseAdultNoticeRecord('{')).toBeUndefined();
    expect(parseAdultNoticeRecord(JSON.stringify({ acknowledged: false, policyVersion: '1.0', acknowledgedAt: 'now' }))).toBeUndefined();
  });
});

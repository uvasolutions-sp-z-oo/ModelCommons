import AsyncStorage from '@react-native-async-storage/async-storage';

export const ADULT_NOTICE_POLICY_VERSION = '1.0';
export const ADULT_NOTICE_STORAGE_KEY = 'modelcommons-adult-notice-v1';

export interface AdultNoticeRecord {
  acknowledged: true;
  policyVersion: string;
  acknowledgedAt: string;
}

export function parseAdultNoticeRecord(
  raw: string | null,
  requiredVersion = ADULT_NOTICE_POLICY_VERSION
): AdultNoticeRecord | undefined {
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    if (
      Object.keys(record).length !== 3
      || record.acknowledged !== true
      || record.policyVersion !== requiredVersion
      || typeof record.acknowledgedAt !== 'string'
      || Number.isNaN(Date.parse(record.acknowledgedAt))
    ) return undefined;
    return {
      acknowledged: true,
      policyVersion: requiredVersion,
      acknowledgedAt: record.acknowledgedAt,
    };
  } catch {
    return undefined;
  }
}

export async function loadAdultNoticeRecord(): Promise<AdultNoticeRecord | undefined> {
  return parseAdultNoticeRecord(await AsyncStorage.getItem(ADULT_NOTICE_STORAGE_KEY));
}

export async function acknowledgeAdultNotice(now = new Date()): Promise<AdultNoticeRecord> {
  const record: AdultNoticeRecord = {
    acknowledged: true,
    policyVersion: ADULT_NOTICE_POLICY_VERSION,
    acknowledgedAt: now.toISOString(),
  };
  await AsyncStorage.setItem(ADULT_NOTICE_STORAGE_KEY, JSON.stringify(record));
  return record;
}

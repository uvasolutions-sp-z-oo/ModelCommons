import {
  ModelCommonsError,
  isModelCommonsErrorCode,
  type ModelCommonsErrorCode,
} from '@modelcommons/protocol';

export interface NativeErrorPolicy {
  fallbackCode: ModelCommonsErrorCode;
  fallbackMessage: string;
  retryable?: boolean;
}

const TRUSTED_LEADING_CODE = /^([A-Z][A-Z0-9_]*):\s*([\s\S]*)$/;
const MAX_TRUSTED_MESSAGE_LENGTH = 512;
const RETRYABLE_CODES = new Set<ModelCommonsErrorCode>([
  'HUB_NOT_FOUND',
  'MODEL_NOT_READY',
  'RUNTIME_UNAVAILABLE',
  'INSUFFICIENT_MEMORY',
  'STORAGE_UNAVAILABLE',
  'TRANSPORT_UNAVAILABLE',
]);

function rawMessage(error: unknown): string | undefined {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return undefined;
}

function trustedNativeError(
  error: unknown
): { code: ModelCommonsErrorCode; message?: string } | undefined {
  const match = rawMessage(error)?.match(TRUSTED_LEADING_CODE);
  if (!match) return undefined;

  const nativeCode = match[1]!;
  const code = nativeCode === 'RUNTIME_NOT_READY' ? 'RUNTIME_UNAVAILABLE' : nativeCode;
  if (!isModelCommonsErrorCode(code)) return undefined;

  const message = (match[2] ?? '').trim();
  return {
    code,
    ...(message.length > 0 && message.length <= MAX_TRUSTED_MESSAGE_LENGTH ? { message } : {}),
  };
}

/**
 * Converts a native/Expo exception into the stable public protocol surface.
 *
 * Native text is intentionally discarded unless it begins with a protocol code.
 * This keeps localized OS and Expo implementation details out of public errors.
 */
export function normalizeNativeError(error: unknown, policy: NativeErrorPolicy): ModelCommonsError {
  if (error instanceof ModelCommonsError) return error;

  const trusted = trustedNativeError(error);
  const code = trusted?.code ?? policy.fallbackCode;
  return new ModelCommonsError(code, trusted?.message ?? policy.fallbackMessage, {
    retryable: policy.retryable ?? RETRYABLE_CODES.has(code),
  });
}

export async function callNative<T>(
  operation: () => T | Promise<T>,
  policy: NativeErrorPolicy
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw normalizeNativeError(error, policy);
  }
}

export function callNativeSync<T>(operation: () => T, policy: NativeErrorPolicy): T {
  try {
    return operation();
  } catch (error) {
    throw normalizeNativeError(error, policy);
  }
}

export const MODEL_COMMONS_ERROR_CODES = [
  'HUB_NOT_FOUND',
  'PERMISSION_REQUIRED',
  'CLIENT_NOT_AUTHORIZED',
  'MODEL_NOT_FOUND',
  'MODEL_NOT_READY',
  'MODEL_INCOMPATIBLE',
  'RUNTIME_UNAVAILABLE',
  'RUNTIME_INITIALIZATION_FAILED',
  'INSUFFICIENT_MEMORY',
  'STORAGE_UNAVAILABLE',
  'PROTOCOL_VERSION_UNSUPPORTED',
  'USER_CANCELLED',
  'INTEGRITY_FAILED',
  'LICENSE_ACCEPTANCE_REQUIRED',
  'FEATURE_UNSUPPORTED',
  'CAPABILITY_UNAVAILABLE',
  'TRANSPORT_UNAVAILABLE',
] as const;

export type ModelCommonsErrorCode = (typeof MODEL_COMMONS_ERROR_CODES)[number];

export interface ModelCommonsErrorShape {
  code: ModelCommonsErrorCode;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export class ModelCommonsError extends Error implements ModelCommonsErrorShape {
  readonly code: ModelCommonsErrorCode;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ModelCommonsErrorCode,
    message: string,
    options: { retryable?: boolean; details?: Record<string, unknown>; cause?: unknown } = {}
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ModelCommonsError';
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }

  toJSON(): ModelCommonsErrorShape {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export function isModelCommonsErrorCode(value: unknown): value is ModelCommonsErrorCode {
  return typeof value === 'string' && MODEL_COMMONS_ERROR_CODES.includes(value as ModelCommonsErrorCode);
}

export function toModelCommonsError(
  error: unknown,
  fallbackCode: ModelCommonsErrorCode = 'RUNTIME_INITIALIZATION_FAILED'
): ModelCommonsError {
  if (error instanceof ModelCommonsError) {
    return error;
  }

  if (error && typeof error === 'object') {
    const candidate = error as Partial<ModelCommonsErrorShape>;
    if (
      isModelCommonsErrorCode(candidate.code)
      && typeof candidate.message === 'string'
      && candidate.message.length > 0
      && candidate.message.length <= 1024
    ) {
      const details = candidate.details
        && typeof candidate.details === 'object'
        && !Array.isArray(candidate.details)
        ? candidate.details
        : undefined;
      return new ModelCommonsError(candidate.code, candidate.message, {
        retryable: typeof candidate.retryable === 'boolean' ? candidate.retryable : undefined,
        details,
        cause: error,
      });
    }
  }

  return new ModelCommonsError(fallbackCode, 'The ModelCommons operation failed.', { cause: error });
}

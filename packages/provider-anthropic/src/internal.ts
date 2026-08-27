import {
  ModelCommonsError,
  isModelCommonsErrorCode,
  toModelCommonsError,
  type JsonObject,
  type JsonValue,
} from '@modelcommons/protocol';
import type { AnthropicErrorBody, ProviderWebPrimitives } from './types';

let generatedId = 0;

export class ProviderInputError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, options: { status?: number; code?: string } = {}) {
    super(message);
    this.name = 'ProviderInputError';
    this.status = options.status ?? 400;
    this.code = options.code ?? 'INVALID_REQUEST';
  }
}

export function unsupported(param: string, message?: string): never {
  throw new ProviderInputError(
    message ?? `Field \`${param}\` is not supported by this ModelCommons endpoint.`,
    { code: 'FEATURE_UNSUPPORTED' }
  );
}

export function invalid(param: string | null, message: string): never {
  throw new ProviderInputError(param ? `${message} (at ${param})` : message);
}

export function record(value: unknown, param: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid(param, `${param || 'Request body'} must be an object.`);
  }
  return value as Record<string, unknown>;
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (value && typeof value === 'object') return Object.values(value).every(isJsonValue);
  return false;
}

export function jsonObject(value: unknown, param: string): JsonObject {
  const candidate = record(value, param);
  if (!isJsonValue(candidate)) invalid(param, `${param} must contain only JSON values.`);
  return candidate as JsonObject;
}

export function nonEmptyString(value: unknown, param: string): string {
  if (typeof value !== 'string' || !value.trim()) invalid(param, `${param} must be a non-empty string.`);
  return value;
}

export function optionalString(value: unknown, param: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') invalid(param, `${param} must be a string.`);
  return value;
}

export function boolean(value: unknown, param: string): boolean {
  if (typeof value !== 'boolean') invalid(param, `${param} must be a boolean.`);
  return value;
}

export function positiveInteger(value: unknown, param: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) invalid(param, `${param} must be a positive integer.`);
  return Number(value);
}

export function finiteNumber(value: unknown, param: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(param, `${param} must be a finite number.`);
  return value;
}

export function assertAllowedKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  prefix = ''
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) unsupported(prefix ? `${prefix}.${key}` : key);
  }
}

export function parseJsonText(text: string): unknown {
  if (!text.trim()) invalid(null, 'A JSON request body is required.');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ProviderInputError('The request body is not valid JSON.');
  }
}

export interface NormalizedFetchRequest {
  url: URL;
  method: string;
  bodyText: string;
  signal?: AbortSignal;
  headers: Record<string, string>;
}

function copyHeaders(target: Record<string, string>, source: HeadersInit | undefined): void {
  if (!source) return;
  if (Array.isArray(source)) {
    for (const [key, value] of source) target[key.toLowerCase()] = String(value);
    return;
  }
  if (typeof (source as Headers).forEach === 'function') {
    (source as Headers).forEach((value, key) => {
      target[key.toLowerCase()] = value;
    });
    return;
  }
  for (const [key, value] of Object.entries(source as Record<string, string>)) {
    target[key.toLowerCase()] = String(value);
  }
}

export async function normalizeFetchRequest(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<NormalizedFetchRequest> {
  const requestLike = typeof input === 'object' && !(input instanceof URL) && 'url' in input
    ? (input as Request)
    : undefined;
  const rawUrl = input instanceof URL
    ? input.toString()
    : typeof input === 'string'
      ? input
      : requestLike?.url;
  if (!rawUrl) throw new TypeError('ModelCommons fetch requires an absolute URL.');
  const headers: Record<string, string> = {};
  copyHeaders(headers, requestLike?.headers);
  copyHeaders(headers, init?.headers);
  let bodyText = '';
  if (init?.body !== undefined && init.body !== null) {
    if (typeof init.body !== 'string') unsupported('body', 'Only JSON string request bodies are supported.');
    bodyText = init.body;
  } else if (requestLike && !['GET', 'HEAD'].includes((init?.method ?? requestLike.method).toUpperCase())) {
    bodyText = await requestLike.clone().text();
  }
  return {
    url: new URL(rawUrl),
    method: (init?.method ?? requestLike?.method ?? 'GET').toUpperCase(),
    bodyText,
    signal: init?.signal ?? requestLike?.signal,
    headers,
  };
}

export function resolveWebPrimitives(supplied?: Partial<ProviderWebPrimitives>): ProviderWebPrimitives {
  const ResponseConstructor = supplied?.Response ?? globalThis.Response;
  const ReadableStreamConstructor = supplied?.ReadableStream ?? globalThis.ReadableStream;
  const TextEncoderConstructor = supplied?.TextEncoder ?? globalThis.TextEncoder;
  if (!ResponseConstructor || !ReadableStreamConstructor || !TextEncoderConstructor) {
    throw new Error('ModelCommons provider fetch requires Response, ReadableStream, and TextEncoder web primitives.');
  }
  return {
    Response: ResponseConstructor,
    ReadableStream: ReadableStreamConstructor,
    TextEncoder: TextEncoderConstructor,
  };
}

export function createId(factory: ((prefix: string) => string) | undefined, prefix: string): string {
  if (factory) return factory(prefix);
  generatedId += 1;
  return `${prefix}_mc_${Date.now().toString(36)}${generatedId.toString(36)}`;
}

export function providerId(prefix: string, value: string): string {
  return value.startsWith(`${prefix}_`) ? value : `${prefix}_${value}`;
}

export function createAbortScope(parent?: AbortSignal): {
  signal: AbortSignal;
  abort: (reason?: unknown) => void;
  dispose: () => void;
} {
  const controller = new AbortController();
  const relay = () => controller.abort(parent?.reason);
  if (parent?.aborted) relay();
  else parent?.addEventListener('abort', relay, { once: true });
  return {
    signal: controller.signal,
    abort: (reason?: unknown) => controller.abort(reason),
    dispose: () => parent?.removeEventListener('abort', relay),
  };
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (typeof DOMException !== 'undefined') throw new DOMException('The operation was aborted.', 'AbortError');
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  throw error;
}

export function anthropicErrorBody(error: unknown, requestId: string): {
  body: AnthropicErrorBody;
  status: number;
  modelCommonsCode: string;
} {
  if (error instanceof ProviderInputError) {
    return {
      status: error.status,
      modelCommonsCode: error.code,
      body: {
        type: 'error',
        error: { type: error.status === 404 ? 'not_found_error' : 'invalid_request_error', message: error.message },
        request_id: requestId,
      },
    };
  }
  const trusted = error instanceof ModelCommonsError || Boolean(
    error && typeof error === 'object' && isModelCommonsErrorCode((error as { code?: unknown }).code)
  );
  const normalized = toModelCommonsError(error);
  const table: Record<typeof normalized.code, { status: number; type: string }> = {
    HUB_NOT_FOUND: { status: 500, type: 'api_error' },
    PERMISSION_REQUIRED: { status: 403, type: 'permission_error' },
    CLIENT_NOT_AUTHORIZED: { status: 401, type: 'authentication_error' },
    MODEL_NOT_FOUND: { status: 404, type: 'not_found_error' },
    MODEL_NOT_READY: { status: 500, type: 'api_error' },
    MODEL_INCOMPATIBLE: { status: 400, type: 'invalid_request_error' },
    FEATURE_UNSUPPORTED: { status: 400, type: 'invalid_request_error' },
    CAPABILITY_UNAVAILABLE: { status: 400, type: 'invalid_request_error' },
    RUNTIME_UNAVAILABLE: { status: 500, type: 'api_error' },
    RUNTIME_INITIALIZATION_FAILED: { status: 500, type: 'api_error' },
    INSUFFICIENT_MEMORY: { status: 500, type: 'api_error' },
    STORAGE_UNAVAILABLE: { status: 500, type: 'api_error' },
    PROTOCOL_VERSION_UNSUPPORTED: { status: 400, type: 'invalid_request_error' },
    INTEGRITY_FAILED: { status: 500, type: 'api_error' },
    LICENSE_ACCEPTANCE_REQUIRED: { status: 403, type: 'permission_error' },
    TRANSPORT_UNAVAILABLE: { status: 500, type: 'api_error' },
    USER_CANCELLED: { status: 500, type: 'api_error' },
  };
  const mapped = table[normalized.code];
  return {
    status: mapped.status,
    modelCommonsCode: normalized.code,
    body: {
      type: 'error',
      error: {
        type: mapped.type,
        message: trusted ? normalized.message : 'The local ModelCommons runtime failed.',
      },
      request_id: requestId,
    },
  };
}

export function jsonResponse(
  web: ProviderWebPrimitives,
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {}
): Response {
  return new web.Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-modelcommons-offline': 'true',
      ...init.headers,
    },
  });
}

export function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function usageNumbers(usage: {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}): { input: number; output: number; total: number } | null {
  if (usage.inputTokens === undefined || usage.outputTokens === undefined) return null;
  const total = usage.totalTokens ?? usage.inputTokens + usage.outputTokens;
  if (
    !Number.isSafeInteger(usage.inputTokens) || usage.inputTokens < 0 ||
    !Number.isSafeInteger(usage.outputTokens) || usage.outputTokens < 0 ||
    !Number.isSafeInteger(total) || total < usage.inputTokens + usage.outputTokens
  ) return null;
  return {
    input: usage.inputTokens,
    output: usage.outputTokens,
    total,
  };
}

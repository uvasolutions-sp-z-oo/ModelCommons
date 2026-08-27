import {
  ModelCommonsError,
  isModelCommonsErrorCode,
  toModelCommonsError,
  type JsonObject,
  type JsonValue,
} from '@modelcommons/protocol';
import type { OpenAIErrorBody, ProviderWebPrimitives } from './types';

let generatedId = 0;

export class ProviderInputError extends Error {
  readonly status: number;
  readonly param: string | null;
  readonly code: string;

  constructor(
    message: string,
    options: { status?: number; param?: string | null; code?: string } = {}
  ) {
    super(message);
    this.name = 'ProviderInputError';
    this.status = options.status ?? 400;
    this.param = options.param ?? null;
    this.code = options.code ?? 'modelcommons_invalid_request';
  }
}

export function unsupported(param: string, message?: string): never {
  throw new ProviderInputError(message ?? `Field \`${param}\` is not supported by this ModelCommons endpoint.`, {
    param,
    code: 'modelcommons_feature_unsupported',
  });
}

export function invalid(param: string | null, message: string): never {
  throw new ProviderInputError(message, { param });
}

export function record(value: unknown, param: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid(param, `${param || 'Request body'} must be an object.`);
  }
  return value as Record<string, unknown>;
}

export function jsonObject(value: unknown, param: string): JsonObject {
  const candidate = record(value, param);
  if (!isJsonValue(candidate)) {
    invalid(param, `${param} must contain only JSON values.`);
  }
  return candidate as JsonObject;
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).every(isJsonValue);
  }
  return false;
}

export function nonEmptyString(value: unknown, param: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    invalid(param, `${param} must be a non-empty string.`);
  }
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
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    invalid(param, `${param} must be a positive integer.`);
  }
  return Number(value);
}

export function finiteNumber(value: unknown, param: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    invalid(param, `${param} must be a finite number.`);
  }
  return value;
}

export function assertAllowedKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  prefix = ''
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      unsupported(prefix ? `${prefix}.${key}` : key);
    }
  }
}

export function parseJsonText(text: string): unknown {
  if (!text.trim()) {
    invalid(null, 'A JSON request body is required.');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ProviderInputError('The request body is not valid JSON.', {
      code: 'modelcommons_invalid_json',
    });
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
    if (typeof init.body !== 'string') {
      throw new ProviderInputError('Only JSON string request bodies are supported.', {
        param: null,
        code: 'modelcommons_feature_unsupported',
      });
    }
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

export function resolveWebPrimitives(
  supplied: Partial<ProviderWebPrimitives> | undefined
): ProviderWebPrimitives {
  const ResponseConstructor = supplied?.Response ?? globalThis.Response;
  const ReadableStreamConstructor = supplied?.ReadableStream ?? globalThis.ReadableStream;
  const TextEncoderConstructor = supplied?.TextEncoder ?? globalThis.TextEncoder;
  if (!ResponseConstructor || !ReadableStreamConstructor || !TextEncoderConstructor) {
    throw new Error(
      'ModelCommons provider fetch requires Response, ReadableStream, and TextEncoder web primitives.'
    );
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
  if (typeof DOMException !== 'undefined') {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  throw error;
}

function mappedError(error: unknown): {
  status: number;
  type: string;
  code: string;
  modelCommonsCode: string;
  message: string;
  param: string | null;
} {
  if (error instanceof ProviderInputError) {
    return {
      status: error.status,
      type: 'invalid_request_error',
      code: error.code,
      modelCommonsCode: error.code === 'modelcommons_feature_unsupported'
        ? 'FEATURE_UNSUPPORTED'
        : 'INVALID_REQUEST',
      message: error.message,
      param: error.param,
    };
  }

  const trusted = error instanceof ModelCommonsError || Boolean(
    error && typeof error === 'object' && isModelCommonsErrorCode((error as { code?: unknown }).code)
  );
  const normalized = toModelCommonsError(error);
  const table: Record<typeof normalized.code, { status: number; type: string }> = {
    HUB_NOT_FOUND: { status: 503, type: 'server_error' },
    PERMISSION_REQUIRED: { status: 403, type: 'permission_error' },
    CLIENT_NOT_AUTHORIZED: { status: 401, type: 'authentication_error' },
    MODEL_NOT_FOUND: { status: 404, type: 'invalid_request_error' },
    MODEL_NOT_READY: { status: 503, type: 'server_error' },
    MODEL_INCOMPATIBLE: { status: 400, type: 'invalid_request_error' },
    FEATURE_UNSUPPORTED: { status: 400, type: 'invalid_request_error' },
    CAPABILITY_UNAVAILABLE: { status: 400, type: 'invalid_request_error' },
    RUNTIME_UNAVAILABLE: { status: 503, type: 'server_error' },
    RUNTIME_INITIALIZATION_FAILED: { status: 500, type: 'server_error' },
    INSUFFICIENT_MEMORY: { status: 503, type: 'server_error' },
    STORAGE_UNAVAILABLE: { status: 503, type: 'server_error' },
    PROTOCOL_VERSION_UNSUPPORTED: { status: 400, type: 'invalid_request_error' },
    USER_CANCELLED: { status: 499, type: 'server_error' },
    INTEGRITY_FAILED: { status: 500, type: 'server_error' },
    LICENSE_ACCEPTANCE_REQUIRED: { status: 403, type: 'permission_error' },
    TRANSPORT_UNAVAILABLE: { status: 503, type: 'server_error' },
  };
  const mapped = table[normalized.code];
  return {
    ...mapped,
    code: `modelcommons_${normalized.code.toLowerCase()}`,
    modelCommonsCode: normalized.code,
    message: trusted ? normalized.message : 'The local ModelCommons runtime failed.',
    param: typeof normalized.details?.param === 'string' ? normalized.details.param : null,
  };
}

export function openAIErrorBody(error: unknown): {
  body: OpenAIErrorBody;
  status: number;
  modelCommonsCode: string;
} {
  const mapped = mappedError(error);
  return {
    status: mapped.status,
    modelCommonsCode: mapped.modelCommonsCode,
    body: {
      error: {
        message: mapped.message,
        type: mapped.type,
        param: mapped.param,
        code: mapped.code,
      },
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

export function sseData(data: unknown): string {
  return `data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`;
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

export function encodeFloat32Base64(values: readonly number[]): string {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < values.length; index += 1) {
    view.setFloat32(index * 4, values[index], true);
  }
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const packed = (first << 16) | (second << 8) | third;
    output += alphabet[(packed >>> 18) & 63];
    output += alphabet[(packed >>> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(packed >>> 6) & 63] : '=';
    output += index + 2 < bytes.length ? alphabet[packed & 63] : '=';
  }
  return output;
}

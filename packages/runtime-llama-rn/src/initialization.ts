import { ModelCommonsError } from '@modelcommons/protocol';

export const INIT_FAILURE_KINDS = [
  'NATIVE_BINDING_UNAVAILABLE', 'MODEL_LOCATION_INVALID', 'MODEL_FILE_NOT_FOUND',
  'MODEL_OPEN_FAILED', 'MODEL_LOAD_FAILED', 'MODEL_FORMAT_REJECTED', 'MMAP_FAILED',
  'MEMORY_ALLOCATION_FAILED', 'INVALID_RUNTIME_PARAMETER', 'NATIVE_INIT_FAILED', 'UNKNOWN',
] as const;
export type InitFailureKind = typeof INIT_FAILURE_KINDS[number];
export type InitFailureStage = 'loadModule' | 'contextParams' | 'modelFileCheck'
  | 'loadLlamaModelInfo' | 'initLlama' | 'reportCapabilities';

export function modelLocationKind(uri: string): 'file-uri' | 'absolute-path' | 'other' {
  if (/^file:/i.test(uri)) return 'file-uri';
  if (uri.startsWith('/') || /^[a-z]:[\\/]/i.test(uri)) return 'absolute-path';
  return 'other';
}

/** 0.12.9 slices file:// but never percent-decodes before fopen (JSIParams.cpp).
 * Keep ordinary documented file URLs unchanged. Decode escaped URLs exactly
 * once into a path, so literal % sequences cannot be decoded a second time.
 * Raw paths are already filesystem names and must never be URI-decoded.
 */
export function llamaModelLocation(uri: string): string {
  const invalid = () => new ModelCommonsError('INTEGRITY_FAILED', 'The model location is invalid.', {
    details: { initFailureKind: 'MODEL_LOCATION_INVALID' },
  });
  if (!uri.trim() || /[\u0000-\u001f\u007f]/.test(uri)) throw invalid();
  if (!/^file:/i.test(uri)) {
    if (modelLocationKind(uri) !== 'absolute-path') throw invalid();
    return uri;
  }
  // No remote authorities, credentials, query, or fragment at this file boundary.
  const match = /^file:\/\/(?:localhost)?(\/[^?#]*)$/i.exec(uri);
  if (!match || match[1].startsWith('//')) throw invalid();
  let path: string;
  try { path = decodeURIComponent(match[1]); } catch { throw invalid(); }
  if (/[\u0000-\u001f\u007f]/.test(path) || path.startsWith('//')) throw invalid();
  return uri.startsWith('file:///') && !uri.includes('%') ? uri : path;
}

/** Inspect native wording locally; only a fixed category crosses the boundary. */
export function classifyInitFailure(error: unknown): InitFailureKind {
  if (error instanceof ModelCommonsError) {
    const kind = error.details?.initFailureKind;
    if (INIT_FAILURE_KINDS.includes(kind as InitFailureKind)) return kind as InitFailureKind;
  }
  const message = typeof error === 'string' ? error
    : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message : '';
  if (/\b(?:jsi bindings not installed|missing jsi bindings|unsatisfiedlinkerror|dlopen failed|librnllama_jni|failed to load native librar(?:y|ies))\b|TurboModuleRegistry[^\n]*RNLlama|(?:RNLlama|llamaInitContext)[^\n]*(?:not found|not registered|is not a function|undefined|null)|cannot read property ['"]install['"] of (?:null|undefined)/i.test(message)) return 'NATIVE_BINDING_UNAVAILABLE';
  if (/\b(?:mmap|memory map(?:ping)?)\b[^\n]*(?:fail|cannot|unable)|(?:failed|unable) to (?:mmap|map (?:the )?(?:model|file|memory))/i.test(message)) return 'MMAP_FAILED';
  if (/\b(?:oom|out of memory|bad_alloc|memory pressure|cannot allocate memory)\b|(?:failed|unable) to alloc(?:ate)?|(?:memory )?allocation (?:failed|failure)/i.test(message)) return 'MEMORY_ALLOCATION_FAILED';
  if (/\b(?:no such file or directory|file not found|model file does not exist)\b/i.test(message)) return 'MODEL_FILE_NOT_FOUND';
  if (/(?:failed|unable|cannot) to open (?:model|file|GGUF|\/|[a-z]:[\\/])|(?:fopen|open)[^\n]*(?:permission denied|failed)/i.test(message)) return 'MODEL_OPEN_FAILED';
  if (/invalid (?:GGUF|magic)|unsupported (?:model )?architecture|(?:GGUF[^\n]*(?:parse|invalid|unsupported)|(?:failed|unable) to parse GGUF)/i.test(message)) return 'MODEL_FORMAT_REJECTED';
  if (/(?:failed|unable) to load model/i.test(message)) return 'MODEL_LOAD_FAILED';
  if (/invalid (?:runtime |context )?(?:parameter|argument)|n_(?:ctx|batch|ubatch|parallel)[^\n]*(?:must|invalid|out of range)/i.test(message)) return 'INVALID_RUNTIME_PARAMETER';
  if (/(?:failed|unable) to (?:initialize|create) (?:the )?(?:native |llama )?context|context limit reached/i.test(message)) return 'NATIVE_INIT_FAILED';
  return 'UNKNOWN';
}

export type CompatibilityStatus =
  | 'SUPPORTED'
  | 'PARTIAL'
  | 'UNSUPPORTED'
  | 'RUNTIME_DEPENDENT'
  | 'MODEL_DEPENDENT';

export interface CompatibilityRow {
  feature: string;
  native: CompatibilityStatus;
  responses: CompatibilityStatus;
  chat: CompatibilityStatus;
  anthropic: CompatibilityStatus;
  note?: string;
}

export const COMPATIBILITY_MATRIX: CompatibilityRow[] = [
  { feature: 'Text', native: 'SUPPORTED', responses: 'SUPPORTED', chat: 'SUPPORTED', anthropic: 'SUPPORTED' },
  { feature: 'Streaming', native: 'SUPPORTED', responses: 'SUPPORTED', chat: 'SUPPORTED', anthropic: 'SUPPORTED' },
  { feature: 'Cancellation', native: 'SUPPORTED', responses: 'SUPPORTED', chat: 'SUPPORTED', anthropic: 'SUPPORTED' },
  { feature: 'Tool calls', native: 'UNSUPPORTED', responses: 'UNSUPPORTED', chat: 'UNSUPPORTED', anthropic: 'UNSUPPORTED', note: 'The adapters map client-executed tools, but the current Hub backend does not advertise a probed tool-capable template.' },
  { feature: 'JSON object', native: 'UNSUPPORTED', responses: 'UNSUPPORTED', chat: 'UNSUPPORTED', anthropic: 'UNSUPPORTED', note: 'The adapters are capability-gated; the current Hub backend does not advertise constrained decoding.' },
  { feature: 'Strict JSON Schema', native: 'UNSUPPORTED', responses: 'UNSUPPORTED', chat: 'UNSUPPORTED', anthropic: 'UNSUPPORTED', note: 'The adapters accept this only with a backend grammar guarantee; prompt-only JSON is never called strict.' },
  { feature: 'Vision', native: 'UNSUPPORTED', responses: 'UNSUPPORTED', chat: 'UNSUPPORTED', anthropic: 'UNSUPPORTED', note: 'The current llama.rn adapter does not initialize a multimodal projector; a future runtime may add vision.' },
  { feature: 'Embeddings', native: 'UNSUPPORTED', responses: 'UNSUPPORTED', chat: 'UNSUPPORTED', anthropic: 'UNSUPPORTED', note: 'No installed catalog model/runtime implements embeddings; the OpenAI route remains capability-gated.' },
  { feature: 'Reasoning controls', native: 'UNSUPPORTED', responses: 'UNSUPPORTED', chat: 'UNSUPPORTED', anthropic: 'UNSUPPORTED' },
  { feature: 'Server tools / prompt caching', native: 'UNSUPPORTED', responses: 'UNSUPPORTED', chat: 'UNSUPPORTED', anthropic: 'UNSUPPORTED' },
];

export const SUPPORTED_ENDPOINTS = [
  'POST /v1/responses',
  'POST /v1/chat/completions',
  'GET /v1/models',
  'POST /v1/messages',
  'POST /v1/embeddings — capability gated',
];

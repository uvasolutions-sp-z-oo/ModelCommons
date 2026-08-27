export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export const MODEL_CAPABILITIES = [
  'text',
  'vision',
  'audio',
  'embeddings',
  'tools',
  'structured-output',
] as const;
export type ModelCapability = (typeof MODEL_CAPABILITIES)[number];

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  uri: string;
  mediaType?: string;
  detail?: 'auto' | 'low' | 'high';
}

export interface AudioContent {
  type: 'audio';
  uri?: string;
  data?: string;
  mediaType: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: JsonObject;
  rawArguments?: string;
}

export interface ToolCallContent {
  type: 'tool_call';
  call: ToolCall;
}

export interface ToolResult {
  toolCallId: string;
  content: string | JsonValue;
  isError?: boolean;
}

export interface ToolResultContent {
  type: 'tool_result';
  result: ToolResult;
}

export type ModelCommonsContent =
  | TextContent
  | ImageContent
  | AudioContent
  | ToolCallContent
  | ToolResultContent;

export type ModelCommonsRole = 'system' | 'developer' | 'user' | 'assistant';

export interface ModelCommonsMessage {
  id?: string;
  role: ModelCommonsRole;
  content: ModelCommonsContent[];
}

export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: JsonObject;
  strict?: boolean;
}

export type ToolChoice =
  | { type: 'auto' }
  | { type: 'none' }
  | { type: 'required' }
  | { type: 'tool'; name: string };

export type ResponseFormat =
  | { type: 'text' }
  | { type: 'json_object'; guarantee: 'grammar' | 'prompt-only' }
  | {
      type: 'json_schema';
      name: string;
      schema: JsonObject;
      strict: boolean;
      guarantee: 'grammar' | 'prompt-only';
      description?: string;
    };

export interface ModelSelection {
  id?: string;
  capabilities: ModelCapability[];
  profile?: string;
}

export interface SamplingOptions {
  temperature?: number;
  topP?: number;
}

export interface ModelCommonsRequest {
  id?: string;
  model: ModelSelection;
  instructions?: string;
  messages: ModelCommonsMessage[];
  tools?: ToolDefinition[];
  toolChoice?: ToolChoice;
  responseFormat?: ResponseFormat;
  maxOutputTokens?: number;
  sampling?: SamplingOptions;
  stop?: string[];
  metadata?: Record<string, string>;
}

export type ModelCommonsStopReason =
  | 'stop'
  | 'length'
  | 'tool_call'
  | 'cancelled'
  | 'error';

export interface ModelCommonsUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
}

export interface ExecutionDiagnostics {
  offline: true;
  resolvedModelId: string;
  runtimeId: string;
  profileId: string;
}

export interface ModelCommonsResponse {
  id: string;
  createdAt: number;
  modelId: string;
  content: ModelCommonsContent[];
  stopReason: ModelCommonsStopReason;
  stopSequence?: string;
  usage: ModelCommonsUsage;
  diagnostics: ExecutionDiagnostics;
}

export type ModelCommonsStreamEvent =
  | {
      type: 'response.started';
      responseId: string;
      createdAt: number;
      modelId: string;
      diagnostics: ExecutionDiagnostics;
    }
  | { type: 'text.delta'; responseId: string; delta: string }
  | { type: 'tool_call.started'; responseId: string; callId: string; name: string; index: number }
  | { type: 'tool_call.arguments.delta'; responseId: string; callId: string; delta: string; index: number }
  | { type: 'tool_call.completed'; responseId: string; call: ToolCall; index: number }
  | { type: 'usage.updated'; responseId: string; usage: ModelCommonsUsage }
  | { type: 'response.completed'; response: ModelCommonsResponse }
  | {
      type: 'response.failed';
      responseId: string;
      error: import('./errors').ModelCommonsErrorShape;
    };

export function textContent(text: string): TextContent {
  return { type: 'text', text };
}

export function messageText(message: ModelCommonsMessage): string {
  return message.content
    .filter((part): part is TextContent => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}

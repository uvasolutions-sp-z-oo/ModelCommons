import type {
  ModelAliasTarget,
  ModelCapability,
  ModelCommonsRequest,
  ModelCommonsResponse,
  ModelCommonsStreamEvent,
} from '@modelcommons/protocol';

export const MODEL_COMMONS_ANTHROPIC_ORIGIN = 'https://modelcommons.local' as const;
export const SUPPORTED_ANTHROPIC_VERSION = '2023-06-01' as const;

export interface ProviderModelFeatures {
  streaming?: boolean;
  stopSequences?: boolean;
  temperature?: boolean;
  topP?: boolean;
  topK?: boolean;
  tools?: boolean;
  strictTools?: boolean;
  parallelTools?: boolean;
  jsonSchema?: boolean;
}

export interface ProviderModelDescriptor {
  id: string;
  createdAt: number;
  capabilities: readonly ModelCapability[];
  state?: 'ready' | 'not_ready';
  profileId?: string;
  runtimeId?: string;
  features?: ProviderModelFeatures;
}

export interface ProviderExecutionOptions {
  signal: AbortSignal;
  requestId: string;
  requestedModelId: string;
  allowParallelToolCalls?: boolean;
  topK?: number;
}

export type Awaitable<T> = T | Promise<T>;

export interface ModelCommonsProviderBackend {
  listModels(options: { signal: AbortSignal }): Awaitable<readonly ProviderModelDescriptor[]>;
  complete(
    request: ModelCommonsRequest,
    options: ProviderExecutionOptions
  ): Promise<ModelCommonsResponse>;
  stream?(
    request: ModelCommonsRequest,
    options: ProviderExecutionOptions
  ): AsyncIterable<ModelCommonsStreamEvent>;
}

export interface ProviderWebPrimitives {
  Response: typeof Response;
  ReadableStream: typeof ReadableStream;
  TextEncoder: typeof TextEncoder;
}

export interface AnthropicProviderAdapterOptions {
  backend: ModelCommonsProviderBackend;
  aliases?: Readonly<Record<string, ModelAliasTarget>>;
  idFactory?: (prefix: string) => string;
  web?: Partial<ProviderWebPrimitives>;
}

export type AnthropicProviderFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export interface AnthropicErrorBody {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
  request_id: string;
}

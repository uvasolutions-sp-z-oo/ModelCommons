import type {
  JsonValue,
  ModelAliasTarget,
  ModelCapability,
  ModelCommonsRequest,
  ModelCommonsResponse,
  ModelCommonsStreamEvent,
  ModelCommonsUsage,
} from '@modelcommons/protocol';

export const MODEL_COMMONS_OPENAI_ORIGIN = 'https://modelcommons.local' as const;

export interface ProviderModelFeatures {
  streaming?: boolean;
  stopSequences?: boolean;
  temperature?: boolean;
  topP?: boolean;
  tools?: boolean;
  strictTools?: boolean;
  parallelTools?: boolean;
  jsonObject?: boolean;
  jsonSchema?: boolean;
  embeddingDimensions?: 'any' | readonly number[];
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
}

export interface ProviderEmbeddingRequest {
  id?: string;
  model: {
    id: string;
    profile?: string;
    capabilities: readonly ModelCapability[];
  };
  input: readonly string[];
  dimensions?: number;
}

export interface ProviderEmbeddingResponse {
  modelId: string;
  embeddings: readonly (readonly number[])[];
  usage: ModelCommonsUsage;
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
  embed?(
    request: ProviderEmbeddingRequest,
    options: ProviderExecutionOptions
  ): Promise<ProviderEmbeddingResponse>;
}

export interface ProviderWebPrimitives {
  Response: typeof Response;
  ReadableStream: typeof ReadableStream;
  TextEncoder: typeof TextEncoder;
}

export interface OpenAIProviderAdapterOptions {
  backend: ModelCommonsProviderBackend;
  aliases?: Readonly<Record<string, ModelAliasTarget>>;
  exposeAliasesInModelList?: boolean;
  idFactory?: (prefix: string) => string;
  web?: Partial<ProviderWebPrimitives>;
}

export type OpenAIProviderFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export interface OpenAIErrorBody {
  error: {
    message: string;
    type: string;
    param: string | null;
    code: string | null;
  };
}

export interface OpenAIEmbeddingWireResponse {
  object: 'list';
  model: string;
  data: Array<{
    object: 'embedding';
    index: number;
    embedding: number[] | string;
  }>;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export type OpenAIJson = JsonValue;

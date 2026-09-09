import type {
  ModelCommonsRequest,
  ModelCommonsResponse,
  ModelCommonsStreamEvent,
  RuntimeProfile,
} from '@modelcommons/protocol';

export const LLAMA_RN_RUNTIME_ID = 'llama.rn' as const;
export const LLAMA_RN_VERSION = '0.12.9' as const;
export const LLAMA_CPP_BUILD = 'b10256' as const;

export type LlamaRnModule = typeof import('llama.rn');
export type LlamaRnContext = Awaited<ReturnType<LlamaRnModule['initLlama']>>;

export interface ModelResourceLease {
  /** Stable lease identity. It participates in the native-context cache key. */
  id: string;
  /** A file URL or absolute path accepted by llama.rn. */
  uri: string;
  /** Must stop security-scoped access only after the llama context is released. */
  release(): Promise<void>;
}

export interface LlamaRnModelSource {
  id: string;
  revision?: string;
  uri: string;
  lease?: ModelResourceLease;
}

export interface CreateLlamaRnSessionOptions {
  model: LlamaRnModelSource;
  profile: RuntimeProfile;
  enforceContextBudget?: boolean;
}

export interface LlamaRnAvailability {
  available: boolean;
  runtimeId: typeof LLAMA_RN_RUNTIME_ID;
  runtimeVersion: typeof LLAMA_RN_VERSION;
  reason?: 'OPTIONAL_PEER_MISSING' | 'NATIVE_BINDINGS_UNAVAILABLE' | 'RUNTIME_RELEASED';
  message?: string;
}

export interface LlamaRnReportedCapabilities {
  runtimeId: typeof LLAMA_RN_RUNTIME_ID;
  runtimeVersion: typeof LLAMA_RN_VERSION;
  llamaCppBuild: typeof LLAMA_CPP_BUILD;
  text: true;
  streaming: true;
  cancellation: true;
  tools: boolean;
  parallelToolCalls: boolean;
  structuredOutput: 'grammar' | 'none';
  systemRole: boolean;
  chatTemplate: 'jinja' | 'llama-chat' | 'fallback-transcript';
  accelerator: {
    active: boolean;
    devices: string[];
    androidLibrary?: string;
    reasonInactive?: string;
  };
  model: {
    description: string;
    parameterCount?: number;
    sizeBytes?: number;
    recurrent: boolean;
    hybrid: boolean;
  };
}

export interface LlamaRnSession {
  readonly id: string;
  readonly modelId: string;
  readonly profileId: string;
  getCapabilities(): LlamaRnReportedCapabilities;
  stream(request: ModelCommonsRequest, signal?: AbortSignal): AsyncIterable<ModelCommonsStreamEvent>;
  complete(request: ModelCommonsRequest, signal?: AbortSignal): Promise<ModelCommonsResponse>;
  cancel(requestId?: string): Promise<void>;
  release(): Promise<void>;
}

export interface LlamaRnRuntimeOptions {
  /** Test/integration seam. Production defaults to dynamic import('llama.rn'). */
  loadModule?: () => Promise<LlamaRnModule>;
  /** OOM-safe default is one loaded model/profile context. */
  maxLoadedContexts?: number;
}

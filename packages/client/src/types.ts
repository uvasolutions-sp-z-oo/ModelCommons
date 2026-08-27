import type {
  ClientConfiguration,
  ModelAliasTarget,
  ModelCapability,
  ModelCommonsRequest,
  ModelCommonsResponse,
  ModelCommonsStreamEvent,
  ModelManifest,
  ModelSelection,
  RuntimeAvailability,
  TransportPreference,
} from '@modelcommons/protocol';

export type ModelCommonsAvailabilityState =
  | 'AVAILABLE'
  | 'HUB_NOT_FOUND'
  | 'PERMISSION_REQUIRED'
  | 'CLIENT_NOT_AUTHORIZED'
  | 'RUNTIME_UNAVAILABLE'
  | 'TRANSPORT_UNAVAILABLE'
  | 'UNSUPPORTED_PLATFORM';

export interface ModelCommonsAvailability {
  state: ModelCommonsAvailabilityState;
  transportId?: string;
  /** The configured access path used by the active transport, when known. */
  transportPreference?: TransportPreference;
  protocolVersion?: string;
  message?: string;
}

export interface AvailableModel {
  manifest: ModelManifest;
  state: 'READY' | 'NOT_READY';
  runtimeIds: string[];
}

export interface ResolvedModel {
  readonly manifest: ModelManifest;
  readonly runtimeId: string;
  readonly profileId: string;
  readonly alias?: string;
}

export interface SessionIntent {
  capabilities: ModelCapability[];
  modelId?: string;
  profile?: string;
  /** Required context capacity and the requested context size for transports that expose it. */
  minimumContext?: number;
}

/** Additional compatibility constraints that a transport must honor during resolution. */
export interface ModelResolutionRequirements {
  formats?: readonly string[];
  runtimeIds?: readonly string[];
  minimumContext?: number;
}

export interface GenerateOptions {
  signal?: AbortSignal;
}

export interface TransportSession {
  readonly id: string;
  readonly model: ResolvedModel;
  generate(request: ModelCommonsRequest, options?: GenerateOptions): Promise<ModelCommonsResponse>;
  stream(
    request: ModelCommonsRequest,
    options?: GenerateOptions
  ): AsyncIterable<ModelCommonsStreamEvent>;
  cancel(): Promise<void>;
  release(): Promise<void>;
}

export interface ModelCommonsTransport {
  readonly id: string;
  /** Declares which ClientConfiguration access path this transport implements. */
  readonly preference?: TransportPreference;
  getAvailability(): Promise<ModelCommonsAvailability>;
  listModels(): Promise<AvailableModel[]>;
  resolve(
    selection: ModelSelection,
    requirements?: ModelResolutionRequirements
  ): Promise<ResolvedModel>;
  createSession(model: ResolvedModel, intent: SessionIntent): Promise<TransportSession>;
}

export interface RuntimeDescriptor {
  id: string;
  version: string;
  availability: RuntimeAvailability;
  capabilities: ModelCapability[];
  structuredOutput: 'none' | 'prompt-only' | 'json-grammar' | 'json-schema';
  toolCalling: 'none' | 'model-dependent' | 'grammar-constrained';
}

export interface ClientConfigInput {
  id: string;
  displayName: string;
  capabilities: ModelCapability[];
  aliases?: Record<string, ModelAliasTarget>;
  preferredModelId?: string;
  fallback?: 'best-compatible' | 'unavailable';
  profile?: string;
  context?: number;
  maxOutput?: number;
  formats?: string[];
  runtimes?: string[];
  minimumContext?: number;
  transports: TransportPreference[];
}

export type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export interface OpenAIClientOptions {
  apiKey: 'modelcommons-local';
  baseURL: 'https://modelcommons.local/v1';
  fetch: FetchImplementation;
  maxRetries: 0;
  dangerouslyAllowBrowser: true;
  logLevel: 'off';
}

export interface AnthropicClientOptions {
  apiKey: 'modelcommons-local';
  baseURL: 'https://modelcommons.local';
  fetch: FetchImplementation;
  maxRetries: 0;
  dangerouslyAllowBrowser: true;
  logLevel: 'off';
}

export interface ConnectOptions {
  transport?: ModelCommonsTransport;
  transportFactory?: () => ModelCommonsTransport | Promise<ModelCommonsTransport>;
  /** Classifies a custom transport when it cannot expose `preference` itself. */
  transportPreference?: TransportPreference;
  clientConfiguration?: ClientConfiguration;
}

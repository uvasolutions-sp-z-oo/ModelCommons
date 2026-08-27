import {
  MODEL_CAPABILITIES,
  ModelCommonsError,
  isModelCommonsErrorCode,
  isProtocolVersionCompatible,
  parseClientConfiguration,
  parseModelManifest,
  validateCanonicalRequest,
  type ClientConfiguration,
  type ModelAliasTarget,
  type ModelCapability,
  type ModelCommonsRequest,
  type ModelCommonsResponse,
  type ModelCommonsStreamEvent,
  type ModelSelection,
  type TransportPreference,
} from '@modelcommons/protocol';
import {
  anthropicClientOptions,
  openAIClientOptions,
  validateClientConfigurationSemantics,
} from './config';
import { selectCompatibleModel } from './selection';
import type {
  AnthropicClientOptions,
  ConnectOptions,
  FetchImplementation,
  GenerateOptions,
  ModelCommonsAvailability,
  ModelCommonsTransport,
  ModelResolutionRequirements,
  OpenAIClientOptions,
  ResolvedModel,
  SessionIntent,
  TransportSession,
} from './types';

const RESOLUTION_FAILURE_CODES = new Set([
  'MODEL_NOT_FOUND',
  'MODEL_NOT_READY',
  'MODEL_INCOMPATIBLE',
  'CAPABILITY_UNAVAILABLE',
  'RUNTIME_UNAVAILABLE',
]);
const MAX_STRUCTURAL_VALIDATION_NODES = 100_000;
const MAX_ERROR_MESSAGE_CHARACTERS = 1024;

function deepFrozenSnapshot<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== 'object') return value;
  const existing = seen.get(value);
  if (existing) return existing as T;

  const snapshot: unknown[] | Record<string, unknown> = Array.isArray(value) ? [] : {};
  seen.set(value, snapshot);
  for (const [key, item] of Object.entries(value)) {
    Object.defineProperty(snapshot, key, {
      value: deepFrozenSnapshot(item, seen),
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  return Object.freeze(snapshot) as unknown as T;
}

function requiredNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ModelCommonsError('INTEGRITY_FAILED', `${label} must be a non-empty string.`);
  }
  return value;
}

function snapshotResolvedModel(model: ResolvedModel): ResolvedModel {
  if (!model || typeof model !== 'object') {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'The transport returned an invalid resolved model.');
  }
  const manifest = parseModelManifest(model.manifest);
  const runtimeId = requiredNonEmptyString(model.runtimeId, 'Resolved model runtimeId');
  const profileId = requiredNonEmptyString(model.profileId, 'Resolved model profileId');
  const alias = model.alias === undefined
    ? undefined
    : requiredNonEmptyString(model.alias, 'Resolved model alias');
  return deepFrozenSnapshot({
    manifest,
    runtimeId,
    profileId,
    ...(alias === undefined ? {} : { alias }),
  });
}

function protocolViolation(
  message: string,
  details?: Record<string, unknown>
): ModelCommonsError {
  return new ModelCommonsError('INTEGRITY_FAILED', message, {
    ...(details === undefined ? {} : { details }),
  });
}

function assertDiagnosticsIdentity(
  diagnostics: ModelCommonsResponse['diagnostics'],
  model: ResolvedModel,
  label: string
): void {
  if (diagnostics && typeof diagnostics === 'object') {
    plainRecord(diagnostics, `${label} diagnostics`);
  }
  if (
    !diagnostics
    || diagnostics.offline !== true
    || diagnostics.resolvedModelId !== model.manifest.id
    || diagnostics.runtimeId !== model.runtimeId
    || diagnostics.profileId !== model.profileId
  ) {
    throw protocolViolation(`${label} diagnostics do not match the loaded session.`, {
      modelId: model.manifest.id,
      runtimeId: model.runtimeId,
      profileId: model.profileId,
    });
  }
}

interface StructuralValidationBudget {
  remaining: number;
}

function consumeValidationNode(budget: StructuralValidationBudget, label: string): void {
  budget.remaining -= 1;
  if (budget.remaining < 0) {
    throw protocolViolation(`${label} exceeds the structural validation budget.`);
  }
}

function plainRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw protocolViolation(`${label} must be an object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw protocolViolation(`${label} must be a plain object.`);
  }
  return value as Record<string, unknown>;
}

function assertBoundedJsonValue(
  value: unknown,
  label: string,
  budget: StructuralValidationBudget,
  seen = new WeakSet<object>(),
  depth = 0
): void {
  consumeValidationNode(budget, label);
  if (depth > 64) throw protocolViolation(`${label} exceeds the JSON nesting limit.`);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw protocolViolation(`${label} contains a non-finite number.`);
    return;
  }
  if (!value || typeof value !== 'object') {
    throw protocolViolation(`${label} must contain JSON values only.`);
  }
  if (seen.has(value)) throw protocolViolation(`${label} must not contain cycles.`);
  seen.add(value);
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      assertBoundedJsonValue(item, `${label}[${index}]`, budget, seen, depth + 1);
    }
  } else {
    const record = plainRecord(value, label);
    for (const [key, item] of Object.entries(record)) {
      assertBoundedJsonValue(item, `${label}.${key}`, budget, seen, depth + 1);
    }
  }
  seen.delete(value);
}

function assertNonNegativeIndex(value: unknown, label: string): void {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw protocolViolation(`${label} must be a non-negative integer.`);
  }
}

function assertCanonicalToolCall(
  value: unknown,
  label: string,
  budget: StructuralValidationBudget
): void {
  const call = plainRecord(value, label);
  requiredNonEmptyString(call.id, `${label}.id`);
  requiredNonEmptyString(call.name, `${label}.name`);
  plainRecord(call.arguments, `${label}.arguments`);
  assertBoundedJsonValue(call.arguments, `${label}.arguments`, budget);
  if (call.rawArguments !== undefined) {
    requiredNonEmptyString(call.rawArguments, `${label}.rawArguments`);
  }
}

function assertCanonicalResponseContent(
  value: unknown,
  budget: StructuralValidationBudget
): void {
  if (!Array.isArray(value)) throw protocolViolation('Canonical response content must be an array.');
  for (const [index, rawPart] of value.entries()) {
    consumeValidationNode(budget, `Canonical response content[${index}]`);
    const label = `Canonical response content[${index}]`;
    const part = plainRecord(rawPart, label);
    if (part.type === 'text') {
      if (typeof part.text !== 'string') throw protocolViolation(`${label}.text must be a string.`);
      continue;
    }
    if (part.type === 'image') {
      requiredNonEmptyString(part.uri, `${label}.uri`);
      if (part.mediaType !== undefined) requiredNonEmptyString(part.mediaType, `${label}.mediaType`);
      if (part.detail !== undefined && !['auto', 'low', 'high'].includes(String(part.detail))) {
        throw protocolViolation(`${label}.detail is invalid.`);
      }
      continue;
    }
    if (part.type === 'audio') {
      requiredNonEmptyString(part.mediaType, `${label}.mediaType`);
      if ((part.uri === undefined) === (part.data === undefined)) {
        throw protocolViolation(`${label} must contain exactly one of uri or data.`);
      }
      if (part.uri !== undefined) requiredNonEmptyString(part.uri, `${label}.uri`);
      if (part.data !== undefined) requiredNonEmptyString(part.data, `${label}.data`);
      continue;
    }
    if (part.type === 'tool_call') {
      assertCanonicalToolCall(part.call, `${label}.call`, budget);
      continue;
    }
    if (part.type === 'tool_result') {
      const result = plainRecord(part.result, `${label}.result`);
      requiredNonEmptyString(result.toolCallId, `${label}.result.toolCallId`);
      assertBoundedJsonValue(result.content, `${label}.result.content`, budget);
      if (result.isError !== undefined && typeof result.isError !== 'boolean') {
        throw protocolViolation(`${label}.result.isError must be a boolean.`);
      }
      continue;
    }
    throw protocolViolation(`${label}.type is unsupported.`, { contentType: part.type });
  }
}

function assertCanonicalUsage(value: unknown): void {
  const usage = plainRecord(value, 'Canonical response usage');
  for (const key of ['inputTokens', 'outputTokens', 'totalTokens', 'cachedInputTokens']) {
    const count = usage[key];
    if (count !== undefined && (!Number.isSafeInteger(count) || Number(count) < 0)) {
      throw protocolViolation(`Canonical response usage.${key} must be a non-negative integer.`);
    }
  }
}

function assertFailurePayload(event: Extract<ModelCommonsStreamEvent, { type: 'response.failed' }>): void {
  const error = plainRecord(event.error, 'response.failed.error');
  if (!isModelCommonsErrorCode(error.code)) {
    throw protocolViolation('response.failed.error.code is invalid.', { responseId: event.responseId });
  }
  const message = requiredNonEmptyString(error.message, 'response.failed.error.message');
  if (message.length > MAX_ERROR_MESSAGE_CHARACTERS) {
    throw protocolViolation(
      `response.failed.error.message exceeds ${MAX_ERROR_MESSAGE_CHARACTERS} characters.`,
      { responseId: event.responseId }
    );
  }
  if (typeof error.retryable !== 'boolean') {
    throw protocolViolation('response.failed.error.retryable must be a boolean.', {
      responseId: event.responseId,
    });
  }
  if (error.details !== undefined) {
    plainRecord(error.details, 'response.failed.error.details');
    assertBoundedJsonValue(
      error.details,
      'response.failed.error.details',
      { remaining: MAX_STRUCTURAL_VALIDATION_NODES }
    );
  }
}

function assertResponseIdentity(
  response: ModelCommonsResponse,
  model: ResolvedModel,
  expectedResponseId?: string
): void {
  if (!response || typeof response !== 'object') {
    throw protocolViolation('The transport returned an invalid canonical response.');
  }
  plainRecord(response, 'Canonical response');
  if (typeof response.id !== 'string' || !response.id.trim()) {
    throw protocolViolation('The canonical response ID is invalid.');
  }
  if (!Number.isFinite(response.createdAt) || response.createdAt < 0) {
    throw protocolViolation('The canonical response timestamp is invalid.', {
      responseId: response.id,
    });
  }
  if (expectedResponseId !== undefined && response.id !== expectedResponseId) {
    throw protocolViolation('The completed response ID does not match response.started.', {
      expectedResponseId,
      responseId: response.id,
    });
  }
  if (response.modelId !== model.manifest.id) {
    throw protocolViolation('The canonical response model does not match the loaded session.', {
      responseId: response.id,
      modelId: response.modelId,
      loadedModelId: model.manifest.id,
    });
  }
  assertCanonicalResponseContent(response.content, {
    remaining: MAX_STRUCTURAL_VALIDATION_NODES,
  });
  if (!['stop', 'length', 'tool_call', 'cancelled', 'error'].includes(response.stopReason)) {
    throw protocolViolation('The canonical response stop reason is invalid.', {
      responseId: response.id,
      stopReason: response.stopReason,
    });
  }
  if (response.stopSequence !== undefined && typeof response.stopSequence !== 'string') {
    throw protocolViolation('The canonical response stop sequence must be a string.', {
      responseId: response.id,
    });
  }
  assertCanonicalUsage(response.usage);
  assertDiagnosticsIdentity(response.diagnostics, model, 'Canonical response');
}

interface StreamValidationState {
  started: boolean;
  terminal: boolean;
  responseId?: string;
  budget: StructuralValidationBudget;
}

const STREAM_EVENT_TYPES = new Set<ModelCommonsStreamEvent['type']>([
  'response.started',
  'text.delta',
  'tool_call.started',
  'tool_call.arguments.delta',
  'tool_call.completed',
  'usage.updated',
  'response.completed',
  'response.failed',
]);

function eventResponseId(event: ModelCommonsStreamEvent): string | undefined {
  return event.type === 'response.completed' ? event.response?.id : event.responseId;
}

function validateStreamEvent(
  event: ModelCommonsStreamEvent,
  model: ResolvedModel,
  state: StreamValidationState
): boolean {
  if (!event || typeof event !== 'object' || typeof event.type !== 'string') {
    throw protocolViolation('The transport emitted an invalid stream event.');
  }
  plainRecord(event, 'Stream event');
  if (!STREAM_EVENT_TYPES.has(event.type)) {
    throw protocolViolation('The transport emitted an unknown stream event type.', {
      eventType: event.type,
    });
  }
  if (state.terminal) {
    throw protocolViolation('The transport emitted an event after the terminal event.', {
      responseId: state.responseId,
    });
  }

  if (event.type === 'response.started') {
    if (state.started) {
      throw protocolViolation('The transport emitted more than one response.started event.', {
        responseId: state.responseId,
      });
    }
    if (typeof event.responseId !== 'string' || !event.responseId.trim()) {
      throw protocolViolation('response.started contains an invalid response ID.');
    }
    if (!Number.isFinite(event.createdAt) || event.createdAt < 0) {
      throw protocolViolation('response.started contains an invalid timestamp.', {
        responseId: event.responseId,
      });
    }
    if (event.modelId !== model.manifest.id) {
      throw protocolViolation('response.started identifies a different model.', {
        responseId: event.responseId,
        modelId: event.modelId,
        loadedModelId: model.manifest.id,
      });
    }
    assertDiagnosticsIdentity(event.diagnostics, model, 'response.started');
    state.started = true;
    state.responseId = event.responseId;
    return false;
  }

  if (!state.started || state.responseId === undefined) {
    throw protocolViolation('The transport emitted a stream event before response.started.', {
      eventType: event.type,
    });
  }

  const responseId = eventResponseId(event);
  if (responseId !== state.responseId) {
    throw protocolViolation('A stream event contains a mismatched response ID.', {
      eventType: event.type,
      expectedResponseId: state.responseId,
      responseId,
    });
  }

  if (event.type === 'response.completed') {
    assertResponseIdentity(event.response, model, state.responseId);
    state.terminal = true;
    return true;
  }
  if (event.type === 'response.failed') {
    assertFailurePayload(event);
    state.terminal = true;
    return true;
  }

  if (event.type === 'text.delta') {
    if (typeof event.delta !== 'string') {
      throw protocolViolation('text.delta.delta must be a string.', { responseId: state.responseId });
    }
    return false;
  }
  if (event.type === 'tool_call.started') {
    requiredNonEmptyString(event.callId, 'tool_call.started.callId');
    requiredNonEmptyString(event.name, 'tool_call.started.name');
    assertNonNegativeIndex(event.index, 'tool_call.started.index');
    return false;
  }
  if (event.type === 'tool_call.arguments.delta') {
    requiredNonEmptyString(event.callId, 'tool_call.arguments.delta.callId');
    if (typeof event.delta !== 'string') {
      throw protocolViolation('tool_call.arguments.delta.delta must be a string.', {
        responseId: state.responseId,
      });
    }
    assertNonNegativeIndex(event.index, 'tool_call.arguments.delta.index');
    return false;
  }
  if (event.type === 'tool_call.completed') {
    assertCanonicalToolCall(event.call, 'tool_call.completed.call', state.budget);
    assertNonNegativeIndex(event.index, 'tool_call.completed.index');
    return false;
  }
  if (event.type === 'usage.updated') {
    assertCanonicalUsage(event.usage);
    return false;
  }
  return false;
}

function validateCapabilities(capabilities: ModelCapability[], label: string): ModelCapability[] {
  if (
    !Array.isArray(capabilities)
    || capabilities.length === 0
    || capabilities.some((capability) => !MODEL_CAPABILITIES.includes(capability))
    || new Set(capabilities).size !== capabilities.length
  ) {
    throw new ModelCommonsError('INTEGRITY_FAILED', `${label} must contain unique supported capabilities.`);
  }
  return capabilities;
}

function unionCapabilities(
  configured: readonly ModelCapability[],
  requested: readonly ModelCapability[]
): ModelCapability[] {
  return [...new Set([...configured, ...requested])];
}

function supportedContext(model: ResolvedModel): number {
  return model.manifest.context.maximum
    ?? model.manifest.context.trained
    ?? model.manifest.context.recommended;
}

function assertResolvedCompatibility(
  model: ResolvedModel,
  capabilities: readonly ModelCapability[],
  requirements: ModelResolutionRequirements
): void {
  const missingCapabilities = capabilities.filter(
    (capability) => !model.manifest.capabilities.includes(capability)
  );
  if (missingCapabilities.length > 0) {
    throw new ModelCommonsError('CAPABILITY_UNAVAILABLE', 'The resolved model lacks required capabilities.', {
      details: { modelId: model.manifest.id, capabilities: missingCapabilities },
    });
  }
  if (requirements.formats !== undefined && !requirements.formats.includes(model.manifest.format)) {
    throw new ModelCommonsError('MODEL_INCOMPATIBLE', 'The resolved model format is not allowed by the client.', {
      details: { modelId: model.manifest.id, format: model.manifest.format },
    });
  }
  if (requirements.runtimeIds !== undefined && !requirements.runtimeIds.includes(model.runtimeId)) {
    throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'The resolved runtime is not allowed by the client.', {
      details: { modelId: model.manifest.id, runtimeId: model.runtimeId },
    });
  }
  if (!model.manifest.compatibleRuntimes.some((runtime) => runtime.id === model.runtimeId)) {
    throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'The resolved runtime is absent from the model manifest.', {
      details: { modelId: model.manifest.id, runtimeId: model.runtimeId },
    });
  }
  if (
    requirements.minimumContext !== undefined
    && supportedContext(model) < requirements.minimumContext
  ) {
    throw new ModelCommonsError('MODEL_INCOMPATIBLE', 'The resolved model has insufficient context capacity.', {
      details: {
        modelId: model.manifest.id,
        supportedContext: supportedContext(model),
        minimumContext: requirements.minimumContext,
      },
    });
  }
}

function availabilityError(availability: ModelCommonsAvailability): ModelCommonsError {
  if (
    availability.protocolVersion !== undefined
    && !isProtocolVersionCompatible(availability.protocolVersion)
  ) {
    return new ModelCommonsError(
      'PROTOCOL_VERSION_UNSUPPORTED',
      availability.message ?? 'The transport protocol version is unsupported.',
      { details: { protocolVersion: availability.protocolVersion } }
    );
  }

  switch (availability.state) {
    case 'HUB_NOT_FOUND':
    case 'PERMISSION_REQUIRED':
    case 'CLIENT_NOT_AUTHORIZED':
    case 'RUNTIME_UNAVAILABLE':
    case 'TRANSPORT_UNAVAILABLE':
      return new ModelCommonsError(
        availability.state,
        availability.message ?? `ModelCommons is unavailable: ${availability.state}.`
      );
    case 'UNSUPPORTED_PLATFORM':
      return new ModelCommonsError(
        'FEATURE_UNSUPPORTED',
        availability.message ?? 'ModelCommons is unsupported on this platform.'
      );
    case 'AVAILABLE':
      return new ModelCommonsError('TRANSPORT_UNAVAILABLE', 'The transport did not remain available.');
  }
  return new ModelCommonsError('TRANSPORT_UNAVAILABLE', 'ModelCommons availability is invalid.');
}

function exactAlias(
  aliases: Record<string, ModelAliasTarget> | undefined,
  requestedId: string | undefined
): ModelAliasTarget | undefined {
  if (!aliases || !requestedId || !Object.prototype.hasOwnProperty.call(aliases, requestedId)) {
    return undefined;
  }
  return aliases[requestedId];
}

function unavailableTransport(): ModelCommonsTransport {
  return {
    id: 'unavailable',
    async getAvailability() {
      return {
        state: typeof document === 'undefined' ? 'TRANSPORT_UNAVAILABLE' : 'UNSUPPORTED_PLATFORM',
        transportId: 'unavailable',
        message: 'No ModelCommons transport is configured in this application.',
      };
    },
    async listModels() {
      return [];
    },
    async resolve() {
      throw new ModelCommonsError('TRANSPORT_UNAVAILABLE', 'No ModelCommons transport is configured.');
    },
    async createSession() {
      throw new ModelCommonsError('TRANSPORT_UNAVAILABLE', 'No ModelCommons transport is configured.');
    },
  };
}

let defaultTransportFactory: (() => ModelCommonsTransport | Promise<ModelCommonsTransport>) | undefined;

interface SessionDefaults {
  capabilities?: ModelCapability[];
  maxOutputTokens?: number;
  model?: ResolvedModel;
}

export class ModelCommonsSession {
  readonly id: string;
  readonly model: ResolvedModel;
  #session: TransportSession;
  readonly #capabilities: readonly ModelCapability[];
  readonly #maxOutputTokens?: number;
  #released = false;
  #releaseAttempt?: Promise<void>;
  #operationToken?: symbol;

  constructor(session: TransportSession, defaults: SessionDefaults = {}) {
    this.#session = session;
    this.id = requiredNonEmptyString(session.id, 'Session id');
    this.model = snapshotResolvedModel(defaults.model ?? session.model);
    this.#capabilities = Object.freeze([
      ...validateCapabilities(
        defaults.capabilities ?? this.model.manifest.capabilities,
        'Session capabilities'
      ),
    ]);
    const unsupported = this.#capabilities.filter(
      (capability) => !this.model.manifest.capabilities.includes(capability)
    );
    if (unsupported.length > 0) {
      throw new ModelCommonsError('CAPABILITY_UNAVAILABLE', 'The loaded session lacks required capabilities.', {
        details: { modelId: this.model.manifest.id, capabilities: unsupported },
      });
    }
    this.#maxOutputTokens = defaults.maxOutputTokens;
  }

  async generate(
    request: Omit<ModelCommonsRequest, 'model'> & { model?: ModelSelection },
    options?: GenerateOptions
  ): Promise<ModelCommonsResponse> {
    const operation = this.#beginOperation('generate');
    try {
      const response = await this.#session.generate(this.#request(request), options);
      assertResponseIdentity(response, this.model);
      return response;
    } finally {
      this.#endOperation(operation);
    }
  }

  stream(
    request: Omit<ModelCommonsRequest, 'model'> & { model?: ModelSelection },
    options?: GenerateOptions
  ): AsyncIterable<ModelCommonsStreamEvent> {
    return this.#validatedStream(request, options);
  }

  async cancel(): Promise<void> {
    if (this.#released) return;
    if (this.#releaseAttempt) {
      throw new ModelCommonsError(
        'RUNTIME_UNAVAILABLE',
        'Cannot cancel a ModelCommons session while release is in progress.',
        { retryable: true, details: { reason: 'SESSION_RELEASING' } }
      );
    }
    await this.#session.cancel();
  }

  async release(): Promise<void> {
    if (this.#released) return;
    if (this.#releaseAttempt) return this.#releaseAttempt;
    if (this.#operationToken) {
      throw new ModelCommonsError(
        'RUNTIME_UNAVAILABLE',
        'Cannot release a ModelCommons session while inference is active.',
        { retryable: true, details: { reason: 'SESSION_BUSY' } }
      );
    }
    const attempt = this.#performRelease();
    this.#releaseAttempt = attempt;
    return attempt;
  }

  async *#validatedStream(
    request: Omit<ModelCommonsRequest, 'model'> & { model?: ModelSelection },
    options?: GenerateOptions
  ): AsyncIterable<ModelCommonsStreamEvent> {
    const operation = this.#beginOperation('stream');
    let operationEnded = false;
    let workStarted = false;
    let exhausted = false;
    let hasPrimaryError = false;
    let iterator: AsyncIterator<ModelCommonsStreamEvent> | undefined;
    const state: StreamValidationState = {
      started: false,
      terminal: false,
      budget: { remaining: MAX_STRUCTURAL_VALIDATION_NODES },
    };

    try {
      const canonicalRequest = this.#request(request);
      workStarted = true;
      const iterable = this.#session.stream(canonicalRequest, options);
      if (!iterable || typeof iterable[Symbol.asyncIterator] !== 'function') {
        throw protocolViolation('The transport did not return an async stream iterator.');
      }
      iterator = iterable[Symbol.asyncIterator]();
      if (!iterator || typeof iterator.next !== 'function') {
        throw protocolViolation('The transport returned an invalid async stream iterator.');
      }

      while (true) {
        const next = await iterator.next();
        if (!next || typeof next !== 'object' || (next.done !== undefined && typeof next.done !== 'boolean')) {
          throw protocolViolation('The transport returned an invalid stream iterator result.');
        }
        if (next.done === true) {
          exhausted = true;
          if (!state.started) {
            throw protocolViolation('The stream ended before response.started.');
          }
          if (!state.terminal) {
            throw protocolViolation('The stream ended before a terminal event.', {
              responseId: state.responseId,
            });
          }
          return;
        }
        if (!Object.prototype.hasOwnProperty.call(next, 'value')) {
          throw protocolViolation('A stream iterator result is missing its event value.');
        }

        const terminal = validateStreamEvent(next.value, this.model, state);
        if (!terminal) {
          yield next.value;
          continue;
        }

        // Hold the terminal event until the producer confirms exhaustion. This
        // is intentionally fail-closed: otherwise a consumer that stops at the
        // terminal event could never observe a protocol-violating trailing
        // event. A producer that never closes can therefore delay delivery;
        // callers retain AbortSignal/session.cancel() as the escape hatch.
        const trailing = await iterator.next();
        if (
          !trailing
          || typeof trailing !== 'object'
          || (trailing.done !== undefined && typeof trailing.done !== 'boolean')
        ) {
          throw protocolViolation('The transport returned an invalid terminal iterator result.', {
            responseId: state.responseId,
          });
        }
        if (trailing.done !== true) {
          throw protocolViolation('The transport emitted an event after the terminal event.', {
            responseId: state.responseId,
            eventType: trailing.value?.type,
          });
        }
        exhausted = true;
        this.#endOperation(operation);
        operationEnded = true;
        yield next.value;
        return;
      }
    } catch (error) {
      hasPrimaryError = true;
      throw error;
    } finally {
      let hasCleanupError = false;
      let cleanupError: unknown;
      if (workStarted && !exhausted) {
        try {
          await this.#session.cancel();
        } catch (error) {
          hasCleanupError = true;
          cleanupError = error;
        }
        try {
          await iterator?.return?.();
        } catch (error) {
          if (!hasCleanupError) cleanupError = error;
          hasCleanupError = true;
        }
      }
      if (!operationEnded) this.#endOperation(operation);
      if (!hasPrimaryError && hasCleanupError) throw cleanupError;
    }
  }

  #request(request: Omit<ModelCommonsRequest, 'model'> & { model?: ModelSelection }): ModelCommonsRequest {
    if (
      request.model?.id !== undefined
      && request.model.id !== this.model.manifest.id
      && request.model.id !== this.model.alias
    ) {
      throw new ModelCommonsError('MODEL_INCOMPATIBLE', 'A session request cannot select a different model.', {
        details: { requestedModelId: request.model.id, loadedModelId: this.model.manifest.id },
      });
    }
    if (
      request.model?.profile !== undefined
      && request.model.profile !== this.model.profileId
    ) {
      throw new ModelCommonsError('MODEL_INCOMPATIBLE', 'A session request cannot claim a different profile.', {
        details: { requestedProfileId: request.model.profile, loadedProfileId: this.model.profileId },
      });
    }

    const capabilities = request.model?.capabilities ?? [...this.#capabilities];
    const unsupported = capabilities.filter(
      (capability) => !this.#capabilities.includes(capability)
        || !this.model.manifest.capabilities.includes(capability)
    );
    if (unsupported.length > 0) {
      throw new ModelCommonsError('CAPABILITY_UNAVAILABLE', 'The loaded session does not support the request.', {
        details: { modelId: this.model.manifest.id, capabilities: unsupported },
      });
    }

    return validateCanonicalRequest({
      ...request,
      ...(request.maxOutputTokens === undefined && this.#maxOutputTokens !== undefined
        ? { maxOutputTokens: this.#maxOutputTokens }
        : {}),
      model: {
        id: this.model.manifest.id,
        capabilities,
        profile: this.model.profileId,
      },
    });
  }

  #beginOperation(kind: 'generate' | 'stream'): symbol {
    if (this.#released) {
      throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'This ModelCommons session has been released.');
    }
    if (this.#releaseAttempt) {
      throw new ModelCommonsError(
        'RUNTIME_UNAVAILABLE',
        'This ModelCommons session is being released.',
        { retryable: true, details: { reason: 'SESSION_RELEASING' } }
      );
    }
    if (this.#operationToken) {
      throw new ModelCommonsError(
        'RUNTIME_UNAVAILABLE',
        'A ModelCommons session supports only one active inference operation.',
        { retryable: true, details: { reason: 'SESSION_BUSY', requestedOperation: kind } }
      );
    }
    const operation = Symbol(kind);
    this.#operationToken = operation;
    return operation;
  }

  #endOperation(operation: symbol): void {
    if (this.#operationToken === operation) this.#operationToken = undefined;
  }

  async #performRelease(): Promise<void> {
    // Let release() publish this attempt before invoking a transport that may
    // throw synchronously. Concurrent callers then share one reliable attempt.
    await Promise.resolve();
    try {
      await this.#session.release();
      this.#released = true;
    } finally {
      this.#releaseAttempt = undefined;
    }
  }
}

export class ModelCommonsClient {
  readonly transport: ModelCommonsTransport;
  readonly clientConfiguration?: ClientConfiguration;
  readonly activeTransportPreference?: TransportPreference;

  constructor(
    transport: ModelCommonsTransport,
    options: Pick<ConnectOptions, 'clientConfiguration' | 'transportPreference'> = {}
  ) {
    this.transport = transport;
    if (
      options.transportPreference !== undefined
      && transport.preference !== undefined
      && options.transportPreference !== transport.preference
    ) {
      throw new ModelCommonsError(
        'INTEGRITY_FAILED',
        'The explicit transport preference conflicts with the transport declaration.'
      );
    }
    this.activeTransportPreference = options.transportPreference ?? transport.preference;
    this.clientConfiguration = options.clientConfiguration === undefined
      ? undefined
      : deepFrozenSnapshot(validateClientConfigurationSemantics(parseClientConfiguration(
          deepFrozenSnapshot(options.clientConfiguration)
        )));
  }

  async getAvailability(): Promise<ModelCommonsAvailability> {
    const availability = await this.transport.getAvailability();
    if (
      this.activeTransportPreference !== undefined
      && availability.transportPreference !== undefined
      && this.activeTransportPreference !== availability.transportPreference
    ) {
      return {
        state: 'TRANSPORT_UNAVAILABLE',
        transportId: this.transport.id,
        message: 'The transport reported a conflicting configured access path.',
      };
    }
    const activePreference = this.activeTransportPreference ?? availability.transportPreference;
    if (availability.state !== 'AVAILABLE' || !this.clientConfiguration) {
      return {
        ...availability,
        ...(activePreference === undefined
          ? {}
          : { transportPreference: activePreference }),
      };
    }

    if (activePreference === undefined) {
      return {
        state: 'TRANSPORT_UNAVAILABLE',
        transportId: this.transport.id,
        protocolVersion: availability.protocolVersion,
        message: 'The active transport does not declare which configured access path it implements.',
      };
    }
    if (!this.clientConfiguration.access.transports.includes(activePreference)) {
      return {
        state: 'TRANSPORT_UNAVAILABLE',
        transportId: this.transport.id,
        transportPreference: activePreference,
        protocolVersion: availability.protocolVersion,
        message: `The ${activePreference} access path is not allowed by the client configuration.`,
      };
    }
    return {
      ...availability,
      transportPreference: activePreference,
    };
  }

  async listModels() {
    await this.#assertAvailable();
    return this.transport.listModels();
  }

  async resolve(intent: SessionIntent): Promise<ResolvedModel> {
    await this.#assertAvailable();
    const effective = this.#effectiveIntent(intent);
    const requirements = this.#resolutionRequirements(effective);
    const explicitModel = intent.modelId !== undefined;
    const preferredModelId = explicitModel
      ? undefined
      : this.clientConfiguration?.selection.preferredModelId;
    const requestedModelId = intent.modelId ?? preferredModelId;
    const alias = exactAlias(this.clientConfiguration?.aliases, requestedModelId);
    const selection: ModelSelection = {
      ...(requestedModelId === undefined ? {} : { id: alias?.modelId ?? requestedModelId }),
      capabilities: effective.capabilities,
      profile: intent.profile
        ?? alias?.profile
        ?? this.clientConfiguration?.inference.profile,
    };

    if (selection.id === undefined) {
      return this.#resolveBestCompatible(selection, requirements);
    }

    try {
      return await this.#resolveWithTransport(
        selection,
        requirements,
        alias === undefined ? undefined : requestedModelId
      );
    } catch (error) {
      const fallbackAllowed = !explicitModel
        && preferredModelId !== undefined
        && this.clientConfiguration?.selection.fallback === 'best-compatible'
        && error instanceof ModelCommonsError
        && RESOLUTION_FAILURE_CODES.has(error.code);
      if (!fallbackAllowed) throw error;
      return this.#resolveBestCompatible({
        capabilities: effective.capabilities,
        profile: intent.profile ?? this.clientConfiguration?.inference.profile,
      }, requirements);
    }
  }

  async createSession(intent: SessionIntent): Promise<ModelCommonsSession> {
    const effective = this.#effectiveIntent(intent);
    const requirements = this.#resolutionRequirements(effective);
    const model = await this.resolve(intent);
    const sessionIntent: SessionIntent = {
      ...effective,
      modelId: model.manifest.id,
      profile: model.profileId,
    };
    const session = await this.transport.createSession(
      deepFrozenSnapshot(model),
      deepFrozenSnapshot(sessionIntent)
    );
    try {
      const loaded = snapshotResolvedModel(session.model);
      if (
        loaded.manifest.id !== model.manifest.id
        || loaded.manifest.revision !== model.manifest.revision
        || loaded.manifest.storageId !== model.manifest.storageId
        || loaded.runtimeId !== model.runtimeId
        || loaded.profileId !== model.profileId
      ) {
        throw new ModelCommonsError(
          'RUNTIME_INITIALIZATION_FAILED',
          'The created session identity does not match the resolved model.'
        );
      }
      assertResolvedCompatibility(loaded, effective.capabilities, requirements);
      const exposedModel = snapshotResolvedModel({
        ...loaded,
        ...(loaded.alias === undefined && model.alias !== undefined ? { alias: model.alias } : {}),
      });
      return new ModelCommonsSession(session, {
        model: exposedModel,
        capabilities: effective.capabilities,
        maxOutputTokens: this.clientConfiguration?.inference.maxOutput,
      });
    } catch (error) {
      try {
        await session.release();
      } finally {
        throw error;
      }
    }
  }

  openAI(fetch: FetchImplementation): OpenAIClientOptions {
    return openAIClientOptions(fetch);
  }

  anthropic(fetch: FetchImplementation): AnthropicClientOptions {
    return anthropicClientOptions(fetch);
  }

  #effectiveIntent(intent: SessionIntent): SessionIntent {
    if (!intent || typeof intent !== 'object') {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'Session intent must be an object.');
    }
    const requestedCapabilities = validateCapabilities(intent.capabilities, 'Session intent capabilities');
    if (intent.modelId !== undefined) requiredNonEmptyString(intent.modelId, 'Session intent modelId');
    if (intent.profile !== undefined) requiredNonEmptyString(intent.profile, 'Session intent profile');
    if (
      intent.minimumContext !== undefined
      && (!Number.isSafeInteger(intent.minimumContext) || intent.minimumContext <= 0)
    ) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'Session intent minimumContext must be a positive integer.');
    }

    const configuredCapabilities = this.clientConfiguration?.requirements.capabilities ?? [];
    const requestedContext = intent.minimumContext ?? this.clientConfiguration?.inference.context;
    const configuredMinimum = this.clientConfiguration?.requirements.minimumContext;
    const minimumContext = Math.max(requestedContext ?? 0, configuredMinimum ?? 0) || undefined;
    return {
      capabilities: unionCapabilities(configuredCapabilities, requestedCapabilities),
      ...(intent.modelId === undefined ? {} : { modelId: intent.modelId }),
      ...(intent.profile === undefined ? {} : { profile: intent.profile }),
      ...(minimumContext === undefined ? {} : { minimumContext }),
    };
  }

  #resolutionRequirements(intent: SessionIntent): ModelResolutionRequirements {
    return {
      ...(this.clientConfiguration?.requirements.formats === undefined
        ? {}
        : { formats: this.clientConfiguration.requirements.formats }),
      ...(this.clientConfiguration?.requirements.runtimes === undefined
        ? {}
        : { runtimeIds: this.clientConfiguration.requirements.runtimes }),
      ...(intent.minimumContext === undefined ? {} : { minimumContext: intent.minimumContext }),
    };
  }

  async #resolveWithTransport(
    selection: ModelSelection,
    requirements: ModelResolutionRequirements,
    exposedAlias?: string
  ): Promise<ResolvedModel> {
    const raw = await this.transport.resolve(
      deepFrozenSnapshot(selection),
      deepFrozenSnapshot(requirements)
    );
    const resolved = snapshotResolvedModel(raw);
    if (
      selection.id !== undefined
      && resolved.manifest.id !== selection.id
      && resolved.alias !== selection.id
    ) {
      throw new ModelCommonsError('MODEL_INCOMPATIBLE', 'The transport resolved a different model identity.', {
        details: { requestedModelId: selection.id, resolvedModelId: resolved.manifest.id },
      });
    }
    const model = snapshotResolvedModel({
      ...resolved,
      ...(exposedAlias === undefined ? {} : { alias: exposedAlias }),
    });
    assertResolvedCompatibility(model, selection.capabilities, requirements);
    return model;
  }

  async #resolveBestCompatible(
    selection: ModelSelection,
    requirements: ModelResolutionRequirements
  ): Promise<ResolvedModel> {
    const result = selectCompatibleModel(
      await this.transport.listModels(),
      { ...selection, id: undefined },
      {},
      requirements
    );
    return this.#resolveWithTransport({
      id: result.model.manifest.id,
      capabilities: selection.capabilities,
      profile: selection.profile ?? result.profileId,
    }, requirements);
  }

  async #assertAvailable(): Promise<void> {
    const availability = await this.getAvailability();
    if (availability.state !== 'AVAILABLE') throw availabilityError(availability);
  }
}

export const ModelCommons = {
  configureDefaultTransport(
    factory: () => ModelCommonsTransport | Promise<ModelCommonsTransport>
  ): void {
    defaultTransportFactory = factory;
  },

  async connect(options: ConnectOptions = {}): Promise<ModelCommonsClient> {
    const transport = options.transport
      ?? await options.transportFactory?.()
      ?? await defaultTransportFactory?.()
      ?? unavailableTransport();
    return new ModelCommonsClient(transport, options);
  },

  openAI: openAIClientOptions,
  anthropic: anthropicClientOptions,
};

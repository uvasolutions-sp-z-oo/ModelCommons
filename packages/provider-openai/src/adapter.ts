import {
  ModelCommonsError,
  validateCanonicalRequest,
  type ModelAliasTarget,
} from '@modelcommons/protocol';
import {
  ProviderInputError,
  assertAllowedKeys,
  createAbortScope,
  createId,
  encodeFloat32Base64,
  invalid,
  jsonResponse,
  nonEmptyString,
  normalizeFetchRequest,
  openAIErrorBody,
  parseJsonText,
  positiveInteger,
  record,
  resolveWebPrimitives,
  throwIfAborted,
  unsupported,
} from './internal';
import { parseChatRequest, parseResponsesRequest, type ParsedGenerationRequest } from './parse';
import {
  chatEventStream,
  chatStreamError,
  responsesEventStream,
  responsesStreamError,
} from './streams';
import type {
  OpenAIEmbeddingWireResponse,
  OpenAIProviderAdapterOptions,
  OpenAIProviderFetch,
  ProviderExecutionOptions,
  ProviderModelDescriptor,
  ProviderWebPrimitives,
} from './types';
import { MODEL_COMMONS_OPENAI_ORIGIN } from './types';
import { chatBody, responsesBody, unixSeconds } from './wire';

interface ResolvedModel {
  descriptor: ProviderModelDescriptor;
  profile?: string;
}

function ownAlias(
  aliases: Readonly<Record<string, ModelAliasTarget>> | undefined,
  requestedId: string
): ModelAliasTarget | undefined {
  return aliases && Object.prototype.hasOwnProperty.call(aliases, requestedId)
    ? aliases[requestedId]
    : undefined;
}

function abortError(): Error {
  if (typeof DOMException !== 'undefined') return new DOMException('The operation was aborted.', 'AbortError');
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export class OpenAIProviderAdapter {
  readonly fetch: OpenAIProviderFetch;
  private readonly web: ProviderWebPrimitives;

  constructor(private readonly options: OpenAIProviderAdapterOptions) {
    this.web = resolveWebPrimitives(options.web);
    this.fetch = async (input, init) => this.handleFetch(input, init);
  }

  private requestId(): string {
    return createId(this.options.idFactory, 'req');
  }

  private async models(signal: AbortSignal): Promise<readonly ProviderModelDescriptor[]> {
    throwIfAborted(signal);
    const models = await this.options.backend.listModels({ signal });
    throwIfAborted(signal);
    return models;
  }

  private async resolveModel(
    requestedId: string,
    signal: AbortSignal
  ): Promise<ResolvedModel> {
    const models = await this.models(signal);
    const direct = models.find((model) => model.id === requestedId);
    const alias = direct ? undefined : ownAlias(this.options.aliases, requestedId);
    const descriptor = direct ?? (alias ? models.find((model) => model.id === alias.modelId) : undefined);
    if (!descriptor) {
      throw new ModelCommonsError('MODEL_NOT_FOUND', `Model \`${requestedId}\` was not found.`, {
        details: { param: 'model' },
      });
    }
    if (descriptor.state === 'not_ready') {
      throw new ModelCommonsError('MODEL_NOT_READY', `Model \`${descriptor.id}\` is not ready.`, {
        retryable: true,
        details: { param: 'model' },
      });
    }
    return {
      descriptor,
      profile: alias?.profile ?? descriptor.profileId,
    };
  }

  private executionOptions(
    parsed: ParsedGenerationRequest,
    requestId: string,
    signal: AbortSignal
  ): ProviderExecutionOptions {
    return {
      signal,
      requestId,
      requestedModelId: parsed.requestedModelId,
      ...(parsed.allowParallelToolCalls !== undefined
        ? { allowParallelToolCalls: parsed.allowParallelToolCalls }
        : {}),
    };
  }

  private responseHeaders(
    requestId: string,
    model?: ProviderModelDescriptor,
    diagnostics?: { resolvedModelId: string; runtimeId: string; profileId: string },
    profile?: string
  ): Record<string, string> {
    return {
      'x-request-id': requestId,
      'x-modelcommons-offline': 'true',
      ...(diagnostics?.resolvedModelId || model?.id
        ? { 'x-modelcommons-resolved-model': diagnostics?.resolvedModelId ?? model!.id }
        : {}),
      ...(diagnostics?.runtimeId || model?.runtimeId
        ? { 'x-modelcommons-runtime': diagnostics?.runtimeId ?? model!.runtimeId! }
        : {}),
      ...(diagnostics?.profileId || profile || model?.profileId
        ? { 'x-modelcommons-profile': diagnostics?.profileId ?? profile ?? model!.profileId! }
        : {}),
    };
  }

  private errorResponse(error: unknown, requestId: string): Response {
    const mapped = openAIErrorBody(error);
    return jsonResponse(this.web, mapped.body, {
      status: mapped.status,
      headers: {
        'x-request-id': requestId,
        'x-modelcommons-error-code': mapped.modelCommonsCode,
      },
    });
  }

  private async parseAndResolve(
    bodyText: string,
    signal: AbortSignal,
    kind: 'responses' | 'chat'
  ): Promise<{ parsed: ParsedGenerationRequest; model: ResolvedModel }> {
    const raw = parseJsonText(bodyText);
    const body = record(raw, 'Request body');
    const requestedId = nonEmptyString(body.model, 'model');
    const model = await this.resolveModel(requestedId, signal);
    const parsed = kind === 'responses'
      ? parseResponsesRequest(raw, model.descriptor, model.profile)
      : parseChatRequest(raw, model.descriptor, model.profile);
    parsed.canonical.id = createId(this.options.idFactory, 'request');
    validateCanonicalRequest(parsed.canonical);
    return { parsed, model };
  }

  private async complete(
    parsed: ParsedGenerationRequest,
    model: ResolvedModel,
    requestId: string,
    signal: AbortSignal,
    kind: 'responses' | 'chat'
  ): Promise<Response> {
    const response = await this.options.backend.complete(
      parsed.canonical,
      this.executionOptions(parsed, requestId, signal)
    );
    throwIfAborted(signal);
    if (response.modelId !== model.descriptor.id) {
      throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The backend returned a different model than the resolved selection.');
    }
    if (response.stopReason === 'cancelled') {
      throw new ModelCommonsError('USER_CANCELLED', 'The local inference request was cancelled.');
    }
    if (response.stopReason === 'error') {
      throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The local inference runtime failed.');
    }
    return jsonResponse(
      this.web,
      kind === 'responses'
        ? responsesBody(response, parsed.canonical, parsed.allowParallelToolCalls)
        : chatBody(response, parsed.canonical),
      { headers: this.responseHeaders(requestId, model.descriptor, response.diagnostics, model.profile) }
    );
  }

  private stream(
    parsed: ParsedGenerationRequest,
    model: ResolvedModel,
    requestId: string,
    parentSignal: AbortSignal | undefined,
    kind: 'responses' | 'chat'
  ): Response {
    const backend = this.options.backend;
    const stream = backend.stream;
    if (!stream) {
      throw new ProviderInputError('Streaming is not available from the configured backend.', {
        param: 'stream',
        code: 'modelcommons_feature_unsupported',
      });
    }
    const abortScope = createAbortScope(parentSignal);
    const events = stream.call(
      backend,
      parsed.canonical,
      this.executionOptions(parsed, requestId, abortScope.signal)
    );
    const web = this.web;
    const encoder = new web.TextEncoder();
    const frames = kind === 'responses'
      ? responsesEventStream(events, parsed)
      : chatEventStream(events, parsed);
    const iterator = frames[Symbol.asyncIterator]();
    let settled = false;
    const body = new web.ReadableStream<Uint8Array>({
      async pull(controller) {
        if (settled) return;
        try {
          throwIfAborted(abortScope.signal);
          const next = await iterator.next();
          throwIfAborted(abortScope.signal);
          if (next.done) {
            settled = true;
            controller.close();
            abortScope.dispose();
            return;
          }
          controller.enqueue(encoder.encode(next.value));
        } catch (error) {
          settled = true;
          const wasAborted = abortScope.signal.aborted || isAbortError(error);
          if (!abortScope.signal.aborted) abortScope.abort(error);
          try {
            await iterator.return?.(undefined);
          } catch {
            // Preserve the original provider/abort outcome.
          }
          abortScope.dispose();
          if (wasAborted) {
            controller.error(abortError());
          } else {
            try {
              const frame = kind === 'responses'
                ? responsesStreamError(error)
                : chatStreamError(error);
              controller.enqueue(encoder.encode(frame));
              controller.close();
            } catch {
              controller.error(error);
            }
          }
        }
      },
      async cancel(reason) {
        if (!settled) {
          settled = true;
          abortScope.abort(reason);
          try {
            await iterator.return?.(undefined);
          } finally {
            abortScope.dispose();
          }
        } else {
          abortScope.dispose();
        }
      },
    });

    return new web.Response(body, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        ...this.responseHeaders(requestId, model.descriptor, undefined, model.profile),
      },
    });
  }

  private async handleGeneration(
    bodyText: string,
    signal: AbortSignal | undefined,
    requestId: string,
    kind: 'responses' | 'chat'
  ): Promise<Response> {
    const abortScope = createAbortScope(signal);
    try {
      const { parsed, model } = await this.parseAndResolve(bodyText, abortScope.signal, kind);
      if (parsed.stream) {
        abortScope.dispose();
        return this.stream(parsed, model, requestId, signal, kind);
      }
      return await this.complete(parsed, model, requestId, abortScope.signal, kind);
    } finally {
      abortScope.dispose();
    }
  }

  private async handleModels(signal: AbortSignal, requestId: string): Promise<Response> {
    const models = await this.models(signal);
    const ready = models.filter((model) => model.state !== 'not_ready');
    const data = ready.map((model) => ({
      id: model.id,
      object: 'model',
      created: unixSeconds(model.createdAt),
      owned_by: 'modelcommons',
    }));
    if (this.options.exposeAliasesInModelList) {
      for (const [alias, target] of Object.entries(this.options.aliases ?? {})) {
        const model = ready.find((candidate) => candidate.id === target.modelId);
        if (!model || data.some((item) => item.id === alias)) continue;
        data.push({
          id: alias,
          object: 'model',
          created: unixSeconds(model.createdAt),
          owned_by: 'modelcommons',
        });
      }
    }
    return jsonResponse(this.web, { object: 'list', data }, {
      headers: { 'x-request-id': requestId },
    });
  }

  private parseEmbeddingInput(value: unknown): string[] {
    if (typeof value === 'string') return [value];
    if (!Array.isArray(value) || value.length === 0) {
      invalid('input', 'input must be a string or a non-empty array of strings.');
    }
    if (value.some((item) => typeof item !== 'string')) {
      unsupported('input', 'Numeric token inputs require tokenizer-ID compatibility and are not supported.');
    }
    return value as string[];
  }

  private async handleEmbeddings(
    bodyText: string,
    signal: AbortSignal,
    requestId: string
  ): Promise<Response> {
    const raw = parseJsonText(bodyText);
    const body = record(raw, 'Request body');
    assertAllowedKeys(body, ['model', 'input', 'encoding_format', 'dimensions']);
    const requestedId = nonEmptyString(body.model, 'model');
    const model = await this.resolveModel(requestedId, signal);
    const backend = this.options.backend;
    const embed = backend.embed;
    if (!model.descriptor.capabilities.includes('embeddings') || !embed) {
      unsupported('model', `Model \`${model.descriptor.id}\` does not provide embeddings.`);
    }
    const input = this.parseEmbeddingInput(body.input);
    const encoding = body.encoding_format === undefined ? 'float' : nonEmptyString(body.encoding_format, 'encoding_format');
    if (encoding !== 'float' && encoding !== 'base64') unsupported('encoding_format');
    let dimensions: number | undefined;
    if (body.dimensions !== undefined) {
      dimensions = positiveInteger(body.dimensions, 'dimensions');
      const supported = model.descriptor.features?.embeddingDimensions;
      if (supported !== 'any' && (!supported || !supported.includes(dimensions))) {
        unsupported('dimensions', `Embedding dimension ${dimensions} is not supported by this model/runtime.`);
      }
    }
    const execution: ProviderExecutionOptions = {
      signal,
      requestId,
      requestedModelId: requestedId,
    };
    const result = await embed.call(backend, {
      id: createId(this.options.idFactory, 'embedding'),
      model: {
        id: model.descriptor.id,
        profile: model.profile,
        capabilities: [...model.descriptor.capabilities],
      },
      input,
      ...(dimensions !== undefined ? { dimensions } : {}),
    }, execution);
    throwIfAborted(signal);
    if (result.modelId !== model.descriptor.id) {
      throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The embedding backend returned a different model than the resolved selection.');
    }
    if (result.embeddings.length !== input.length) {
      throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'Embedding result count did not match the input count.');
    }
    for (const [index, embedding] of result.embeddings.entries()) {
      if (!embedding.length || embedding.some((value) => !Number.isFinite(value))) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', `Embedding ${index} contains invalid values.`);
      }
      if (dimensions !== undefined && embedding.length !== dimensions) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', `Embedding ${index} has an unexpected dimension.`);
      }
    }
    const promptTokens = result.usage.inputTokens;
    const totalTokens = result.usage.totalTokens ?? promptTokens;
    if (
      promptTokens === undefined ||
      !Number.isSafeInteger(promptTokens) ||
      promptTokens < 0 ||
      totalTokens === undefined ||
      !Number.isSafeInteger(totalTokens) ||
      totalTokens < promptTokens
    ) {
      throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The embedding backend must report input token usage.');
    }
    const response: OpenAIEmbeddingWireResponse = {
      object: 'list',
      model: result.modelId,
      data: result.embeddings.map((embedding, index) => ({
        object: 'embedding',
        index,
        embedding: encoding === 'base64' ? encodeFloat32Base64(embedding) : [...embedding],
      })),
      usage: {
        prompt_tokens: promptTokens,
        total_tokens: totalTokens,
      },
    };
    return jsonResponse(this.web, response, {
      headers: this.responseHeaders(requestId, model.descriptor, undefined, model.profile),
    });
  }

  private async handleFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const requestId = this.requestId();
    try {
      const request = await normalizeFetchRequest(input, init);
      if (request.url.origin !== MODEL_COMMONS_OPENAI_ORIGIN) {
        throw new TypeError(`ModelCommons fetch refuses non-local origin \`${request.url.origin}\`.`);
      }
      if (request.url.username || request.url.password || request.url.hash) {
        throw new ProviderInputError('Credentials and URL fragments are not accepted by the local provider fetch.');
      }
      throwIfAborted(request.signal);
      const scope = createAbortScope(request.signal);
      try {
        if (request.url.search) unsupported('query', 'Query parameters are not supported on this endpoint.');
        if (request.url.pathname === '/v1/models') {
          if (request.method !== 'GET') throw new ProviderInputError('Method not allowed.', { status: 405 });
          return await this.handleModels(scope.signal, requestId);
        }
        if (request.url.pathname === '/v1/responses') {
          if (request.method !== 'POST') throw new ProviderInputError('Method not allowed.', { status: 405 });
          return await this.handleGeneration(request.bodyText, request.signal, requestId, 'responses');
        }
        if (request.url.pathname === '/v1/chat/completions') {
          if (request.method !== 'POST') throw new ProviderInputError('Method not allowed.', { status: 405 });
          return await this.handleGeneration(request.bodyText, request.signal, requestId, 'chat');
        }
        if (request.url.pathname === '/v1/embeddings') {
          if (request.method !== 'POST') throw new ProviderInputError('Method not allowed.', { status: 405 });
          return await this.handleEmbeddings(request.bodyText, scope.signal, requestId);
        }
        throw new ProviderInputError(`Unknown local OpenAI route \`${request.url.pathname}\`.`, {
          status: 404,
          code: 'modelcommons_route_not_found',
        });
      } finally {
        scope.dispose();
      }
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (error instanceof TypeError && error.message.startsWith('ModelCommons fetch refuses')) throw error;
      return this.errorResponse(error, requestId);
    }
  }
}

export function createOpenAIProviderFetch(options: OpenAIProviderAdapterOptions): OpenAIProviderFetch {
  return new OpenAIProviderAdapter(options).fetch;
}

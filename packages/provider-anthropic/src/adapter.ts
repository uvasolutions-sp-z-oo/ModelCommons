import {
  ModelCommonsError,
  validateCanonicalRequest,
  type ModelAliasTarget,
} from '@modelcommons/protocol';
import {
  ProviderInputError,
  anthropicErrorBody,
  createAbortScope,
  createId,
  jsonResponse,
  nonEmptyString,
  normalizeFetchRequest,
  parseJsonText,
  record,
  resolveWebPrimitives,
  throwIfAborted,
  unsupported,
} from './internal';
import { parseAnthropicRequest, type ParsedAnthropicRequest } from './parse';
import { anthropicEventStream, anthropicStreamError } from './streams';
import type {
  AnthropicProviderAdapterOptions,
  AnthropicProviderFetch,
  ProviderExecutionOptions,
  ProviderModelDescriptor,
  ProviderWebPrimitives,
} from './types';
import {
  MODEL_COMMONS_ANTHROPIC_ORIGIN,
  SUPPORTED_ANTHROPIC_VERSION,
} from './types';
import { anthropicMessageBody } from './wire';

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

export class AnthropicProviderAdapter {
  readonly fetch: AnthropicProviderFetch;
  private readonly web: ProviderWebPrimitives;

  constructor(private readonly options: AnthropicProviderAdapterOptions) {
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

  private async resolveModel(requestedId: string, signal: AbortSignal): Promise<ResolvedModel> {
    const models = await this.models(signal);
    const direct = models.find((model) => model.id === requestedId);
    const alias = direct ? undefined : ownAlias(this.options.aliases, requestedId);
    const descriptor = direct ?? (alias ? models.find((model) => model.id === alias.modelId) : undefined);
    if (!descriptor) {
      throw new ModelCommonsError('MODEL_NOT_FOUND', `Model \`${requestedId}\` was not found.`);
    }
    if (descriptor.state === 'not_ready') {
      throw new ModelCommonsError('MODEL_NOT_READY', `Model \`${descriptor.id}\` is not ready.`, {
        retryable: true,
      });
    }
    return {
      descriptor,
      profile: alias?.profile ?? descriptor.profileId,
    };
  }

  private executionOptions(
    parsed: ParsedAnthropicRequest,
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
      ...(parsed.topK !== undefined ? { topK: parsed.topK } : {}),
    };
  }

  private responseHeaders(
    requestId: string,
    model?: ProviderModelDescriptor,
    diagnostics?: { resolvedModelId: string; runtimeId: string; profileId: string },
    profile?: string
  ): Record<string, string> {
    return {
      'request-id': requestId,
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
    const mapped = anthropicErrorBody(error, requestId);
    return jsonResponse(this.web, mapped.body, {
      status: mapped.status,
      headers: {
        'request-id': requestId,
        'x-modelcommons-error-code': mapped.modelCommonsCode,
      },
    });
  }

  private async parseAndResolve(
    bodyText: string,
    signal: AbortSignal
  ): Promise<{ parsed: ParsedAnthropicRequest; model: ResolvedModel }> {
    const raw = parseJsonText(bodyText);
    const body = record(raw, 'Request body');
    const requestedId = nonEmptyString(body.model, 'model');
    const model = await this.resolveModel(requestedId, signal);
    const parsed = parseAnthropicRequest(raw, model.descriptor, model.profile);
    parsed.canonical.id = createId(this.options.idFactory, 'request');
    validateCanonicalRequest(parsed.canonical);
    return { parsed, model };
  }

  private async complete(
    parsed: ParsedAnthropicRequest,
    model: ResolvedModel,
    requestId: string,
    signal: AbortSignal
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
    return jsonResponse(this.web, anthropicMessageBody(response, parsed.canonical), {
      headers: this.responseHeaders(requestId, model.descriptor, response.diagnostics, model.profile),
    });
  }

  private stream(
    parsed: ParsedAnthropicRequest,
    model: ResolvedModel,
    requestId: string,
    parentSignal?: AbortSignal
  ): Response {
    const backend = this.options.backend;
    const stream = backend.stream;
    if (!stream) {
      throw new ProviderInputError('Streaming is not available from the configured backend.', {
        code: 'FEATURE_UNSUPPORTED',
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
    const frames = anthropicEventStream(events, requestId, parsed.canonical);
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
              controller.enqueue(encoder.encode(anthropicStreamError(error, requestId)));
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

  private async handleMessages(
    bodyText: string,
    signal: AbortSignal | undefined,
    requestId: string
  ): Promise<Response> {
    const abortScope = createAbortScope(signal);
    try {
      const { parsed, model } = await this.parseAndResolve(bodyText, abortScope.signal);
      if (parsed.stream) {
        abortScope.dispose();
        return this.stream(parsed, model, requestId, signal);
      }
      return await this.complete(parsed, model, requestId, abortScope.signal);
    } finally {
      abortScope.dispose();
    }
  }

  private validateVersion(headers: Record<string, string>): void {
    const version = headers['anthropic-version'];
    if (!version) {
      throw new ProviderInputError('The anthropic-version header is required.');
    }
    if (version !== SUPPORTED_ANTHROPIC_VERSION) {
      throw new ProviderInputError(
        `Anthropic API version \`${version}\` is not supported; use ${SUPPORTED_ANTHROPIC_VERSION}.`
      );
    }
    if (headers['anthropic-beta']) {
      unsupported('anthropic-beta', 'Anthropic beta features are not supported by this adapter.');
    }
  }

  private async handleFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const requestId = this.requestId();
    try {
      const request = await normalizeFetchRequest(input, init);
      if (request.url.origin !== MODEL_COMMONS_ANTHROPIC_ORIGIN) {
        throw new TypeError(`ModelCommons fetch refuses non-local origin \`${request.url.origin}\`.`);
      }
      if (request.url.username || request.url.password || request.url.hash) {
        throw new ProviderInputError('Credentials and URL fragments are not accepted by the local provider fetch.');
      }
      throwIfAborted(request.signal);
      this.validateVersion(request.headers);
      if (request.url.search) unsupported('query', 'Query parameters are not supported on this endpoint.');
      if (request.url.pathname !== '/v1/messages') {
        throw new ProviderInputError(`Unknown local Anthropic route \`${request.url.pathname}\`.`, {
          status: 404,
          code: 'ROUTE_NOT_FOUND',
        });
      }
      if (request.method !== 'POST') throw new ProviderInputError('Method not allowed.', { status: 405 });
      return await this.handleMessages(request.bodyText, request.signal, requestId);
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (error instanceof TypeError && error.message.startsWith('ModelCommons fetch refuses')) throw error;
      return this.errorResponse(error, requestId);
    }
  }
}

export function createAnthropicProviderFetch(
  options: AnthropicProviderAdapterOptions
): AnthropicProviderFetch {
  return new AnthropicProviderAdapter(options).fetch;
}

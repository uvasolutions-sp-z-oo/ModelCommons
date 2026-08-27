import {
  ModelCommonsError,
  toModelCommonsError,
  validateCanonicalRequest,
  type ModelCommonsResponse,
  type ModelCommonsStreamEvent,
  type ModelCommonsUsage,
} from '@modelcommons/protocol';
import type { NativeCompletionResult, TokenData } from 'llama.rn';
import { completionParams, contextParams, reportCapabilities, resultContent, resultStopReason, resultToolCalls } from './mapping';
import { AsyncEventQueue, AsyncMutex } from './mutex';
import {
  LLAMA_RN_RUNTIME_ID,
  LLAMA_RN_VERSION,
  type CreateLlamaRnSessionOptions,
  type LlamaRnAvailability,
  type LlamaRnContext,
  type LlamaRnModule,
  type LlamaRnReportedCapabilities,
  type LlamaRnRuntimeOptions,
  type LlamaRnSession,
  type ModelResourceLease,
} from './types';

interface ContextEntry {
  key: string;
  context: LlamaRnContext;
  capabilities: LlamaRnReportedCapabilities;
  operationMutex: AsyncMutex;
  references: number;
  lease?: ModelResourceLease;
  contextReleased: boolean;
  leaseReleased: boolean;
}

interface PendingContextCleanup {
  key: string;
  context?: LlamaRnContext;
  lease?: ModelResourceLease;
  contextReleased: boolean;
  leaseReleased: boolean;
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter = (idCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

function contextKey(options: CreateLlamaRnSessionOptions): string {
  const modelUri = options.model.lease?.uri ?? options.model.uri;
  return JSON.stringify({
    modelUri,
    leaseId: options.model.lease?.id,
    profile: options.profile.llama,
  });
}

class ContextPool {
  private readonly lifecycleMutex = new AsyncMutex();
  private readonly entries = new Map<string, ContextEntry>();
  private readonly pendingCleanup = new Map<string, PendingContextCleanup>();

  constructor(
    private readonly loadModule: () => Promise<LlamaRnModule>,
    private readonly maxLoadedContexts: number
  ) {}

  async acquire(options: CreateLlamaRnSessionOptions): Promise<ContextEntry> {
    return this.lifecycleMutex.runExclusive(async () => {
      const key = contextKey(options);
      if (this.pendingCleanup.has(key)) {
        throw new ModelCommonsError(
          'RUNTIME_UNAVAILABLE',
          'The matching native context has incomplete initialization cleanup.',
          { retryable: true }
        );
      }
      const existing = this.entries.get(key);
      if (existing) {
        if (existing.references <= 0 || existing.contextReleased) {
          throw new ModelCommonsError(
            'RUNTIME_UNAVAILABLE',
            'The matching native context is awaiting cleanup; retry after release completes.',
            { retryable: true }
          );
        }
        existing.references += 1;
        return existing;
      }

      if (this.entries.size + this.pendingCleanup.size >= this.maxLoadedContexts) {
        throw new ModelCommonsError(
          'RUNTIME_UNAVAILABLE',
          'The mobile runtime context limit is reached. Release another session before loading a different model/profile.',
          { retryable: true, details: { maxLoadedContexts: this.maxLoadedContexts } }
        );
      }

      let context: LlamaRnContext | undefined;
      const lease = options.model.lease;
      try {
        const llama = await this.loadModule();
        const uri = lease?.uri ?? options.model.uri;
        context = await llama.initLlama(contextParams(uri, options.profile));
        const entry: ContextEntry = {
          key,
          context,
          capabilities: reportCapabilities(context),
          operationMutex: new AsyncMutex(),
          references: 1,
          lease,
          contextReleased: false,
          leaseReleased: lease === undefined,
        };
        this.entries.set(key, entry);
        return entry;
      } catch (error) {
        let contextReleased = context === undefined;
        let leaseReleased = lease === undefined;
        if (context) {
          try {
            await context.release();
            contextReleased = true;
          } catch {
            // Preserve the initialization error; the native context was best-effort cleaned.
          }
        }
        if (lease && contextReleased) {
          try {
            await lease.release();
            leaseReleased = true;
          } catch {
            // Preserve the initialization error. The connector also cleans leases on teardown.
          }
        }
        if (!contextReleased || !leaseReleased) {
          this.pendingCleanup.set(key, {
            key,
            context,
            lease,
            contextReleased,
            leaseReleased,
          });
        }
        if (error instanceof ModelCommonsError) throw error;
        const allocationFailure = error instanceof Error && /\b(?:oom|out of memory|alloc(?:ation)?|memory pressure)\b/i.test(error.message);
        throw new ModelCommonsError(
          allocationFailure ? 'INSUFFICIENT_MEMORY' : 'RUNTIME_INITIALIZATION_FAILED',
          allocationFailure
            ? 'llama.rn could not allocate enough memory for this model and profile.'
            : 'llama.rn failed to initialize the selected model and profile.',
          { cause: error }
        );
      }
    });
  }

  async release(entry: ContextEntry): Promise<void> {
    await this.lifecycleMutex.runExclusive(async () => {
      const current = this.entries.get(entry.key);
      if (!current) return;
      if (current.references > 0) current.references -= 1;
      if (current.references > 0) return;
      await this.cleanupResource(current);
      this.entries.delete(current.key);
    });
  }

  async releaseAll(): Promise<void> {
    await this.lifecycleMutex.runExclusive(async () => {
      const entries = [...this.entries.values()];
      const failures: unknown[] = [];
      for (const entry of entries) {
        entry.references = 0;
        if (!entry.contextReleased) {
          try {
            await entry.context.stopCompletion();
          } catch {
            // No completion may be active.
          }
        }
        try {
          await this.cleanupResource(entry);
          this.entries.delete(entry.key);
        } catch (error) {
          failures.push(error);
        }
      }
      for (const pending of [...this.pendingCleanup.values()]) {
        if (!pending.contextReleased && pending.context) {
          try {
            await pending.context.stopCompletion();
          } catch {
            // Initialization failed before an operation was admitted.
          }
        }
        try {
          await this.cleanupResource(pending);
          this.pendingCleanup.delete(pending.key);
        } catch (error) {
          failures.push(error);
        }
      }
      if (failures.length > 0) {
        throw new ModelCommonsError(
          'RUNTIME_INITIALIZATION_FAILED',
          'One or more native contexts or model leases failed to release.',
          { cause: failures[0], details: { failureCount: failures.length } }
        );
      }
    });
  }

  /** Caller holds lifecycleMutex. Keep failed cleanup registered for a safe retry. */
  private async cleanupResource(resource: PendingContextCleanup): Promise<void> {
    if (!resource.contextReleased) {
      if (!resource.context) {
        throw new ModelCommonsError(
          'RUNTIME_INITIALIZATION_FAILED',
          'Native context cleanup state is incomplete.'
        );
      }
      try {
        await resource.context.release();
        resource.contextReleased = true;
      } catch (error) {
        throw new ModelCommonsError(
          'RUNTIME_INITIALIZATION_FAILED',
          'The native model context failed to release.',
          { cause: error }
        );
      }
    }
    // The mmap/context must be gone before balancing security-scoped access.
    if (!resource.leaseReleased) {
      try {
        await resource.lease!.release();
        resource.leaseReleased = true;
      } catch (error) {
        throw new ModelCommonsError(
          'STORAGE_UNAVAILABLE',
          'The model resource lease failed to release after context destruction.',
          { cause: error }
        );
      }
    }
  }
}

class Session implements LlamaRnSession {
  readonly id = nextId('session');
  readonly modelId: string;
  readonly profileId: string;
  private released = false;
  private closing = false;
  private releaseAttempt?: Promise<void>;
  private readonly operations = new Map<string, AbortController>();
  private readonly jobs = new Set<Promise<void>>();

  constructor(
    private readonly pool: ContextPool,
    private readonly entry: ContextEntry,
    options: CreateLlamaRnSessionOptions,
    private readonly onRelease: (session: Session) => void
  ) {
    this.modelId = options.model.id;
    this.profileId = options.profile.id;
  }

  getCapabilities(): LlamaRnReportedCapabilities {
    return this.entry.capabilities;
  }

  stream(request: Parameters<LlamaRnSession['stream']>[0], signal?: AbortSignal): AsyncIterable<ModelCommonsStreamEvent> {
    let cancelOnIteratorReturn: (() => void) | undefined;
    const queue = new AsyncEventQueue<ModelCommonsStreamEvent>(() => cancelOnIteratorReturn?.());
    const responseId = request.id ?? nextId('response');
    if (this.released || this.closing) {
      this.emitImmediateFailure(queue, responseId, new ModelCommonsError(
        'RUNTIME_UNAVAILABLE',
        this.released ? 'The session has been released.' : 'The session is being released.',
        { retryable: !this.released }
      ));
      queue.close();
      return queue;
    }

    if (this.operations.has(responseId)) {
      this.emitImmediateFailure(
        queue,
        responseId,
        new ModelCommonsError('INTEGRITY_FAILED', 'A request with this id is already active.')
      );
      queue.close();
      return queue;
    }

    const controller = new AbortController();
    cancelOnIteratorReturn = () => controller.abort(
      new ModelCommonsError('USER_CANCELLED', 'The stream consumer stopped before completion.')
    );
    const forwardAbort = () => controller.abort(signal?.reason);
    if (signal?.aborted) controller.abort(signal.reason);
    else signal?.addEventListener('abort', forwardAbort, { once: true });
    this.operations.set(responseId, controller);

    const job = this.run(responseId, request, controller, queue)
      .finally(() => {
        signal?.removeEventListener('abort', forwardAbort);
        this.operations.delete(responseId);
        queue.close();
      });
    this.jobs.add(job);
    void job.finally(() => this.jobs.delete(job));
    return queue;
  }

  private emitImmediateFailure(
    queue: AsyncEventQueue<ModelCommonsStreamEvent>,
    responseId: string,
    error: ModelCommonsError
  ): void {
    const diagnostics = {
      offline: true as const,
      resolvedModelId: this.modelId,
      runtimeId: LLAMA_RN_RUNTIME_ID,
      profileId: this.profileId,
    };
    queue.push({
      type: 'response.started',
      responseId,
      createdAt: Date.now(),
      modelId: this.modelId,
      diagnostics,
    });
    queue.push({
      type: 'response.failed',
      responseId,
      error: error.toJSON(),
    });
  }

  private async run(
    responseId: string,
    request: Parameters<LlamaRnSession['stream']>[0],
    controller: AbortController,
    queue: AsyncEventQueue<ModelCommonsStreamEvent>
  ): Promise<void> {
    const diagnostics = {
      offline: true as const,
      resolvedModelId: this.modelId,
      runtimeId: LLAMA_RN_RUNTIME_ID,
      profileId: this.profileId,
    };
    queue.push({
      type: 'response.started',
      responseId,
      createdAt: Date.now(),
      modelId: this.modelId,
      diagnostics,
    });

    try {
      validateCanonicalRequest(request);
      await this.entry.operationMutex.runExclusive(async () => {
        if (controller.signal.aborted) {
          throw new ModelCommonsError('USER_CANCELLED', 'Generation was cancelled before it started.');
        }

        let stopRequested = false;
        const stopNative = () => {
          if (stopRequested) return;
          stopRequested = true;
          void this.entry.context.stopCompletion().catch(() => undefined);
        };
        controller.signal.addEventListener('abort', stopNative, { once: true });
        let streamedContent = '';
        try {
          const params = completionParams(request, this.entry.capabilities);
          // Canonical requests carry their complete history. Reset native KV/recurrent
          // state so a context shared by multiple sessions cannot leak prior prompts.
          await this.entry.context.clearCache(
            this.entry.context.model.is_recurrent || this.entry.context.model.is_hybrid
          );
          if (controller.signal.aborted) {
            throw new ModelCommonsError('USER_CANCELLED', 'Generation was cancelled before native completion started.');
          }
          const result = await this.entry.context.completion(params, (data: TokenData) => {
            const parsed = data.content;
            let delta = '';
            if (typeof parsed === 'string' && parsed.startsWith(streamedContent)) {
              delta = parsed.slice(streamedContent.length);
              streamedContent = parsed;
            } else if (!request.tools?.length && data.token) {
              delta = data.token;
              streamedContent += delta;
            }
            if (delta) queue.push({ type: 'text.delta', responseId, delta });
          });
          this.emitResult(responseId, result, diagnostics, queue);
        } finally {
          controller.signal.removeEventListener('abort', stopNative);
        }
      });
    } catch (error) {
      const normalized = controller.signal.aborted
        ? new ModelCommonsError('USER_CANCELLED', 'Generation was cancelled.')
        : error instanceof ModelCommonsError && error.code === 'USER_CANCELLED'
          ? error
          : toModelCommonsError(error);
      queue.push({ type: 'response.failed', responseId, error: normalized.toJSON() });
    }
  }

  private emitResult(
    responseId: string,
    result: NativeCompletionResult,
    diagnostics: ModelCommonsResponse['diagnostics'],
    queue: AsyncEventQueue<ModelCommonsStreamEvent>
  ): void {
    const toolCalls = resultToolCalls(result);
    for (const [index, call] of toolCalls.entries()) {
      queue.push({ type: 'tool_call.started', responseId, callId: call.id, name: call.name, index });
      const raw = call.rawArguments ?? JSON.stringify(call.arguments);
      if (raw) queue.push({ type: 'tool_call.arguments.delta', responseId, callId: call.id, delta: raw, index });
      queue.push({ type: 'tool_call.completed', responseId, call, index });
    }
    const usage: ModelCommonsUsage = {
      inputTokens: result.tokens_evaluated,
      outputTokens: result.tokens_predicted,
      totalTokens: result.tokens_evaluated + result.tokens_predicted,
      cachedInputTokens: result.tokens_cached,
    };
    queue.push({ type: 'usage.updated', responseId, usage });
    queue.push({
      type: 'response.completed',
      response: {
        id: responseId,
        createdAt: Date.now(),
        modelId: this.modelId,
        content: resultContent(result),
        stopReason: resultStopReason(result),
        ...(result.stopping_word ? { stopSequence: result.stopping_word } : {}),
        usage,
        diagnostics,
      },
    });
  }

  async complete(request: Parameters<LlamaRnSession['complete']>[0], signal?: AbortSignal): Promise<ModelCommonsResponse> {
    let response: ModelCommonsResponse | undefined;
    let failure: ModelCommonsStreamEvent & { type: 'response.failed' } | undefined;
    for await (const event of this.stream(request, signal)) {
      if (event.type === 'response.completed') response = event.response;
      if (event.type === 'response.failed') failure = event;
    }
    if (response) return response;
    if (failure) {
      throw new ModelCommonsError(failure.error.code, failure.error.message, {
        retryable: failure.error.retryable,
        details: failure.error.details,
      });
    }
    throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'llama.rn completed without a terminal event.');
  }

  async cancel(requestId?: string): Promise<void> {
    if (requestId) {
      this.operations.get(requestId)?.abort();
    } else {
      for (const controller of this.operations.values()) controller.abort();
    }
  }

  async release(): Promise<void> {
    if (this.released) return;
    if (this.releaseAttempt) return this.releaseAttempt;
    this.closing = true;
    const attempt = (async () => {
      await this.cancel();
      await Promise.allSettled([...this.jobs]);
      await this.pool.release(this.entry);
      this.released = true;
      this.onRelease(this);
    })();
    this.releaseAttempt = attempt;
    try {
      await attempt;
    } finally {
      if (this.releaseAttempt === attempt) this.releaseAttempt = undefined;
    }
  }
}

export class LlamaRnRuntime {
  private readonly loadModule: () => Promise<LlamaRnModule>;
  private readonly pool: ContextPool;
  private readonly sessions = new Set<Session>();
  private released = false;
  private closing = false;
  private releaseAttempt?: Promise<void>;

  constructor(options: LlamaRnRuntimeOptions = {}) {
    this.loadModule = options.loadModule ?? (() => import('llama.rn'));
    const maxLoadedContexts = options.maxLoadedContexts ?? 1;
    if (!Number.isInteger(maxLoadedContexts) || maxLoadedContexts < 1) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'maxLoadedContexts must be a positive integer.');
    }
    this.pool = new ContextPool(this.loadModule, maxLoadedContexts);
  }

  async getAvailability(): Promise<LlamaRnAvailability> {
    if (this.released || this.closing) {
      return {
        available: false,
        runtimeId: LLAMA_RN_RUNTIME_ID,
        runtimeVersion: LLAMA_RN_VERSION,
        reason: 'RUNTIME_RELEASED',
        ...(this.closing && !this.released ? { message: 'Runtime cleanup is in progress.' } : {}),
      };
    }
    try {
      const module = await this.loadModule();
      if (typeof module.initLlama !== 'function') {
        return {
          available: false,
          runtimeId: LLAMA_RN_RUNTIME_ID,
          runtimeVersion: LLAMA_RN_VERSION,
          reason: 'NATIVE_BINDINGS_UNAVAILABLE',
        };
      }
      return { available: true, runtimeId: LLAMA_RN_RUNTIME_ID, runtimeVersion: LLAMA_RN_VERSION };
    } catch {
      return {
        available: false,
        runtimeId: LLAMA_RN_RUNTIME_ID,
        runtimeVersion: LLAMA_RN_VERSION,
        reason: 'OPTIONAL_PEER_MISSING',
        message: 'The optional llama.rn package or its native bindings are unavailable in this build.',
      };
    }
  }

  async createSession(options: CreateLlamaRnSessionOptions): Promise<LlamaRnSession> {
    if (this.released || this.closing) {
      throw new ModelCommonsError(
        'RUNTIME_UNAVAILABLE',
        this.released ? 'The runtime has been released.' : 'The runtime is being released.',
        { retryable: !this.released }
      );
    }
    const entry = await this.pool.acquire(options);
    const session = new Session(this.pool, entry, options, (released) => this.sessions.delete(released));
    this.sessions.add(session);
    return session;
  }

  async release(): Promise<void> {
    if (this.released) return;
    if (this.releaseAttempt) return this.releaseAttempt;
    this.closing = true;
    const attempt = this.performRelease();
    this.releaseAttempt = attempt;
    try {
      await attempt;
    } finally {
      if (this.releaseAttempt === attempt) this.releaseAttempt = undefined;
    }
  }

  private async performRelease(): Promise<void> {
    await Promise.allSettled([...this.sessions].map((session) => session.release()));
    try {
      await this.pool.releaseAll();
    } catch (error) {
      throw new ModelCommonsError(
        'RUNTIME_INITIALIZATION_FAILED',
        'One or more native contexts or model leases failed to release.',
        { cause: error }
      );
    }

    // A session whose first cleanup attempt failed remains registered. With
    // pool cleanup now complete, retry it so its public lifecycle can finish.
    const retries = await Promise.allSettled([...this.sessions].map((session) => session.release()));
    const retryFailure = retries.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );
    if (retryFailure) {
      throw new ModelCommonsError(
        'RUNTIME_INITIALIZATION_FAILED',
        'One or more sessions failed to finalize after native cleanup.',
        { cause: retryFailure.reason }
      );
    }
    this.sessions.clear();
    this.released = true;
  }
}

export function createLlamaRnRuntime(options: LlamaRnRuntimeOptions = {}): LlamaRnRuntime {
  return new LlamaRnRuntime(options);
}

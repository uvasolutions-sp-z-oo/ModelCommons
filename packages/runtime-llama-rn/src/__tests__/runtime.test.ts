import type { ModelCommonsRequest, ModelCommonsStreamEvent, RuntimeProfile } from '@modelcommons/protocol';
import { describe, expect, it, vi } from 'vitest';
import { createLlamaRnRuntime } from '../runtime';

const profile: RuntimeProfile = {
  schema: 'modelcommons.runtime-profile',
  schemaVersion: 1,
  protocolVersion: '0.1.0',
  id: 'safe',
  displayName: 'Safe',
  stability: 'stable',
  llama: {
    nCtx: 2048,
    nBatch: 128,
    nUbatch: 64,
    nGpuLayers: 0,
    useMmap: true,
    useMlock: false,
    cacheTypeK: 'q8_0',
    cacheTypeV: 'q8_0',
  },
};

const request: ModelCommonsRequest = {
  id: 'request-1',
  model: { capabilities: ['text'] },
  messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
};

describe('LlamaRnRuntime lifecycle', () => {
  it('budgets rendered instructions and output before native generation without trimming', async () => {
    const context = {
      gpu: false, devices: [], reasonNoGPU: 'CPU profile',
      model: { desc: 'synthetic budget model', size: 1, nParams: 1, is_recurrent: false, is_hybrid: false,
        chatTemplates: { llamaChat: false, jinja: { default: true,
          defaultCaps: { tools: false, toolCalls: false, systemRole: true, parallelToolCalls: false }, toolUse: false } } },
      isJinjaSupported: () => true, isLlamaChatSupported: () => false,
      getFormattedChat: vi.fn(async (messages: unknown) => ({ prompt: JSON.stringify(messages) })),
      tokenize: vi.fn(async () => ({ tokens: Array(2000).fill(1) })),
      clearCache: vi.fn(async () => undefined), completion: vi.fn(),
      stopCompletion: vi.fn(async () => undefined), release: vi.fn(async () => undefined),
    };
    const runtime = createLlamaRnRuntime({ loadModule: async () => ({ initLlama: async () => context } as never) });
    const session = await runtime.createSession({ model: { id: 'budget', uri: 'file:///synthetic/model.gguf' }, profile, enforceContextBudget: true });
    await expect(session.complete({ ...request, instructions: 'Do not remove these safety instructions.', maxOutputTokens: 128 }))
      .rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' });
    expect(context.getFormattedChat.mock.calls[0][0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'system', content: 'Do not remove these safety instructions.' }),
    ]));
    expect(context.completion).not.toHaveBeenCalled();
    await session.release(); await runtime.release();
  });

  it.each([false, true])('clears independent session state including recurrent=%s before every request', async (recurrent) => {
    const context = {
      gpu: false, devices: [], reasonNoGPU: 'CPU profile',
      model: { desc: 'synthetic state model', size: 1, nParams: 1, is_recurrent: recurrent, is_hybrid: false,
        chatTemplates: { llamaChat: false, jinja: { default: true,
          defaultCaps: { tools: false, toolCalls: false, systemRole: true, parallelToolCalls: false }, toolUse: false } } },
      isJinjaSupported: () => true, isLlamaChatSupported: () => false,
      clearCache: vi.fn(async () => undefined),
      completion: vi.fn(async () => ({ text: 'Synthetic answer', content: 'Synthetic answer', reasoning_content: '', tool_calls: [],
        chat_format: 0, tokens_predicted: 2, tokens_evaluated: 4, tokens_cached: 0, stopped_eos: true, stopped_limit: false,
        stopped_word: false, stopping_word: '', interrupted: false, timings: {} })),
      stopCompletion: vi.fn(async () => undefined), release: vi.fn(async () => undefined),
    };
    const runtime = createLlamaRnRuntime({ loadModule: async () => ({ initLlama: async () => context } as never) });
    const first = await runtime.createSession({ model: { id: 'state', uri: 'file:///synthetic/state.gguf' }, profile });
    const second = await runtime.createSession({ model: { id: 'state', uri: 'file:///synthetic/state.gguf' }, profile });
    await first.complete({ ...request, instructions: 'Synthetic account A' });
    await second.complete({ ...request, instructions: 'Synthetic account B' });
    expect(context.clearCache.mock.calls).toEqual([[recurrent], [recurrent]]);
    await first.release(); await second.release(); await runtime.release();
  });

  it('reports a missing native binding without exposing native loader details', async () => {
    const runtime = createLlamaRnRuntime({
      loadModule: async () => ({
        initLlama: async () => { throw new Error('dlopen failed: library "librnllama_jni.so" not found at /private/path'); },
      } as never),
    });

    await expect(runtime.createSession({
      model: { id: 'native-bindings', uri: 'file:///models/native-bindings.gguf' },
      profile,
    })).rejects.toMatchObject({
      code: 'RUNTIME_UNAVAILABLE',
      retryable: true,
      message: 'llama.rn native bindings are unavailable in this build.',
    });
  });

  it('clears shared state, stops native completion when iteration ends, and releases context before lease', async () => {
    const lifecycle: string[] = [];
    let signalCompletionStarted!: () => void;
    const completionStarted = new Promise<void>((resolve) => { signalCompletionStarted = resolve; });
    let finishCompletion!: (value: Record<string, unknown>) => void;

    const context = {
      gpu: false,
      devices: [],
      reasonNoGPU: 'CPU profile',
      androidLib: undefined,
      model: {
        desc: 'mock',
        size: 1,
        nParams: 1,
        is_recurrent: false,
        is_hybrid: false,
        chatTemplates: {
          llamaChat: false,
          jinja: {
            default: true,
            defaultCaps: { tools: false, toolCalls: false, systemRole: true, parallelToolCalls: false },
            toolUse: false,
          },
        },
      },
      isJinjaSupported: () => true,
      isLlamaChatSupported: () => false,
      clearCache: vi.fn(async () => undefined),
      completion: vi.fn(() => {
        signalCompletionStarted();
        return new Promise((resolve) => { finishCompletion = resolve; });
      }),
      stopCompletion: vi.fn(async () => {
        lifecycle.push('stop');
        finishCompletion({
          text: '',
          reasoning_content: '',
          tool_calls: [],
          content: '',
          chat_format: 0,
          tokens_predicted: 0,
          tokens_evaluated: 1,
          draft_tokens: 0,
          draft_tokens_accepted: 0,
          truncated: false,
          stopped_eos: false,
          stopped_word: '',
          stopped_limit: 0,
          stopping_word: '',
          context_full: false,
          interrupted: true,
          tokens_cached: 0,
          timings: {},
        });
      }),
      release: vi.fn(async () => { lifecycle.push('context.release'); }),
    };
    const lease = {
      id: 'lease-1',
      uri: 'file:///models/mock.gguf',
      release: vi.fn(async () => { lifecycle.push('lease.release'); }),
    };
    const runtime = createLlamaRnRuntime({
      loadModule: async () => ({ initLlama: async () => context } as never),
    });
    const session = await runtime.createSession({
      model: { id: 'mock', uri: lease.uri, lease },
      profile,
    });

    const iterator = session.stream(request)[Symbol.asyncIterator]();
    const started = await iterator.next();
    if (started.done) throw new Error('The stream ended before response.started.');
    expect(started.value.type).toBe('response.started');
    await completionStarted;
    await iterator.return?.();
    await session.release();

    expect(context.clearCache).toHaveBeenCalledWith(false);
    expect(context.stopCompletion).toHaveBeenCalledTimes(1);
    expect(lifecycle.slice(-2)).toEqual(['context.release', 'lease.release']);
  });

  it('keeps failed native cleanup retryable and releases the lease only after context teardown', async () => {
    const lifecycle: string[] = [];
    const releaseContext = vi.fn()
      .mockRejectedValueOnce(new Error('transient native release failure'))
      .mockImplementation(async () => { lifecycle.push('context.release'); });
    const context = {
      gpu: false,
      devices: [],
      reasonNoGPU: 'CPU profile',
      androidLib: undefined,
      model: {
        desc: 'cleanup mock',
        size: 1,
        nParams: 1,
        is_recurrent: false,
        is_hybrid: false,
        chatTemplates: {
          llamaChat: false,
          jinja: {
            default: true,
            defaultCaps: { tools: false, toolCalls: false, systemRole: true, parallelToolCalls: false },
            toolUse: false,
          },
        },
      },
      isJinjaSupported: () => true,
      isLlamaChatSupported: () => false,
      clearCache: vi.fn(async () => undefined),
      completion: vi.fn(),
      stopCompletion: vi.fn(async () => undefined),
      release: releaseContext,
    };
    const lease = {
      id: 'lease-retry',
      uri: 'file:///models/cleanup.gguf',
      release: vi.fn(async () => { lifecycle.push('lease.release'); }),
    };
    const runtime = createLlamaRnRuntime({
      loadModule: async () => ({ initLlama: async () => context } as never),
    });
    const session = await runtime.createSession({
      model: { id: 'cleanup', uri: lease.uri, lease },
      profile,
    });

    await expect(session.release()).rejects.toMatchObject({
      code: 'RUNTIME_INITIALIZATION_FAILED',
    });
    expect(lease.release).not.toHaveBeenCalled();
    await expect(session.release()).resolves.toBeUndefined();
    expect(releaseContext).toHaveBeenCalledTimes(2);
    expect(lifecycle).toEqual(['context.release', 'lease.release']);
    await expect(runtime.release()).resolves.toBeUndefined();
  });

  it('retains initialization-failure cleanup so runtime release can retry it', async () => {
    const releaseContext = vi.fn()
      .mockRejectedValueOnce(new Error('initial cleanup failed'))
      .mockResolvedValue(undefined);
    const context = {
      gpu: false,
      devices: [],
      reasonNoGPU: 'CPU profile',
      androidLib: undefined,
      model: {
        desc: 'initialization cleanup mock',
        size: 1,
        nParams: 1,
        is_recurrent: false,
        is_hybrid: false,
        get chatTemplates(): never {
          throw new Error('capability probe failed');
        },
      },
      isJinjaSupported: () => true,
      isLlamaChatSupported: () => false,
      clearCache: vi.fn(async () => undefined),
      completion: vi.fn(),
      stopCompletion: vi.fn(async () => undefined),
      release: releaseContext,
    };
    const lease = {
      id: 'lease-init-retry',
      uri: 'file:///models/init-cleanup.gguf',
      release: vi.fn(async () => undefined),
    };
    const runtime = createLlamaRnRuntime({
      loadModule: async () => ({ initLlama: async () => context } as never),
    });

    await expect(runtime.createSession({
      model: { id: 'init-cleanup', uri: lease.uri, lease },
      profile,
    })).rejects.toMatchObject({ code: 'RUNTIME_INITIALIZATION_FAILED' });
    expect(releaseContext).toHaveBeenCalledTimes(1);
    expect(lease.release).not.toHaveBeenCalled();
    await expect(runtime.release()).resolves.toBeUndefined();
    expect(releaseContext).toHaveBeenCalledTimes(2);
    expect(lease.release).toHaveBeenCalledOnce();
  });

  it('keeps immediate released-session failures inside the canonical stream lifecycle', async () => {
    const context = {
      gpu: false,
      devices: [],
      reasonNoGPU: 'CPU profile',
      androidLib: undefined,
      model: {
        desc: 'released session mock',
        size: 1,
        nParams: 1,
        is_recurrent: false,
        is_hybrid: false,
        chatTemplates: {
          llamaChat: false,
          jinja: {
            default: true,
            defaultCaps: { tools: false, toolCalls: false, systemRole: true, parallelToolCalls: false },
            toolUse: false,
          },
        },
      },
      isJinjaSupported: () => true,
      isLlamaChatSupported: () => false,
      clearCache: vi.fn(async () => undefined),
      completion: vi.fn(),
      stopCompletion: vi.fn(async () => undefined),
      release: vi.fn(async () => undefined),
    };
    const runtime = createLlamaRnRuntime({
      loadModule: async () => ({ initLlama: async () => context } as never),
    });
    const session = await runtime.createSession({
      model: { id: 'released-session', uri: 'file:///models/released.gguf' },
      profile,
    });
    await session.release();

    const events: ModelCommonsStreamEvent[] = [];
    for await (const event of session.stream(request)) events.push(event);

    expect(events.map((event) => event.type)).toEqual(['response.started', 'response.failed']);
    expect(events[0]).toMatchObject({ responseId: request.id, modelId: 'released-session' });
    expect(events[1]).toMatchObject({ responseId: request.id, error: { code: 'RUNTIME_UNAVAILABLE' } });
  });
});

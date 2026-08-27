import { describe, expect, it, vi } from 'vitest';
import {
  PROTOCOL_VERSION,
  type ModelCommonsRequest,
  type ModelCommonsResponse,
  type ModelCommonsStreamEvent,
  type ModelManifest,
} from '@modelcommons/protocol';
import { ModelCommonsSession } from '../client';
import type { ResolvedModel, TransportSession } from '../types';

const MODEL_ID = 'local/session-fixture';
const RUNTIME_ID = 'runtime-fixture';
const PROFILE_ID = 'safe';

function manifest(): ModelManifest {
  return {
    schema: 'modelcommons.model-manifest',
    schemaVersion: 1,
    protocolVersion: PROTOCOL_VERSION,
    id: MODEL_ID,
    revision: 'r1',
    storageId: 'local-session-fixture',
    displayName: 'Session fixture',
    family: 'fixture',
    architecture: { type: 'dense' },
    format: 'gguf',
    files: [{ role: 'model', path: 'model.gguf', required: true }],
    source: { provider: 'user' },
    license: {
      id: 'fixture',
      url: 'https://example.com/license',
      acceptanceRequired: false,
      gated: false,
    },
    capabilities: ['text'],
    compatibleRuntimes: [{ id: RUNTIME_ID }],
    context: { recommended: 2048 },
  };
}

function resolvedModel(): ResolvedModel {
  return {
    manifest: manifest(),
    runtimeId: RUNTIME_ID,
    profileId: PROFILE_ID,
  };
}

function diagnostics() {
  return {
    offline: true as const,
    resolvedModelId: MODEL_ID,
    runtimeId: RUNTIME_ID,
    profileId: PROFILE_ID,
  };
}

function response(overrides: Partial<ModelCommonsResponse> = {}): ModelCommonsResponse {
  return {
    id: 'response-1',
    createdAt: 10,
    modelId: MODEL_ID,
    content: [],
    stopReason: 'stop',
    usage: {},
    diagnostics: diagnostics(),
    ...overrides,
  };
}

function started(overrides: Partial<Extract<ModelCommonsStreamEvent, { type: 'response.started' }>> = {}): ModelCommonsStreamEvent {
  return {
    type: 'response.started',
    responseId: 'response-1',
    createdAt: 10,
    modelId: MODEL_ID,
    diagnostics: diagnostics(),
    ...overrides,
  };
}

function completed(overrides: Partial<ModelCommonsResponse> = {}): ModelCommonsStreamEvent {
  return { type: 'response.completed', response: response(overrides) };
}

function request(): Omit<ModelCommonsRequest, 'model'> {
  return {
    messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
  };
}

function transportSession(options: {
  generate?: TransportSession['generate'];
  stream?: TransportSession['stream'];
  cancel?: TransportSession['cancel'];
  release?: TransportSession['release'];
} = {}): TransportSession {
  return {
    id: 'session-1',
    model: resolvedModel(),
    generate: options.generate ?? (async () => response()),
    stream: options.stream ?? (async function* () {
      yield started();
      yield completed();
    }),
    cancel: options.cancel ?? (async () => undefined),
    release: options.release ?? (async () => undefined),
  };
}

async function collect(stream: AsyncIterable<ModelCommonsStreamEvent>): Promise<ModelCommonsStreamEvent[]> {
  const events: ModelCommonsStreamEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

describe('ModelCommonsSession lifecycle', () => {
  it('allows only one active inference operation', async () => {
    let finish!: (value: ModelCommonsResponse) => void;
    const pending = new Promise<ModelCommonsResponse>((resolve) => { finish = resolve; });
    const generate = vi.fn(async () => pending);
    const session = new ModelCommonsSession(transportSession({ generate }));

    const first = session.generate(request());
    await expect(session.generate(request())).rejects.toMatchObject({
      code: 'RUNTIME_UNAVAILABLE',
      retryable: true,
      details: { reason: 'SESSION_BUSY' },
    });
    await expect(session.release()).rejects.toMatchObject({
      code: 'RUNTIME_UNAVAILABLE',
      details: { reason: 'SESSION_BUSY' },
    });

    finish(response());
    await expect(first).resolves.toMatchObject({ id: 'response-1' });
    await expect(session.generate(request())).resolves.toMatchObject({ id: 'response-1' });
  });

  it('keeps release retryable after failure and makes successful release idempotent', async () => {
    const release = vi.fn()
      .mockRejectedValueOnce(new Error('first release failed'))
      .mockResolvedValue(undefined);
    const session = new ModelCommonsSession(transportSession({ release }));

    await expect(session.release()).rejects.toThrow('first release failed');
    await expect(session.generate(request())).resolves.toMatchObject({ id: 'response-1' });
    const retry = session.release();
    const concurrentRetry = session.release();
    await expect(Promise.all([retry, concurrentRetry])).resolves.toEqual([undefined, undefined]);
    await expect(session.release()).resolves.toBeUndefined();
    expect(release).toHaveBeenCalledTimes(2);
    await expect(session.generate(request())).rejects.toMatchObject({ code: 'RUNTIME_UNAVAILABLE' });
  });

  it('rejects a generated response whose identity differs from the loaded session', async () => {
    const generate = vi.fn()
      .mockResolvedValueOnce(response({ modelId: 'local/wrong-model' }))
      .mockResolvedValue(response());
    const session = new ModelCommonsSession(transportSession({ generate }));

    await expect(session.generate(request())).rejects.toMatchObject({ code: 'INTEGRITY_FAILED' });
    await expect(session.generate(request())).resolves.toMatchObject({ modelId: MODEL_ID });
  });

  it('rejects malformed generated response payloads', async () => {
    const generate = vi.fn()
      .mockResolvedValueOnce(response({
        stopReason: 'not-a-stop-reason' as ModelCommonsResponse['stopReason'],
      }))
      .mockResolvedValue(response({ usage: { totalTokens: -1 } }));
    const session = new ModelCommonsSession(transportSession({ generate }));

    await expect(session.generate(request())).rejects.toMatchObject({ code: 'INTEGRITY_FAILED' });
    await expect(session.generate(request())).rejects.toMatchObject({ code: 'INTEGRITY_FAILED' });
  });

  it('accepts one coherent started-to-terminal stream lifecycle', async () => {
    const cancel = vi.fn(async () => undefined);
    const stream: TransportSession['stream'] = async function* () {
      yield started();
      yield completed({ createdAt: 11 });
    };
    const session = new ModelCommonsSession(transportSession({ cancel, stream }));

    await expect(collect(session.stream(request()))).resolves.toEqual([
      started(),
      completed({ createdAt: 11 }),
    ]);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('rejects exhaustion before a terminal event', async () => {
    const stream: TransportSession['stream'] = async function* () {
      yield started();
      yield { type: 'text.delta', responseId: 'response-1', delta: 'partial' };
    };
    const session = new ModelCommonsSession(transportSession({ stream }));

    await expect(collect(session.stream(request()))).rejects.toMatchObject({
      code: 'INTEGRITY_FAILED',
      message: expect.stringContaining('terminal event'),
    });
  });

  it('rejects duplicate starts and mismatched response IDs', async () => {
    const duplicateStart: TransportSession['stream'] = async function* () {
      yield started();
      yield started();
    };
    const mismatchedId: TransportSession['stream'] = async function* () {
      yield started();
      yield { type: 'text.delta', responseId: 'response-2', delta: 'wrong' };
    };

    await expect(collect(new ModelCommonsSession(transportSession({ stream: duplicateStart })).stream(request())))
      .rejects.toMatchObject({ code: 'INTEGRITY_FAILED' });
    await expect(collect(new ModelCommonsSession(transportSession({ stream: mismatchedId })).stream(request())))
      .rejects.toMatchObject({ code: 'INTEGRITY_FAILED' });
  });

  it('rejects stream identity mismatches and events after terminal', async () => {
    const wrongDiagnostics: TransportSession['stream'] = async function* () {
      yield started({ diagnostics: { ...diagnostics(), profileId: 'wrong-profile' } });
    };
    const wrongTerminalDiagnostics: TransportSession['stream'] = async function* () {
      yield started();
      yield completed({ diagnostics: { ...diagnostics(), runtimeId: 'wrong-runtime' } });
    };
    const afterTerminal: TransportSession['stream'] = async function* () {
      yield started();
      yield completed();
      yield { type: 'text.delta', responseId: 'response-1', delta: 'too late' };
    };

    await expect(collect(new ModelCommonsSession(transportSession({ stream: wrongDiagnostics })).stream(request())))
      .rejects.toMatchObject({ code: 'INTEGRITY_FAILED' });
    await expect(collect(new ModelCommonsSession(transportSession({ stream: wrongTerminalDiagnostics })).stream(request())))
      .rejects.toMatchObject({ code: 'INTEGRITY_FAILED' });
    await expect(collect(new ModelCommonsSession(transportSession({ stream: afterTerminal })).stream(request())))
      .rejects.toMatchObject({
        code: 'INTEGRITY_FAILED',
        message: expect.stringContaining('after the terminal event'),
      });
  });

  it('rejects malformed completed and failed terminal payloads', async () => {
    const malformedCompleted: TransportSession['stream'] = async function* () {
      yield started();
      yield completed({
        content: [{ type: 'text', text: 42 }] as unknown as ModelCommonsResponse['content'],
      });
    };
    const malformedFailure: TransportSession['stream'] = async function* () {
      yield started();
      yield {
        type: 'response.failed',
        responseId: 'response-1',
        error: { code: 'NOT_A_CODE', message: '', retryable: 'yes' },
      } as unknown as ModelCommonsStreamEvent;
    };
    const oversizedFailure: TransportSession['stream'] = async function* () {
      yield started();
      yield {
        type: 'response.failed',
        responseId: 'response-1',
        error: { code: 'RUNTIME_UNAVAILABLE', message: 'x'.repeat(1025), retryable: false },
      } as ModelCommonsStreamEvent;
    };

    await expect(collect(new ModelCommonsSession(transportSession({ stream: malformedCompleted })).stream(request())))
      .rejects.toMatchObject({ code: 'INTEGRITY_FAILED' });
    await expect(collect(new ModelCommonsSession(transportSession({ stream: malformedFailure })).stream(request())))
      .rejects.toMatchObject({ code: 'INTEGRITY_FAILED' });
    await expect(collect(new ModelCommonsSession(transportSession({ stream: oversizedFailure })).stream(request())))
      .rejects.toMatchObject({ code: 'INTEGRITY_FAILED' });
  });

  it('rejects malformed intermediate event payloads before yielding them', async () => {
    const malformedText: TransportSession['stream'] = async function* () {
      yield started();
      yield {
        type: 'text.delta', responseId: 'response-1', delta: 42,
      } as unknown as ModelCommonsStreamEvent;
    };
    const malformedTool: TransportSession['stream'] = async function* () {
      yield started();
      yield {
        type: 'tool_call.completed',
        responseId: 'response-1',
        index: -1,
        call: { id: '', name: 'fixture', arguments: [] },
      } as unknown as ModelCommonsStreamEvent;
    };
    const malformedUsage: TransportSession['stream'] = async function* () {
      yield started();
      yield {
        type: 'usage.updated', responseId: 'response-1', usage: { totalTokens: -1 },
      } as ModelCommonsStreamEvent;
    };

    for (const stream of [malformedText, malformedTool, malformedUsage]) {
      await expect(collect(new ModelCommonsSession(transportSession({ stream })).stream(request())))
        .rejects.toMatchObject({ code: 'INTEGRITY_FAILED' });
    }
  });

  it('cancels and closes underlying work when the consumer abandons a stream', async () => {
    const returned = vi.fn();
    const cancel = vi.fn(async () => undefined);
    const stream: TransportSession['stream'] = async function* () {
      try {
        yield started();
        yield { type: 'text.delta', responseId: 'response-1', delta: 'unused' };
      } finally {
        returned();
      }
    };
    const session = new ModelCommonsSession(transportSession({ stream, cancel }));

    for await (const _event of session.stream(request())) break;

    expect(cancel).toHaveBeenCalledOnce();
    expect(returned).toHaveBeenCalledOnce();
    await expect(session.generate(request())).resolves.toMatchObject({ id: 'response-1' });
  });

  it('preserves a stream protocol error when cancellation cleanup also fails', async () => {
    const cleanupFailure = new Error('cancel cleanup failed');
    const cancel = vi.fn(async () => { throw cleanupFailure; });
    const stream: TransportSession['stream'] = async function* () {
      yield started();
      yield { type: 'text.delta', responseId: 'response-2', delta: 'wrong' };
    };
    const session = new ModelCommonsSession(transportSession({ stream, cancel }));

    await expect(collect(session.stream(request()))).rejects.toMatchObject({
      code: 'INTEGRITY_FAILED',
      message: expect.stringContaining('mismatched response ID'),
    });
    expect(cancel).toHaveBeenCalledOnce();
  });
});

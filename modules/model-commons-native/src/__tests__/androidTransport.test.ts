import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SMOLLM2_135M_INSTRUCT } from '@modelcommons/model-store/catalog';
import type { AndroidStreamEvent } from '../types';

const fake = vi.hoisted(() => ({ listener: undefined as undefined | ((event: AndroidStreamEvent) => void),
  generate: vi.fn(), ack: vi.fn(), cancel: vi.fn(), release: vi.fn(), drained: vi.fn() }));
vi.mock('../index', () => ({
  connectAndroidHub: async () => ({ apiVersion: 2, protocolVersion: '0.1.0', centralizedInference: true,
    contextSize: 1024, maxOutputTokens: 128,
    runtimeState: 'READY', runtimeId: 'modelcommons.android.cpu', runtimeVersion: '0.1.0' }),
  disconnectAndroidHub: async () => {}, getNativeAvailability: async () => ({ androidHubConnected: true }),
  androidListModels: async () => ({ models: [{ id: SMOLLM2_135M_INSTRUCT.id, revision: SMOLLM2_135M_INSTRUCT.revision,
    state: 'READY', manifestJson: JSON.stringify({ ...SMOLLM2_135M_INSTRUCT, recommendedProfiles: ['safe'],
      compatibleRuntimes: [{ id: 'modelcommons.android.cpu', minimumVersion: '0.1.0' }] }) }] }),
  androidCreateSession: async () => ({ ok: true, sessionId: 'session' }),
  androidGenerate: fake.generate, androidAcknowledge: fake.ack, androidCancel: fake.cancel,
  androidReleaseSession: fake.release, androidIsSessionDrained: fake.drained,
  addAndroidStreamListener: (listener: (event: AndroidStreamEvent) => void) => {
    fake.listener = listener; return { remove: () => { fake.listener = undefined; } };
  },
}));
import { createAndroidBinderTransport } from '../androidTransport';

function emit(sequence: number, event: unknown, requestId = 'request') {
  fake.listener?.({ sessionId: 'session', requestId, sequence, eventJson: JSON.stringify(event) });
}
async function session() {
  const { transport } = await createAndroidBinderTransport({ packageName: 'example.hub', trustedCertificateSha256: ['a'.repeat(64)] });
  const model = await transport.resolve({ capabilities: ['text'], profile: 'safe' });
  return transport.createSession(model, { capabilities: ['text'], profile: 'safe' });
}
const request = { id: 'request', model: { capabilities: ['text'] as ['text'] }, messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'synthetic' }] }] };
describe('Android Binder canonical adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks(); fake.cancel.mockResolvedValue({ ok: true }); fake.release.mockResolvedValue({ ok: true }); fake.drained.mockResolvedValue(true);
    fake.generate.mockImplementation(async () => { emit(0, { type: 'response.started' }); return { ok: true }; });
    fake.ack.mockResolvedValue({ ok: true });
  });
  it('acknowledges consumption and drains a deliberately abandoned iterator', async () => {
    const active = await session();
    for await (const event of active.stream(request)) { expect(event.type).toBe('response.started'); break; }
    expect(fake.ack).toHaveBeenCalledWith('session', 'request', 0);
    expect(fake.cancel).toHaveBeenCalledWith('session', 'request');
    expect(fake.release).toHaveBeenCalledWith('session');
    expect(fake.drained).toHaveBeenCalledWith('session');
    expect(fake.listener).toBeUndefined();
  });
  it('waits for native destruction after release acceptance', async () => {
    const active = await session();
    fake.drained.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await active.release();
    expect(fake.drained).toHaveBeenCalledTimes(2);
  });
  it('completes ordered text and reuses the session only after native drain', async () => {
    const diagnostics = { offline: true, resolvedModelId: SMOLLM2_135M_INSTRUCT.id, runtimeId: 'modelcommons.android.cpu', profileId: 'safe' };
    fake.generate.mockImplementation(async (_session, id) => {
      emit(0, { type: 'response.started', responseId: id, createdAt: 1, modelId: SMOLLM2_135M_INSTRUCT.id, diagnostics }, id);
      return { ok: true };
    });
    fake.ack.mockImplementation(async (_session, id, sequence) => {
      if (sequence === 0) emit(1, { type: 'text.delta', responseId: id, delta: 'synthetic' }, id);
      if (sequence === 1) emit(2, { type: 'response.completed', response: { id, createdAt: 1, modelId: SMOLLM2_135M_INSTRUCT.id,
        content: [{ type: 'text', text: 'synthetic' }], stopReason: 'stop', usage: { inputTokens: 8, outputTokens: 2 }, diagnostics } }, id);
      return { ok: true };
    });
    const active = await session();
    expect((await active.generate(request)).id).toBe('request');
    expect((await active.generate({ ...request, id: 'second' })).id).toBe('second');
    expect(fake.drained).toHaveBeenCalledTimes(2);
    expect(fake.release).not.toHaveBeenCalled();
    await active.release();
    expect(fake.release).toHaveBeenCalledOnce();
  });
  it('rejects unsupported context before opening a session', async () => {
    const { transport } = await createAndroidBinderTransport({ packageName: 'example.hub', trustedCertificateSha256: ['a'.repeat(64)] });
    const model = await transport.resolve({ capabilities: ['text'], profile: 'safe' });
    await expect(transport.createSession(model, { capabilities: ['text'], minimumContext: 2048 })).rejects.toMatchObject({ code: 'MODEL_INCOMPATIBLE' });
  });
  it('propagates a failed terminal without an embedded fallback', async () => {
    fake.ack.mockImplementation(async (_session, _request, sequence) => {
      if (sequence === 0) emit(1, { type: 'response.failed', responseId: 'request', error: { code: 'MODEL_NOT_READY', message: 'Absent', retryable: true } });
      return { ok: true };
    });
    await expect((await session()).generate(request)).rejects.toMatchObject({ code: 'MODEL_NOT_READY' });
    expect(fake.release).toHaveBeenCalledOnce();
  });
});

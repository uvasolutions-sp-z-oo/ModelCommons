import { InProcessTransport, type AvailableModel, type ResolvedModel, type TransportSession, type SessionIntent } from '@modelcommons/client';
import { ModelCommonsError, PROTOCOL_VERSION, isModelCommonsErrorCode, parseModelManifest,
  type ModelCommonsRequest, type ModelCommonsResponse, type ModelCommonsStreamEvent } from '@modelcommons/protocol';
import { connectAndroidHub, disconnectAndroidHub, getNativeAvailability, androidListModels,
  androidCreateSession, androidGenerate, androidCancel, androidReleaseSession,
  androidAcknowledge, androidIsSessionDrained, addAndroidStreamListener } from './index';
import type { AndroidOperationResult, AndroidStreamEvent } from './types';

function accepted(result: AndroidOperationResult): void {
  if (!result.ok) throw new ModelCommonsError(isModelCommonsErrorCode(result.code) ? result.code : 'TRANSPORT_UNAVAILABLE',
    'The selected Hub did not accept this operation.', { retryable: true });
}
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
let requestSequence = 0;
let connectionEpoch = 0;

class BinderSession implements TransportSession {
  private active?: string;
  private closed = false;
  private releasePromise?: Promise<void>;
  constructor(readonly id: string, readonly model: ResolvedModel, private readonly current: () => void) {}
  async generate(request: ModelCommonsRequest, options?: { signal?: AbortSignal }): Promise<ModelCommonsResponse> {
    let response: ModelCommonsResponse | undefined;
    for await (const event of this.stream(request, options)) {
      if (event.type === 'response.completed') response = event.response;
      if (event.type === 'response.failed') throw new ModelCommonsError(event.error.code, event.error.message, event.error);
    }
    if (!response) throw new ModelCommonsError('TRANSPORT_UNAVAILABLE', 'The Hub stream ended without a response.');
    return response;
  }
  async *stream(request: ModelCommonsRequest, options?: { signal?: AbortSignal }): AsyncIterable<ModelCommonsStreamEvent> {
    this.current();
    if (this.closed || this.active) throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'This session is closed or already generating.');
    if (options?.signal?.aborted) throw new ModelCommonsError('USER_CANCELLED', 'Request cancelled.');
    const requestId = request.id ?? `binder-${Date.now()}-${++requestSequence}`;
    this.active = requestId;
    let pending: AndroidStreamEvent | undefined;
    let failure: Error | undefined;
    let wake: (() => void) | undefined;
    let terminal = false;
    let completed = false;
    const fail = (error: Error) => { failure = error; wake?.(); };
    const subscription = addAndroidStreamListener((event) => {
      if (event.sessionId !== this.id || event.requestId !== requestId) return;
      if (pending && !event.localFailure) {
        fail(new ModelCommonsError('INTEGRITY_FAILED', 'The Hub exceeded the event window.'));
        void this.cancel().catch(() => {});
        return;
      }
      // Native transport loss may replace an undelivered event with a local terminal failure.
      pending = event; wake?.();
    });
    const abort = () => { void this.cancel().catch(() => {}); fail(new ModelCommonsError('USER_CANCELLED', 'Request cancelled.')); };
    options?.signal?.addEventListener('abort', abort, { once: true });
    try {
      accepted(await androidGenerate(this.id, requestId, JSON.stringify({ ...request, id: requestId,
        model: { ...request.model, id: this.model.manifest.id, profile: this.model.profileId } })));
      while (!terminal) {
        if (!pending && !failure) {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(() => { failure = new ModelCommonsError('TRANSPORT_UNAVAILABLE', 'The Hub stream timed out.'); resolve(); }, 130000);
            wake = () => { clearTimeout(timer); resolve(); };
          });
          wake = undefined;
        }
        if (failure) throw failure;
        const envelope = pending!;
        pending = undefined;
        const event = JSON.parse(envelope.eventJson) as ModelCommonsStreamEvent; // Kotlin validates the canonical envelope.
        if (!envelope.localFailure) accepted(await androidAcknowledge(this.id, requestId, envelope.sequence));
        terminal = event.type === 'response.completed' || event.type === 'response.failed';
        completed = event.type === 'response.completed';
        yield event;
      }
    } finally {
      options?.signal?.removeEventListener('abort', abort);
      subscription.remove();
      if (!terminal) { try { await this.cancel(); } catch { /* release below still attempts native cleanup */ } }
      try {
        // Successful sessions may be reused, with a fresh native context each time.
        if (completed) await this.waitForDrain();
        else await this.release(); // includes iterator abandonment and failed terminals
      } finally { this.active = undefined; }
    }
  }
  async cancel(): Promise<void> { this.current(); if (this.active) accepted(await androidCancel(this.id, this.active)); }
  release(): Promise<void> {
    if (!this.releasePromise) this.releasePromise = this.drain();
    return this.releasePromise;
  }
  private async drain(): Promise<void> {
    this.closed = true;
    this.current();
    // Revocation may deny release, but drain status exposes only this UID's session liveness.
    let releaseError: unknown;
    try { accepted(await androidReleaseSession(this.id)); } catch (error) { releaseError = error; }
    try { await this.waitForDrain(); } catch (error) { throw releaseError ?? error; }
  }
  private async waitForDrain(): Promise<void> {
    for (let i = 0; i < 200; i++) {
      this.current();
      if (await androidIsSessionDrained(this.id)) return;
      await delay(100);
    }
    throw new ModelCommonsError('TRANSPORT_UNAVAILABLE', 'The Hub is still draining native work.');
  }
}

/** Explicit user-selected package + signing policy. This connector never provisions models or creates an embedded runtime. */
export async function createAndroidBinderTransport(options: { packageName: string; trustedCertificateSha256: string[] }) {
  const serviceInfo = await connectAndroidHub(options.packageName, options.trustedCertificateSha256);
  const epoch = ++connectionEpoch;
  const current = () => {
    if (epoch !== connectionEpoch) throw new ModelCommonsError('TRANSPORT_UNAVAILABLE', 'The Hub connection changed.');
  };
  if (serviceInfo.apiVersion !== 2 || serviceInfo.protocolVersion !== PROTOCOL_VERSION ||
    serviceInfo.contextSize !== 1024 || serviceInfo.maxOutputTokens !== 128 ||
    !serviceInfo.centralizedInference || serviceInfo.runtimeState !== 'READY' || serviceInfo.runtimeId !== 'modelcommons.android.cpu') {
    await disconnectAndroidHub();
    throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'This Hub build has no compatible native inference worker.');
  }
  const transport = new InProcessTransport({
    protocolVersion: serviceInfo.protocolVersion,
    async listModels(): Promise<AvailableModel[]> {
      current();
      const page = await androidListModels(null, 2);
      current();
      if (page.nextCursor || page.models.length > 2) throw new ModelCommonsError('INTEGRITY_FAILED', 'Invalid Hub model page.');
      return page.models.map((descriptor) => {
        const manifest = parseModelManifest(JSON.parse(descriptor.manifestJson));
        if (manifest.id !== descriptor.id || manifest.revision !== descriptor.revision || descriptor.state !== 'READY' ||
          !manifest.compatibleRuntimes.some((runtime) => runtime.id === serviceInfo.runtimeId))
          throw new ModelCommonsError('INTEGRITY_FAILED', 'Invalid Hub model descriptor.');
        return { manifest, state: 'READY', runtimeIds: [serviceInfo.runtimeId] };
      });
    },
    async createSession(model: ResolvedModel, intent: SessionIntent) {
      current();
      if (model.profileId !== 'safe' || (intent.minimumContext ?? 1024) > 1024)
        throw new ModelCommonsError('MODEL_INCOMPATIBLE', 'The Hub CPU profile supports context 1024 and output up to 128.');
      const result = await androidCreateSession(model.manifest.id, model.profileId);
      accepted(result);
      if (!result.sessionId) throw new ModelCommonsError('INTEGRITY_FAILED', 'The Hub returned no session ID.');
      if (epoch !== connectionEpoch) {
        try { await androidReleaseSession(result.sessionId); } catch { /* binding teardown owns old sessions */ }
        current();
      }
      return new BinderSession(result.sessionId, model, current);
    },
  }, { id: 'android-binder', preference: 'hub-service' });
  transport.getAvailability = async () => ({
    state: epoch === connectionEpoch && (await getNativeAvailability()).androidHubConnected ? 'AVAILABLE' : 'TRANSPORT_UNAVAILABLE',
    transportId: 'android-binder', transportPreference: 'hub-service', protocolVersion: PROTOCOL_VERSION,
  });
  return { transport, serviceInfo, disconnect: async () => {
    if (epoch !== connectionEpoch) return;
    ++connectionEpoch;
    await disconnectAndroidHub();
  } };
}

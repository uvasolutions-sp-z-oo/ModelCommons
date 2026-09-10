import {
  ModelCommons,
  type ModelCommonsTransport,
} from '@modelcommons/client';
import {
  ModelCommonsError,
  type ModelCommonsMessage,
} from '@modelcommons/protocol';

let localTransport: ModelCommonsTransport | undefined;

export function registerHubTransport(transport: ModelCommonsTransport): void {
  localTransport = transport;
}

export async function streamHubChat(options: {
  messages: ModelCommonsMessage[];
  modelId: string;
  profile: string;
  context?: number;
  maxOutputTokens: number;
  signal?: AbortSignal;
  onText: (completeText: string) => void;
}): Promise<{ text: string; modelId: string; modelRevision: string; runtimeId: string }> {
  if (!localTransport) {
    throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'The local llama.rn runtime is not registered in this build.');
  }
  const client = await ModelCommons.connect({ transport: localTransport });
  const session = await client.createSession({
    capabilities: ['text'],
    modelId: options.modelId,
    profile: options.profile,
    minimumContext: options.context,
  });
  let complete = '';
  let responseId: string | undefined;
  let terminal = false;
  let primaryError: unknown;
  try {
    for await (const event of session.stream({
      messages: options.messages,
      maxOutputTokens: options.maxOutputTokens,
    }, { signal: options.signal })) {
      if (terminal) {
        throw new ModelCommonsError('INTEGRITY_FAILED', 'The runtime emitted an event after a terminal event.');
      }
      if (event.type === 'response.started') {
        if (responseId) throw new ModelCommonsError('INTEGRITY_FAILED', 'The runtime emitted multiple start events.');
        responseId = event.responseId;
      } else if (event.type === 'text.delta') {
        if (!responseId || event.responseId !== responseId) {
          throw new ModelCommonsError('INTEGRITY_FAILED', 'The runtime emitted an out-of-sequence text event.');
        }
        complete += event.delta;
        options.onText(complete);
      } else if (event.type === 'response.completed') {
        if (!responseId || event.response.id !== responseId) {
          throw new ModelCommonsError('INTEGRITY_FAILED', 'The runtime completed a different response identity.');
        }
        terminal = true;
        if (event.response.stopReason === 'cancelled') {
          throw new ModelCommonsError('USER_CANCELLED', 'Local generation was cancelled.');
        }
      } else if (event.type === 'response.failed') {
        terminal = true;
        throw new ModelCommonsError(event.error.code, event.error.message, {
          retryable: event.error.retryable,
          details: event.error.details,
        });
      }
    }
    if (!terminal) {
      throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The runtime stream ended without a terminal event.');
    }
    return {
      text: complete,
      modelId: session.model.manifest.id,
      modelRevision: session.model.manifest.revision,
      runtimeId: session.model.runtimeId,
    };
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      await session.release();
    } catch (releaseError) {
      if (!primaryError) throw releaseError;
    }
  }
}

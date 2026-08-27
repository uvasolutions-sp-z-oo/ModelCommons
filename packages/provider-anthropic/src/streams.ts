import {
  ModelCommonsError,
  type JsonValue,
  type ModelCommonsRequest,
  type ModelCommonsStreamEvent,
  type ModelCommonsUsage,
  type ToolCall,
} from '@modelcommons/protocol';
import { anthropicErrorBody, sseEvent } from './internal';
import { anthropicStopReason, anthropicUsage, messageId, validateStructuredOutput } from './wire';

interface StreamIdentity {
  canonicalId: string;
  providerId: string;
  model: string;
}

function canonicalJson(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value)!;
}

function completedToolArguments(call: ToolCall): string {
  if (call.rawArguments === undefined) return JSON.stringify(call.arguments);
  let parsed: unknown;
  try {
    parsed = JSON.parse(call.rawArguments) as unknown;
  } catch {
    throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The backend returned invalid JSON tool arguments.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The backend returned non-object tool arguments.');
  }
  if (canonicalJson(parsed as JsonValue) !== canonicalJson(call.arguments)) {
    throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'Raw and parsed tool arguments do not match.');
  }
  return call.rawArguments;
}

function initialUsage(usage: ModelCommonsUsage): Record<string, unknown> {
  if (
    usage.inputTokens === undefined ||
    !Number.isSafeInteger(usage.inputTokens) ||
    usage.inputTokens < 0
  ) {
    throw new ModelCommonsError(
      'RUNTIME_INITIALIZATION_FAILED',
      'Anthropic streaming requires input-token usage before the first content event.'
    );
  }
  return {
    input_tokens: usage.inputTokens,
    output_tokens: 0,
    cache_creation: null,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
  };
}

function messageStart(identity: StreamIdentity, usage: ModelCommonsUsage): string {
  return sseEvent('message_start', {
    type: 'message_start',
    message: {
      id: identity.providerId,
      type: 'message',
      role: 'assistant',
      model: identity.model,
      container: null,
      content: [],
      stop_details: null,
      stop_reason: null,
      stop_sequence: null,
      usage: initialUsage(usage),
    },
  });
}

export async function* anthropicEventStream(
  events: AsyncIterable<ModelCommonsStreamEvent>,
  requestId: string,
  request: ModelCommonsRequest
): AsyncGenerator<string> {
  let identity: StreamIdentity | undefined;
  let wireStarted = false;
  let usage: ModelCommonsUsage = {};
  let nextContentIndex = 0;
  let textIndex: number | undefined;
  let streamedText = '';
  const toolIndexes = new Map<string, number>();
  const toolEventIndexes = new Map<string, number>();
  const toolNames = new Map<string, string>();
  const toolArguments = new Map<string, string>();
  const completedTools = new Map<string, { name: string; arguments: string }>();

  const ensureStarted = (): string[] => {
    if (wireStarted) return [];
    if (!identity) {
      throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The canonical stream omitted response.started.');
    }
    wireStarted = true;
    return [messageStart(identity, usage)];
  };

  const closeText = (): string[] => {
    if (textIndex === undefined) return [];
    const index = textIndex;
    textIndex = undefined;
    return [sseEvent('content_block_stop', { type: 'content_block_stop', index })];
  };

  for await (const event of events) {
    if (event.type === 'response.started') {
      if (identity) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The canonical stream started more than once.');
      }
      if (event.modelId !== request.model.id) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The stream started with a different model than the resolved selection.');
      }
      identity = {
        canonicalId: event.responseId,
        providerId: messageId(event.responseId),
        model: event.modelId,
      };
      continue;
    }

    if (event.type === 'usage.updated') {
      if (!identity || event.responseId !== identity.canonicalId) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A usage event arrived without a matching response start.');
      }
      usage = { ...usage, ...event.usage };
      if (identity && !wireStarted && usage.inputTokens !== undefined) {
        for (const frame of ensureStarted()) yield frame;
      }
      continue;
    }

    if (event.type === 'text.delta') {
      if (!identity || event.responseId !== identity.canonicalId) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A text delta arrived without a matching response start.');
      }
      for (const frame of ensureStarted()) yield frame;
      if (textIndex === undefined) {
        textIndex = nextContentIndex++;
        yield sseEvent('content_block_start', {
          type: 'content_block_start',
          index: textIndex,
          content_block: { type: 'text', text: '' },
        });
      }
      streamedText += event.delta;
      yield sseEvent('content_block_delta', {
        type: 'content_block_delta',
        index: textIndex,
        delta: { type: 'text_delta', text: event.delta },
      });
      continue;
    }

    if (event.type === 'tool_call.started') {
      if (!identity || event.responseId !== identity.canonicalId || toolIndexes.has(event.callId)) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A tool-call start was inconsistent.');
      }
      if (
        !Number.isSafeInteger(event.index) ||
        event.index < 0 ||
        [...toolEventIndexes.values()].includes(event.index)
      ) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A tool call used an invalid or duplicate index.');
      }
      for (const frame of ensureStarted()) yield frame;
      for (const frame of closeText()) yield frame;
      const index = nextContentIndex++;
      toolIndexes.set(event.callId, index);
      toolEventIndexes.set(event.callId, event.index);
      toolNames.set(event.callId, event.name);
      toolArguments.set(event.callId, '');
      yield sseEvent('content_block_start', {
        type: 'content_block_start',
        index,
        content_block: { type: 'tool_use', id: event.callId, name: event.name, input: {} },
      });
      continue;
    }

    if (event.type === 'tool_call.arguments.delta') {
      const index = toolIndexes.get(event.callId);
      if (
        index === undefined ||
        toolEventIndexes.get(event.callId) !== event.index ||
        completedTools.has(event.callId) ||
        !identity ||
        event.responseId !== identity.canonicalId
      ) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'Tool arguments arrived without a matching tool-call start.');
      }
      toolArguments.set(event.callId, `${toolArguments.get(event.callId) ?? ''}${event.delta}`);
      yield sseEvent('content_block_delta', {
        type: 'content_block_delta',
        index,
        delta: { type: 'input_json_delta', partial_json: event.delta },
      });
      continue;
    }

    if (event.type === 'tool_call.completed') {
      const callId = event.call.id;
      const index = toolIndexes.get(callId);
      if (
        index === undefined ||
        toolEventIndexes.get(callId) !== event.index ||
        completedTools.has(callId) ||
        !identity ||
        event.responseId !== identity.canonicalId ||
        toolNames.get(callId) !== event.call.name
      ) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A completed tool call had no matching start.');
      }
      const full = completedToolArguments(event.call);
      const emitted = toolArguments.get(callId) ?? '';
      if (!full.startsWith(emitted)) {
        throw new ModelCommonsError(
          'RUNTIME_INITIALIZATION_FAILED',
          `Tool argument deltas for \`${callId}\` do not match the completed call.`
        );
      }
      if (full.length > emitted.length) {
        yield sseEvent('content_block_delta', {
          type: 'content_block_delta',
          index,
          delta: { type: 'input_json_delta', partial_json: full.slice(emitted.length) },
        });
      }
      completedTools.set(callId, { name: event.call.name, arguments: full });
      yield sseEvent('content_block_stop', { type: 'content_block_stop', index });
      continue;
    }

    if (event.type === 'response.completed') {
      const finalResponse = {
        ...event.response,
        usage: { ...usage, ...event.response.usage },
      };
      if (finalResponse.stopReason === 'cancelled') {
        throw new ModelCommonsError('USER_CANCELLED', 'The local inference request was cancelled.');
      }
      if (finalResponse.stopReason === 'error') {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The local inference runtime failed.');
      }
      if (!identity) {
        identity = {
          canonicalId: finalResponse.id,
          providerId: messageId(finalResponse.id),
          model: finalResponse.modelId,
        };
      } else if (finalResponse.id !== identity.canonicalId || finalResponse.modelId !== identity.model) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The terminal response identity did not match response.started.');
      }
      usage = finalResponse.usage;
      for (const frame of ensureStarted()) yield frame;
      validateStructuredOutput(finalResponse, request);
      const finalText = finalResponse.content
        .filter((part) => part.type === 'text')
        .map((part) => part.type === 'text' ? part.text : '')
        .join('');
      if (!finalText.startsWith(streamedText)) {
        throw new ModelCommonsError(
          'RUNTIME_INITIALIZATION_FAILED',
          'Text deltas do not match the completed response.'
        );
      }
      if (finalText.length > streamedText.length) {
        if (textIndex === undefined) {
          textIndex = nextContentIndex++;
          yield sseEvent('content_block_start', {
            type: 'content_block_start',
            index: textIndex,
            content_block: { type: 'text', text: '' },
          });
        }
        yield sseEvent('content_block_delta', {
          type: 'content_block_delta',
          index: textIndex,
          delta: { type: 'text_delta', text: finalText.slice(streamedText.length) },
        });
        streamedText = finalText;
      }
      for (const frame of closeText()) yield frame;

      const finalToolCalls: ToolCall[] = [];
      for (const part of finalResponse.content) {
        if (part.type !== 'text' && part.type !== 'tool_call') {
          throw new ModelCommonsError(
            'RUNTIME_INITIALIZATION_FAILED',
            `The backend returned unsupported assistant content type \`${part.type}\`.`
          );
        }
        if (part.type === 'tool_call') finalToolCalls.push(part.call);
      }
      const finalToolIds = new Set(finalToolCalls.map((call) => call.id));
      if (finalToolIds.size !== finalToolCalls.length) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The completed response contained duplicate tool-call IDs.');
      }
      for (const callId of toolIndexes.keys()) {
        if (!finalToolIds.has(callId)) {
          throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A streamed tool call was absent from the completed response.');
        }
      }

      for (const call of finalToolCalls) {
        const full = completedToolArguments(call);
        const streamedName = toolNames.get(call.id);
        if (streamedName !== undefined && streamedName !== call.name) {
          throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A streamed tool call changed name in the terminal response.');
        }
        const completed = completedTools.get(call.id);
        if (completed && (completed.name !== call.name || completed.arguments !== full)) {
          throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A completed tool call changed in the terminal response.');
        }
        if (completed) continue;
        let index = toolIndexes.get(call.id);
        if (index === undefined) {
          index = nextContentIndex++;
          toolIndexes.set(call.id, index);
          toolNames.set(call.id, call.name);
          yield sseEvent('content_block_start', {
            type: 'content_block_start',
            index,
            content_block: { type: 'tool_use', id: call.id, name: call.name, input: {} },
          });
        }
        const emitted = toolArguments.get(call.id) ?? '';
        if (!full.startsWith(emitted)) {
          throw new ModelCommonsError(
            'RUNTIME_INITIALIZATION_FAILED',
            `Tool argument deltas for \`${call.id}\` do not match the completed response.`
          );
        }
        if (full.length > emitted.length) {
          yield sseEvent('content_block_delta', {
            type: 'content_block_delta',
            index,
            delta: { type: 'input_json_delta', partial_json: full.slice(emitted.length) },
          });
        }
        yield sseEvent('content_block_stop', { type: 'content_block_stop', index });
      }

      yield sseEvent('message_delta', {
        type: 'message_delta',
        delta: {
          container: null,
          stop_details: null,
          stop_reason: anthropicStopReason(finalResponse),
          stop_sequence: finalResponse.stopSequence ?? null,
        },
        usage: anthropicUsage(finalResponse.usage),
      });
      yield sseEvent('message_stop', { type: 'message_stop' });
      return;
    }

    if (event.type === 'response.failed') {
      if (identity && event.responseId !== identity.canonicalId) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The failed response ID did not match response.started.');
      }
      const error = anthropicErrorBody(event.error, requestId).body.error;
      yield sseEvent('error', { type: 'error', error });
      return;
    }
  }

  throw new ModelCommonsError(
    'RUNTIME_INITIALIZATION_FAILED',
    'The canonical stream ended without a terminal response event.'
  );
}

export function anthropicStreamError(error: unknown, requestId: string): string {
  return sseEvent('error', {
    type: 'error',
    error: anthropicErrorBody(error, requestId).body.error,
  });
}

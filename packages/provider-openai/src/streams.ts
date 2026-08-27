import type {
  ModelCommonsStreamEvent,
  ModelCommonsUsage,
} from '@modelcommons/protocol';
import { ModelCommonsError } from '@modelcommons/protocol';
import { openAIErrorBody, providerId, sseData, sseEvent } from './internal';
import type { ParsedGenerationRequest } from './parse';
import {
  chatFinishReason,
  chatId,
  chatUsage,
  outputText,
  responseId,
  responsesBody,
  responsesConfiguration,
  toolArguments,
  unixSeconds,
  validateStructuredOutput,
} from './wire';

interface StreamIdentity {
  canonicalId: string;
  providerId: string;
  created: number;
  model: string;
}

function identityFromStarted(event: Extract<ModelCommonsStreamEvent, { type: 'response.started' }>): StreamIdentity {
  return {
    canonicalId: event.responseId,
    providerId: responseId(event.responseId),
    created: unixSeconds(event.createdAt),
    model: event.modelId,
  };
}

function incompleteResponse(
  identity: StreamIdentity,
  parsed: ParsedGenerationRequest
): Record<string, unknown> {
  return {
    id: identity.providerId,
    object: 'response',
    created_at: identity.created,
    status: 'in_progress',
    error: null,
    incomplete_details: null,
    model: identity.model,
    output: [],
    ...responsesConfiguration(parsed.canonical, parsed.allowParallelToolCalls),
    usage: null,
  };
}

export async function* responsesEventStream(
  events: AsyncIterable<ModelCommonsStreamEvent>,
  parsed: ParsedGenerationRequest
): AsyncGenerator<string> {
  let sequence = 0;
  let identity: StreamIdentity | undefined;
  let textStarted = false;
  let text = '';
  let latestUsage: ModelCommonsUsage = {};
  let nextOutputIndex = 0;
  let textOutputIndex = -1;
  const toolIndexes = new Map<string, number>();
  const toolEventIndexes = new Map<string, number>();
  const toolNames = new Map<string, string>();
  const toolArgumentsText = new Map<string, string>();
  const completedTools = new Set<string>();
  const completedToolValues = new Map<string, { name: string; arguments: string }>();

  const frame = (type: string, data: Record<string, unknown>): string =>
    sseEvent(type, { type, sequence_number: sequence++, ...data });

  const startText = (): string[] => {
    if (textStarted || !identity) return [];
    textStarted = true;
    textOutputIndex = nextOutputIndex++;
    const itemId = providerId('msg', identity.canonicalId);
    return [
      frame('response.output_item.added', {
        output_index: textOutputIndex,
        item: {
          id: itemId,
          type: 'message',
          status: 'in_progress',
          role: 'assistant',
          content: [],
        },
      }),
      frame('response.content_part.added', {
        output_index: textOutputIndex,
        item_id: itemId,
        content_index: 0,
        part: { type: 'output_text', text: '', annotations: [] },
      }),
    ];
  };

  const closeText = (finalText: string): string[] => {
    if (!textStarted || !identity) return [];
    const itemId = providerId('msg', identity.canonicalId);
    return [
      frame('response.output_text.done', {
        output_index: textOutputIndex,
        item_id: itemId,
        content_index: 0,
        text: finalText,
      }),
      frame('response.content_part.done', {
        output_index: textOutputIndex,
        item_id: itemId,
        content_index: 0,
        part: { type: 'output_text', text: finalText, annotations: [] },
      }),
      frame('response.output_item.done', {
        output_index: textOutputIndex,
        item: {
          id: itemId,
          type: 'message',
          status: 'completed',
          role: 'assistant',
          content: [{ type: 'output_text', text: finalText, annotations: [] }],
        },
      }),
    ];
  };

  for await (const event of events) {
    if (event.type === 'response.started') {
      if (identity) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The canonical stream started more than once.');
      }
      if (event.modelId !== parsed.canonical.model.id) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The stream started with a different model than the resolved selection.');
      }
      identity = identityFromStarted(event);
      const response = incompleteResponse(identity, parsed);
      yield frame('response.created', { response });
      yield frame('response.in_progress', { response });
      continue;
    }

    if (event.type === 'text.delta') {
      if (!identity) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'Text arrived before response.started.');
      }
      if (event.responseId !== identity.canonicalId) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A text delta used the wrong response ID.');
      }
      for (const item of startText()) yield item;
      text += event.delta;
      yield frame('response.output_text.delta', {
        output_index: textOutputIndex,
        item_id: providerId('msg', identity.canonicalId),
        content_index: 0,
        delta: event.delta,
      });
      continue;
    }

    if (event.type === 'tool_call.started') {
      if (!identity) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A tool call arrived before response.started.');
      }
      if (event.responseId !== identity.canonicalId || toolIndexes.has(event.callId)) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A tool-call start was inconsistent.');
      }
      if (
        !Number.isSafeInteger(event.index) ||
        event.index < 0 ||
        [...toolEventIndexes.values()].includes(event.index)
      ) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A tool call used an invalid or duplicate index.');
      }
      const outputIndex = nextOutputIndex++;
      toolIndexes.set(event.callId, outputIndex);
      toolEventIndexes.set(event.callId, event.index);
      toolNames.set(event.callId, event.name);
      toolArgumentsText.set(event.callId, '');
      yield frame('response.output_item.added', {
        output_index: outputIndex,
        item: {
          id: providerId('fc', event.callId),
          type: 'function_call',
          status: 'in_progress',
          call_id: event.callId,
          name: event.name,
          arguments: '',
        },
      });
      continue;
    }

    if (event.type === 'tool_call.arguments.delta') {
      const outputIndex = toolIndexes.get(event.callId);
      if (
        outputIndex === undefined ||
        toolEventIndexes.get(event.callId) !== event.index ||
        completedTools.has(event.callId) ||
        !identity ||
        event.responseId !== identity.canonicalId
      ) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'Tool arguments arrived without a matching tool-call start.');
      }
      toolArgumentsText.set(event.callId, `${toolArgumentsText.get(event.callId) ?? ''}${event.delta}`);
      yield frame('response.function_call_arguments.delta', {
        item_id: providerId('fc', event.callId),
        output_index: outputIndex,
        delta: event.delta,
      });
      continue;
    }

    if (event.type === 'tool_call.completed') {
      const callId = event.call.id;
      const outputIndex = toolIndexes.get(callId);
      if (
        outputIndex === undefined ||
        toolEventIndexes.get(callId) !== event.index ||
        completedTools.has(callId) ||
        !identity ||
        event.responseId !== identity.canonicalId ||
        toolNames.get(callId) !== event.call.name
      ) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A completed tool call had no matching start.');
      }
      const fullArguments = toolArguments(event.call);
      const emittedArguments = toolArgumentsText.get(callId) ?? '';
      if (!fullArguments.startsWith(emittedArguments)) {
        throw new ModelCommonsError(
          'RUNTIME_INITIALIZATION_FAILED',
          `Tool argument deltas for \`${callId}\` do not match the completed call.`
        );
      }
      if (fullArguments.length > emittedArguments.length) {
        yield frame('response.function_call_arguments.delta', {
          item_id: providerId('fc', callId),
          output_index: outputIndex,
          delta: fullArguments.slice(emittedArguments.length),
        });
      }
      completedTools.add(callId);
      completedToolValues.set(callId, { name: event.call.name, arguments: fullArguments });
      yield frame('response.function_call_arguments.done', {
        item_id: providerId('fc', callId),
        output_index: outputIndex,
        name: event.call.name,
        arguments: fullArguments,
      });
      yield frame('response.output_item.done', {
        output_index: outputIndex,
        item: {
          id: providerId('fc', callId),
          type: 'function_call',
          status: 'completed',
          call_id: callId,
          name: event.call.name,
          arguments: fullArguments,
        },
      });
      continue;
    }

    if (event.type === 'usage.updated') {
      if (!identity || event.responseId !== identity.canonicalId) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A usage event arrived without a matching response start.');
      }
      latestUsage = { ...latestUsage, ...event.usage };
      continue;
    }

    if (event.type === 'response.completed') {
      const finalResponse = {
        ...event.response,
        usage: { ...latestUsage, ...event.response.usage },
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
          providerId: responseId(finalResponse.id),
          created: unixSeconds(finalResponse.createdAt),
          model: finalResponse.modelId,
        };
        const response = incompleteResponse(identity, parsed);
        yield frame('response.created', { response });
        yield frame('response.in_progress', { response });
      } else if (finalResponse.id !== identity.canonicalId || finalResponse.modelId !== identity.model) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The terminal response identity did not match response.started.');
      }
      const finalText = outputText(finalResponse);
      const hasToolOutput = finalResponse.content.some((part) => part.type === 'tool_call');
      if (textStarted && !finalText.startsWith(text)) {
        throw new ModelCommonsError(
          'RUNTIME_INITIALIZATION_FAILED',
          'Text deltas do not match the completed response.'
        );
      }
      if (textStarted && finalText.length > text.length) {
        const remainder = finalText.slice(text.length);
        text = finalText;
        yield frame('response.output_text.delta', {
          output_index: textOutputIndex,
          item_id: providerId('msg', identity.canonicalId),
          content_index: 0,
          delta: remainder,
        });
      }
      if (finalText && !textStarted) {
        for (const item of startText()) yield item;
        yield frame('response.output_text.delta', {
          output_index: textOutputIndex,
          item_id: providerId('msg', identity.canonicalId),
          content_index: 0,
          delta: finalText,
        });
      }
      if (!finalText && !hasToolOutput && !textStarted) {
        for (const item of startText()) yield item;
      }
      for (const item of closeText(finalText || text)) yield item;

      const finalToolCalls = finalResponse.content.filter((part) => part.type === 'tool_call');
      const finalToolIds = new Set(finalToolCalls.map((part) => part.call.id));
      if (finalToolIds.size !== finalToolCalls.length) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The completed response contained duplicate tool-call IDs.');
      }
      for (const callId of toolIndexes.keys()) {
        if (!finalToolIds.has(callId)) {
          throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A streamed tool call was absent from the completed response.');
        }
      }
      for (const part of finalToolCalls) {
        const streamedName = toolNames.get(part.call.id);
        if (streamedName !== undefined && streamedName !== part.call.name) {
          throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A streamed tool call changed name in the terminal response.');
        }
        const completed = completedToolValues.get(part.call.id);
        if (completed && (
          completed.name !== part.call.name || completed.arguments !== toolArguments(part.call)
        )) {
          throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A completed tool call changed in the terminal response.');
        }
      }

      for (const part of finalToolCalls) {
        if (completedTools.has(part.call.id)) continue;
        const outputIndex = toolIndexes.get(part.call.id) ?? nextOutputIndex++;
        if (!toolIndexes.has(part.call.id)) {
          toolIndexes.set(part.call.id, outputIndex);
          toolNames.set(part.call.id, part.call.name);
          yield frame('response.output_item.added', {
            output_index: outputIndex,
            item: {
              id: providerId('fc', part.call.id),
              type: 'function_call',
              status: 'in_progress',
              call_id: part.call.id,
              name: part.call.name,
              arguments: '',
            },
          });
        }
        const fullArguments = toolArguments(part.call);
        const emitted = toolArgumentsText.get(part.call.id) ?? '';
        if (!fullArguments.startsWith(emitted)) {
          throw new ModelCommonsError(
            'RUNTIME_INITIALIZATION_FAILED',
            `Tool argument deltas for \`${part.call.id}\` do not match the completed response.`
          );
        }
        if (fullArguments.length > emitted.length) {
          yield frame('response.function_call_arguments.delta', {
            item_id: providerId('fc', part.call.id),
            output_index: outputIndex,
            delta: fullArguments.slice(emitted.length),
          });
        }
        yield frame('response.function_call_arguments.done', {
          item_id: providerId('fc', part.call.id),
          output_index: outputIndex,
          name: part.call.name,
          arguments: fullArguments,
        });
        yield frame('response.output_item.done', {
          output_index: outputIndex,
          item: {
            id: providerId('fc', part.call.id),
            type: 'function_call',
            status: 'completed',
            call_id: part.call.id,
            name: part.call.name,
            arguments: fullArguments,
          },
        });
      }

      const terminalType = finalResponse.stopReason === 'length'
        ? 'response.incomplete'
        : 'response.completed';
      yield frame(terminalType, {
        response: responsesBody(finalResponse, parsed.canonical, parsed.allowParallelToolCalls),
      });
      return;
    }

    if (event.type === 'response.failed') {
      if (identity && event.responseId !== identity.canonicalId) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The failed response ID did not match response.started.');
      }
      const mapped = openAIErrorBody(event.error);
      yield sseEvent('error', {
        type: 'error',
        code: mapped.body.error.code,
        message: mapped.body.error.message,
        param: mapped.body.error.param,
        sequence_number: sequence++,
      });
      return;
    }
  }
  throw new ModelCommonsError(
    'RUNTIME_INITIALIZATION_FAILED',
    'The canonical stream ended without a terminal response event.'
  );
}

function chatChunk(
  identity: StreamIdentity,
  delta: Record<string, unknown>,
  finishReason: string | null = null,
  includeUsage = false
): Record<string, unknown> {
  return {
    id: chatId(identity.canonicalId),
    object: 'chat.completion.chunk',
    created: identity.created,
    model: identity.model,
    choices: [{ index: 0, delta, finish_reason: finishReason, logprobs: null }],
    ...(includeUsage ? { usage: null } : {}),
  };
}

export async function* chatEventStream(
  events: AsyncIterable<ModelCommonsStreamEvent>,
  parsed: ParsedGenerationRequest
): AsyncGenerator<string> {
  let identity: StreamIdentity | undefined;
  let latestUsage: ModelCommonsUsage = {};
  let streamedText = '';
  const argumentText = new Map<string, string>();
  const toolIndexes = new Map<string, number>();
  const toolNames = new Map<string, string>();
  const completedTools = new Set<string>();

  for await (const event of events) {
    if (event.type === 'response.started') {
      if (identity) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The canonical stream started more than once.');
      }
      if (event.modelId !== parsed.canonical.model.id) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The stream started with a different model than the resolved selection.');
      }
      identity = identityFromStarted(event);
      yield sseData(chatChunk(identity, { role: 'assistant', content: '' }, null, parsed.includeUsage));
      continue;
    }
    if (event.type === 'text.delta') {
      if (!identity || event.responseId !== identity.canonicalId) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A text delta arrived without a matching response start.');
      }
      streamedText += event.delta;
      yield sseData(chatChunk(identity, { content: event.delta }, null, parsed.includeUsage));
      continue;
    }
    if (event.type === 'tool_call.started') {
      if (!identity || event.responseId !== identity.canonicalId || toolIndexes.has(event.callId)) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A tool-call start was inconsistent.');
      }
      if (!Number.isSafeInteger(event.index) || event.index < 0 || [...toolIndexes.values()].includes(event.index)) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A tool call used an invalid or duplicate index.');
      }
      argumentText.set(event.callId, '');
      toolIndexes.set(event.callId, event.index);
      toolNames.set(event.callId, event.name);
      yield sseData(chatChunk(identity, {
        tool_calls: [{
          index: event.index,
          id: event.callId,
          type: 'function',
          function: { name: event.name, arguments: '' },
        }],
      }, null, parsed.includeUsage));
      continue;
    }
    if (event.type === 'tool_call.arguments.delta') {
      if (
        !identity ||
        event.responseId !== identity.canonicalId ||
        completedTools.has(event.callId) ||
        toolIndexes.get(event.callId) !== event.index
      ) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'Tool arguments arrived without a matching tool-call start.');
      }
      argumentText.set(event.callId, `${argumentText.get(event.callId) ?? ''}${event.delta}`);
      yield sseData(chatChunk(identity, {
        tool_calls: [{ index: event.index, function: { arguments: event.delta } }],
      }, null, parsed.includeUsage));
      continue;
    }
    if (event.type === 'tool_call.completed') {
      const callId = event.call.id;
      const toolIndex = toolIndexes.get(callId);
      if (
        !identity ||
        event.responseId !== identity.canonicalId ||
        toolIndex === undefined ||
        toolIndex !== event.index ||
        completedTools.has(callId) ||
        toolNames.get(callId) !== event.call.name
      ) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A completed tool call had no matching start.');
      }
      const full = toolArguments(event.call);
      const emitted = argumentText.get(callId) ?? '';
      if (!full.startsWith(emitted)) {
        throw new ModelCommonsError(
          'RUNTIME_INITIALIZATION_FAILED',
          `Tool argument deltas for \`${callId}\` do not match the completed call.`
        );
      }
      if (full.length > emitted.length) {
        yield sseData(chatChunk(identity, {
          tool_calls: [{
            index: toolIndex,
            function: { arguments: full.slice(emitted.length) },
          }],
        }, null, parsed.includeUsage));
      }
      argumentText.set(callId, full);
      completedTools.add(callId);
      continue;
    }
    if (event.type === 'usage.updated') {
      if (!identity || event.responseId !== identity.canonicalId) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A usage event arrived without a matching response start.');
      }
      latestUsage = { ...latestUsage, ...event.usage };
      continue;
    }
    if (event.type === 'response.completed') {
      if (!identity) {
        identity = {
          canonicalId: event.response.id,
          providerId: responseId(event.response.id),
          created: unixSeconds(event.response.createdAt),
          model: event.response.modelId,
        };
        yield sseData(chatChunk(identity, { role: 'assistant', content: '' }, null, parsed.includeUsage));
      } else if (event.response.id !== identity.canonicalId || event.response.modelId !== identity.model) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The terminal response identity did not match response.started.');
      }
      validateStructuredOutput(event.response, parsed.canonical);
      const finalText = outputText(event.response);
      if (!finalText.startsWith(streamedText)) {
        throw new ModelCommonsError(
          'RUNTIME_INITIALIZATION_FAILED',
          'Text deltas do not match the completed response.'
        );
      }
      if (finalText.length > streamedText.length) {
        yield sseData(chatChunk(identity, { content: finalText.slice(streamedText.length) }, null, parsed.includeUsage));
        streamedText = finalText;
      }
      let nextToolIndex = Math.max(-1, ...toolIndexes.values()) + 1;
      const finalToolCalls = event.response.content.filter((part) => part.type === 'tool_call');
      const finalToolIds = new Set(finalToolCalls.map((part) => part.call.id));
      if (finalToolIds.size !== finalToolCalls.length) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The completed response contained duplicate tool-call IDs.');
      }
      for (const callId of toolIndexes.keys()) {
        if (!finalToolIds.has(callId)) {
          throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A streamed tool call was absent from the completed response.');
        }
      }
      for (const part of finalToolCalls) {
        const streamedName = toolNames.get(part.call.id);
        if (streamedName !== undefined && streamedName !== part.call.name) {
          throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'A streamed tool call changed name in the terminal response.');
        }
        const full = toolArguments(part.call);
        const emitted = argumentText.get(part.call.id) ?? '';
        let index = toolIndexes.get(part.call.id);
        if (index === undefined) {
          index = nextToolIndex++;
          toolIndexes.set(part.call.id, index);
          toolNames.set(part.call.id, part.call.name);
          yield sseData(chatChunk(identity, {
            tool_calls: [{
              index,
              id: part.call.id,
              type: 'function',
              function: { name: part.call.name, arguments: '' },
            }],
          }, null, parsed.includeUsage));
        }
        if (!full.startsWith(emitted)) {
          throw new ModelCommonsError(
            'RUNTIME_INITIALIZATION_FAILED',
            `Tool argument deltas for \`${part.call.id}\` do not match the completed response.`
          );
        }
        if (full.length > emitted.length) {
          yield sseData(chatChunk(identity, {
            tool_calls: [{
              index,
              function: { arguments: full.slice(emitted.length) },
            }],
          }, null, parsed.includeUsage));
        }
      }
      const finalUsage = parsed.includeUsage
        ? chatUsage(event.response.usage) ?? chatUsage(latestUsage)
        : undefined;
      if (parsed.includeUsage && !finalUsage) {
        throw new ModelCommonsError(
          'RUNTIME_INITIALIZATION_FAILED',
          'The backend must report token usage when stream_options.include_usage is true.'
        );
      }
      yield sseData(chatChunk(identity, {}, chatFinishReason(event.response), parsed.includeUsage));
      if (parsed.includeUsage) {
        yield sseData({
          id: chatId(identity.canonicalId),
          object: 'chat.completion.chunk',
          created: identity.created,
          model: identity.model,
          choices: [],
          usage: finalUsage,
        });
      }
      yield sseData('[DONE]');
      return;
    }
    if (event.type === 'response.failed') {
      if (identity && event.responseId !== identity.canonicalId) {
        throw new ModelCommonsError('RUNTIME_INITIALIZATION_FAILED', 'The failed response ID did not match response.started.');
      }
      yield sseData(openAIErrorBody(event.error).body);
      return;
    }
  }
  throw new ModelCommonsError(
    'RUNTIME_INITIALIZATION_FAILED',
    'The canonical stream ended without a terminal response event.'
  );
}

export function responsesStreamError(error: unknown): string {
  const mapped = openAIErrorBody(error);
  return sseEvent('error', {
    type: 'error',
    code: mapped.body.error.code,
    message: mapped.body.error.message,
    param: mapped.body.error.param,
  });
}

export function chatStreamError(error: unknown): string {
  return sseData(openAIErrorBody(error).body);
}

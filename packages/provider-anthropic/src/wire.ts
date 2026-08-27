import {
  ModelCommonsError,
  type ModelCommonsRequest,
  type ModelCommonsResponse,
  type ModelCommonsUsage,
} from '@modelcommons/protocol';
import { providerId, usageNumbers } from './internal';

export function messageId(value: string): string {
  return providerId('msg', value);
}

export function anthropicUsage(usage: ModelCommonsUsage): Record<string, unknown> {
  const values = usageNumbers(usage);
  if (!values) {
    throw new ModelCommonsError(
      'RUNTIME_INITIALIZATION_FAILED',
      'The backend must report input and output token usage for Anthropic Messages.'
    );
  }
  return {
    input_tokens: values.input,
    output_tokens: values.output,
    cache_creation: null,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    inference_geo: null,
    output_tokens_details: null,
    server_tool_use: null,
    service_tier: null,
  };
}

export function anthropicStopReason(
  response: ModelCommonsResponse
): 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' {
  if (response.stopReason === 'length') return 'max_tokens';
  if (response.stopReason === 'tool_call') return 'tool_use';
  if (response.stopSequence !== undefined) return 'stop_sequence';
  return 'end_turn';
}

export function anthropicContent(response: ModelCommonsResponse): Array<Record<string, unknown>> {
  return response.content.map((part): Record<string, unknown> => {
    if (part.type === 'text') return { type: 'text', text: part.text };
    if (part.type === 'tool_call') {
      return {
        type: 'tool_use',
        id: part.call.id,
        name: part.call.name,
        input: part.call.arguments,
      };
    }
    throw new ModelCommonsError(
      'RUNTIME_INITIALIZATION_FAILED',
      `The backend returned unsupported assistant content type \`${part.type}\`.`
    );
  });
}

export function validateStructuredOutput(
  response: ModelCommonsResponse,
  request: ModelCommonsRequest
): void {
  if (request.responseFormat?.type !== 'json_schema' || response.stopReason === 'tool_call') return;
  const text = response.content
    .filter((part) => part.type === 'text')
    .map((part) => part.type === 'text' ? part.text : '')
    .join('');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new ModelCommonsError(
      'RUNTIME_INITIALIZATION_FAILED',
      'The backend violated its structured-output capability by returning invalid JSON.'
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ModelCommonsError(
      'RUNTIME_INITIALIZATION_FAILED',
      'The backend violated its structured-output capability by returning a non-object root.'
    );
  }
}

export function anthropicMessageBody(
  response: ModelCommonsResponse,
  request?: ModelCommonsRequest
): Record<string, unknown> {
  if (request) validateStructuredOutput(response, request);
  return {
    id: messageId(response.id),
    type: 'message',
    role: 'assistant',
    model: response.modelId,
    container: null,
    content: anthropicContent(response),
    stop_details: null,
    stop_reason: anthropicStopReason(response),
    stop_sequence: response.stopSequence ?? null,
    usage: anthropicUsage(response.usage),
  };
}

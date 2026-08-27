import type {
  ModelCommonsRequest,
  ModelCommonsResponse,
  ModelCommonsUsage,
  TextContent,
  ToolCall,
  JsonValue,
} from '@modelcommons/protocol';
import { providerId, usageNumbers } from './internal';
import { ModelCommonsError } from '@modelcommons/protocol';

function assertAssistantContent(response: ModelCommonsResponse): void {
  for (const part of response.content) {
    if (part.type !== 'text' && part.type !== 'tool_call') {
      throw new ModelCommonsError(
        'RUNTIME_INITIALIZATION_FAILED',
        `The backend returned unsupported assistant content type \`${part.type}\`.`
      );
    }
  }
}

export function validateStructuredOutput(
  response: ModelCommonsResponse,
  request: ModelCommonsRequest
): void {
  const format = request.responseFormat;
  if (!format || format.type === 'text' || response.stopReason === 'tool_call') return;
  const text = response.content
    .filter((part): part is TextContent => part.type === 'text')
    .map((part) => part.text)
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

function canonicalJson(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value)!;
}

export function unixSeconds(value: number): number {
  return Math.floor(value > 100_000_000_000 ? value / 1000 : value);
}

export function responseId(value: string): string {
  return providerId('resp', value);
}

export function chatId(value: string): string {
  return providerId('chatcmpl', value);
}

export function responseItemId(response: ModelCommonsResponse): string {
  return providerId('msg', response.id);
}

function responseFormatWire(request: ModelCommonsRequest): unknown {
  const format = request.responseFormat;
  if (!format || format.type === 'text') return { type: 'text' };
  if (format.type === 'json_object') return { type: 'json_object' };
  return {
    type: 'json_schema',
    name: format.name,
    ...(format.description ? { description: format.description } : {}),
    schema: format.schema,
    strict: format.strict,
  };
}

function responseToolChoiceWire(request: ModelCommonsRequest): unknown {
  const choice = request.toolChoice;
  if (!choice) return 'auto';
  if (choice.type === 'tool') return { type: 'function', name: choice.name };
  return choice.type;
}

function responseToolsWire(request: ModelCommonsRequest): unknown[] {
  return (request.tools ?? []).map((tool) => ({
    type: 'function',
    name: tool.name,
    ...(tool.description ? { description: tool.description } : {}),
    parameters: tool.inputSchema,
    ...(tool.strict !== undefined ? { strict: tool.strict } : {}),
  }));
}

export function responsesConfiguration(
  request: ModelCommonsRequest,
  allowParallelToolCalls?: boolean
): Record<string, unknown> {
  return {
    instructions: request.instructions ?? null,
    max_output_tokens: request.maxOutputTokens ?? null,
    parallel_tool_calls: Boolean(request.tools?.length && allowParallelToolCalls),
    previous_response_id: null,
    reasoning: { effort: null, summary: null },
    store: false,
    temperature: request.sampling?.temperature ?? null,
    text: { format: responseFormatWire(request) },
    tool_choice: responseToolChoiceWire(request),
    tools: responseToolsWire(request),
    top_p: request.sampling?.topP ?? null,
    truncation: 'disabled',
    metadata: request.metadata ?? {},
  };
}

export function responsesUsage(usage: ModelCommonsUsage): unknown {
  const values = usageNumbers(usage);
  if (!values) return null;
  return {
    input_tokens: values.input,
    output_tokens: values.output,
    total_tokens: values.total,
    input_tokens_details: {
      cached_tokens: usage.cachedInputTokens ?? 0,
    },
    output_tokens_details: {
      reasoning_tokens: 0,
    },
  };
}

export function responseOutputItems(response: ModelCommonsResponse): unknown[] {
  assertAssistantContent(response);
  const output: unknown[] = [];
  const text = response.content
    .filter((item): item is TextContent => item.type === 'text')
    .map((item) => item.text)
    .join('');
  if (text || !response.content.some((item) => item.type === 'tool_call')) {
    output.push({
      id: responseItemId(response),
      type: 'message',
      status: 'completed',
      role: 'assistant',
      content: [{ type: 'output_text', text, annotations: [] }],
    });
  }
  response.content.forEach((item) => {
    if (item.type !== 'tool_call') return;
    output.push({
      id: providerId('fc', item.call.id),
      type: 'function_call',
      status: 'completed',
      call_id: item.call.id,
      name: item.call.name,
      arguments: toolArguments(item.call),
    });
  });
  return output;
}

export function responsesBody(
  response: ModelCommonsResponse,
  request: ModelCommonsRequest,
  allowParallelToolCalls?: boolean
): Record<string, unknown> {
  assertAssistantContent(response);
  validateStructuredOutput(response, request);
  const incomplete = response.stopReason === 'length';
  return {
    id: responseId(response.id),
    object: 'response',
    created_at: unixSeconds(response.createdAt),
    status: incomplete ? 'incomplete' : 'completed',
    error: null,
    incomplete_details: incomplete ? { reason: 'max_output_tokens' } : null,
    model: response.modelId,
    output: responseOutputItems(response),
    ...responsesConfiguration(request, allowParallelToolCalls),
    usage: responsesUsage(response.usage),
  };
}

export function chatToolCalls(response: ModelCommonsResponse): Array<Record<string, unknown>> {
  const calls: Array<Record<string, unknown>> = [];
  for (const item of response.content) {
    if (item.type !== 'tool_call') continue;
    calls.push({
      id: item.call.id,
      type: 'function',
      function: {
        name: item.call.name,
        arguments: toolArguments(item.call),
      },
    });
  }
  return calls;
}

export function chatFinishReason(response: ModelCommonsResponse): 'stop' | 'length' | 'tool_calls' {
  if (response.stopReason === 'length') return 'length';
  if (response.stopReason === 'tool_call') return 'tool_calls';
  return 'stop';
}

export function chatUsage(usage: ModelCommonsUsage): Record<string, number> | undefined {
  const values = usageNumbers(usage);
  if (!values) return undefined;
  return {
    prompt_tokens: values.input,
    completion_tokens: values.output,
    total_tokens: values.total,
  };
}

export function chatBody(
  response: ModelCommonsResponse,
  request?: ModelCommonsRequest
): Record<string, unknown> {
  assertAssistantContent(response);
  if (request) validateStructuredOutput(response, request);
  const text = response.content
    .filter((item): item is TextContent => item.type === 'text')
    .map((item) => item.text)
    .join('');
  const toolCalls = chatToolCalls(response);
  return {
    id: chatId(response.id),
    object: 'chat.completion',
    created: unixSeconds(response.createdAt),
    model: response.modelId,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: text || toolCalls.length === 0 ? text : null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      },
      finish_reason: chatFinishReason(response),
      logprobs: null,
    }],
    ...(chatUsage(response.usage) ? { usage: chatUsage(response.usage) } : {}),
  };
}

export function outputText(response: ModelCommonsResponse): string {
  assertAssistantContent(response);
  return response.content
    .filter((item): item is TextContent => item.type === 'text')
    .map((item) => item.text)
    .join('');
}

export function toolArguments(call: ToolCall): string {
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

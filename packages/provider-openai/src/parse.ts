import type {
  JsonObject,
  ModelCapability,
  ModelCommonsContent,
  ModelCommonsMessage,
  ModelCommonsRequest,
  ResponseFormat,
  ToolChoice,
  ToolDefinition,
} from '@modelcommons/protocol';
import {
  assertAllowedKeys,
  boolean,
  finiteNumber,
  invalid,
  jsonObject,
  nonEmptyString,
  optionalString,
  positiveInteger,
  record,
  unsupported,
} from './internal';
import type { ProviderModelDescriptor } from './types';

export interface ParsedGenerationRequest {
  canonical: ModelCommonsRequest;
  requestedModelId: string;
  stream: boolean;
  includeUsage: boolean;
  allowParallelToolCalls?: boolean;
}

function hasCapability(model: ProviderModelDescriptor, capability: string): boolean {
  return model.capabilities.includes(capability as ModelCapability);
}

function requireTextModel(model: ProviderModelDescriptor): void {
  if (!hasCapability(model, 'text')) {
    unsupported('model', `Model \`${model.id}\` does not provide text generation.`);
  }
}

function requireStream(model: ProviderModelDescriptor): void {
  if (model.features?.streaming !== true) {
    unsupported('stream', `Model \`${model.id}\` does not provide streaming generation.`);
  }
}

function parseTextParts(
  value: unknown,
  param: string,
  acceptedTypes: readonly string[]
): ModelCommonsContent[] {
  if (typeof value === 'string') return [{ type: 'text', text: value }];
  if (!Array.isArray(value) || value.length === 0) {
    invalid(param, `${param} must be a string or a non-empty array of text parts.`);
  }
  const content: ModelCommonsContent[] = [];
  value.forEach((rawPart, index) => {
    const partParam = `${param}[${index}]`;
    const part = record(rawPart, partParam);
    const type = nonEmptyString(part.type, `${partParam}.type`);
    if (!acceptedTypes.includes(type)) unsupported(`${partParam}.type`, `Content type \`${type}\` is not supported.`);
    assertAllowedKeys(part, ['type', 'text'], partParam);
    content.push({ type: 'text', text: typeof part.text === 'string' ? part.text : invalid(`${partParam}.text`, `${partParam}.text must be a string.`) });
  });
  return content;
}

function parseArguments(value: unknown, param: string): { value: JsonObject; raw: string } {
  if (typeof value !== 'string') invalid(param, `${param} must be a JSON string.`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    invalid(param, `${param} must contain a valid JSON object.`);
  }
  return { value: jsonObject(parsed, param), raw: value };
}

function parseResponsesInput(value: unknown): ModelCommonsMessage[] {
  if (typeof value === 'string') {
    return [{ role: 'user', content: [{ type: 'text', text: value }] }];
  }
  if (!Array.isArray(value) || value.length === 0) {
    invalid('input', 'input must be a string or a non-empty array.');
  }

  return value.map((rawItem, index): ModelCommonsMessage => {
    const param = `input[${index}]`;
    const item = record(rawItem, param);
    const type = item.type === undefined ? 'message' : nonEmptyString(item.type, `${param}.type`);
    if (type === 'message') {
      assertAllowedKeys(item, ['type', 'role', 'content', 'id', 'status'], param);
      if (item.id !== undefined) nonEmptyString(item.id, `${param}.id`);
      const role = nonEmptyString(item.role, `${param}.role`);
      if (!['system', 'developer', 'user', 'assistant'].includes(role)) {
        unsupported(`${param}.role`, `Message role \`${role}\` is not supported.`);
      }
      if (item.status !== undefined && item.status !== 'completed') {
        unsupported(`${param}.status`);
      }
      return {
        ...(typeof item.id === 'string' ? { id: item.id } : {}),
        role: role as ModelCommonsMessage['role'],
        content: parseTextParts(item.content, `${param}.content`, ['input_text', 'output_text']),
      };
    }
    if (type === 'function_call') {
      assertAllowedKeys(item, ['type', 'id', 'status', 'call_id', 'name', 'arguments'], param);
      if (item.id !== undefined) nonEmptyString(item.id, `${param}.id`);
      if (item.status !== undefined && item.status !== 'completed') unsupported(`${param}.status`);
      const callId = nonEmptyString(item.call_id, `${param}.call_id`);
      const parsed = parseArguments(item.arguments, `${param}.arguments`);
      return {
        role: 'assistant',
        content: [{
          type: 'tool_call',
          call: {
            id: callId,
            name: nonEmptyString(item.name, `${param}.name`),
            arguments: parsed.value,
            rawArguments: parsed.raw,
          },
        }],
      };
    }
    if (type === 'function_call_output') {
      assertAllowedKeys(item, ['type', 'call_id', 'output'], param);
      if (typeof item.output !== 'string') {
        unsupported(`${param}.output`, 'Only string function-call output is supported.');
      }
      return {
        role: 'user',
        content: [{
          type: 'tool_result',
          result: {
            toolCallId: nonEmptyString(item.call_id, `${param}.call_id`),
            content: item.output,
          },
        }],
      };
    }
    unsupported(`${param}.type`, `Input item type \`${type}\` is not supported.`);
  });
}

function parseFunctionTool(
  rawTool: unknown,
  param: string,
  shape: 'responses' | 'chat',
  model: ProviderModelDescriptor
): ToolDefinition {
  if (!hasCapability(model, 'tools') || model.features?.tools === false) {
    unsupported('tools', `Model \`${model.id}\` does not provide tool calling.`);
  }
  const outer = record(rawTool, param);
  if (outer.type !== 'function') {
    unsupported(`${param}.type`, 'Only client-executed function tools are supported.');
  }
  const tool = shape === 'chat'
    ? (() => {
        assertAllowedKeys(outer, ['type', 'function'], param);
        return record(outer.function, `${param}.function`);
      })()
    : outer;
  assertAllowedKeys(tool, shape === 'chat'
    ? ['name', 'description', 'parameters', 'strict']
    : ['type', 'name', 'description', 'parameters', 'strict'], shape === 'chat' ? `${param}.function` : param);
  const strict = tool.strict === undefined ? false : boolean(tool.strict, `${param}${shape === 'chat' ? '.function' : ''}.strict`);
  if (strict && model.features?.strictTools !== true) {
    unsupported(`${param}${shape === 'chat' ? '.function' : ''}.strict`, 'Strict tool schemas require constrained decoding support.');
  }
  return {
    name: nonEmptyString(tool.name, `${param}${shape === 'chat' ? '.function' : ''}.name`),
    ...(optionalString(tool.description, `${param}${shape === 'chat' ? '.function' : ''}.description`) !== undefined
      ? { description: tool.description as string }
      : {}),
    inputSchema: tool.parameters === undefined
      ? { type: 'object', properties: {} }
      : jsonObject(tool.parameters, `${param}${shape === 'chat' ? '.function' : ''}.parameters`),
    ...(strict ? { strict: true } : {}),
  };
}

function parseTools(
  value: unknown,
  shape: 'responses' | 'chat',
  model: ProviderModelDescriptor
): ToolDefinition[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) invalid('tools', 'tools must be a non-empty array.');
  const tools = value.map((tool, index) => parseFunctionTool(tool, `tools[${index}]`, shape, model));
  const names = new Set<string>();
  for (const [index, tool] of tools.entries()) {
    if (names.has(tool.name)) invalid(`tools[${index}].name`, 'Tool names must be unique.');
    names.add(tool.name);
  }
  return tools;
}

function parseToolChoice(value: unknown, shape: 'responses' | 'chat'): ToolChoice | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') {
    if (value === 'auto' || value === 'none') return { type: value };
    if (value === 'required') return { type: 'required' };
    unsupported('tool_choice', `Tool choice \`${value}\` is not supported.`);
  }
  const choice = record(value, 'tool_choice');
  if (shape === 'responses') {
    assertAllowedKeys(choice, ['type', 'name'], 'tool_choice');
    if (choice.type !== 'function') unsupported('tool_choice.type');
    return { type: 'tool', name: nonEmptyString(choice.name, 'tool_choice.name') };
  }
  assertAllowedKeys(choice, ['type', 'function'], 'tool_choice');
  if (choice.type !== 'function') unsupported('tool_choice.type');
  const fn = record(choice.function, 'tool_choice.function');
  assertAllowedKeys(fn, ['name'], 'tool_choice.function');
  return { type: 'tool', name: nonEmptyString(fn.name, 'tool_choice.function.name') };
}

function responseFormatFromResponses(value: unknown, model: ProviderModelDescriptor): ResponseFormat | undefined {
  if (value === undefined) return undefined;
  const text = record(value, 'text');
  assertAllowedKeys(text, ['format'], 'text');
  if (text.format === undefined) return undefined;
  const format = record(text.format, 'text.format');
  const type = nonEmptyString(format.type, 'text.format.type');
  if (type === 'text') {
    assertAllowedKeys(format, ['type'], 'text.format');
    return { type: 'text' };
  }
  if (type === 'json_object') {
    assertAllowedKeys(format, ['type'], 'text.format');
    if (model.features?.jsonObject !== true) {
      unsupported('text.format', 'JSON-object output requires a runtime JSON grammar.');
    }
    return { type: 'json_object', guarantee: 'grammar' };
  }
  if (type === 'json_schema') {
    assertAllowedKeys(format, ['type', 'name', 'description', 'schema', 'strict'], 'text.format');
    if (model.features?.jsonSchema !== true || !hasCapability(model, 'structured-output')) {
      unsupported('text.format', 'JSON Schema output requires schema-constrained decoding support.');
    }
    const schema = jsonObject(format.schema, 'text.format.schema');
    if (schema.type !== 'object') {
      invalid('text.format.schema.type', 'The root output schema must have type "object".');
    }
    return {
      type: 'json_schema',
      name: nonEmptyString(format.name, 'text.format.name'),
      schema,
      strict: format.strict === undefined ? false : boolean(format.strict, 'text.format.strict'),
      guarantee: 'grammar',
      ...(optionalString(format.description, 'text.format.description') !== undefined
        ? { description: format.description as string }
        : {}),
    };
  }
  unsupported('text.format.type', `Response format \`${type}\` is not supported.`);
}

function responseFormatFromChat(value: unknown, model: ProviderModelDescriptor): ResponseFormat | undefined {
  if (value === undefined) return undefined;
  const format = record(value, 'response_format');
  const type = nonEmptyString(format.type, 'response_format.type');
  if (type === 'text') {
    assertAllowedKeys(format, ['type'], 'response_format');
    return { type: 'text' };
  }
  if (type === 'json_object') {
    assertAllowedKeys(format, ['type'], 'response_format');
    if (model.features?.jsonObject !== true) {
      unsupported('response_format', 'JSON-object output requires a runtime JSON grammar.');
    }
    return { type: 'json_object', guarantee: 'grammar' };
  }
  if (type === 'json_schema') {
    assertAllowedKeys(format, ['type', 'json_schema'], 'response_format');
    const schema = record(format.json_schema, 'response_format.json_schema');
    assertAllowedKeys(schema, ['name', 'description', 'schema', 'strict'], 'response_format.json_schema');
    if (model.features?.jsonSchema !== true || !hasCapability(model, 'structured-output')) {
      unsupported('response_format', 'JSON Schema output requires schema-constrained decoding support.');
    }
    const parsedSchema = jsonObject(schema.schema, 'response_format.json_schema.schema');
    if (parsedSchema.type !== 'object') {
      invalid('response_format.json_schema.schema.type', 'The root output schema must have type "object".');
    }
    return {
      type: 'json_schema',
      name: nonEmptyString(schema.name, 'response_format.json_schema.name'),
      schema: parsedSchema,
      strict: schema.strict === undefined ? false : boolean(schema.strict, 'response_format.json_schema.strict'),
      guarantee: 'grammar',
      ...(optionalString(schema.description, 'response_format.json_schema.description') !== undefined
        ? { description: schema.description as string }
        : {}),
    };
  }
  unsupported('response_format.type', `Response format \`${type}\` is not supported.`);
}

function parseStop(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  const values = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(values) || values.length === 0 || values.some((item) => typeof item !== 'string' || !item)) {
    invalid('stop', 'stop must be a string or a non-empty array of non-empty strings.');
  }
  return values as string[];
}

function parseSampling(
  body: Record<string, unknown>,
  model: ProviderModelDescriptor
): ModelCommonsRequest['sampling'] {
  const sampling: NonNullable<ModelCommonsRequest['sampling']> = {};
  if (body.temperature !== undefined) {
    if (model.features?.temperature !== true) unsupported('temperature');
    const value = finiteNumber(body.temperature, 'temperature');
    if (value < 0 || value > 2) invalid('temperature', 'temperature must be between 0 and 2.');
    sampling.temperature = value;
  }
  if (body.top_p !== undefined) {
    if (model.features?.topP !== true) unsupported('top_p');
    const value = finiteNumber(body.top_p, 'top_p');
    if (value <= 0 || value > 1) invalid('top_p', 'top_p must be greater than 0 and at most 1.');
    sampling.topP = value;
  }
  return Object.keys(sampling).length ? sampling : undefined;
}

function parseParallel(
  value: unknown,
  model: ProviderModelDescriptor
): boolean | undefined {
  if (value === undefined) return undefined;
  const enabled = boolean(value, 'parallel_tool_calls');
  if (enabled && model.features?.parallelTools !== true) {
    unsupported('parallel_tool_calls', 'Parallel tool calls are not supported by this model/runtime.');
  }
  return enabled;
}

function parseMetadata(value: unknown): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  const metadata = record(value, 'metadata');
  for (const [key, item] of Object.entries(metadata)) {
    if (!key) invalid('metadata', 'Metadata keys must be non-empty strings.');
    if (typeof item !== 'string') invalid(`metadata.${key}`, 'Metadata values must be strings.');
  }
  return metadata as Record<string, string>;
}

export function parseResponsesRequest(
  raw: unknown,
  model: ProviderModelDescriptor,
  profile: string | undefined
): ParsedGenerationRequest {
  const body = record(raw, 'Request body');
  assertAllowedKeys(body, [
    'model', 'input', 'instructions', 'max_output_tokens', 'stream', 'tools', 'tool_choice',
    'parallel_tool_calls', 'text', 'temperature', 'top_p', 'metadata', 'store', 'truncation',
  ]);
  requireTextModel(model);
  const requestedModelId = nonEmptyString(body.model, 'model');
  const stream = body.stream === undefined ? false : boolean(body.stream, 'stream');
  if (stream) requireStream(model);
  if (body.store !== undefined && body.store !== false) unsupported('store', 'Only store:false is supported; ModelCommons never stores provider requests.');
  if (body.truncation !== undefined && body.truncation !== 'disabled') unsupported('truncation');
  const tools = parseTools(body.tools, 'responses', model);
  const toolChoice = parseToolChoice(body.tool_choice, 'responses');
  if (toolChoice && !tools?.length) invalid('tool_choice', 'tool_choice requires tools.');
  const selectedTool = toolChoice?.type === 'tool' ? toolChoice.name : undefined;
  if (selectedTool && !tools?.some((tool) => tool.name === selectedTool)) {
    invalid('tool_choice.name', 'The selected tool is absent from tools.');
  }
  const parallel = parseParallel(body.parallel_tool_calls, model);
  if (parallel !== undefined && !tools?.length) invalid('parallel_tool_calls', 'parallel_tool_calls requires tools.');
  const instructions = optionalString(body.instructions, 'instructions');
  const responseFormat = responseFormatFromResponses(body.text, model);
  const sampling = parseSampling(body, model);
  const metadata = parseMetadata(body.metadata);
  return {
    requestedModelId,
    stream,
    includeUsage: true,
    allowParallelToolCalls: tools?.length
      ? parallel ?? model.features?.parallelTools === true
      : false,
    canonical: {
      model: { id: model.id, profile, capabilities: [...model.capabilities] },
      messages: parseResponsesInput(body.input),
      ...(instructions !== undefined ? { instructions } : {}),
      ...(body.max_output_tokens !== undefined
        ? { maxOutputTokens: positiveInteger(body.max_output_tokens, 'max_output_tokens') }
        : {}),
      ...(tools ? { tools } : {}),
      ...(toolChoice ? { toolChoice } : {}),
      ...(responseFormat ? { responseFormat } : {}),
      ...(sampling ? { sampling } : {}),
      ...(metadata ? { metadata } : {}),
    },
  };
}

function parseChatMessages(value: unknown): ModelCommonsMessage[] {
  if (!Array.isArray(value) || value.length === 0) invalid('messages', 'messages must be a non-empty array.');
  return value.map((rawMessage, index): ModelCommonsMessage => {
    const param = `messages[${index}]`;
    const message = record(rawMessage, param);
    const role = nonEmptyString(message.role, `${param}.role`);
    if (role === 'tool') {
      assertAllowedKeys(message, ['role', 'tool_call_id', 'content'], param);
      if (typeof message.content !== 'string') unsupported(`${param}.content`, 'Only string tool results are supported.');
      return {
        role: 'user',
        content: [{
          type: 'tool_result',
          result: {
            toolCallId: nonEmptyString(message.tool_call_id, `${param}.tool_call_id`),
            content: message.content,
          },
        }],
      };
    }
    if (!['system', 'developer', 'user', 'assistant'].includes(role)) unsupported(`${param}.role`);
    assertAllowedKeys(message, ['role', 'content', 'tool_calls'], param);
    const content = message.content === null && role === 'assistant'
      ? []
      : parseTextParts(message.content, `${param}.content`, ['text']);
    if (message.tool_calls !== undefined) {
      if (role !== 'assistant') invalid(`${param}.tool_calls`, 'Only assistant messages may contain tool_calls.');
      if (!Array.isArray(message.tool_calls)) invalid(`${param}.tool_calls`, `${param}.tool_calls must be an array.`);
      message.tool_calls.forEach((rawCall, callIndex) => {
        const callParam = `${param}.tool_calls[${callIndex}]`;
        const call = record(rawCall, callParam);
        assertAllowedKeys(call, ['id', 'type', 'function'], callParam);
        if (call.type !== 'function') unsupported(`${callParam}.type`);
        const fn = record(call.function, `${callParam}.function`);
        assertAllowedKeys(fn, ['name', 'arguments'], `${callParam}.function`);
        const parsed = parseArguments(fn.arguments, `${callParam}.function.arguments`);
        content.push({
          type: 'tool_call',
          call: {
            id: nonEmptyString(call.id, `${callParam}.id`),
            name: nonEmptyString(fn.name, `${callParam}.function.name`),
            arguments: parsed.value,
            rawArguments: parsed.raw,
          },
        });
      });
    }
    if (content.length === 0) invalid(`${param}.content`, 'An assistant message needs content or tool_calls.');
    return { role: role as ModelCommonsMessage['role'], content };
  });
}

export function parseChatRequest(
  raw: unknown,
  model: ProviderModelDescriptor,
  profile: string | undefined
): ParsedGenerationRequest {
  const body = record(raw, 'Request body');
  assertAllowedKeys(body, [
    'model', 'messages', 'stream', 'max_completion_tokens', 'max_tokens', 'stop', 'temperature',
    'top_p', 'tools', 'tool_choice', 'parallel_tool_calls', 'response_format', 'stream_options', 'n',
  ]);
  requireTextModel(model);
  const requestedModelId = nonEmptyString(body.model, 'model');
  const stream = body.stream === undefined ? false : boolean(body.stream, 'stream');
  if (stream) requireStream(model);
  if (body.n !== undefined && body.n !== 1) unsupported('n', 'Only n:1 is supported.');
  if (body.max_completion_tokens !== undefined && body.max_tokens !== undefined && body.max_completion_tokens !== body.max_tokens) {
    invalid('max_completion_tokens', 'max_completion_tokens and max_tokens conflict.');
  }
  const tokenValue = body.max_completion_tokens ?? body.max_tokens;
  const stop = parseStop(body.stop);
  if (stop && model.features?.stopSequences !== true) unsupported('stop');
  const tools = parseTools(body.tools, 'chat', model);
  const toolChoice = parseToolChoice(body.tool_choice, 'chat');
  if (toolChoice && !tools?.length) invalid('tool_choice', 'tool_choice requires tools.');
  const selectedTool = toolChoice?.type === 'tool' ? toolChoice.name : undefined;
  if (selectedTool && !tools?.some((tool) => tool.name === selectedTool)) {
    invalid('tool_choice.function.name', 'The selected tool is absent from tools.');
  }
  const parallel = parseParallel(body.parallel_tool_calls, model);
  if (parallel !== undefined && !tools?.length) invalid('parallel_tool_calls', 'parallel_tool_calls requires tools.');
  let includeUsage = false;
  if (body.stream_options !== undefined) {
    if (!stream) invalid('stream_options', 'stream_options requires stream:true.');
    const options = record(body.stream_options, 'stream_options');
    assertAllowedKeys(options, ['include_usage'], 'stream_options');
    includeUsage = options.include_usage === undefined ? false : boolean(options.include_usage, 'stream_options.include_usage');
  }
  const responseFormat = responseFormatFromChat(body.response_format, model);
  const sampling = parseSampling(body, model);
  return {
    requestedModelId,
    stream,
    includeUsage,
    allowParallelToolCalls: tools?.length
      ? parallel ?? model.features?.parallelTools === true
      : false,
    canonical: {
      model: { id: model.id, profile, capabilities: [...model.capabilities] },
      messages: parseChatMessages(body.messages),
      ...(tokenValue !== undefined ? { maxOutputTokens: positiveInteger(tokenValue, body.max_completion_tokens !== undefined ? 'max_completion_tokens' : 'max_tokens') } : {}),
      ...(stop ? { stop } : {}),
      ...(tools ? { tools } : {}),
      ...(toolChoice ? { toolChoice } : {}),
      ...(responseFormat ? { responseFormat } : {}),
      ...(sampling ? { sampling } : {}),
    },
  };
}

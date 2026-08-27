import type {
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

export interface ParsedAnthropicRequest {
  canonical: ModelCommonsRequest;
  requestedModelId: string;
  stream: boolean;
  allowParallelToolCalls?: boolean;
  topK?: number;
}

function hasCapability(model: ProviderModelDescriptor, capability: string): boolean {
  return model.capabilities.includes(capability as ModelCapability);
}

function parseTextBlocks(value: unknown, param: string): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value) || value.length === 0) {
    invalid(param, `${param} must be a string or a non-empty array of text blocks.`);
  }
  return value.map((rawBlock, index) => {
    const blockParam = `${param}[${index}]`;
    const block = record(rawBlock, blockParam);
    assertAllowedKeys(block, ['type', 'text'], blockParam);
    if (block.type !== 'text') unsupported(`${blockParam}.type`, 'Only text system blocks are supported.');
    if (typeof block.text !== 'string') invalid(`${blockParam}.text`, `${blockParam}.text must be a string.`);
    return block.text;
  }).join('\n');
}

function parseToolResultContent(value: unknown, param: string): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) unsupported(param, 'Only string and text-block tool results are supported.');
  return value.map((rawBlock, index) => {
    const blockParam = `${param}[${index}]`;
    const block = record(rawBlock, blockParam);
    assertAllowedKeys(block, ['type', 'text'], blockParam);
    if (block.type !== 'text') unsupported(`${blockParam}.type`, 'Only text tool-result blocks are supported.');
    if (typeof block.text !== 'string') invalid(`${blockParam}.text`, `${blockParam}.text must be a string.`);
    return block.text;
  }).join('\n');
}

function parseMessageContent(value: unknown, param: string, role: string): ModelCommonsContent[] {
  if (typeof value === 'string') return [{ type: 'text', text: value }];
  if (!Array.isArray(value) || value.length === 0) invalid(param, `${param} must be a string or non-empty content array.`);
  return value.map((rawBlock, index): ModelCommonsContent => {
    const blockParam = `${param}[${index}]`;
    const block = record(rawBlock, blockParam);
    const type = nonEmptyString(block.type, `${blockParam}.type`);
    if (type === 'text') {
      assertAllowedKeys(block, ['type', 'text'], blockParam);
      if (typeof block.text !== 'string') invalid(`${blockParam}.text`, `${blockParam}.text must be a string.`);
      return { type: 'text', text: block.text };
    }
    if (type === 'tool_use') {
      if (role !== 'assistant') invalid(blockParam, 'tool_use blocks are only valid in assistant messages.');
      assertAllowedKeys(block, ['type', 'id', 'name', 'input'], blockParam);
      return {
        type: 'tool_call',
        call: {
          id: nonEmptyString(block.id, `${blockParam}.id`),
          name: nonEmptyString(block.name, `${blockParam}.name`),
          arguments: jsonObject(block.input, `${blockParam}.input`),
          rawArguments: JSON.stringify(block.input),
        },
      };
    }
    if (type === 'tool_result') {
      if (role !== 'user') invalid(blockParam, 'tool_result blocks are only valid in user messages.');
      assertAllowedKeys(block, ['type', 'tool_use_id', 'content', 'is_error'], blockParam);
      return {
        type: 'tool_result',
        result: {
          toolCallId: nonEmptyString(block.tool_use_id, `${blockParam}.tool_use_id`),
          content: parseToolResultContent(block.content, `${blockParam}.content`),
          ...(block.is_error === undefined ? {} : { isError: boolean(block.is_error, `${blockParam}.is_error`) }),
        },
      };
    }
    unsupported(`${blockParam}.type`, `Content block type \`${type}\` is not supported.`);
  });
}

function parseMessages(value: unknown): ModelCommonsMessage[] {
  if (!Array.isArray(value) || value.length === 0) invalid('messages', 'messages must be a non-empty array.');
  return value.map((rawMessage, index): ModelCommonsMessage => {
    const param = `messages[${index}]`;
    const message = record(rawMessage, param);
    assertAllowedKeys(message, ['role', 'content'], param);
    const role = nonEmptyString(message.role, `${param}.role`);
    if (role !== 'user' && role !== 'assistant') {
      invalid(`${param}.role`, 'Anthropic messages only accept user and assistant roles; use top-level system.');
    }
    return {
      role,
      content: parseMessageContent(message.content, `${param}.content`, role),
    };
  });
}

function parseTools(value: unknown, model: ProviderModelDescriptor): ToolDefinition[] | undefined {
  if (value === undefined) return undefined;
  if (!hasCapability(model, 'tools') || model.features?.tools === false) {
    unsupported('tools', `Model \`${model.id}\` does not provide tool calling.`);
  }
  if (!Array.isArray(value) || value.length === 0) invalid('tools', 'tools must be a non-empty array.');
  const tools = value.map((rawTool, index): ToolDefinition => {
    const param = `tools[${index}]`;
    const tool = record(rawTool, param);
    assertAllowedKeys(tool, ['name', 'description', 'input_schema', 'strict'], param);
    const schema = jsonObject(tool.input_schema, `${param}.input_schema`);
    if (schema.type !== 'object') invalid(`${param}.input_schema.type`, 'Tool input_schema must have type "object".');
    const strict = tool.strict === undefined ? false : boolean(tool.strict, `${param}.strict`);
    if (strict && model.features?.strictTools !== true) {
      unsupported(`${param}.strict`, 'Strict tool schemas require constrained decoding support.');
    }
    const description = optionalString(tool.description, `${param}.description`);
    return {
      name: nonEmptyString(tool.name, `${param}.name`),
      ...(description !== undefined ? { description } : {}),
      inputSchema: schema,
      ...(strict ? { strict: true } : {}),
    };
  });
  const names = new Set<string>();
  for (const [index, tool] of tools.entries()) {
    if (names.has(tool.name)) invalid(`tools[${index}].name`, 'Tool names must be unique.');
    names.add(tool.name);
  }
  return tools;
}

function parseToolChoice(value: unknown, model: ProviderModelDescriptor): {
  choice?: ToolChoice;
  allowParallel?: boolean;
} {
  if (value === undefined) return {};
  const choice = record(value, 'tool_choice');
  assertAllowedKeys(choice, ['type', 'name', 'disable_parallel_tool_use'], 'tool_choice');
  const type = nonEmptyString(choice.type, 'tool_choice.type');
  let canonical: ToolChoice;
  if (type === 'auto' || type === 'none') canonical = { type };
  else if (type === 'any') canonical = { type: 'required' };
  else if (type === 'tool') canonical = { type: 'tool', name: nonEmptyString(choice.name, 'tool_choice.name') };
  else unsupported('tool_choice.type', `Tool choice \`${type}\` is not supported.`);
  if (type !== 'tool' && choice.name !== undefined) {
    invalid('tool_choice.name', 'tool_choice.name is only valid for type "tool".');
  }
  let allowParallel: boolean | undefined;
  if (choice.disable_parallel_tool_use !== undefined) {
    allowParallel = !boolean(choice.disable_parallel_tool_use, 'tool_choice.disable_parallel_tool_use');
    if (allowParallel && model.features?.parallelTools !== true) {
      unsupported(
        'tool_choice.disable_parallel_tool_use',
        'This model/runtime cannot honor an explicit request to allow parallel tool calls.'
      );
    }
  }
  return { choice: canonical, ...(allowParallel !== undefined ? { allowParallel } : {}) };
}

function parseOutputConfig(value: unknown, model: ProviderModelDescriptor): ResponseFormat | undefined {
  if (value === undefined) return undefined;
  const config = record(value, 'output_config');
  assertAllowedKeys(config, ['format'], 'output_config');
  if (config.format === undefined) return undefined;
  const format = record(config.format, 'output_config.format');
  assertAllowedKeys(format, ['type', 'schema'], 'output_config.format');
  if (format.type !== 'json_schema') unsupported('output_config.format.type');
  if (!hasCapability(model, 'structured-output') || model.features?.jsonSchema !== true) {
    unsupported('output_config.format', 'JSON Schema output requires schema-constrained decoding support.');
  }
  const schema = jsonObject(format.schema, 'output_config.format.schema');
  if (schema.type !== 'object') invalid('output_config.format.schema.type', 'The root output schema must have type "object".');
  return {
    type: 'json_schema',
    name: 'anthropic_output',
    schema,
    strict: true,
    guarantee: 'grammar',
  };
}

function parseStopSequences(value: unknown, model: ProviderModelDescriptor): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || !item)) {
    invalid('stop_sequences', 'stop_sequences must be a non-empty array of non-empty strings.');
  }
  if (model.features?.stopSequences !== true) unsupported('stop_sequences');
  return value as string[];
}

function parseSampling(body: Record<string, unknown>, model: ProviderModelDescriptor): ModelCommonsRequest['sampling'] {
  const sampling: NonNullable<ModelCommonsRequest['sampling']> = {};
  if (body.temperature !== undefined) {
    if (model.features?.temperature !== true) unsupported('temperature');
    const value = finiteNumber(body.temperature, 'temperature');
    if (value < 0 || value > 1) invalid('temperature', 'temperature must be between 0 and 1.');
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

function parseTopK(value: unknown, model: ProviderModelDescriptor): number | undefined {
  if (value === undefined) return undefined;
  if (model.features?.topK !== true) unsupported('top_k');
  return positiveInteger(value, 'top_k');
}

export function parseAnthropicRequest(
  raw: unknown,
  model: ProviderModelDescriptor,
  profile: string | undefined
): ParsedAnthropicRequest {
  const body = record(raw, 'Request body');
  assertAllowedKeys(body, [
    'model', 'max_tokens', 'messages', 'system', 'stream', 'stop_sequences', 'tools', 'tool_choice',
    'output_config', 'temperature', 'top_p', 'top_k',
  ]);
  if (!hasCapability(model, 'text')) unsupported('model', `Model \`${model.id}\` does not provide text generation.`);
  const requestedModelId = nonEmptyString(body.model, 'model');
  const stream = body.stream === undefined ? false : boolean(body.stream, 'stream');
  if (stream && model.features?.streaming !== true) unsupported('stream');
  const tools = parseTools(body.tools, model);
  const toolChoice = parseToolChoice(body.tool_choice, model);
  if (toolChoice.choice && !tools?.length) invalid('tool_choice', 'tool_choice requires tools.');
  const selectedTool = toolChoice.choice?.type === 'tool' ? toolChoice.choice.name : undefined;
  if (selectedTool && !tools?.some((tool) => tool.name === selectedTool)) {
    invalid('tool_choice.name', 'The selected tool is absent from tools.');
  }
  const instructions = body.system === undefined ? undefined : parseTextBlocks(body.system, 'system');
  const responseFormat = parseOutputConfig(body.output_config, model);
  const sampling = parseSampling(body, model);
  const stop = parseStopSequences(body.stop_sequences, model);
  const topK = parseTopK(body.top_k, model);
  return {
    requestedModelId,
    stream,
    allowParallelToolCalls: tools?.length
      ? toolChoice.allowParallel ?? (model.features?.parallelTools === true)
      : false,
    ...(topK !== undefined ? { topK } : {}),
    canonical: {
      model: { id: model.id, profile, capabilities: [...model.capabilities] },
      messages: parseMessages(body.messages),
      maxOutputTokens: positiveInteger(body.max_tokens, 'max_tokens'),
      ...(instructions !== undefined ? { instructions } : {}),
      ...(tools ? { tools } : {}),
      ...(toolChoice.choice ? { toolChoice: toolChoice.choice } : {}),
      ...(responseFormat ? { responseFormat } : {}),
      ...(sampling ? { sampling } : {}),
      ...(stop ? { stop } : {}),
    },
  };
}

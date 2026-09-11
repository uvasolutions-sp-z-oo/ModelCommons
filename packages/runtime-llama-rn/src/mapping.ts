import {
  ModelCommonsError,
  messageText,
  type JsonObject,
  type ModelCommonsContent,
  type ModelCommonsMessage,
  type ModelCommonsRequest,
  type ModelCommonsStopReason,
  type ResponseFormat,
  type RuntimeProfile,
  type ToolCall,
} from '@modelcommons/protocol';
import type {
  CompletionParams,
  CompletionResponseFormat,
  NativeCompletionResult,
  RNLlamaOAICompatibleMessage,
} from 'llama.rn';
import type { LlamaRnContext, LlamaRnReportedCapabilities } from './types';
import { LLAMA_CPP_BUILD, LLAMA_RN_RUNTIME_ID, LLAMA_RN_VERSION } from './types';
import { llamaModelLocation } from './initialization';

type ExtendedLlamaMessage = RNLlamaOAICompatibleMessage & {
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
};

function parseArguments(value: string): JsonObject {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as JsonObject;
    }
  } catch {
    // Preserve malformed arguments for the client instead of inventing an object.
  }
  return {};
}

function toolCallId(id: string | undefined, index: number): string {
  return id?.trim() || `call_${index}`;
}

function messageToLlama(message: ModelCommonsMessage): ExtendedLlamaMessage {
  const text = messageText(message);
  const toolResults = message.content.filter((part) => part.type === 'tool_result');
  const toolCalls = message.content.filter((part) => part.type === 'tool_call');
  const unsupported = message.content.filter(
    (part) => part.type === 'image' || part.type === 'audio'
  );

  if (unsupported.length) {
    throw new ModelCommonsError(
      'FEATURE_UNSUPPORTED',
      'This llama.rn adapter has not initialized a multimodal projector; image and audio input are unavailable.'
    );
  }

  if (toolResults.length) {
    if (toolResults.length !== 1 || message.content.length !== 1) {
      throw new ModelCommonsError(
        'FEATURE_UNSUPPORTED',
        'Each canonical tool-result message must contain exactly one tool result and no sibling text.'
      );
    }
    const result = toolResults[0].result;
    return {
      role: 'tool',
      tool_call_id: result.toolCallId,
      content: typeof result.content === 'string' ? result.content : JSON.stringify(result.content),
    };
  }

  const mapped: ExtendedLlamaMessage = {
    role: message.role === 'developer' ? 'system' : message.role,
    content: text,
  };
  if (toolCalls.length) {
    mapped.tool_calls = toolCalls.map((part) => ({
      id: part.call.id,
      type: 'function',
      function: {
        name: part.call.name,
        arguments: part.call.rawArguments ?? JSON.stringify(part.call.arguments),
      },
    }));
  }
  return mapped;
}

function fallbackTranscript(request: ModelCommonsRequest): string {
  const blocks: string[] = [];
  if (request.instructions?.trim()) blocks.push(`[instructions]\n${request.instructions.trim()}`);
  for (const message of request.messages) {
    if (message.content.some((part) => part.type !== 'text')) {
      throw new ModelCommonsError(
        'CAPABILITY_UNAVAILABLE',
        'Tool and multimodal messages require a supported Jinja chat template.'
      );
    }
    blocks.push(`[${message.role}]\n${messageText(message)}`);
  }
  blocks.push('[assistant]\n');
  return blocks.join('\n\n');
}

function mapResponseFormat(format: ResponseFormat | undefined): CompletionResponseFormat | undefined {
  if (!format || format.type === 'text') return undefined;
  if (format.guarantee !== 'grammar') {
    throw new ModelCommonsError(
      'FEATURE_UNSUPPORTED',
      'llama.rn structured output is exposed only as grammar-constrained output.'
    );
  }
  if (format.type === 'json_object') return { type: 'json_object', schema: {} };
  return {
    type: 'json_schema',
    json_schema: { strict: format.strict, schema: format.schema },
  };
}

export function reportCapabilities(context: LlamaRnContext): LlamaRnReportedCapabilities {
  const templates = context.model.chatTemplates;
  const jinja = templates.jinja;
  const selectedCaps = jinja.toolUse ? jinja.toolUseCaps : jinja.defaultCaps;
  const jinjaSupported = context.isJinjaSupported();
  const llamaChatSupported = context.isLlamaChatSupported();
  return {
    runtimeId: LLAMA_RN_RUNTIME_ID,
    runtimeVersion: LLAMA_RN_VERSION,
    llamaCppBuild: LLAMA_CPP_BUILD,
    text: true,
    streaming: true,
    cancellation: true,
    tools: !!(jinjaSupported && selectedCaps?.tools && selectedCaps?.toolCalls),
    parallelToolCalls: !!(
      jinjaSupported &&
      selectedCaps?.tools &&
      selectedCaps?.toolCalls &&
      selectedCaps?.parallelToolCalls
    ),
    structuredOutput: jinjaSupported || llamaChatSupported ? 'grammar' : 'none',
    // Legacy llama-chat exposes template availability, not a system-role capability bit.
    systemRole: !!(jinjaSupported && selectedCaps?.systemRole),
    chatTemplate: jinjaSupported
      ? 'jinja'
      : llamaChatSupported
        ? 'llama-chat'
        : 'fallback-transcript',
    accelerator: {
      active: context.gpu,
      devices: context.devices ?? [],
      ...(context.androidLib ? { androidLibrary: context.androidLib } : {}),
      ...(!context.gpu && context.reasonNoGPU ? { reasonInactive: context.reasonNoGPU } : {}),
    },
    model: {
      description: context.model.desc,
      parameterCount: context.model.nParams,
      sizeBytes: context.model.size,
      recurrent: context.model.is_recurrent,
      hybrid: context.model.is_hybrid,
    },
  };
}

export function contextParams(modelUri: string, profile: RuntimeProfile): Parameters<
  typeof import('llama.rn')['initLlama']
>[0] {
  const llama = profile.llama;
  const model = llamaModelLocation(modelUri);
  if (
    !Number.isInteger(llama.nCtx) ||
    !Number.isInteger(llama.nBatch) ||
    !Number.isInteger(llama.nUbatch) ||
    llama.nCtx <= 0 ||
    llama.nBatch <= 0 ||
    llama.nUbatch <= 0
  ) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'llama runtime dimensions must be positive.');
  }
  if (llama.nUbatch > llama.nBatch) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'nUbatch cannot exceed nBatch.');
  }
  return {
    model,
    n_ctx: llama.nCtx,
    n_batch: llama.nBatch,
    n_ubatch: llama.nUbatch,
    n_parallel: 1,
    n_gpu_layers: llama.nGpuLayers,
    n_cpu_moe: llama.nCpuMoe,
    use_mmap: llama.useMmap,
    use_mlock: llama.useMlock,
    cache_type_k: llama.cacheTypeK,
    cache_type_v: llama.cacheTypeV,
    no_extra_bufts: llama.noExtraBuffers,
    devices: llama.devices,
    ctx_shift: true,
    kv_unified: true,
  };
}

export function completionParams(
  request: ModelCommonsRequest,
  capabilities: LlamaRnReportedCapabilities
): CompletionParams {
  const hasTools = !!request.tools?.length;
  const hasToolHistory = request.messages.some((message) =>
    message.content.some((part) => part.type === 'tool_call' || part.type === 'tool_result')
  );
  if ((hasTools || hasToolHistory) && !capabilities.tools) {
    throw new ModelCommonsError(
      'CAPABILITY_UNAVAILABLE',
      'The loaded model chat template does not report both tool-input and tool-call support.'
    );
  }
  if (request.responseFormat && request.responseFormat.type !== 'text' && capabilities.structuredOutput !== 'grammar') {
    throw new ModelCommonsError(
      'CAPABILITY_UNAVAILABLE',
      'The loaded model does not expose a chat template usable with grammar-constrained output.'
    );
  }
  const hasPrivilegedRole = !!request.instructions?.trim() || request.messages.some(
    (message) => message.role === 'system' || message.role === 'developer'
  );
  if (hasPrivilegedRole && capabilities.chatTemplate !== 'fallback-transcript' && !capabilities.systemRole) {
    throw new ModelCommonsError(
      'CAPABILITY_UNAVAILABLE',
      'The loaded chat template reports that it cannot represent a system role.'
    );
  }

  const params: CompletionParams = {
    n_predict: request.maxOutputTokens ?? 384,
    temperature: request.sampling?.temperature,
    top_p: request.sampling?.topP,
    stop: request.stop,
    response_format: mapResponseFormat(request.responseFormat),
    enable_thinking: false,
    reasoning_format: 'none',
  };

  if (capabilities.chatTemplate === 'fallback-transcript') {
    params.prompt = fallbackTranscript(request);
    return params;
  }

  const messages: ExtendedLlamaMessage[] = request.messages.map(messageToLlama);
  if (request.instructions?.trim()) {
    messages.unshift({ role: 'system', content: request.instructions.trim() });
  }
  params.messages = messages;

  if (hasTools) {
    let tools = request.tools!;
    let toolChoice = request.toolChoice?.type ?? 'auto';
    const requestedToolChoice = request.toolChoice;
    if (requestedToolChoice?.type === 'tool') {
      const selected = tools.find((tool) => tool.name === requestedToolChoice.name);
      if (!selected) {
        throw new ModelCommonsError('INTEGRITY_FAILED', 'Named tool choice is absent from tools.');
      }
      tools = [selected];
      toolChoice = 'required';
    }
    params.tools = tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
    params.tool_choice = toolChoice;
  }
  return params;
}

export function resultContent(result: NativeCompletionResult): ModelCommonsContent[] {
  const content: ModelCommonsContent[] = [];
  if (result.content) content.push({ type: 'text', text: result.content });
  for (const [index, nativeCall] of (result.tool_calls ?? []).entries()) {
    const rawArguments = nativeCall.function.arguments;
    content.push({
      type: 'tool_call',
      call: {
        id: toolCallId(nativeCall.id, index),
        name: nativeCall.function.name,
        arguments: parseArguments(rawArguments),
        rawArguments,
      },
    });
  }
  return content;
}

export function resultStopReason(result: NativeCompletionResult): ModelCommonsStopReason {
  if (result.interrupted) return 'cancelled';
  if (result.tool_calls?.length) return 'tool_call';
  if (result.context_full || result.truncated || result.stopped_limit > 0) return 'length';
  return 'stop';
}

export function resultToolCalls(result: NativeCompletionResult): ToolCall[] {
  return (result.tool_calls ?? []).map((nativeCall, index) => ({
    id: toolCallId(nativeCall.id, index),
    name: nativeCall.function.name,
    arguments: parseArguments(nativeCall.function.arguments),
    rawArguments: nativeCall.function.arguments,
  }));
}

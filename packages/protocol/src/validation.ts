import { ModelCommonsError } from './errors';
import { MODEL_CAPABILITIES, type ModelCapability, type ModelCommonsRequest } from './inference';
import type { ClientConfiguration } from './client-config';
import type { ModelManifest, ModelRegistry } from './model';
import { assertHttpsUrl, assertSafeRelativePath, assertSafeStorageId } from './path';
import { isProtocolVersionCompatible } from './version';

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ModelCommonsError('INTEGRITY_FAILED', `${label} must be an object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new ModelCommonsError('INTEGRITY_FAILED', `${label} must be a plain object.`);
  }
  return value as Record<string, unknown>;
}

function assertKnownKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const supported = new Set(allowed);
  const unknown = Object.keys(value).find((key) => !supported.has(key));
  if (unknown) {
    throw new ModelCommonsError('FEATURE_UNSUPPORTED', `${label}.${unknown} is unsupported.`);
  }
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ModelCommonsError('INTEGRITY_FAILED', `${label} must be a non-empty string.`);
  }
  return value;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new ModelCommonsError('INTEGRITY_FAILED', `${label} must be a positive integer.`);
  }
  return Number(value);
}

function optionalPositiveNumber(value: unknown, label: string): void {
  if (value !== undefined && (!Number.isFinite(value) || Number(value) <= 0)) {
    throw new ModelCommonsError('INTEGRITY_FAILED', `${label} must be a positive finite number.`);
  }
}

function positiveNumber(value: unknown, label: string): number {
  if (!Number.isFinite(value) || Number(value) <= 0) {
    throw new ModelCommonsError('INTEGRITY_FAILED', `${label} must be a positive finite number.`);
  }
  return Number(value);
}

function stringArray(value: unknown, label: string, allowEmpty = true): string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new ModelCommonsError('INTEGRITY_FAILED', `${label} must be an array${allowEmpty ? '' : ' with at least one item'}.`);
  }
  return value.map((item, index) => requiredString(item, `${label}[${index}]`));
}

function validateAliases(value: unknown, label: string): void {
  const aliases = record(value, label);
  for (const [alias, rawTarget] of Object.entries(aliases)) {
    requiredString(alias, `${label} key`);
    if (alias === '__proto__' || alias === 'prototype' || alias === 'constructor') {
      throw new ModelCommonsError('INTEGRITY_FAILED', `${label} contains a reserved key.`);
    }
    const target = record(rawTarget, `${label}.${alias}`);
    requiredString(target.modelId, `${label}.${alias}.modelId`);
    if (target.profile !== undefined) requiredString(target.profile, `${label}.${alias}.profile`);
  }
}

function validateCapabilities(value: unknown, label: string): ModelCapability[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => !MODEL_CAPABILITIES.includes(item as ModelCapability))) {
    throw new ModelCommonsError('INTEGRITY_FAILED', `${label} contains an unknown capability.`);
  }
  if (new Set(value).size !== value.length) {
    throw new ModelCommonsError('INTEGRITY_FAILED', `${label} must not contain duplicates.`);
  }
  return value as ModelCapability[];
}

function assertJsonValue(value: unknown, label: string, seen = new WeakSet<object>(), depth = 0): void {
  if (depth > 64) throw new ModelCommonsError('INTEGRITY_FAILED', `${label} exceeds the JSON nesting limit.`);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return;
    throw new ModelCommonsError('INTEGRITY_FAILED', `${label} contains a non-finite number.`);
  }
  if (!value || typeof value !== 'object') {
    throw new ModelCommonsError('INTEGRITY_FAILED', `${label} must contain JSON values only.`);
  }
  if (seen.has(value)) throw new ModelCommonsError('INTEGRITY_FAILED', `${label} must not contain cycles.`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${label}[${index}]`, seen, depth + 1));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new ModelCommonsError('INTEGRITY_FAILED', `${label} must use plain JSON objects.`);
    }
    for (const [key, item] of Object.entries(value)) {
      assertJsonValue(item, `${label}.${key}`, seen, depth + 1);
    }
  }
  seen.delete(value);
}

const MODEL_STATES = new Set(['NOT_INSTALLED', 'DOWNLOADING', 'VERIFYING', 'READY', 'FAILED']);
const TRANSPORTS = new Set(['hub-service', 'app-group', 'shared-file', 'local-runtime', 'system']);

export function parseModelManifest(value: unknown): ModelManifest {
  const candidate = record(value, 'Model manifest');
  if (candidate.schema !== 'modelcommons.model-manifest' || candidate.schemaVersion !== 1) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Unsupported model manifest schema.');
  }

  const protocolVersion = requiredString(candidate.protocolVersion, 'protocolVersion');
  if (!isProtocolVersionCompatible(protocolVersion)) {
    throw new ModelCommonsError('PROTOCOL_VERSION_UNSUPPORTED', 'Model manifest protocol version is unsupported.', {
      details: { protocolVersion },
    });
  }

  requiredString(candidate.id, 'id');
  requiredString(candidate.revision, 'revision');
  assertSafeStorageId(requiredString(candidate.storageId, 'storageId'));
  requiredString(candidate.displayName, 'displayName');
  requiredString(candidate.family, 'family');
  validateCapabilities(candidate.capabilities, 'capabilities');
  if (candidate.format !== 'gguf') {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Only GGUF manifests are supported by schema version 1.');
  }
  if (candidate.quantization !== undefined) requiredString(candidate.quantization, 'quantization');

  const architecture = record(candidate.architecture, 'architecture');
  if (architecture.type !== 'dense' && architecture.type !== 'moe') {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Model architecture type is unsupported.');
  }
  if (architecture.type === 'moe') {
    const parameters = record(architecture.parametersBillions, 'architecture.parametersBillions');
    positiveNumber(parameters.total, 'architecture.parametersBillions.total');
    positiveNumber(parameters.activeApprox, 'architecture.parametersBillions.activeApprox');
    if (Number(parameters.activeApprox) > Number(parameters.total)) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'Active MoE parameters cannot exceed total parameters.');
    }
    if (architecture.experts !== undefined) {
      const experts = record(architecture.experts, 'architecture.experts');
      const count = positiveInteger(experts.count, 'architecture.experts.count');
      const active = positiveInteger(experts.activePerToken, 'architecture.experts.activePerToken');
      if (active > count) {
        throw new ModelCommonsError('INTEGRITY_FAILED', 'Active experts per token cannot exceed expert count.');
      }
    }
  } else {
    optionalPositiveNumber(architecture.parametersBillions, 'architecture.parametersBillions');
  }

  if (!Array.isArray(candidate.files) || candidate.files.length === 0) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Model manifest must contain at least one artifact.');
  }
  const artifactPaths = new Set<string>();
  const artifactRoles = new Set(['model', 'mmproj', 'tokenizer', 'license', 'model-card', 'other']);
  for (const item of candidate.files) {
    const file = record(item, 'Artifact');
    if (!artifactRoles.has(String(file.role))) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'Artifact role is unsupported.');
    }
    if (typeof file.required !== 'boolean') {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'artifact.required must be a boolean.');
    }
    const path = assertSafeRelativePath(requiredString(file.path, 'artifact.path'));
    const foldedPath = path.toLowerCase();
    if (artifactPaths.has(foldedPath)) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'Artifact paths must be unique.');
    }
    artifactPaths.add(foldedPath);
    if (file.sizeBytes !== undefined) positiveInteger(file.sizeBytes, 'artifact.sizeBytes');
    if (file.download !== undefined) {
      const download = record(file.download, 'artifact.download');
      assertHttpsUrl(requiredString(download.url, 'artifact.download.url'));
    }
    if (file.integrity !== undefined) {
      const integrity = record(file.integrity, 'artifact.integrity');
      if (integrity.algorithm !== 'sha256' || !/^[a-fA-F\d]{64}$/.test(String(integrity.digest))) {
        throw new ModelCommonsError('INTEGRITY_FAILED', 'Artifact SHA-256 metadata is invalid.');
      }
    }
  }
  const primaryModels = candidate.files.filter((item) => {
    const file = item as Record<string, unknown>;
    return file.role === 'model';
  });
  if (primaryModels.length !== 1 || (primaryModels[0] as Record<string, unknown>).required !== true) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Exactly one required primary model artifact is required.');
  }
  if (candidate.files.filter((item) => (item as Record<string, unknown>).role === 'mmproj').length > 1) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'At most one multimodal projector artifact is supported.');
  }

  const source = record(candidate.source, 'source');
  if (!['huggingface', 'url', 'user'].includes(String(source.provider))) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Model source provider is unsupported.');
  }
  if (source.modelCardUrl !== undefined) {
    assertHttpsUrl(requiredString(source.modelCardUrl, 'source.modelCardUrl'));
  }
  if (source.repository !== undefined) requiredString(source.repository, 'source.repository');
  if (source.revision !== undefined) requiredString(source.revision, 'source.revision');
  const license = record(candidate.license, 'license');
  requiredString(license.id, 'license.id');
  assertHttpsUrl(requiredString(license.url, 'license.url'));
  if (license.name !== undefined) requiredString(license.name, 'license.name');
  if (typeof license.acceptanceRequired !== 'boolean' || typeof license.gated !== 'boolean') {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'License acceptanceRequired and gated must be booleans.');
  }
  if (license.redistribution !== undefined && !['allowed', 'restricted', 'unknown'].includes(String(license.redistribution))) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'License redistribution metadata is invalid.');
  }

  if (!Array.isArray(candidate.compatibleRuntimes) || candidate.compatibleRuntimes.length === 0) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'At least one compatible runtime is required.');
  }
  for (const [index, rawRuntime] of candidate.compatibleRuntimes.entries()) {
    const runtime = record(rawRuntime, `compatibleRuntimes[${index}]`);
    requiredString(runtime.id, `compatibleRuntimes[${index}].id`);
    if (runtime.minimumVersion !== undefined) requiredString(runtime.minimumVersion, `compatibleRuntimes[${index}].minimumVersion`);
  }
  const context = record(candidate.context, 'context');
  const recommendedContext = positiveInteger(context.recommended, 'context.recommended');
  if (context.trained !== undefined) positiveInteger(context.trained, 'context.trained');
  if (context.maximum !== undefined && positiveInteger(context.maximum, 'context.maximum') < recommendedContext) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Maximum context cannot be below recommended context.');
  }
  if (candidate.memory !== undefined) {
    const memory = record(candidate.memory, 'memory');
    optionalPositiveNumber(memory.fileBytes, 'memory.fileBytes');
    optionalPositiveNumber(memory.estimatedMinimumRamBytes, 'memory.estimatedMinimumRamBytes');
    optionalPositiveNumber(memory.recommendedRamBytes, 'memory.recommendedRamBytes');
    if (
      memory.estimatedMinimumRamBytes !== undefined
      && memory.recommendedRamBytes !== undefined
      && Number(memory.recommendedRamBytes) < Number(memory.estimatedMinimumRamBytes)
    ) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'Recommended RAM cannot be below estimated minimum RAM.');
    }
    const requiredFiles = candidate.files
      .map((item) => item as Record<string, unknown>)
      .filter((file) => file.required === true);
    if (memory.fileBytes !== undefined && requiredFiles.every((file) => file.sizeBytes !== undefined)) {
      const requiredBytes = requiredFiles.reduce((total, file) => total + Number(file.sizeBytes), 0);
      if (Number(memory.fileBytes) !== requiredBytes) {
        throw new ModelCommonsError('INTEGRITY_FAILED', 'memory.fileBytes must equal the required artifact-size sum.');
      }
    }
    if (memory.notes !== undefined) stringArray(memory.notes, 'memory.notes');
  }
  if (candidate.recommendedProfiles !== undefined) stringArray(candidate.recommendedProfiles, 'recommendedProfiles', false);
  if (candidate.experimental !== undefined && typeof candidate.experimental !== 'boolean') {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'experimental must be a boolean.');
  }

  return candidate as unknown as ModelManifest;
}

export function parseModelRegistry(value: unknown): ModelRegistry {
  const candidate = record(value, 'Model registry');
  if (candidate.schema !== 'modelcommons.registry' || candidate.schemaVersion !== 1) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Unsupported model registry schema.');
  }
  const protocolVersion = requiredString(candidate.protocolVersion, 'protocolVersion');
  if (!isProtocolVersionCompatible(protocolVersion)) {
    throw new ModelCommonsError('PROTOCOL_VERSION_UNSUPPORTED', 'Registry protocol version is unsupported.');
  }
  if (!Number.isSafeInteger(candidate.revision) || Number(candidate.revision) < 0) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Registry revision is invalid.');
  }
  if (!Number.isFinite(candidate.updatedAt) || Number(candidate.updatedAt) < 0) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Registry updatedAt is invalid.');
  }
  if (!Array.isArray(candidate.models)) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Registry models must be an array.');
  }
  const modelIds = new Set<string>();
  for (const entry of candidate.models) {
    const model = record(entry, 'Registry model');
    const manifest = parseModelManifest(model.manifest);
    if (modelIds.has(manifest.id)) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'Registry model IDs must be unique.');
    }
    modelIds.add(manifest.id);
    if (!MODEL_STATES.has(String(model.state))) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'Registry model state is invalid.');
    }
    if (model.relativeManifestPath !== undefined) {
      assertSafeRelativePath(requiredString(model.relativeManifestPath, 'relativeManifestPath'));
    }
    optionalPositiveNumber(model.installedAt, 'installedAt');
    optionalPositiveNumber(model.readyAt, 'readyAt');
    if (model.failureCode !== undefined) requiredString(model.failureCode, 'failureCode');
  }
  validateAliases(candidate.aliases, 'aliases');
  if (!Array.isArray(candidate.licenseAcceptances)) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Registry licenseAcceptances must be an array.');
  }
  for (const acceptance of candidate.licenseAcceptances) {
    const entry = record(acceptance, 'licenseAcceptance');
    requiredString(entry.modelId, 'licenseAcceptance.modelId');
    requiredString(entry.modelRevision, 'licenseAcceptance.modelRevision');
    requiredString(entry.licenseId, 'licenseAcceptance.licenseId');
    assertHttpsUrl(requiredString(entry.licenseUrl, 'licenseAcceptance.licenseUrl'));
    if (!Number.isFinite(entry.acceptedAt) || Number(entry.acceptedAt) <= 0) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'License acceptance timestamp is invalid.');
    }
  }
  return candidate as unknown as ModelRegistry;
}

export function parseClientConfiguration(value: unknown): ClientConfiguration {
  const candidate = record(value, 'Client configuration');
  if (candidate.schema !== 'modelcommons.client-config' || candidate.schemaVersion !== 1) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Unsupported client configuration schema.');
  }
  const protocolVersion = requiredString(candidate.protocolVersion, 'protocolVersion');
  if (!isProtocolVersionCompatible(protocolVersion)) {
    throw new ModelCommonsError('PROTOCOL_VERSION_UNSUPPORTED', 'Client protocol version is unsupported.');
  }
  const client = record(candidate.client, 'client');
  requiredString(client.id, 'client.id');
  requiredString(client.displayName, 'client.displayName');
  const requirements = record(candidate.requirements, 'requirements');
  validateCapabilities(requirements.capabilities, 'requirements.capabilities');
  if (requirements.formats !== undefined) stringArray(requirements.formats, 'requirements.formats');
  if (requirements.runtimes !== undefined) stringArray(requirements.runtimes, 'requirements.runtimes');
  if (requirements.minimumContext !== undefined) positiveInteger(requirements.minimumContext, 'requirements.minimumContext');
  validateAliases(candidate.aliases, 'aliases');
  const selection = record(candidate.selection, 'selection');
  if (selection.preferredModelId !== undefined) {
    requiredString(selection.preferredModelId, 'selection.preferredModelId');
  }
  if (selection.fallback !== 'best-compatible' && selection.fallback !== 'unavailable') {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Client selection fallback is invalid.');
  }
  const inference = record(candidate.inference, 'inference');
  requiredString(inference.profile, 'inference.profile');
  if (inference.context !== undefined) positiveInteger(inference.context, 'inference.context');
  if (inference.maxOutput !== undefined) positiveInteger(inference.maxOutput, 'inference.maxOutput');
  const access = record(candidate.access, 'access');
  if (!Array.isArray(access.transports) || access.transports.length === 0 || access.transports.some((item) => !TRANSPORTS.has(String(item)))) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Client transport preference is invalid.');
  }
  if (new Set(access.transports).size !== access.transports.length) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Client transport preferences must be unique.');
  }
  return candidate as unknown as ClientConfiguration;
}

function parseCanonicalStructure(value: unknown): ModelCommonsRequest {
  const candidate = record(value, 'Canonical request');
  assertKnownKeys(candidate, [
    'id', 'model', 'instructions', 'messages', 'tools', 'toolChoice', 'responseFormat',
    'maxOutputTokens', 'sampling', 'stop', 'metadata',
  ], 'request');

  const model = record(candidate.model, 'model');
  assertKnownKeys(model, ['id', 'capabilities', 'profile'], 'model');
  if (!Array.isArray(model.capabilities)) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'model.capabilities must be an array.');
  }
  if (!Array.isArray(candidate.messages)) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'messages must be an array.');
  }
  for (const [messageIndex, rawMessage] of candidate.messages.entries()) {
    const message = record(rawMessage, `messages[${messageIndex}]`);
    assertKnownKeys(message, ['id', 'role', 'content'], `messages[${messageIndex}]`);
    if (!Array.isArray(message.content) || message.content.length === 0) {
      throw new ModelCommonsError('INTEGRITY_FAILED', `messages[${messageIndex}].content must be a non-empty array.`);
    }
    for (const [contentIndex, rawContent] of message.content.entries()) {
      const label = `messages[${messageIndex}].content[${contentIndex}]`;
      const content = record(rawContent, label);
      if (content.type === 'text') {
        assertKnownKeys(content, ['type', 'text'], label);
      } else if (content.type === 'image') {
        assertKnownKeys(content, ['type', 'uri', 'mediaType', 'detail'], label);
        if (content.detail !== undefined && !['auto', 'low', 'high'].includes(String(content.detail))) {
          throw new ModelCommonsError('INTEGRITY_FAILED', `${label}.detail is invalid.`);
        }
      } else if (content.type === 'audio') {
        assertKnownKeys(content, ['type', 'uri', 'data', 'mediaType'], label);
      } else if (content.type === 'tool_call') {
        assertKnownKeys(content, ['type', 'call'], label);
        const call = record(content.call, `${label}.call`);
        assertKnownKeys(call, ['id', 'name', 'arguments', 'rawArguments'], `${label}.call`);
        record(call.arguments, `${label}.call.arguments`);
      } else if (content.type === 'tool_result') {
        assertKnownKeys(content, ['type', 'result'], label);
        const result = record(content.result, `${label}.result`);
        assertKnownKeys(result, ['toolCallId', 'content', 'isError'], `${label}.result`);
      } else {
        throw new ModelCommonsError('FEATURE_UNSUPPORTED', `${label}.type is unsupported.`);
      }
    }
  }

  if (candidate.tools !== undefined) {
    if (!Array.isArray(candidate.tools)) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'tools must be an array.');
    }
    for (const [index, rawTool] of candidate.tools.entries()) {
      const tool = record(rawTool, `tools[${index}]`);
      assertKnownKeys(tool, ['name', 'description', 'inputSchema', 'strict'], `tools[${index}]`);
      record(tool.inputSchema, `tools[${index}].inputSchema`);
    }
  }
  if (candidate.toolChoice !== undefined) {
    const choice = record(candidate.toolChoice, 'toolChoice');
    assertKnownKeys(choice, ['type', 'name'], 'toolChoice');
    if (choice.type !== 'tool' && choice.name !== undefined) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'toolChoice.name is valid only for a named tool choice.');
    }
    if (choice.type === 'tool') requiredString(choice.name, 'toolChoice.name');
  }
  if (candidate.responseFormat !== undefined) {
    const format = record(candidate.responseFormat, 'responseFormat');
    if (format.type === 'text') {
      assertKnownKeys(format, ['type'], 'responseFormat');
    } else if (format.type === 'json_object') {
      assertKnownKeys(format, ['type', 'guarantee'], 'responseFormat');
    } else if (format.type === 'json_schema') {
      assertKnownKeys(format, ['type', 'name', 'schema', 'strict', 'guarantee', 'description'], 'responseFormat');
      record(format.schema, 'responseFormat.schema');
      if (format.description !== undefined && typeof format.description !== 'string') {
        throw new ModelCommonsError('INTEGRITY_FAILED', 'responseFormat.description must be a string.');
      }
    } else {
      throw new ModelCommonsError('FEATURE_UNSUPPORTED', 'responseFormat type is unsupported.');
    }
  }
  if (candidate.sampling !== undefined) {
    const sampling = record(candidate.sampling, 'sampling');
    assertKnownKeys(sampling, ['temperature', 'topP'], 'sampling');
  }
  if (candidate.metadata !== undefined) record(candidate.metadata, 'metadata');

  return candidate as unknown as ModelCommonsRequest;
}

export function validateCanonicalRequest(value: unknown): ModelCommonsRequest {
  return validateCanonicalRequestTrusted(parseCanonicalStructure(value));
}

function validateCanonicalRequestTrusted(value: ModelCommonsRequest): ModelCommonsRequest {
  if (!value || !value.model || !Array.isArray(value.messages)) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Canonical inference request is invalid.');
  }
  if (value.id !== undefined) requiredString(value.id, 'id');
  if (value.model.id !== undefined) requiredString(value.model.id, 'model.id');
  if (value.model.profile !== undefined) requiredString(value.model.profile, 'model.profile');
  if (value.instructions !== undefined && typeof value.instructions !== 'string') {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'instructions must be a string.');
  }
  validateCapabilities(value.model.capabilities, 'model.capabilities');
  for (const [messageIndex, message] of value.messages.entries()) {
    if (!['system', 'developer', 'user', 'assistant'].includes(message.role) || !Array.isArray(message.content)) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'Canonical message is invalid.');
    }
    if (message.id !== undefined) requiredString(message.id, `messages[${messageIndex}].id`);
    for (const [contentIndex, content] of message.content.entries()) {
      if (!['text', 'image', 'audio', 'tool_call', 'tool_result'].includes(content.type)) {
        throw new ModelCommonsError('FEATURE_UNSUPPORTED', 'Canonical content type is unsupported.');
      }
      const label = `messages[${messageIndex}].content[${contentIndex}]`;
      if (content.type === 'text' && typeof content.text !== 'string') {
        throw new ModelCommonsError('INTEGRITY_FAILED', `${label}.text must be a string.`);
      }
      if (content.type === 'image') {
        requiredString(content.uri, `${label}.uri`);
        if (content.mediaType !== undefined) requiredString(content.mediaType, `${label}.mediaType`);
      }
      if (content.type === 'audio') {
        requiredString(content.mediaType, `${label}.mediaType`);
        if ((content.uri === undefined) === (content.data === undefined)) {
          throw new ModelCommonsError('INTEGRITY_FAILED', `${label} must contain exactly one of uri or data.`);
        }
        if (content.uri !== undefined) requiredString(content.uri, `${label}.uri`);
        if (content.data !== undefined) requiredString(content.data, `${label}.data`);
      }
      if (content.type === 'tool_call') {
        requiredString(content.call.id, `${label}.call.id`);
        requiredString(content.call.name, `${label}.call.name`);
        assertJsonValue(content.call.arguments, `${label}.call.arguments`);
        if (content.call.rawArguments !== undefined) requiredString(content.call.rawArguments, `${label}.call.rawArguments`);
      }
      if (content.type === 'tool_result') {
        requiredString(content.result.toolCallId, `${label}.result.toolCallId`);
        if (typeof content.result.content !== 'string') {
          assertJsonValue(content.result.content, `${label}.result.content`);
        }
        if (content.result.isError !== undefined && typeof content.result.isError !== 'boolean') {
          throw new ModelCommonsError('INTEGRITY_FAILED', `${label}.result.isError must be a boolean.`);
        }
      }
    }
  }
  if (value.tools) {
    if (value.tools.length === 0) throw new ModelCommonsError('INTEGRITY_FAILED', 'tools must not be empty when supplied.');
    const names = new Set<string>();
    for (const tool of value.tools) {
      requiredString(tool.name, 'tool.name');
      if (names.has(tool.name)) throw new ModelCommonsError('INTEGRITY_FAILED', 'Tool names must be unique.');
      names.add(tool.name);
      if (tool.description !== undefined && typeof tool.description !== 'string') {
        throw new ModelCommonsError('INTEGRITY_FAILED', 'tool.description must be a string.');
      }
      if (!tool.inputSchema || typeof tool.inputSchema !== 'object' || Array.isArray(tool.inputSchema)) {
        throw new ModelCommonsError('INTEGRITY_FAILED', 'Tool input schema must be an object.');
      }
      assertJsonValue(tool.inputSchema, `tools.${tool.name}.inputSchema`);
      if (tool.strict !== undefined && typeof tool.strict !== 'boolean') {
        throw new ModelCommonsError('INTEGRITY_FAILED', 'tool.strict must be a boolean.');
      }
    }
  }
  if (value.toolChoice) {
    if (!['auto', 'none', 'required', 'tool'].includes(value.toolChoice.type)) {
      throw new ModelCommonsError('INTEGRITY_FAILED', 'toolChoice type is invalid.');
    }
    if (!value.tools?.length) throw new ModelCommonsError('INTEGRITY_FAILED', 'toolChoice requires tools.');
    if (value.toolChoice.type === 'tool') {
      const selectedTool = value.toolChoice.name;
      if (!value.tools.some((tool) => tool.name === selectedTool)) {
        throw new ModelCommonsError('INTEGRITY_FAILED', 'Named toolChoice is absent from tools.');
      }
    }
  }
  if (value.responseFormat) {
    if (value.responseFormat.type === 'json_object') {
      if (!['grammar', 'prompt-only'].includes(value.responseFormat.guarantee)) {
        throw new ModelCommonsError('INTEGRITY_FAILED', 'JSON object guarantee is invalid.');
      }
    } else if (value.responseFormat.type === 'json_schema') {
      requiredString(value.responseFormat.name, 'responseFormat.name');
      assertJsonValue(value.responseFormat.schema, 'responseFormat.schema');
      if (typeof value.responseFormat.strict !== 'boolean' || !['grammar', 'prompt-only'].includes(value.responseFormat.guarantee)) {
        throw new ModelCommonsError('INTEGRITY_FAILED', 'JSON Schema controls are invalid.');
      }
    } else if (value.responseFormat.type !== 'text') {
      throw new ModelCommonsError('FEATURE_UNSUPPORTED', 'responseFormat type is unsupported.');
    }
  }
  if (value.maxOutputTokens !== undefined && (!Number.isSafeInteger(value.maxOutputTokens) || value.maxOutputTokens <= 0)) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'maxOutputTokens must be a positive integer.');
  }
  if (value.sampling?.temperature !== undefined && (!Number.isFinite(value.sampling.temperature) || value.sampling.temperature < 0 || value.sampling.temperature > 2)) {
    throw new ModelCommonsError('FEATURE_UNSUPPORTED', 'temperature must be between 0 and 2.');
  }
  if (value.sampling?.topP !== undefined && (!Number.isFinite(value.sampling.topP) || value.sampling.topP <= 0 || value.sampling.topP > 1)) {
    throw new ModelCommonsError('FEATURE_UNSUPPORTED', 'topP must be greater than 0 and at most 1.');
  }
  if (value.stop !== undefined && (!Array.isArray(value.stop) || value.stop.length === 0 || value.stop.some((item) => typeof item !== 'string' || !item))) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'stop must contain non-empty strings.');
  }
  if (value.metadata !== undefined) {
    for (const [key, item] of Object.entries(record(value.metadata, 'metadata'))) {
      requiredString(key, 'metadata key');
      if (typeof item !== 'string') throw new ModelCommonsError('INTEGRITY_FAILED', 'Metadata values must be strings.');
    }
  }
  return value;
}

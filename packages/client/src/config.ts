import {
  PROTOCOL_VERSION,
  ModelCommonsError,
  parseClientConfiguration,
  type ClientConfiguration,
} from '@modelcommons/protocol';
import type {
  AnthropicClientOptions,
  ClientConfigInput,
  FetchImplementation,
  OpenAIClientOptions,
} from './types';

function ownAliases(input: ClientConfigInput['aliases']): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input ?? {}).map(([alias, target]) => [
    alias,
    target && typeof target === 'object'
      ? Object.fromEntries(Object.entries(target))
      : target,
  ]));
}

export function createClientConfiguration(input: ClientConfigInput): ClientConfiguration {
  return validateClientConfigurationSemantics(parseClientConfiguration({
    schema: 'modelcommons.client-config',
    schemaVersion: 1,
    protocolVersion: PROTOCOL_VERSION,
    client: {
      id: input.id,
      displayName: input.displayName,
    },
    requirements: {
      capabilities: input.capabilities,
      ...(input.formats !== undefined ? { formats: input.formats } : {}),
      ...(input.runtimes !== undefined ? { runtimes: input.runtimes } : {}),
      ...(input.minimumContext !== undefined ? { minimumContext: input.minimumContext } : {}),
    },
    selection: {
      ...(input.preferredModelId !== undefined ? { preferredModelId: input.preferredModelId } : {}),
      fallback: input.fallback ?? 'best-compatible',
    },
    aliases: ownAliases(input.aliases),
    inference: {
      profile: input.profile ?? 'balanced',
      ...(input.context !== undefined ? { context: input.context } : {}),
      ...(input.maxOutput !== undefined ? { maxOutput: input.maxOutput } : {}),
    },
    access: {
      transports: input.transports,
    },
  }));
}

export function validateClientConfigurationSemantics(
  configuration: ClientConfiguration
): ClientConfiguration {
  const preferredModelId = configuration.selection.preferredModelId as unknown;
  if (
    preferredModelId !== undefined
    && (typeof preferredModelId !== 'string' || !preferredModelId.trim())
  ) {
    throw new ModelCommonsError(
      'INTEGRITY_FAILED',
      'Client selection preferredModelId must be a non-empty string.'
    );
  }
  return configuration;
}

export function openAIClientOptions(fetch: FetchImplementation): OpenAIClientOptions {
  return {
    apiKey: 'modelcommons-local',
    baseURL: 'https://modelcommons.local/v1',
    fetch,
    maxRetries: 0,
    dangerouslyAllowBrowser: true,
    logLevel: 'off',
  };
}

export function anthropicClientOptions(fetch: FetchImplementation): AnthropicClientOptions {
  return {
    apiKey: 'modelcommons-local',
    baseURL: 'https://modelcommons.local',
    fetch,
    maxRetries: 0,
    dangerouslyAllowBrowser: true,
    logLevel: 'off',
  };
}

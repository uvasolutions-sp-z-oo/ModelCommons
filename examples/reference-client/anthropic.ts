import { ModelCommons } from '@modelcommons/client';
import {
  SUPPORTED_ANTHROPIC_VERSION,
  createAnthropicProviderFetch,
  type ModelCommonsProviderBackend,
} from '@modelcommons/provider-anthropic';

export function createAnthropicReference(backend: ModelCommonsProviderBackend) {
  const fetch = createAnthropicProviderFetch({ backend });
  return {
    fetch,
    /** Pass to `new Anthropic(...)` only if the application installs the SDK. */
    clientOptions: ModelCommons.anthropic(fetch),
  };
}

/** Lightweight Messages request; preferred over the unsupported SDK on RN. */
export async function requestAnthropicMessagesWire(input: {
  backend: ModelCommonsProviderBackend;
  modelId: string;
  prompt: string;
  signal?: AbortSignal;
}): Promise<unknown> {
  const { fetch } = createAnthropicReference(input.backend);
  const response = await fetch('https://modelcommons.local/v1/messages', {
    method: 'POST',
    headers: {
      'anthropic-version': SUPPORTED_ANTHROPIC_VERSION,
      'content-type': 'application/json',
      'x-api-key': 'modelcommons-local',
    },
    body: JSON.stringify({
      model: input.modelId,
      max_tokens: 256,
      messages: [{ role: 'user', content: input.prompt }],
      stream: false,
    }),
    signal: input.signal,
  });
  if (!response.ok) {
    throw new Error(
      `Local Anthropic-shaped request failed (${response.status}, ${response.headers.get('request-id') ?? 'no request id'}).`
    );
  }
  return response.json();
}

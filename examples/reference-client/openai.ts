import { ModelCommons } from '@modelcommons/client';
import {
  createOpenAIProviderFetch,
  type ModelCommonsProviderBackend,
} from '@modelcommons/provider-openai';

export function createOpenAIReference(backend: ModelCommonsProviderBackend) {
  const fetch = createOpenAIProviderFetch({ backend });
  return {
    fetch,
    /** Pass to `new OpenAI(...)` only if the application explicitly installs it. */
    clientOptions: ModelCommons.openAI(fetch),
  };
}

/** Lightweight wire-level request; preferred over the unsupported SDK on RN. */
export async function requestOpenAIResponsesWire(input: {
  backend: ModelCommonsProviderBackend;
  modelId: string;
  prompt: string;
  signal?: AbortSignal;
}): Promise<unknown> {
  const { fetch } = createOpenAIReference(input.backend);
  const response = await fetch('https://modelcommons.local/v1/responses', {
    method: 'POST',
    headers: {
      authorization: 'Bearer modelcommons-local',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: input.modelId,
      input: input.prompt,
      max_output_tokens: 256,
      stream: false,
      store: false,
    }),
    signal: input.signal,
  });
  if (!response.ok) {
    throw new Error(
      `Local OpenAI-shaped request failed (${response.status}, ${response.headers.get('x-request-id') ?? 'no request id'}).`
    );
  }
  return response.json();
}


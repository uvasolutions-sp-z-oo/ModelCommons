import { createTextProviderBackend, type ModelCommonsTransport } from '@modelcommons/client';
import { createOpenAIProviderFetch } from '@modelcommons/provider-openai';
import { createAnthropicProviderFetch } from '@modelcommons/provider-anthropic';
import { createEmbeddedLocalAI } from '@modelcommons/embedded';
import { createModelStore, createReadOnlyModelStore, type StorePolicy } from '@modelcommons/model-store';
import type { DeviceProfile } from '@modelcommons/protocol';

/** Supply either embedded.transport or shared-iOS.transport explicitly.
 * No network fallback and no global fetch replacement. Android is unavailable
 * until its real service-owned inference worker and transport are implemented. */
export function createLocalProviderAdapters(transport: ModelCommonsTransport) {
  const backend = createTextProviderBackend(transport);
  return {
    openaiFetch: createOpenAIProviderFetch({ backend }),
    anthropicFetch: createAnthropicProviderFetch({ backend }),
  };
}

interface ExampleOptions {
  // Supplied independently by the app's trusted build configuration, not read
  // from a connected directory or imported customer preference file.
  storePolicy: StorePolicy;
  deviceProvider: () => Promise<DeviceProfile>;
}

/** Native-only example. No model is installed or loaded merely by this factory. */
export async function createPrivateExample(options: ExampleOptions) {
  const native = await import('@modelcommons/native');
  const store = createModelStore({ port: await native.createPrivateStorePort(), policy: options.storePolicy });
  const local = createEmbeddedLocalAI({ modelStore: store, ownership: 'app-private',
    deviceProvider: options.deviceProvider, policy: { maxContext: 1024, maxOutput: 128 } });
  // Provision only after an explicit user action: store.install(approvedModelId).
  // SDK sessions release their contexts; call release() when leaving this backend.
  return { store, ...local, ...createLocalProviderAdapters(local.transport) };
}

/** iOS connectionId comes from explicit connectSharedDirectory/connectAppGroup.
 * It is NOT a private import and this return value exposes no owner mutation API. */
export async function createSharedFilesExample(connectionId: string, options: ExampleOptions) {
  const native = await import('@modelcommons/native');
  const store = createReadOnlyModelStore(native.createSharedStorePort(connectionId), options.storePolicy);
  const local = createEmbeddedLocalAI({ modelStore: store, ownership: 'shared-files',
    deviceProvider: options.deviceProvider, policy: { maxContext: 1024, maxOutput: 128 } });
  return { store, ...local, ...createLocalProviderAdapters(local.transport) };
}

import { validateCanonicalRequest, type ModelCommonsRequest } from '@modelcommons/protocol';
import { ModelCommons, type ModelCommonsTransport } from '@modelcommons/client';
import { resolveRuntimeProfile, type ResolveProfileInput } from '@modelcommons/device-profile';
import { createReadOnlyModelStore, type ReadStorePort, type StorePolicy } from '@modelcommons/model-store';
import { createEmptyRegistry } from '@modelcommons/model-store/registry';
import { MODEL_CATALOG, type CatalogPresentation } from '@modelcommons/model-store/catalog';

declare const transport: ModelCommonsTransport;
declare const profile: ResolveProfileInput;
declare const port: ReadStorePort;
declare const policy: StorePolicy;
export const client = ModelCommons.connect({ transport });
export const runtime = resolveRuntimeProfile(profile);
export const store = createReadOnlyModelStore(port, policy);
export const registry = createEmptyRegistry();
export const catalog = MODEL_CATALOG;
export type { CatalogPresentation };
export const parse = (input: unknown): ModelCommonsRequest => validateCanonicalRequest(input);
// @ts-expect-error The registry takes a numeric timestamp.
createEmptyRegistry('now');

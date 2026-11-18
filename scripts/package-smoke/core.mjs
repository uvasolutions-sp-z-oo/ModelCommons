import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { assertSafeRelativePath, ModelCommonsError, PROTOCOL_VERSION } from '@modelcommons/protocol';
import { ModelCommons, InProcessTransport } from '@modelcommons/client';
import { resolveRuntimeProfile } from '@modelcommons/device-profile';
import { createModelStore } from '@modelcommons/model-store';
import { createEmptyRegistry } from '@modelcommons/model-store/registry';
import { MODEL_CATALOG, findCatalogModel } from '@modelcommons/model-store/catalog';

const require = createRequire(import.meta.url);
assert.equal(PROTOCOL_VERSION, '0.1.0');
assert.throws(() => assertSafeRelativePath('../model.gguf'), ModelCommonsError);
assert.equal(typeof ModelCommons.connect, 'function');
assert.equal(typeof InProcessTransport, 'function');
assert.equal(typeof resolveRuntimeProfile, 'function');
assert.equal(typeof createModelStore, 'function');
assert.deepEqual(createEmptyRegistry(0).models, []);
assert.equal(findCatalogModel(MODEL_CATALOG[0].id), MODEL_CATALOG[0]);
for (const specifier of [
  '@modelcommons/protocol', '@modelcommons/client', '@modelcommons/device-profile',
  '@modelcommons/model-store', '@modelcommons/model-store/registry', '@modelcommons/model-store/catalog',
]) {
  const esm = await import(specifier);
  const cjs = require(specifier);
  assert.deepEqual(Object.keys(esm).sort(), Object.keys(cjs).sort(), specifier);
  for (const name of Object.keys(cjs)) assert.equal(esm[name], cjs[name], `${specifier} ${name}`);
}
assert.throws(() => require('@modelcommons/model-store/dist/store.js'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
const privateProtocolPath = '@modelcommons/protocol/dist/path.js';
await assert.rejects(import(privateProtocolPath), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });

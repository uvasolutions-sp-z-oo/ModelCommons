#!/usr/bin/env node
// OWNER-RUN ONLY: offline check of the consumer archive/lock/installed closure.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
if (process.argv.length !== 3) throw Error('Usage: node scripts/verify-local-consumer.cjs <consumer-root>');
const root = path.resolve(process.argv[2]);
const json = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const manifest = json('package.json');
const lock = json('package-lock.json');
const provenance = json('vendor/modelcommons/provenance.json');
const dependencies = Object.entries(manifest.dependencies).filter(([name]) => name.startsWith('@modelcommons/'));
assert.equal(dependencies.length, 9, 'Expected the complete nine-package consumer closure');
assert.equal(provenance.packages.length, 9, 'Provenance must describe all nine archives');
for (const [name, spec] of dependencies) {
  assert.match(spec, /^file:vendor\/modelcommons\/modelcommons-[a-z-]+-[0-9.]+\.tgz$/);
  const relative = spec.slice(5);
  const records = provenance.packages.filter((item) => item.name === name);
  assert.equal(records.length, 1, `Missing or duplicated provenance: ${name}`);
  const record = records[0];
  assert.equal(record.filename, path.basename(relative));
  const bytes = fs.readFileSync(path.join(root, relative));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), record.sha256, `${name}: archive/provenance mismatch`);
  const entry = lock.packages[`node_modules/${name}`];
  assert.ok(entry, `${name}: missing lockfile entry`);
  assert.equal(entry.version, record.version, `${name}: lockfile version mismatch`);
  assert.equal(entry.resolved, spec, `${name}: lockfile archive mismatch`);
  assert.equal(lock.packages[''].dependencies[name], spec, `${name}: root lockfile dependency mismatch`);
  assert.equal(entry.integrity, `sha512-${crypto.createHash('sha512').update(bytes).digest('base64')}`, `${name}: stale lockfile integrity; reinstall the repacked archive`);
  assert.equal(json(`node_modules/${name}/package.json`).version, record.version, `${name}: stale installed package`);
}
// These newly added source/compiled hooks must also be present after npm ci.
for (const [relative, needle] of [
  ['node_modules/@modelcommons/native/android/src/main/java/expo/modules/modelcommonsnative/storage/AndroidSharedModelFiles.kt', 'provider.readPermission'],
  ['node_modules/@modelcommons/native/scripts/patch-llama-rn-android-fd.cjs', 'modelcommons_android_fd_v2_params_size'],
  ['node_modules/@modelcommons/native/dist/index.js', 'cancelLeaseVerification'],
  ['node_modules/@modelcommons/runtime-llama-rn/dist/runtime.js', 'getModelCommonsDescriptorSupport'],
  ['node_modules/llama.rn/cpp/jsi/RNLlamaJSI.cpp', 'modelcommons_android_fd_v2_params_size'],
]) {
  assert.ok(fs.readFileSync(path.join(root, relative), 'utf8').includes(needle), `Stale installed source: ${relative}`);
}
console.log('All nine archives, provenance records, lockfile entries, installed versions and required hooks agree. Native build/device acceptance is still required.');

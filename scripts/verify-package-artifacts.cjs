/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { once } = require('node:events');
const { createRequire } = require('node:module');
const { checkArchive } = require('./check-package-archive.cjs');
const {
  core, integrity, isWithin, json, native, npm, previewVersions, publicRegistry, root, tag,
  temporaryDirectory, workspacePackages, writeJson,
} = require('./package-artifacts.cjs');

const args = process.argv.slice(2);
const published = args[0] === '--published';
if (published) args.shift();
assert.equal(args.length, 1, 'Usage: npm run packages:verify-preview -- [--published] <preview-output>');
const output = path.resolve(args[0]);
const packages = workspacePackages();
const packScript = path.join(__dirname, 'pack-local-packages.cjs');
const corePackages = packages.filter(({ manifest }) => core.includes(manifest.name));

function node(args, cwd, options = {}) {
  return execFileSync(process.execPath, args, { cwd, stdio: 'inherit', ...options });
}

async function checkArchives(directory, packages, preview) {
  const workspace = new Map(packages.map((item) => [item.manifest.name, item]));
  const provenance = json(path.join(directory, 'provenance.json'));
  assert.equal(provenance.schema, 1);
  assert.equal(provenance.packages.length, packages.length);
  assert.equal(new Set(provenance.packages.map(({ name }) => name)).size, packages.length);
  return Promise.all(provenance.packages.map((record) => {
    assert.ok(workspace.has(record.name), `Unexpected archive: ${record.name}`);
    return checkArchive(directory, record, workspace.get(record.name), workspace, preview);
  }));
}

function consumer(parent, name, dependencies) {
  const directory = path.join(parent, name);
  fs.mkdirSync(directory);
  writeJson(path.join(directory, 'package.json'), { name, version: '1.0.0', private: true, dependencies });
  return directory;
}

function checkInstall(directory, artifacts, resolution) {
  const lock = json(path.join(directory, 'package-lock.json'));
  const expected = new Set(artifacts.map(({ manifest }) => `node_modules/${manifest.name}`));
  assert.deepEqual(Object.keys(lock.packages).filter(Boolean).sort(), [...expected].sort(),
    'The core consumer must contain only its ModelCommons runtime closure.');
  for (const artifact of artifacts) {
    const { manifest, bytes } = artifact;
    const relative = `node_modules/${manifest.name}`;
    const entry = lock.packages[relative];
    assert.equal(entry.version, manifest.version);
    assert.equal(entry.integrity, integrity(bytes));
    assert.equal(entry.link, undefined);
    resolution(entry.resolved, artifact);
    const installed = path.join(directory, relative);
    assert.ok(isWithin(directory, fs.realpathSync(installed)), `Install links outside fixture: ${relative}`);
    assert.equal(json(path.join(installed, 'package.json')).version, manifest.version);
  }
}

function smokeCore(directory) {
  fs.copyFileSync(path.join(__dirname, 'package-smoke/core.mjs'), path.join(directory, 'smoke.mjs'));
  for (const extension of ['mts', 'cts']) {
    fs.copyFileSync(path.join(__dirname, 'package-smoke/core.types.ts'), path.join(directory, `types.${extension}`));
  }
  writeJson(path.join(directory, 'tsconfig.json'), {
    compilerOptions: {
      module: 'NodeNext', strict: true, noEmit: true, target: 'ES2022',
      lib: ['ES2022', 'DOM', 'DOM.Iterable'], types: [],
    },
    files: ['types.mts', 'types.cts'],
  });
  node(['smoke.mjs'], directory);
  node([require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json'], directory);
  node([require.resolve('typescript/bin/tsc'), '--noEmit', '--strict', '--module', 'esnext',
    '--moduleResolution', 'bundler', '--target', 'es2022', 'types.mts'], directory);
}

function cleanNpm(parent, cache) {
  const user = path.join(parent, 'user.npmrc');
  const global = path.join(parent, 'global.npmrc');
  fs.writeFileSync(user, '');
  fs.writeFileSync(global, '');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !/^(?:npm_config_.*|npm_token|node_auth_token|node_path)$/iu.test(key)));
  const flags = [`--userconfig=${user}`, `--globalconfig=${global}`, `--cache=${path.join(parent, cache)}`,
    '--fetch-retries=0', '--fetch-timeout=60000', '--no-fund', '--strict-ssl=true'];
  return { env, flags };
}

function packument(artifact, registry) {
  const { manifest, filename, bytes } = artifact;
  return {
    name: manifest.name,
    'dist-tags': { [tag]: manifest.version },
    versions: {
      [manifest.version]: {
        ...manifest,
        dist: { tarball: `${registry}/${manifest.name}/-/${filename}`, integrity: integrity(bytes) },
      },
    },
  };
}

async function testRegistry(parent, artifacts, options) {
  // Read-only npm protocol fixture. Every package/version is backed by the
  // exact candidate bytes. Unknown names and writes fail instead of falling
  // through to npm or mutating a registry.
  const byName = new Map(artifacts.map((artifact) => [artifact.manifest.name, artifact]));
  const downloads = new Set();
  const server = http.createServer((req, res) => {
    const requested = decodeURIComponent(new URL(req.url, registry).pathname).slice(1);
    if (req.method === 'GET') {
      const artifact = byName.get(requested);
      if (artifact) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(packument(artifact, registry)));
        return;
      }
      const [name, filename] = requested.split('/-/');
      const archive = byName.get(name);
      if (archive && archive.filename === filename) {
        downloads.add(name);
        res.writeHead(200, { 'content-type': 'application/octet-stream' });
        res.end(archive.bytes);
        return;
      }
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const registry = `http://127.0.0.1:${server.address().port}`;
  async function install(directory) {
    const child = spawn(process.execPath, [process.env.npm_execpath, 'install', '--no-audit',
      `--registry=${registry}`, ...options.flags], { cwd: directory, env: options.env, stdio: 'inherit' });
    const [code] = await once(child, 'exit');
    assert.equal(code, 0, `Candidate registry install failed in ${directory}`);
  }
  try {
    const directory = consumer(parent, 'registry-consumer', previewVersions);
    await install(directory);
    assert.deepEqual([...downloads].sort(), [...core].sort(), 'Install must fetch every candidate from the registry.');
    const checkResolution = (resolved, { manifest, filename }) =>
      assert.equal(resolved, `${registry}/${manifest.name}/-/${filename}`);
    checkInstall(directory, artifacts, checkResolution);
    smokeCore(directory);

    // With only one package requested at a time, npm must resolve protocol
    // transitively from its exact release version for each dependent.
    for (const artifact of artifacts) {
      const { name, version } = artifact.manifest;
      const standalone = consumer(parent, name.split('/')[1], { [name]: version });
      await install(standalone);
      const closure = artifacts.filter(({ manifest }) => manifest.name === name || manifest.name === core[0]);
      checkInstall(standalone, closure, checkResolution);
    }
    // Ask the real public advisory service about this exact installed tree.
    // This reports known advisories, including for transitive versions.
    npm(['audit', '--omit=dev', `--registry=${publicRegistry}`, ...options.flags], directory, { env: options.env });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function testTarballs(parent, artifacts, options) {
  const directory = consumer(parent, 'tarball-consumer',
    Object.fromEntries(artifacts.map(({ manifest, filename }) => [manifest.name, `file:vendor/${filename}`])));
  fs.mkdirSync(path.join(directory, 'vendor'));
  for (const { filename, bytes } of artifacts) fs.writeFileSync(path.join(directory, 'vendor', filename), bytes);
  npm(['install', '--offline', '--no-audit', ...options.flags], directory, { env: options.env });
  npm(['ci', '--offline', '--no-audit', ...options.flags], directory, { env: options.env });
  checkInstall(directory, artifacts, (resolved, { filename }) => assert.equal(resolved, `file:vendor/${filename}`));
  smokeCore(directory);
}

function testPublished(parent, artifacts, options) {
  const directory = consumer(parent, 'public-consumer', previewVersions);
  const registryFlags = [`--registry=${publicRegistry}`, ...options.flags];
  npm(['install', '--no-audit', ...registryFlags], directory, { env: options.env });
  npm(['ci', '--no-audit', ...registryFlags], directory, { env: options.env });
  checkInstall(directory, artifacts, (resolved) => assert.equal(new URL(resolved).origin, publicRegistry));
  smokeCore(directory);
  npm(['audit', '--omit=dev', ...registryFlags], directory, { env: options.env });
  npm(['audit', 'signatures', ...registryFlags], directory, { env: options.env });
}

async function testLocal(parent, options) {
  const consumerRoot = path.join(parent, 'local-consumer');
  const destination = path.join(consumerRoot, 'vendor/modelcommons');
  node([packScript, destination], root);
  const artifacts = await checkArchives(destination, packages, false);
  const lock = json(path.join(root, 'package-lock.json'));
  const peers = ['expo', 'expo-modules-core', 'react', 'react-native', 'llama.rn'];
  const dependencies = Object.fromEntries(peers.map((name) => [name, lock.packages[`node_modules/${name}`].version]));
  for (const { manifest, filename } of artifacts) dependencies[manifest.name] = `file:vendor/modelcommons/${filename}`;
  writeJson(path.join(consumerRoot, 'package.json'), { name: 'local-consumer', version: '1.0.0', private: true, dependencies });
  // Native peer lifecycles include the platform payload downloader. The
  // fixture checks resolution, discovery and pinned patching as source checks.
  const installFlags = ['--ignore-scripts', '--no-audit', `--registry=${publicRegistry}`, ...options.flags];
  npm(['install', '--package-lock-only', ...installFlags], consumerRoot, { env: options.env });
  npm(['ci', ...installFlags], consumerRoot, { env: options.env });
  const installed = createRequire(path.join(consumerRoot, 'package.json'));
  const plugin = installed.resolve(`${native}/app.plugin.js`);
  const resolver = installed('@expo/config-plugins/build/utils/plugin-resolver');
  assert.equal(resolver.resolvePluginForModule(consumerRoot, native).filePath, plugin);
  assert.equal(typeof resolver.resolveConfigPluginFunction(consumerRoot, native), 'function');
  const expoResolve = createRequire(installed.resolve('expo/package.json'));
  const autolinking = expoResolve.resolve('expo-modules-autolinking/bin/expo-modules-autolinking.js');
  for (const platform of ['apple', 'android']) {
    const results = JSON.parse(node([autolinking, 'resolve', '--platform', platform, '--json'], consumerRoot,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }));
    assert.ok(results.modules.some(({ packageName }) => packageName === native), `Missing ${platform} autolink descriptor`);
    assert.ok(!results.modules.some(({ packageName }) => packageName === '@modelcommons/inference-host'));
  }
  for (const { manifest } of artifacts.filter(({ manifest }) => manifest.name !== native)) {
    for (const subpath of Object.keys(manifest.exports)) installed(manifest.name + subpath.slice(1));
  }
  const patch = installed.resolve('@modelcommons/native/scripts/ensure-llama-payload.cjs');
  const installedLlama = path.dirname(installed.resolve('llama.rn/package.json'));
  assert.equal(installed('llama.rn/package.json').version, '0.12.9');
  node([path.join(path.dirname(patch), 'patch-llama-rn-android-fd.cjs'), installedLlama], consumerRoot);
  node([path.join(__dirname, 'verify-local-consumer.cjs'), consumerRoot], root);
  console.log('Nine local archives resolve and pass Expo plugin, Apple/Android autolinking and descriptor-source checks.');
}

async function main() {
  const work = temporaryDirectory('verify');
  try {
    assert.ok(!isWithin(root, work.directory), 'Set your OS temp directory outside the workspace.');
    if (!published) node([packScript, '--preview', output], root);
    const artifacts = await checkArchives(output, corePackages, true);
    if (published) {
      testPublished(work.directory, artifacts, cleanNpm(work.directory, 'registry-cache'));
    } else {
      testTarballs(work.directory, artifacts, cleanNpm(work.directory, 'tarball-cache'));
      // Report both independent results even if registry infrastructure fails.
      const failures = [];
      for (const check of [
        () => testRegistry(work.directory, artifacts, cleanNpm(work.directory, 'registry-cache')),
        () => testLocal(work.directory, cleanNpm(work.directory, 'mobile-cache')),
      ]) {
        try {
          await check();
        } catch (error) {
          failures.push(error);
          console.error(error);
        }
      }
      assert.equal(failures.length, 0, 'One or more package verification checks failed.');
    }
    console.log('Package artifact verification passed.');
  } finally {
    work.remove();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

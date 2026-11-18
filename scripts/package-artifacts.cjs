/* global __dirname */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const repository = 'https://github.com/uvasolutions-sp-z-oo/ModelCommons';
const publicRegistry = 'https://registry.npmjs.org';
const tag = 'experimental';
const previewVersions = {
  '@modelcommons/protocol': '0.1.0-preview.0',
  '@modelcommons/client': '0.1.0-preview.0',
  '@modelcommons/device-profile': '0.1.0-preview.0',
  '@modelcommons/model-store': '0.2.0-preview.0',
};
const core = Object.keys(previewVersions);
const native = '@modelcommons/native';
const directories = ['protocol', 'client', 'model-store', 'device-profile', 'runtime-llama-rn',
  'provider-openai', 'provider-anthropic', 'embedded'].map((name) => `packages/${name}`)
  .concat('modules/model-commons-native');
const nativeFiles = /^(?:app\.plugin\.js|expo-module\.config\.json|ModelCommonsNative\.podspec|scripts\/(?:ensure-llama-payload|native-artifact-env|patch-llama-rn-android-fd)\.cjs|ios\/[\w-]+\.(?:swift|h|m|mm)|android\/build\.gradle|android\/src\/(?:main|androidTest)\/(?:AndroidManifest\.xml|(?:java|aidl)\/expo\/modules\/modelcommonsnative\/[\w/-]+\.(?:kt|aidl)))$/u;
const sourceFile = /^(?!.*(?:^|\/)__[^/]+\/)(?!.*\.test\.ts$)[\w/-]+\.ts$/u;
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const integrity = (bytes) => `sha512-${crypto.createHash('sha512').update(bytes).digest('base64')}`;
const archiveName = (name, version) => `${name.slice(1).replace('/', '-')}-${version}.tgz`;
const posix = (file) => file.split(path.sep).join('/');

function workspacePackages() {
  return directories.map((directory) => ({
    directory,
    manifest: json(path.join(root, directory, 'package.json')),
  }));
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function temporaryDirectory(label) {
  const parent = fs.realpathSync(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(parent, `modelcommons-${label}-`));
  return {
    directory,
    remove() {
      assert.ok(isWithin(parent, fs.realpathSync(directory)), 'Unexpected temporary directory');
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}

function filesUnder(directory, parent = directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(file, parent);
    if (entry.isFile()) return [posix(path.relative(parent, file))];
    return [];
  }).sort();
}

function packageInputs(directory, isNative) {
  const source = path.join(root, directory);
  const files = filesUnder(path.join(source, 'src')).filter((file) => sourceFile.test(file)).map((file) => `src/${file}`);
  if (isNative) {
    for (const folder of ['android/src/main', 'android/src/androidTest', 'ios', 'scripts']) {
      files.push(...filesUnder(path.join(source, folder), source).filter((file) => nativeFiles.test(file)));
    }
    files.push('android/build.gradle', 'app.plugin.js', 'expo-module.config.json', 'ModelCommonsNative.podspec');
  }
  return files;
}

function npm(args, cwd, options = {}) {
  const cli = process.env.npm_execpath;
  assert.ok(cli && fs.existsSync(cli), 'Invoke this command through npm run.');
  return execFileSync(process.execPath, [cli, ...args], {
    cwd, stdio: 'inherit', ...options,
  });
}

function sourceHash(directory, stagedPaths, preview) {
  const hash = crypto.createHash('sha256');
  const source = path.join(root, directory);
  const read = (file) => {
    const bytes = fs.readFileSync(path.join(source, file));
    return preview ? bytes.toString('utf8').replace(/\r\n/g, '\n') : bytes;
  };
  hash.update('original-package.json\0').update(read('package.json'));
  const inputs = [...stagedPaths].sort((a, b) => {
    // Preserve platform sorting for local schema 1. Preview inputs are portable.
    const left = preview ? a : path.normalize(a);
    const right = preview ? b : path.normalize(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });
  for (const file of inputs) hash.update(file + '\0').update(read(file));
  return hash.digest('hex');
}

module.exports = {
  archiveName, core, integrity, isWithin, json, native, nativeFiles, npm, packageInputs,
  previewVersions, publicRegistry, repository, root, sha256, sourceFile, sourceHash, tag,
  temporaryDirectory, workspacePackages, writeJson,
};

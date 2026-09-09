// Owner/EAS install hook only. Downloads the pinned dependency's native engine
// artifacts through its checksum-verifying installer, never model weights.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const project = process.cwd();
const dependency = path.dirname(require.resolve('llama.rn/package.json', { paths: [project] }));
const manifest = JSON.parse(fs.readFileSync(path.join(dependency, 'package.json'), 'utf8'));
if (manifest.version !== '0.12.9') throw new Error('Local AI requires the reviewed llama.rn 0.12.9 payload.');
if (process.env.RNLLAMA_SKIP_POSTINSTALL === '1' || process.env.RNLLAMA_BUILD_FROM_SOURCE === '1') {
  throw new Error('The alpha acceptance path requires the pinned, verified prebuilt engine payload.');
}
const artifacts = JSON.parse(fs.readFileSync(path.join(dependency, 'install/native-artifacts.json'), 'utf8')).artifacts;
const expected = {
  'android-jni-libs': 'cda945a7c0ed075a0b028c1c3c6f5b668532eb18b069ecc4793ed7ca6cdb65ac',
  'ios-xcframework': 'ae9a37ae15a9e8d6ef0330f4afa3d8199af3590f7ecf371bfe48b35fd946c4ae',
};
for (const [name, digest] of Object.entries(expected)) {
  if (!artifacts.some((entry) => entry.name === name && entry.sha256 === digest)) throw new Error('Unexpected native artifact provenance.');
}
function present() {
  return artifacts.every((entry) => {
    try { return fs.readFileSync(path.join(dependency, entry.markerPath), 'utf8').trim() === entry.sha256; }
    catch { return false; }
  }) && fs.existsSync(path.join(dependency, 'ios/rnllama.xcframework/Info.plist'))
    && fs.existsSync(path.join(dependency, 'ios/rnllama.xcframework/ios-arm64/rnllama.framework/rnllama'))
    && fs.existsSync(path.join(dependency, 'android/src/main/jniLibs/arm64-v8a/librnllama.so'));
}
if (!present()) {
  const result = spawnSync(process.execPath, [
    ...(process.allowedNodeEnvironmentFlags?.has('--use-system-ca') ? ['--use-system-ca'] : []),
    path.join(dependency, 'install/download-native-artifacts.js'),
  ], { cwd: project, env: process.env, stdio: 'inherit' });
  if (result.error || result.status !== 0 || !present()) throw new Error('Native engine payload is missing; stop before producing an unusable binary.');
}
process.stdout.write('Pinned llama.rn Apple/Android artifact markers and device payloads are present. This is not device inference verification.\n');

/*
 * llama.rn publishes its Android JNI binaries separately from its npm tarball.
 * The dependency normally fetches them during postinstall, but that lifecycle
 * hook can be disabled by package-manager policy. Do this immediately before an
 * Android build so a development client cannot be produced without llama.rn.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function hasArm64NativePayload(projectRoot, fsModule = fs) {
  const nativeDir = path.join(
    projectRoot,
    'node_modules',
    'llama.rn',
    'android',
    'src',
    'main',
    'jniLibs',
    'arm64-v8a'
  );
  try {
    // These are the prebuilt llama cores. Gradle/CMake links them into the
    // corresponding librnllama_jni* wrappers that RNLlama.java loads.
    return fsModule.readdirSync(nativeDir).some((name) => /^librnllama(?:_[\w.]+)?\.so$/u.test(name));
  } catch {
    return false;
  }
}

function ensureLlamaRnNativeArtifacts(projectRoot, options = {}) {
  const fsModule = options.fsModule ?? fs;
  const spawn = options.spawn ?? spawnSync;
  const output = options.output ?? console;
  if (hasArm64NativePayload(projectRoot, fsModule)) {
    output.log('llama.rn: verified Android native payload is present.');
    return;
  }

  const downloader = path.join(
    projectRoot,
    'node_modules',
    'llama.rn',
    'install',
    'download-native-artifacts.js'
  );
  if (!fsModule.existsSync(downloader)) {
    throw new Error('llama.rn is installed without its native-artifact downloader. Reinstall dependencies before building Android.');
  }

  output.log('llama.rn: Android native bindings are missing; installing the package-verified artifacts.');
  // Corporate and managed Windows machines commonly install their trusted CA
  // in the OS store. Node 22+ can include that store without disabling TLS or
  // weakening the artifact downloader's SHA-256 verification.
  const nodeArgs = [
    ...(process.allowedNodeEnvironmentFlags?.has('--use-system-ca') ? ['--use-system-ca'] : []),
    downloader,
  ];
  const result = spawn(process.execPath, nodeArgs, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error || result.status !== 0) {
    throw new Error('llama.rn native-artifact installation failed; Android build aborted before creating a client without local inference support.');
  }
  // CMake decides which JNI wrappers to create by testing whether each
  // prebuilt core exists during configuration. If an earlier build configured
  // while jniLibs was missing, its cache permanently records an empty target
  // graph until it is regenerated.
  const cmakeCache = path.join(projectRoot, 'node_modules', 'llama.rn', 'android', '.cxx');
  fsModule.rmSync?.(cmakeCache, { recursive: true, force: true });
  if (!hasArm64NativePayload(projectRoot, fsModule)) {
    throw new Error('llama.rn native-artifact installation completed without arm64-v8a runtime libraries; Android build aborted.');
  }
}

if (require.main === module) {
  ensureLlamaRnNativeArtifacts(path.resolve(__dirname, '..'));
}

module.exports = { ensureLlamaRnNativeArtifacts, hasArm64NativePayload };

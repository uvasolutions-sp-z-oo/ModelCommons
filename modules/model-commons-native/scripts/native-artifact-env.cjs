const fs = require('node:fs');
const path = require('node:path');

/** llama.rn 0.12.9 spawns `tar` with native absolute paths. Git Bash's GNU
 * tar treats the C: prefix as a remote host. Prefer Windows' bundled bsdtar
 * only in the downloader's environment; do not alter the parent shell PATH.
 */
function nativeArtifactEnv({ platform = process.platform, env = process.env, fsModule = fs } = {}) {
  if (platform !== 'win32') return env;

  const systemRootKey = Object.keys(env).find((key) => key.toLowerCase() === 'systemroot');
  const systemRoot = systemRootKey && env[systemRootKey];
  if (!systemRoot || !path.win32.isAbsolute(systemRoot)) {
    throw new Error('Cannot locate Windows tar.exe: SystemRoot must identify the Windows directory.');
  }
  const systemDirectory = path.win32.join(systemRoot, 'System32');
  if (!fsModule.existsSync(path.win32.join(systemDirectory, 'tar.exe'))) {
    throw new Error('Windows System32 tar.exe is required to extract llama.rn artifacts from native Windows paths.');
  }

  // Windows environment names are case-insensitive. Supplying both PATH and
  // Path to Node's spawn can select the wrong one, so emit exactly one key.
  const pathKeys = Object.keys(env).filter((key) => key.toLowerCase() === 'path');
  const inheritedPath = pathKeys.map((key) => env[key]).filter(Boolean).join(';');
  const childEnv = { ...env };
  for (const key of pathKeys) delete childEnv[key];
  childEnv.Path = systemDirectory + (inheritedPath ? `;${inheritedPath}` : '');
  return childEnv;
}

module.exports = { nativeArtifactEnv };

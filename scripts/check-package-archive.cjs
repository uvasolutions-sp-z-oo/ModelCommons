const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const path = require('node:path');
const tar = require('tar');
const {
  archiveName, native, nativeFiles, packageInputs, previewVersions, publicRegistry, repository,
  root, sha256, sourceFile, sourceHash, tag,
} = require('./package-artifacts.cjs');

const compiledFile = /^dist\/[\w/-]+\.(?:js|d\.ts|mjs|d\.mts)$/u;
const secretPatterns = [
  /-----BEGIN [A-Z0-9 ]*(?:PRIVATE KEY|CERTIFICATE)-----/u,
  /\b(?:npm_[A-Za-z0-9]{36,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{35,}|(?:AKIA|ASIA)[A-Z0-9]{16}|sk-(?:proj-|ant-api\d+-)?[A-Za-z0-9_-]{32,}|hf_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{20,})\b/u,
  /(?:_authToken|client_secret|private_key)\s*["']?\s*[:=]\s*["']?[A-Za-z0-9_+/=-]{16,}/iu,
];

function checkEntry(name, bytes, isNative, preview) {
  assert.ok(name.split('/').every((part) => part && part !== '.' && part !== '..'), `Unsafe archive path: ${name}`);
  const allowed = ['package.json', 'README.md', 'LICENSE'].includes(name)
    || (compiledFile.test(name) && (preview || !/\.m(?:js|ts)$/u.test(name)))
    || (!preview && name.startsWith('src/') && sourceFile.test(name.slice(4)))
    || (isNative && !preview && nativeFiles.test(name));
  assert.ok(allowed, `Unexpected archive file: ${name}`);
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  assert.doesNotMatch(decoded, /[\x00-\x08\x0b\x0c\x0e-\x1f]|[A-Za-z0-9+/]{1024}/u, `Binary or encoded payload: ${name}`);
  for (const pattern of secretPatterns) {
    // Avoid printing the matched file contents or credential.
    assert.ok(!pattern.test(decoded), `Possible signing material or credential: ${name}`);
  }
}

function exportTargets(entry) {
  return typeof entry === 'string' ? [entry] : Object.values(entry).flatMap(exportTargets);
}

async function checkArchive(directory, record, item, workspace, preview) {
  const { manifest: source } = item;
  const name = source.name;
  const version = preview ? previewVersions[name] : source.version;
  assert.equal(record.version, version);
  assert.equal(record.filename, archiveName(name, version));
  const file = path.join(directory, record.filename);
  const stat = fs.lstatSync(file);
  assert.ok(stat.isFile() && stat.size > 0 && stat.size < 4 * 1024 * 1024, `Unexpected archive size or file type: ${name}`);
  const bytes = fs.readFileSync(file);
  assert.equal(sha256(bytes), record.sha256, `Provenance hash mismatch: ${name}`);
  const contents = new Map();
  let total = 0;
  await tar.t({
    file, strict: true,
    onReadEntry(entry) {
      assert.equal(entry.type, 'File', `Unexpected archive entry type: ${entry.path}`);
      assert.ok(entry.path.startsWith('package/'), `Unexpected archive entry: ${entry.path}`);
      const relative = entry.path.slice('package/'.length);
      assert.ok(!contents.has(relative), `Duplicate archive entry: ${relative}`);
      const chunks = [];
      total += entry.size;
      assert.ok(total < 12 * 1024 * 1024, `Unexpected decompressed archive size: ${name}`);
      contents.set(relative, chunks);
      entry.on('data', (chunk) => chunks.push(chunk));
    },
  });
  const entries = new Map([...contents].map(([name, chunks]) => [name, Buffer.concat(chunks)]));
  for (const [relative, content] of entries) checkEntry(relative, content, name === native, preview);
  for (const [relative, from] of [['LICENSE', root], ['README.md', path.join(root, item.directory)]]) {
    const original = fs.readFileSync(path.join(from, relative));
    const expected = preview ? Buffer.from(original.toString('utf8').replace(/\r\n/g, '\n')) : original;
    assert.deepEqual(entries.get(relative), expected, `Missing or altered ${relative}: ${name}`);
  }
  const sourcePaths = packageInputs(item.directory, name === native);
  assert.equal(record.sourceSha256, sourceHash(item.directory, sourcePaths, preview), `Stale source provenance: ${name}`);
  const manifest = JSON.parse(entries.get('package.json').toString('utf8'));
  assert.equal(manifest.name, name);
  assert.equal(manifest.version, version);
  assert.equal(manifest.license, 'MIT');
  assert.equal(manifest.type, 'commonjs');
  assert.equal(manifest.main, './dist/index.js');
  assert.equal(manifest.types, './dist/index.d.ts');
  assert.deepEqual(manifest.repository, { type: 'git', url: `git+${repository}.git`, directory: item.directory });
  assert.equal(manifest.homepage, `${repository}/tree/HEAD/${item.directory}`);
  assert.equal(manifest.bugs.url, `${repository}/issues`);
  for (const key of ['scripts', 'bin', 'devDependencies', 'optionalDependencies', 'bundledDependencies',
    'bundleDependencies', 'workspaces', 'overrides', 'os', 'cpu']) {
    assert.ok(!(key in manifest), `${name}: unexpected manifest field ${key}`);
  }
  assert.deepEqual(Object.keys(manifest.exports), Object.keys(source.exports));
  for (const [key, entry] of Object.entries(manifest.exports)) {
    if (preview) {
      assert.deepEqual(Object.keys(entry), ['import', 'require', 'default']);
      assert.deepEqual(Object.keys(entry.import), ['types', 'default']);
      assert.deepEqual(Object.keys(entry.require), ['types', 'default']);
      assert.match(entry.import.types, /\.d\.mts$/u);
      assert.match(entry.import.default, /\.mjs$/u);
      assert.match(entry.require.types, /\.d\.ts$/u);
      assert.match(entry.require.default, /\.js$/u);
      assert.equal(entry.default, entry.require.default);
    } else if (name === native && key === '.') {
      assert.equal(entry['react-native'], './src/index.ts');
    }
    for (const target of exportTargets(entry)) {
      assert.ok(target.startsWith('./') && entries.has(target.slice(2)), `${name}/${key}: missing ${target}`);
    }
  }
  if (preview) {
    assert.equal(manifest.private, undefined);
    assert.deepEqual(manifest.publishConfig, { access: 'public', registry: publicRegistry, tag });
    assert.deepEqual(manifest.engines, { node: '>=20.19.0' });
    assert.equal(manifest.peerDependencies, undefined);
  } else {
    assert.equal(manifest.private, true);
    assert.equal(manifest.publishConfig, undefined);
    for (const relative of sourcePaths) {
      assert.deepEqual(entries.get(relative), fs.readFileSync(path.join(root, item.directory, relative)), `Stale or missing local input: ${relative}`);
    }
  }
  for (const [section, values] of Object.entries({
    dependencies: manifest.dependencies, peerDependencies: manifest.peerDependencies,
  })) {
    const expected = Object.fromEntries(Object.entries(source[section] ?? {}).map(([dependency, spec]) =>
      [dependency, preview ? previewVersions[dependency] : spec]));
    assert.deepEqual(values ?? {}, expected, `${name}: unexpected ${section}`);
    for (const [dependency, spec] of Object.entries(values ?? {})) {
      assert.match(spec, /^(?:\^?\d+\.\d+\.\d+(?:-preview\.\d+)?|>=\d+\.\d+\.\d+ <\d+\.\d+\.\d+)$/u);
      if (dependency.startsWith('@modelcommons/')) {
        const match = workspace.get(dependency);
        assert.ok(match, `${name}: dependency outside the distributable closure: ${dependency}`);
        assert.equal(spec.replace(/^\^/u, ''), preview ? previewVersions[dependency] : match.manifest.version);
      }
    }
  }
  assert.deepEqual(manifest.peerDependenciesMeta, source.peerDependenciesMeta);
  return { bytes, filename: record.filename, manifest };
}

module.exports = { checkArchive, checkEntry };

#!/usr/bin/env node
// OWNER-RUN ONLY: compiles packages, then packs their full dependency closure.
// Does not install, publish, commit, fetch models, or invoke native builds.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const destinations = process.argv.slice(2);
if (destinations.length !== 1) throw new Error('Usage: node scripts/pack-local-packages.cjs <consumer/vendor/modelcommons>');
const destination = path.resolve(destinations[0]);
if (path.basename(destination) !== 'modelcommons' || path.basename(path.dirname(destination)) !== 'vendor') {
  throw new Error('Destination must be an explicit vendor/modelcommons directory.');
}
const packages = ['protocol', 'client', 'model-store', 'device-profile', 'runtime-llama-rn',
  'provider-openai', 'provider-anthropic', 'embedded'].map((name) => `packages/${name}`)
  .concat('modules/model-commons-native');
const temporary = fs.mkdtempSync(path.join(root, '.modelcommons-pack-'));
const output = path.join(temporary, 'compiled');
const paths = {};
const sourceFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('__')) walk(file);
    else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) sourceFiles.push(file);
  }
}
for (const directory of packages) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, directory, 'package.json'), 'utf8'));
  paths[manifest.name] = [`${directory}/src/index.ts`];
  paths[`${manifest.name}/*`] = [`${directory}/src/*`];
  walk(path.join(root, directory, 'src'));
}
const program = ts.createProgram(sourceFiles, {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.Node10, declaration: true,
  strict: true, skipLibCheck: true, esModuleInterop: true,
  baseUrl: root, paths, rootDir: root, outDir: output, noEmitOnError: true,
  types: ['node'], lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
});
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.some((item) => item.category === ts.DiagnosticCategory.Error)) {
  process.stderr.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (name) => name, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }));
  process.exitCode = 1;
} else {
  const result = program.emit();
  if (result.emitSkipped) throw new Error('Package compilation did not emit output.');
  fs.mkdirSync(destination, { recursive: true });
  const provenance = { schema: 1, generatedAt: new Date().toISOString(), packages: [] };
  for (const directory of packages) {
    const source = path.join(root, directory);
    const manifest = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
    const stage = path.join(temporary, manifest.name.replace('@', '').replace('/', '-'));
    fs.mkdirSync(stage);
    fs.cpSync(path.join(output, directory, 'src'), path.join(stage, 'dist'), { recursive: true });
    fs.cpSync(path.join(source, 'src'), path.join(stage, 'src'), { recursive: true,
      filter: (file) => !file.includes('__tests__') && !file.endsWith('.test.ts') });
    const native = manifest.name === '@modelcommons/native';
    if (native) {
      for (const item of ['android', 'ios', 'scripts', 'app.plugin.js', 'expo-module.config.json', 'ModelCommonsNative.podspec']) {
        fs.cpSync(path.join(source, item), path.join(stage, item), { recursive: true,
          filter: (file) => !file.split(path.sep).some((part) => ['build', '.cxx', '.gradle', 'test'].includes(part)) });
      }
    }
    fs.copyFileSync(path.join(root, 'LICENSE'), path.join(stage, 'LICENSE'));
    if (fs.existsSync(path.join(source, 'README.md'))) fs.copyFileSync(path.join(source, 'README.md'), path.join(stage, 'README.md'));
    const exports = {};
    for (const [key, value] of Object.entries(manifest.exports || { '.': './src/index.ts' })) {
      if (typeof value === 'string' && value.startsWith('./src/')) {
        const compiled = value.replace('./src/', './dist/').replace(/\.ts$/, '.js');
        exports[key] = { types: compiled.replace(/\.js$/, '.d.ts'),
          ...(native ? { 'react-native': value } : {}), default: compiled };
      } else exports[key] = value;
    }
    const packed = { ...manifest, type: 'commonjs', main: './dist/index.js', types: './dist/index.d.ts',
      exports, files: ['dist', 'src', 'LICENSE', 'README.md', ...(native ? ['android', 'ios', 'scripts', 'app.plugin.js', 'expo-module.config.json', 'ModelCommonsNative.podspec'] : [])] };
    fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify(packed, null, 2) + '\n');
    const npmCli = process.env.npm_execpath;
    if (!npmCli || !fs.existsSync(npmCli)) throw new Error('Run this script with npm run packages:pack-local -- <destination>.');
    const packedOutput = execFileSync(process.execPath, [npmCli, 'pack', '--ignore-scripts', '--json', '--pack-destination', destination],
      { cwd: stage, encoding: 'utf8' });
    const record = JSON.parse(packedOutput)[0];
    const artifact = path.join(destination, record.filename);
    const sourceHash = crypto.createHash('sha256');
    const sourceInputs = [];
    function collect(directory) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) collect(file);
        else if (entry.isFile()) sourceInputs.push(file);
      }
    }
    collect(path.join(stage, 'src'));
    if (native) for (const name of ['android', 'ios', 'scripts']) collect(path.join(stage, name));
    if (native) for (const name of ['app.plugin.js', 'expo-module.config.json', 'ModelCommonsNative.podspec']) sourceInputs.push(path.join(stage, name));
    sourceHash.update('original-package.json\0').update(fs.readFileSync(path.join(source, 'package.json')));
    for (const file of sourceInputs.sort()) {
      sourceHash.update(path.relative(stage, file).split(path.sep).join('/') + '\0').update(fs.readFileSync(file));
    }
    provenance.packages.push({ name: manifest.name, version: manifest.version, filename: record.filename,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(artifact)).digest('hex'), sourceSha256: sourceHash.digest('hex') });
  }
  fs.writeFileSync(path.join(destination, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
  process.stdout.write(`Packed ${packages.length} packages into ${destination}\nTemporary build retained for inspection: ${temporary}\n`);
}

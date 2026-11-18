#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {
  archiveName, core, isWithin, native, npm, packageInputs, previewVersions,
  publicRegistry, root, sha256, sourceHash, tag, temporaryDirectory,
  workspacePackages, writeJson,
} = require('./package-artifacts.cjs');

const args = process.argv.slice(2);
const preview = args[0] === '--preview';
if (preview) args.shift();
assert.equal(args.length, 1, 'Supply a preview output directory or a local vendor/modelcommons directory.');
const destination = path.resolve(args[0]);
if (!preview) {
  assert.equal(path.basename(destination), 'modelcommons', 'Local destination must end in vendor/modelcommons.');
  assert.equal(path.basename(path.dirname(destination)), 'vendor', 'Local destination must end in vendor/modelcommons.');
}

const packages = workspacePackages().filter(({ manifest }) => !preview || core.includes(manifest.name));
const paths = {};
const sources = new Map();
for (const { directory, manifest } of packages) {
  assert.equal(manifest.private, true, `${manifest.name}: protect the workspace source manifest`);
  const files = packageInputs(directory, false);
  sources.set(directory, files.map((file) => path.join(root, directory, file)));
  for (const [key, value] of Object.entries(manifest.exports)) {
    if (value.startsWith('./src/')) {
      paths[manifest.name + key.slice(1)] = [`${directory}/${value.slice(2)}`];
    }
  }
}

function compile(output) {
  const options = {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10, declaration: true,
    strict: true, skipLibCheck: true, esModuleInterop: true, newLine: ts.NewLineKind.LineFeed,
    baseUrl: root, paths, rootDir: root, outDir: output, noEmitOnError: true,
    types: [], lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  };

  for (const { directory, manifest } of packages) {
    const inputs = new Set(sources.get(directory));
    for (const file of inputs) {
      const info = ts.preProcessFile(fs.readFileSync(file, 'utf8'), true, true);
      for (const { fileName: specifier } of [...info.importedFiles, ...info.referencedFiles, ...info.typeReferenceDirectives]) {
        if (specifier.startsWith('.')) {
          const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule?.resolvedFileName;
          assert.ok(resolved && inputs.has(path.normalize(resolved)), `${file}: import outside packaged source: ${specifier}`);
        } else {
          const name = specifier.split('/').slice(0, specifier.startsWith('@') ? 2 : 1).join('/');
          assert.ok(manifest.dependencies?.[name] || manifest.peerDependencies?.[name],
            `${file}: undeclared dependency: ${specifier}`);
          if (name.startsWith('@modelcommons/')) {
            assert.ok(paths[specifier], `${file}: unavailable workspace export: ${specifier}`);
          }
        }
      }
    }
  }

  const inputFiles = [...sources.values()].flat();
  const program = ts.createProgram(inputFiles, options);
  const allowed = new Set(inputFiles);
  for (const file of program.getSourceFiles()) {
    const absolute = path.normalize(file.fileName);
    assert.ok(allowed.has(absolute) || isWithin(path.join(root, 'node_modules'), absolute),
      `Package build reached outside its inputs: ${file.fileName}`);
  }
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (name) => name, getCurrentDirectory: () => root, getNewLine: () => '\n',
    }));
  }
  assert.equal(program.emit().emitSkipped, false, 'Package compilation did not emit output.');
  return program;
}

function previewEntry(program, source, stage, compiled) {
  const checker = program.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(source));
  const names = checker.getExportsOfModule(moduleSymbol).filter((symbol) => {
    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    return target.flags & ts.SymbolFlags.Value;
  }).map((symbol) => symbol.name).sort();
  const cjs = './' + path.basename(compiled);
  const esm = compiled.replace(/\.js$/, '.mjs');
  // Both loaders use the same instance, including classes shared with protocol.
  const wrapper = [`import api from ${JSON.stringify(cjs)};`];
  for (const name of names) {
    assert.match(name, /^[A-Za-z_$][\w$]*$/u);
    assert.notEqual(name, 'default', 'Handle a default export explicitly before changing the public API.');
    wrapper.push(`export const ${name} = api.${name};`);
  }
  fs.writeFileSync(path.join(stage, esm), wrapper.join('\n') + '\n');
  const esmTypes = esm.replace(/\.mjs$/, '.d.mts');
  fs.writeFileSync(path.join(stage, esmTypes), `export * from ${JSON.stringify(cjs)};\n`);
  return {
    import: { types: esmTypes, default: esm },
    require: { types: compiled.replace(/\.js$/, '.d.ts'), default: compiled },
    default: compiled,
  };
}

function stagePackage({ directory, manifest }, temp, output, program) {
  const source = path.join(root, directory);
  const { name } = manifest;
  const isNative = name === native;
  const stage = path.join(temp, name.slice(1).replace('/', '-'));
  fs.mkdirSync(stage);
  fs.cpSync(path.join(output, directory, 'src'), path.join(stage, 'dist'), { recursive: true });
  const inputs = packageInputs(directory, isNative);
  if (!preview) {
    for (const file of inputs) {
      fs.mkdirSync(path.dirname(path.join(stage, file)), { recursive: true });
      fs.copyFileSync(path.join(source, file), path.join(stage, file));
    }
  }
  for (const [file, from] of [['LICENSE', root], ['README.md', source]]) {
    const content = fs.readFileSync(path.join(from, file));
    fs.writeFileSync(path.join(stage, file), preview ? content.toString('utf8').replace(/\r\n/g, '\n') : content);
  }

  const exports = {};
  for (const [key, value] of Object.entries(manifest.exports)) {
    if (value.startsWith('./src/')) {
      const compiled = value.replace('./src/', './dist/').replace(/\.ts$/, '.js');
      exports[key] = preview
        ? previewEntry(program, path.resolve(source, value), stage, compiled)
        : { types: compiled.replace(/\.js$/, '.d.ts'), ...(isNative ? { 'react-native': value } : {}), default: compiled };
    } else {
      exports[key] = value;
    }
  }
  const packed = {
    ...manifest,
    type: 'commonjs',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    exports,
    files: ['dist', 'LICENSE', 'README.md', ...(!preview ? ['src'] : []),
      ...(isNative ? ['android', 'ios', 'scripts', 'app.plugin.js', 'expo-module.config.json', 'ModelCommonsNative.podspec'] : [])],
  };
  if (preview) {
    delete packed.private;
    packed.version = previewVersions[name];
    packed.engines = { node: '>=20.19.0' };
    packed.publishConfig = { access: 'public', registry: publicRegistry, tag };
    for (const [dependency, version] of Object.entries(packed.dependencies ?? {})) {
      assert.ok(previewVersions[dependency], `${name}: preview dependency has no release version: ${dependency}`);
      assert.equal(version, packages.find((item) => item.manifest.name === dependency).manifest.version,
        `${name}: review the source dependency before translating it to a preview version`);
    }
    if (packed.dependencies) {
      packed.dependencies = Object.fromEntries(Object.keys(packed.dependencies).map((dependency) => [dependency, previewVersions[dependency]]));
    }
  }
  writeJson(path.join(stage, 'package.json'), packed);

  const filename = archiveName(name, packed.version);
  npm(['pack', '--offline', '--ignore-scripts', '--json', '--cache', path.join(temp, 'npm-cache'),
    '--pack-destination', temp], stage, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  const artifact = path.join(temp, filename);
  const info = fs.lstatSync(artifact);
  assert.ok(info.isFile() && info.size > 0, `Missing archive: ${filename}`);
  return {
    name, version: packed.version, filename, sha256: sha256(fs.readFileSync(artifact)),
    sourceSha256: sourceHash(directory, inputs, preview),
  };
}

const work = temporaryDirectory('pack');
try {
  const output = path.join(work.directory, 'compiled');
  const program = compile(output);
  const records = packages.map((item) => stagePackage(item, work.directory, output, program));
  fs.mkdirSync(destination, { recursive: true });
  for (const { filename } of records) {
    fs.copyFileSync(path.join(work.directory, filename), path.join(destination, filename));
  }
  writeJson(path.join(destination, 'provenance.json'), {
    schema: 1, generatedAt: new Date().toISOString(), packages: records,
  });
  console.log(`Packed ${records.length} ${preview ? 'preview' : 'local'} packages into ${destination}`);
} finally {
  work.remove();
}

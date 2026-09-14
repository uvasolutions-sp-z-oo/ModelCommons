import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// The build hook is CommonJS because npm invokes it before Metro or TypeScript.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PATCH_ID, applyLlamaRnAndroidFdPatch } = require(
  '../../modules/model-commons-native/scripts/patch-llama-rn-android-fd.cjs'
);

const temporary: string[] = [];
afterEach(() => {
  for (const directory of temporary.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('llama.rn Android descriptor source patch', () => {
  it('is pinned, fail-closed, and idempotent against the installed 0.12.9 source', () => {
    const sourceRoot = path.dirname(require.resolve('llama.rn/package.json'));
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'modelcommons-llama-fd-'));
    temporary.push(fixture);
    const files = [
      'package.json', 'src/types.ts', 'src/index.ts', 'cpp/common/common.h',
      'cpp/common/common.cpp', 'cpp/jsi/JSIParams.cpp', 'android/src/main/CMakeLists.txt',
    ];
    for (const relative of files) {
      const destination = path.join(fixture, relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(sourceRoot, relative), destination);
    }

    const first = applyLlamaRnAndroidFdPatch(fixture);
    const second = applyLlamaRnAndroidFdPatch(fixture);
    expect(first.patchId).toBe(PATCH_ID);
    expect(second).toEqual({ patchId: PATCH_ID, changed: false });
    expect(fs.readFileSync(path.join(fixture, 'cpp/common/common.cpp'), 'utf8')).toContain(
      'llama_model_load_from_file_ptr(stream, mparams)'
    );
    expect(fs.readFileSync(path.join(fixture, 'src/index.ts'), 'utf8')).toContain(
      "ownership: 'runtime-validates-and-duplicates-descriptor'"
    );
    const params = fs.readFileSync(path.join(fixture, 'cpp/jsi/JSIParams.cpp'), 'utf8');
    expect(params).toContain('fcntl(borrowed_model_fd, F_DUPFD_CLOEXEC, 0)');
    expect(params).toContain('descriptor_stat.st_ino');
    expect(params).toContain('lseek(owned_model_fd, 0, SEEK_SET) == 0');
    expect(fs.readFileSync(path.join(fixture, 'cpp/common/common.h'), 'utf8')).toContain('fd_owner');
    expect(fs.readFileSync(path.join(fixture, 'android/src/main/CMakeLists.txt'), 'utf8')).toContain(
      'requires RNLLAMA_BUILD_FROM_SOURCE=ON'
    );
  });
});

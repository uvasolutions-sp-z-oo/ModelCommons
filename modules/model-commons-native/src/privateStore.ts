import { ModelCommonsError, assertSafeRelativePath } from '@modelcommons/protocol';
import type { WriteStorePort } from '@modelcommons/model-store';
import nativeModule from './nativeModule';
import { callNative } from './nativeError';
let portSequence = 0;

async function operation<T>(name: string, path = '', value = ''): Promise<T> {
  if (!nativeModule?.privateModelOperation) {
    throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'Private model storage requires a new native build.');
  }
  return callNative(() => nativeModule.privateModelOperation!(name, path, value) as Promise<T>, {
    fallbackCode: 'STORAGE_UNAVAILABLE', fallbackMessage: 'Private model storage operation failed.',
  });
}

/** Resolve the sandbox root at runtime; callers persist model IDs, never this URI. */
export async function createPrivateStorePort(): Promise<WriteStorePort> {
  const identity = await operation<string>('identity');
  const portId = ++portSequence;
  let sequence = 0;
  return {
    identity,
    readText: (path) => operation('read', assertSafeRelativePath(path)),
    stat: (path) => operation('stat', assertSafeRelativePath(path)),
    sha256: (path) => operation('sha256', assertSafeRelativePath(path)),
    atomicText: (path, value) => operation('write', assertSafeRelativePath(path), value),
    mkdir: (path) => operation('mkdir', assertSafeRelativePath(path)),
    remove: (path) => operation('remove', assertSafeRelativePath(path)),
    move: (from, to) => operation('move', assertSafeRelativePath(from), assertSafeRelativePath(to)),
    freeBytes: () => operation('free'),
    async acquire(path) {
      const uri = await operation<string>('uri', assertSafeRelativePath(path));
      return { id: `private-${portId}-${++sequence}`, uri, async release() {} };
    },
    async download(url, path, options) {
      if (!nativeModule?.downloadPrivateModel) throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'Native model provisioning is unavailable.');
      if (options.signal?.aborted) throw new ModelCommonsError('USER_CANCELLED', 'Provisioning cancelled.');
      const id = `download-${portId}-${Date.now()}-${++sequence}`;
      // Start first so cancellation is addressed to an admitted native operation.
      const job = callNative(() => nativeModule.downloadPrivateModel!(
        id, url, assertSafeRelativePath(path), options.expectedBytes, [...options.origins]
      ), { fallbackCode: 'STORAGE_UNAVAILABLE', fallbackMessage: 'Model provisioning failed.' });
      const abort = () => { void operation('cancel', id).catch(() => undefined); };
      options.signal?.addEventListener('abort', abort, { once: true });
      const poll = setInterval(() => {
        if (options.signal?.aborted) abort();
        void operation<number>('progress', id).then((written) => {
          options.onProgress?.(written, options.expectedBytes);
        }).catch(() => undefined);
      }, 250);
      try {
        if (options.signal?.aborted) abort();
        await job;
        if (options.signal?.aborted) throw new ModelCommonsError('USER_CANCELLED', 'Provisioning cancelled.');
        options.onProgress?.(options.expectedBytes, options.expectedBytes);
      } finally {
        clearInterval(poll);
        options.signal?.removeEventListener('abort', abort);
      }
    },
    async importFile(source, path, signal, expectedBytes) {
      // Only a fresh OS picker grant, never an arbitrary URI supplied in settings.
      if (source !== 'user-picker' || !Number.isSafeInteger(expectedBytes) || !expectedBytes) {
        throw new ModelCommonsError('PERMISSION_REQUIRED', 'Choose an approved GGUF using the private import picker.');
      }
      if (!nativeModule?.importPrivateModel) throw new ModelCommonsError('RUNTIME_UNAVAILABLE', 'Private import requires a new native build.');
      if (signal?.aborted) throw new ModelCommonsError('USER_CANCELLED', 'Import cancelled.');
      const id = `import-${portId}-${Date.now()}-${++sequence}`;
      const abort = () => { void operation('cancel', id).catch(() => undefined); };
      const job = callNative(() => nativeModule.importPrivateModel!(id, assertSafeRelativePath(path), expectedBytes), {
        fallbackCode: 'STORAGE_UNAVAILABLE', fallbackMessage: 'Private import failed.',
      });
      signal?.addEventListener('abort', abort, { once: true });
      const poll = setInterval(() => { if (signal?.aborted) abort(); }, 250);
      try {
        if (signal?.aborted) abort();
        await job;
        if (signal?.aborted) throw new ModelCommonsError('USER_CANCELLED', 'Import cancelled.');
      } finally { clearInterval(poll); signal?.removeEventListener('abort', abort); }
    },
  };
}

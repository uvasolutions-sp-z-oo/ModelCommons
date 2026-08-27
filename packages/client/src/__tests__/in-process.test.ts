import { describe, expect, it, vi } from 'vitest';
import { PROTOCOL_VERSION } from '@modelcommons/protocol';
import { InProcessTransport, type InProcessHost } from '../in-process';

describe('InProcessTransport protocol gate', () => {
  it('rejects listModels before the incompatible host can access its catalog', async () => {
    const listModels = vi.fn(async () => []);
    const host: InProcessHost = {
      protocolVersion: '9.0.0',
      listModels,
      async createSession() {
        throw new Error('not used');
      },
    };

    await expect(new InProcessTransport(host).listModels()).rejects.toMatchObject({
      code: 'PROTOCOL_VERSION_UNSUPPORTED',
      details: {
        offeredProtocolVersion: '9.0.0',
        requiredProtocolVersion: PROTOCOL_VERSION,
      },
    });
    expect(listModels).not.toHaveBeenCalled();
  });

  it('rejects transport alias targets that rely on inherited identity fields', () => {
    const host: InProcessHost = {
      protocolVersion: PROTOCOL_VERSION,
      async listModels() { return []; },
      async createSession() { throw new Error('not used'); },
    };
    const inheritedTarget = Object.create({ modelId: 'local/model' }) as { modelId: string };

    expect(() => new InProcessTransport(host, {
      aliases: { legacy: inheritedTarget },
    })).toThrowError(expect.objectContaining({ code: 'INTEGRITY_FAILED' }));
  });
});

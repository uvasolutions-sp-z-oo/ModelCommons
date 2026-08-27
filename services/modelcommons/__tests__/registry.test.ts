import { describe, expect, it } from 'vitest';
import { MEDGEMMA_REFERENCE } from '../catalog';
import {
  acceptModelLicense,
  assertLicenseAccepted,
  createEmptyRegistry,
  removeModelRecord,
  updateModelState,
} from '../registry';

describe('registry state', () => {
  it('increments the revision for atomic publication state', () => {
    const next = updateModelState(createEmptyRegistry(1), MEDGEMMA_REFERENCE, 'VERIFYING', { now: 2 });
    expect(next.revision).toBe(1);
    expect(next.models[0].state).toBe('VERIFYING');
  });

  it('requires explicit acceptance for separately licensed weights', () => {
    const empty = createEmptyRegistry(1);
    expect(() => assertLicenseAccepted(empty, MEDGEMMA_REFERENCE)).toThrow();
    expect(() => assertLicenseAccepted(acceptModelLicense(empty, MEDGEMMA_REFERENCE, 2), MEDGEMMA_REFERENCE)).not.toThrow();
  });

  it('binds each model ID to one immutable revision and removes deleted records', () => {
    const ready = updateModelState(createEmptyRegistry(1), MEDGEMMA_REFERENCE, 'READY', { now: 2 });
    expect(() => updateModelState(
      ready,
      { ...MEDGEMMA_REFERENCE, revision: 'different' },
      'DOWNLOADING'
    )).toThrow();
    expect(removeModelRecord(ready, MEDGEMMA_REFERENCE, 3).models).toHaveLength(0);
  });
});

import { describe, expect, it } from 'vitest';
import { isProtocolVersionCompatible, parseProtocolVersion } from '../version';

describe('protocol versioning', () => {
  it('accepts the same major and a newer offered minor', () => {
    expect(isProtocolVersionCompatible('0.3.0', '0.1.9')).toBe(true);
  });

  it('rejects older minors and different majors', () => {
    expect(isProtocolVersionCompatible('0.1.9', '0.2.0')).toBe(false);
    expect(isProtocolVersionCompatible('1.0.0', '0.1.0')).toBe(false);
  });

  it('rejects non-semver input', () => {
    expect(parseProtocolVersion('v1')).toBeNull();
  });
});

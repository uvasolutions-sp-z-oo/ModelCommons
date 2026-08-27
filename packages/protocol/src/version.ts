export const MODELCOMMONS_PROTOCOL = 'modelcommons.protocol' as const;
export const PROTOCOL_VERSION = '0.1.0' as const;

export interface ParsedProtocolVersion {
  major: number;
  minor: number;
  patch: number;
}

export function parseProtocolVersion(value: string): ParsedProtocolVersion | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (![major, minor, patch].every(Number.isSafeInteger)) return null;
  return { major, minor, patch };
}

/**
 * A peer is compatible when it speaks the same major version and implements at
 * least the minor version required by the caller. Patch versions never add
 * protocol surface.
 */
export function isProtocolVersionCompatible(
  offered: string,
  required: string = PROTOCOL_VERSION
): boolean {
  const offeredVersion = parseProtocolVersion(offered);
  const requiredVersion = parseProtocolVersion(required);

  return !!(
    offeredVersion &&
    requiredVersion &&
    offeredVersion.major === requiredVersion.major &&
    offeredVersion.minor >= requiredVersion.minor
  );
}

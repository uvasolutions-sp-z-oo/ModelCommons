import { ModelCommonsError } from './errors';

const STORAGE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const WINDOWS_DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

function isPortableSegment(value: string): boolean {
  return !value.endsWith('.') && !WINDOWS_DEVICE_NAME.test(value);
}

function pathFailure(value: string, reason: string): never {
  throw new ModelCommonsError('INTEGRITY_FAILED', `Unsafe relative path: ${reason}.`, {
    details: { value },
  });
}

export function assertSafeStorageId(value: string): string {
  if (!STORAGE_ID_PATTERN.test(value) || !isPortableSegment(value)) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Invalid model storage identifier.', {
      details: { value },
    });
  }
  return value;
}

export function assertSafeRelativePath(value: string): string {
  const candidate = value.trim();
  if (!candidate) {
    return pathFailure(value, 'empty path');
  }
  if (candidate.includes('\0')) {
    return pathFailure(value, 'NUL byte');
  }
  if (candidate.includes('\\')) {
    return pathFailure(value, 'backslashes are not allowed');
  }
  if (candidate.startsWith('/') || /^[a-zA-Z]:/.test(candidate)) {
    return pathFailure(value, 'absolute path');
  }
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(candidate)) {
    return pathFailure(value, 'URI schemes are not allowed');
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    return pathFailure(value, 'malformed percent encoding');
  }

  if (decoded.includes('\\') || decoded.startsWith('/')) {
    return pathFailure(value, 'encoded absolute path');
  }

  // Paths are later joined to file URLs by native transports. Reject all
  // percent encoding and URL delimiter characters so no layer can interpret
  // the same manifest path differently.
  if (decoded !== candidate) {
    return pathFailure(value, 'percent encoding is not allowed');
  }

  const segments = decoded.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return pathFailure(value, 'empty or traversal segment');
  }
  if (segments.some((segment) => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(segment))) {
    return pathFailure(value, 'unsupported filename characters');
  }
  if (segments.some((segment) => !isPortableSegment(segment))) {
    return pathFailure(value, 'non-portable filename');
  }

  return candidate;
}

export function assertHttpsUrl(value: string, allowHttpLoopback = false): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Artifact URL is invalid.', {
      details: { value },
      cause: error,
    });
  }

  const isLoopback =
    parsed.hostname === '127.0.0.1' || parsed.hostname === '::1' || parsed.hostname === 'localhost';
  if (parsed.protocol !== 'https:' && !(allowHttpLoopback && parsed.protocol === 'http:' && isLoopback)) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Artifact URLs must use HTTPS.', {
      details: { protocol: parsed.protocol, host: parsed.hostname },
    });
  }
  if (parsed.username || parsed.password) {
    throw new ModelCommonsError('INTEGRITY_FAILED', 'Credentials must not be embedded in artifact URLs.');
  }

  return parsed.toString();
}

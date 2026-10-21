import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

/**
 * Hashes a plain-text password using cryptographically secure scrypt + 16-byte salt.
 */
export function hashPassword(password: string): string {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a plain-text password against a stored `salt:hash` string using constant-time comparison.
 */
export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!password || !storedHash || typeof storedHash !== 'string') {
    return false;
  }
  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }
  const [salt, keyHex] = parts;
  if (!salt || !keyHex || keyHex.length !== KEY_LENGTH * 2) {
    return false;
  }
  // Validate hex characters
  if (!/^[0-9a-fA-F]+$/.test(keyHex) || !/^[0-9a-fA-F]+$/.test(salt)) {
    return false;
  }
  try {
    const keyBuffer = Buffer.from(keyHex, 'hex');
    if (keyBuffer.length !== KEY_LENGTH) {
      return false;
    }
    const derivedBuffer = scryptSync(password, salt, KEY_LENGTH);
    return timingSafeEqual(derivedBuffer, keyBuffer);
  } catch {
    return false;
  }
}

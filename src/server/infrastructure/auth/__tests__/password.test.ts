import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../password';

describe('Password Utility', () => {
  it('hashes password and verifies correctly', () => {
    const password = 'SuperSecretPassword123!';
    const hash = hashPassword(password);

    expect(hash).toContain(':');
    expect(verifyPassword(password, hash)).toBe(true);
  });

  it('rejects incorrect password', () => {
    const password = 'SuperSecretPassword123!';
    const hash = hashPassword(password);

    expect(verifyPassword('WrongPassword', hash)).toBe(false);
    expect(verifyPassword('supersecretpassword123!', hash)).toBe(false);
  });

  it('generates different salts and hashes for the same password', () => {
    const password = 'IdenticalPassword';
    const hash1 = hashPassword(password);
    const hash2 = hashPassword(password);

    expect(hash1).not.toBe(hash2);
    expect(verifyPassword(password, hash1)).toBe(true);
    expect(verifyPassword(password, hash2)).toBe(true);
  });

  it('handles empty, null, or malformed hashes safely', () => {
    expect(verifyPassword('password', null)).toBe(false);
    expect(verifyPassword('password', undefined)).toBe(false);
    expect(verifyPassword('password', '')).toBe(false);
    expect(verifyPassword('password', 'malformed_hash')).toBe(false);
    expect(verifyPassword('password', 'salt:invalidhex!')).toBe(false);
  });
});

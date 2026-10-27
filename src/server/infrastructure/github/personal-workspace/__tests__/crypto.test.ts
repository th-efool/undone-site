import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  encryptToken,
  decryptToken,
  deriveWorkspaceKey,
} from '../crypto';

describe('Personal Workspace Crypto (AES-256-GCM HKDF)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Key derivation', () => {
    it('generates consistent 32-byte key for same user and secret', () => {
      const key1 = deriveWorkspaceKey('user_123');
      const key2 = deriveWorkspaceKey('user_123');

      expect(key1).toBeInstanceOf(Buffer);
      expect(key1.length).toBe(32);
      expect(key1.equals(key2)).toBe(true);
    });

    it('derives distinct keys for different users', () => {
      const keyA = deriveWorkspaceKey('user_alpha');
      const keyB = deriveWorkspaceKey('user_beta');

      expect(keyA.equals(keyB)).toBe(false);
    });

    it('throws when userId is empty or invalid', () => {
      expect(() => deriveWorkspaceKey('')).toThrow(/Valid userId string is required/);
      // @ts-expect-error testing invalid input runtime safety
      expect(() => deriveWorkspaceKey(null)).toThrow(/Valid userId string is required/);
    });

    it('derives different keys when WORKSPACE_ENCRYPTION_SECRET changes', () => {
      process.env.WORKSPACE_ENCRYPTION_SECRET = 'secret-test-one-1234567890';
      const key1 = deriveWorkspaceKey('user_123');

      process.env.WORKSPACE_ENCRYPTION_SECRET = 'secret-test-two-0987654321';
      const key2 = deriveWorkspaceKey('user_123');

      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('Roundtrip encryption & decryption', () => {
    it('encrypts and decrypts standard GitHub OAuth access token', async () => {
      const token = 'ghu_1234567890abcdefghijklmnopqrstuvwxyz';
      const userId = 'usr_test_123';

      const encrypted = await encryptToken(token, userId);
      expect(encrypted).toMatch(/^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);

      const decrypted = await decryptToken(encrypted, userId);
      expect(decrypted).toBe(token);
    });

    it('encrypts and decrypts long refresh tokens and arbitrary payload strings', async () => {
      const longToken = 'ghr_' + 'A'.repeat(256) + '_special!@#$%^&*()_+{}[]:;<>?';
      const userId = 'usr_long_token';

      const encrypted = await encryptToken(longToken, userId);
      const decrypted = await decryptToken(encrypted, userId);

      expect(decrypted).toBe(longToken);
    });

    it('handles empty token string properly', async () => {
      const emptyToken = '';
      const userId = 'usr_empty_token';

      const encrypted = await encryptToken(emptyToken, userId);
      expect(encrypted).toMatch(/^v1:[0-9a-f]{24}:[0-9a-f]{32}:$/);

      const decrypted = await decryptToken(encrypted, userId);
      expect(decrypted).toBe('');
    });

    it('produces unique IV and ciphertext on multiple encryptions of same plaintext', async () => {
      const token = 'ghu_stable_token_content';
      const userId = 'usr_unique_iv';

      const enc1 = await encryptToken(token, userId);
      const enc2 = await encryptToken(token, userId);

      expect(enc1).not.toBe(enc2);
      expect(await decryptToken(enc1, userId)).toBe(token);
      expect(await decryptToken(enc2, userId)).toBe(token);
    });
  });

  describe('User isolation & key separation', () => {
    it('prevents user B from decrypting token encrypted by user A', async () => {
      const token = 'ghu_confidential_token';
      const userA = 'user_alice';
      const userB = 'user_bob';

      const encrypted = await encryptToken(token, userA);

      await expect(decryptToken(encrypted, userB)).rejects.toThrow(
        /Token decryption failed: authentication tag mismatch, tampering, or invalid key/
      );
    });
  });

  describe('Tampering and integrity verification', () => {
    it('rejects tampered ciphertext', async () => {
      const token = 'ghu_secret_payload_123';
      const userId = 'usr_tamper_test';

      const encrypted = await encryptToken(token, userId);
      const parts = encrypted.split(':');
      const cipherHex = parts[3];

      // Flip the last character in ciphertext
      const flippedChar = cipherHex.endsWith('a') ? 'b' : 'a';
      const tamperedCipher = cipherHex.slice(0, -1) + flippedChar;
      const tamperedPayload = `v1:${parts[1]}:${parts[2]}:${tamperedCipher}`;

      await expect(decryptToken(tamperedPayload, userId)).rejects.toThrow(
        /Token decryption failed/
      );
    });

    it('rejects tampered authentication tag', async () => {
      const token = 'ghu_secret_payload_123';
      const userId = 'usr_tamper_test';

      const encrypted = await encryptToken(token, userId);
      const parts = encrypted.split(':');
      const tagHex = parts[2];

      // Flip a character in the auth tag
      const flippedChar = tagHex.endsWith('0') ? '1' : '0';
      const tamperedTag = tagHex.slice(0, -1) + flippedChar;
      const tamperedPayload = `v1:${parts[1]}:${tamperedTag}:${parts[3]}`;

      await expect(decryptToken(tamperedPayload, userId)).rejects.toThrow(
        /Token decryption failed/
      );
    });

    it('rejects tampered IV', async () => {
      const token = 'ghu_secret_payload_123';
      const userId = 'usr_tamper_test';

      const encrypted = await encryptToken(token, userId);
      const parts = encrypted.split(':');
      const ivHex = parts[1];

      // Flip a character in the IV
      const flippedChar = ivHex.endsWith('0') ? '1' : '0';
      const tamperedIv = ivHex.slice(0, -1) + flippedChar;
      const tamperedPayload = `v1:${tamperedIv}:${parts[2]}:${parts[3]}`;

      await expect(decryptToken(tamperedPayload, userId)).rejects.toThrow(
        /Token decryption failed/
      );
    });

    it('rejects invalid payload prefix', async () => {
      const payload = 'v2:0123456789abcdef01234567:0123456789abcdef0123456789abcdef:aabbcc';
      await expect(decryptToken(payload, 'usr_test')).rejects.toThrow(
        /Invalid encrypted payload format: expected "v1:<iv>:<authTag>:<ciphertext>"/
      );
    });

    it('rejects malformed payload structure missing components', async () => {
      await expect(decryptToken('invalid-non-colon-string', 'usr_test')).rejects.toThrow(
        /Invalid encrypted payload format/
      );
      await expect(decryptToken('v1:only-two-parts', 'usr_test')).rejects.toThrow(
        /Invalid encrypted payload format/
      );
    });

    it('rejects invalid IV length or non-hex characters', async () => {
      const shortIv = 'v1:abcd:0123456789abcdef0123456789abcdef:1234';
      await expect(decryptToken(shortIv, 'usr_test')).rejects.toThrow(
        /Invalid IV in encrypted payload: expected 24 hex characters/
      );

      const nonHexIv = 'v1:zzzzzzzzzzzzzzzzzzzzzzzz:0123456789abcdef0123456789abcdef:1234';
      await expect(decryptToken(nonHexIv, 'usr_test')).rejects.toThrow(
        /Invalid IV in encrypted payload/
      );
    });

    it('rejects invalid auth tag length or non-hex characters', async () => {
      const shortTag = 'v1:0123456789abcdef01234567:0123456789abcdef:1234';
      await expect(decryptToken(shortTag, 'usr_test')).rejects.toThrow(
        /Invalid auth tag in encrypted payload: expected 32 hex characters/
      );
    });

    it('rejects invalid ciphertext with odd length hex', async () => {
      const oddCipher = 'v1:0123456789abcdef01234567:0123456789abcdef0123456789abcdef:123';
      await expect(decryptToken(oddCipher, 'usr_test')).rejects.toThrow(
        /Invalid ciphertext in encrypted payload: must be a valid hex-encoded string/
      );
    });

    it('throws when plaintextToken is not a string', async () => {
      // @ts-expect-error runtime validation
      await expect(encryptToken(null, 'usr_test')).rejects.toThrow(/plaintextToken must be a string/);
    });
  });
});

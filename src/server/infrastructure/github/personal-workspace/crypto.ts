import crypto from 'node:crypto';

/**
 * Retrieves the root encryption secret for personal workspace tokens.
 * Priority: WORKSPACE_ENCRYPTION_SECRET -> NEXTAUTH_SECRET -> development fallback.
 */
function getEncryptionSecret(): string {
  return (
    process.env.WORKSPACE_ENCRYPTION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'undone-dev-secret-key-32-bytes-long!!'
  );
}

/**
 * Derives a deterministic user salt from the userId.
 */
function getUserSalt(userId: string): Buffer {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw new Error('Valid userId string is required for encryption/decryption key derivation');
  }
  return Buffer.from(userId, 'utf-8');
}

/**
 * Derives a 32-byte cryptographic key for AES-256-GCM using HKDF-SHA256
 * bound to the user's ID and personal workspace domain context.
 */
export function deriveWorkspaceKey(userId: string): Buffer {
  const secret = getEncryptionSecret();
  const userSalt = getUserSalt(userId);
  const info = Buffer.from('undone-personal-workspace-v1');
  const derivedKeyArrayBuffer = crypto.hkdfSync('sha256', secret, userSalt, info, 32);
  return Buffer.from(derivedKeyArrayBuffer);
}

/**
 * Encrypts a plaintext personal workspace token using AES-256-GCM.
 *
 * Output format:
 *   v1:${iv.hex}:${authTag.hex}:${ciphertext.hex}
 *
 * @param plaintextToken The raw token string to encrypt
 * @param userId The ID of the owning user for key derivation
 * @returns Compact serialized encrypted token payload
 */
export async function encryptToken(plaintextToken: string, userId: string): Promise<string> {
  if (typeof plaintextToken !== 'string') {
    throw new Error('plaintextToken must be a string');
  }

  const key = deriveWorkspaceKey(userId);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintextToken, 'utf-8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypts an encrypted token payload using AES-256-GCM with authenticated key verification.
 *
 * @param encryptedPayload Serialized payload formatted as v1:<iv>:<authTag>:<ciphertext>
 * @param userId The ID of the owning user for key derivation
 * @returns Decrypted plaintext token string
 * @throws Error if the payload is malformed, has been tampered with, or tag verification fails
 */
export async function decryptToken(encryptedPayload: string, userId: string): Promise<string> {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') {
    throw new Error('Invalid encrypted payload: payload must be a non-empty string');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error(
      `Invalid encrypted payload format: expected "v1:<iv>:<authTag>:<ciphertext>", received "${encryptedPayload.slice(0, 30)}..."`
    );
  }

  const [, ivHex, authTagHex, ciphertextHex] = parts;

  // IV must be 12 bytes = 24 hex characters
  if (!/^[0-9a-fA-F]{24}$/.test(ivHex)) {
    throw new Error(
      `Invalid IV in encrypted payload: expected 24 hex characters (12 bytes), received ${ivHex.length}`
    );
  }

  // Auth tag must be 16 bytes = 32 hex characters
  if (!/^[0-9a-fA-F]{32}$/.test(authTagHex)) {
    throw new Error(
      `Invalid auth tag in encrypted payload: expected 32 hex characters (16 bytes), received ${authTagHex.length}`
    );
  }

  // Ciphertext must be valid even hex string (or empty for empty token)
  if (ciphertextHex.length > 0 && (!/^[0-9a-fA-F]+$/.test(ciphertextHex) || ciphertextHex.length % 2 !== 0)) {
    throw new Error('Invalid ciphertext in encrypted payload: must be a valid hex-encoded string');
  }

  const key = deriveWorkspaceKey(userId);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString('utf-8');
  } catch (err) {
    const originalMessage = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Token decryption failed: authentication tag mismatch, tampering, or invalid key (${originalMessage})`
    );
  }
}

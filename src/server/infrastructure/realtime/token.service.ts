import 'server-only';
import * as jose from 'jose';

export interface ConnectionTokenResult {
  token: string;
  expiresAt: number; // Unix timestamp in seconds
  endpoint: string;
}

const DEFAULT_ISSUER = 'undone-messaging';
const DEFAULT_AUDIENCE = 'undone-centrifugo';
const DEFAULT_LIFETIME_SECONDS = 300; // 5 minutes

function getSigningSecret(): Uint8Array {
  const secret = process.env.CENTRIFUGO_TOKEN_HMAC_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CENTRIFUGO_TOKEN_HMAC_SECRET_KEY is required in production');
    }
    return new TextEncoder().encode('undone_dev_secret_key_minimum_32_characters_long');
  }
  if (secret.length < 32 && process.env.NODE_ENV === 'production') {
    throw new Error('CENTRIFUGO_TOKEN_HMAC_SECRET_KEY must be at least 32 characters in production');
  }
  return new TextEncoder().encode(secret);
}

export const tokenService = {
  async createConnectionToken(userId: string): Promise<ConnectionTokenResult> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('userId is required to generate connection token');
    }

    const secret = getSigningSecret();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + DEFAULT_LIFETIME_SECONDS;
    const issuer = process.env.CENTRIFUGO_ISSUER || DEFAULT_ISSUER;
    const audience = process.env.CENTRIFUGO_AUDIENCE || DEFAULT_AUDIENCE;

    const token = await new jose.SignJWT({ sub: userId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setIssuer(issuer)
      .setAudience(audience)
      .setExpirationTime(expiresAt)
      .sign(secret);

    const endpoint =
      process.env.NEXT_PUBLIC_CENTRIFUGO_WS_URL || 'ws://localhost:8000/connection/websocket';

    return {
      token,
      expiresAt,
      endpoint,
    };
  },

  async verifyConnectionToken(token: string): Promise<{ userId: string; expiresAt: number }> {
    const secret = getSigningSecret();
    const issuer = process.env.CENTRIFUGO_ISSUER || DEFAULT_ISSUER;
    const audience = process.env.CENTRIFUGO_AUDIENCE || DEFAULT_AUDIENCE;

    const { payload } = await jose.jwtVerify(token, secret, {
      issuer,
      audience,
    });

    if (!payload.sub) {
      throw new Error('Token payload missing sub claim');
    }

    return {
      userId: payload.sub,
      expiresAt: payload.exp ?? 0,
    };
  },
};

import { NextResponse } from 'next/server';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import jwt from 'jsonwebtoken';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const secretKey = process.env.CENTRIFUGO_TOKEN_HMAC_SECRET_KEY;
    
    if (!secretKey) {
      console.error('CENTRIFUGO_TOKEN_HMAC_SECRET_KEY is not configured.');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    // Centrifugo connection token payload
    const payload = {
      sub: session.user.id,
      info: {
        name: session.user.name,
        email: session.user.email,
      },
    };

    // Generate HMAC SHA-256 JWT
    const token = jwt.sign(payload, secretKey, {
      algorithm: 'HS256',
      expiresIn: '24h', // Good practice to have an expiration
    });

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error generating Centrifugo token:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

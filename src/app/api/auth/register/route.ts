import { NextRequest, NextResponse } from 'next/server';
import { userRepo } from '@/src/server/infrastructure/db/postgres/repositories/user.repo';
import { hashPassword } from '@/src/server/infrastructure/auth/password';

export const dynamic = 'force-dynamic';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,24}$/.test(username);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, username, password } = body ?? {};

    if (!email || typeof email !== 'string' || !isValidEmail(email.trim())) {
      return NextResponse.json(
        { error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Determine and validate username
    let cleanUsername = username && typeof username === 'string' ? username.trim().replace(/^@+/, '') : '';
    if (!cleanUsername) {
      const emailPrefix = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 20);
      cleanUsername = emailPrefix.length >= 3 ? emailPrefix : `user_${Math.random().toString(36).substring(2, 8)}`;
    }

    if (!isValidUsername(cleanUsername)) {
      return NextResponse.json(
        { error: 'Username must be 3-24 characters containing only letters, numbers, and underscores.' },
        { status: 400 }
      );
    }

    // Check if email already taken
    const existingByEmail = await userRepo.findByEmail(cleanEmail);
    if (existingByEmail) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    // Check if username already taken
    const existingByUsername = await userRepo.findByUsername(cleanUsername);
    if (existingByUsername) {
      return NextResponse.json(
        { error: 'This username is already taken. Please choose another.' },
        { status: 409 }
      );
    }

    const passwordHash = hashPassword(password);
    const user = await userRepo.create({
      email: cleanEmail,
      username: cleanUsername,
      name: name && typeof name === 'string' && name.trim() ? name.trim() : cleanUsername,
      passwordHash,
    });

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[auth/register] Failed to create account:', error);
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}

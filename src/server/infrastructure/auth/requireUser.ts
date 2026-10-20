// src/server/infrastructure/auth/requireUser.ts
// Throws if the user is not authenticated — use in protected API routes

import { getUser } from './getUser';
import { isSharedGuestAccount } from './guestAccount';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

export async function requireUser() {
  const user = await getUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  return user;
}

export async function requirePermittedMessagingUser() {
  const user = await requireUser();
  if (isSharedGuestAccount(user)) {
    throw new Response(JSON.stringify({ error: 'Guest accounts are not permitted to use private messaging' }), { status: 403 });
  }
  const restriction = await prisma.userRestriction.findUnique({
    where: { userId: user.id },
    select: { id: true, expiresAt: true },
  });
  if (restriction && (!restriction.expiresAt || restriction.expiresAt > new Date())) {
    throw new Response(JSON.stringify({ error: 'Account messaging privileges are restricted' }), { status: 403 });
  }
  return user;
}

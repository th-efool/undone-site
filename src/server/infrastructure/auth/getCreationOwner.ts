import 'server-only';
import { cache } from 'react';
import { getUser } from './getUser';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

export const getCreationOwner = cache(async function getCreationOwner(): Promise<string | null> {
  const user = await getUser();
  if (!user?.id) return null;
  try {
    let owner = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true } });
    if (!owner && user.email) {
      owner = await prisma.user.findUnique({ where: { email: user.email }, select: { id: true } });
      if (owner) return owner.id;
      owner = await prisma.user.upsert({
        where: { email: user.email },
        update: {},
        create: {
          id: user.id,
          email: user.email,
          name: user.name || 'Explorer',
          username: user.email.split('@')[0],
        },
        select: { id: true },
      });
    }
    return owner?.id ?? null;
  } catch (error) {
    console.warn('[getCreationOwner] Database check failed:', error);
    return null;
  }
});

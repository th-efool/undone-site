import 'server-only';
import { getUser } from './getUser';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

export async function getCreationOwner(): Promise<string | null> {
  const user = await getUser();
  if (!user?.id) return null;
  // A mock guest session cannot own foreign-key-backed drafts.
  const owner = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true } });
  return owner?.id ?? null;
}

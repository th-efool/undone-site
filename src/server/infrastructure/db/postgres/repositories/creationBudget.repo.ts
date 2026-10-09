import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { JobBudgetExceeded } from '@/src/server/domain/cohort-creation/durable-job';
import { prisma } from '../client';

/** Reservations are conservative: a crashed/uncertain request is still charged. */
export async function reserveBudget(tx: Prisma.TransactionClient, key: string, limit: number, expiresAt: Date) {
  const rows = await tx.$queryRaw<{ used: number }[]>`
    INSERT INTO "creation_budgets" ("key", "used", "expiresAt") VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET "used" = "creation_budgets"."used" + 1
    WHERE "creation_budgets"."used" < ${limit} RETURNING "used"`;
  if (!rows.length) throw new JobBudgetExceeded('Creation request budget exhausted. Try again later.');
}
export function hourlyBudget(scope: string, now = Date.now()) {
  const hour = Math.floor(now / 3600_000);
  return { key: `${scope}:${hour}`, expiresAt: new Date((hour + 2) * 3600_000) };
}

// Public legacy entry has a global hard cap until a trusted client-identity proxy is configured.
// Never trust a browser-supplied user ID or arbitrary forwarding header as a budget key.
export async function reservePublicRecommendation(kind: 'request' | 'model') {
  const budget = hourlyBudget(`public-recommendation:${kind}`);
  await prisma.$transaction(tx => reserveBudget(tx, budget.key, kind === 'request' ? 20 : 80, budget.expiresAt));
}

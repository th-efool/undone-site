-- Additive schema for Phase 1: Cohort Invitations, User Restrictions, and Creator/Community Backfill
-- Safe, idempotent execution without destructive operations.

CREATE TABLE IF NOT EXISTS public.cohort_invitations (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohortId" TEXT NOT NULL REFERENCES public.cohorts("id") ON DELETE CASCADE,
    "inviterId" TEXT NOT NULL REFERENCES public.users("id") ON DELETE CASCADE,
    "email" TEXT,
    "tokenHash" TEXT NOT NULL UNIQUE,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT REFERENCES public.users("id") ON DELETE SET NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "cohort_invitations_cohortId_idx" ON public.cohort_invitations("cohortId");
CREATE INDEX IF NOT EXISTS "cohort_invitations_tokenHash_idx" ON public.cohort_invitations("tokenHash");
CREATE INDEX IF NOT EXISTS "cohort_invitations_email_idx" ON public.cohort_invitations("email");

CREATE TABLE IF NOT EXISTS public.user_restrictions (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE REFERENCES public.users("id") ON DELETE CASCADE,
    "reason" TEXT,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "user_restrictions_userId_idx" ON public.user_restrictions("userId");

-- Backfill legitimate creator memberships where missing
INSERT INTO public.cohort_members ("cohortId", "userId", "role", "joinedAt")
SELECT c.id, c."creatorId", 'CREATOR'::"MemberRole", c."createdAt"
FROM public.cohorts c
WHERE NOT EXISTS (
    SELECT 1 FROM public.cohort_members cm
    WHERE cm."cohortId" = c.id AND cm."userId" = c."creatorId"
)
ON CONFLICT ("cohortId", "userId") DO NOTHING;

-- Backfill missing community hubs for existing cohorts
INSERT INTO public.communities ("id", "cohortId", "chatEnabled", "eventsEnabled", "createdAt", "updatedAt")
SELECT 'comm_' || c.id, c.id, true, true, c."createdAt", c."updatedAt"
FROM public.cohorts c
WHERE NOT EXISTS (
    SELECT 1 FROM public.communities comm
    WHERE comm."cohortId" = c.id
)
ON CONFLICT ("cohortId") DO NOTHING;

-- Backfill default 'general' channel for communities without one
INSERT INTO public.channels ("id", "name", "communityId", "createdAt", "updatedAt")
SELECT 'chan_' || comm.id || '_gen', 'general', comm.id, comm."createdAt", comm."updatedAt"
FROM public.communities comm
WHERE NOT EXISTS (
    SELECT 1 FROM public.channels ch
    WHERE ch."communityId" = comm.id AND ch.name = 'general'
);

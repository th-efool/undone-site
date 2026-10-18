import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
import React from 'react';
import dynamic from 'next/dynamic';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { notFound } from 'next/navigation';
import { mapDbCohortToUiCohort } from '@/src/server/infrastructure/db/postgres/mappers/cohortMapper';
import { NOINDEX_METADATA } from '@/src/server/domain/cohort/cohort-seo-render';

const Archives = dynamic(() => import('@/src/client/screens/cohort').then((mod) => mod.Archives));

export const metadata = NOINDEX_METADATA;

export default async function ArchivesPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  
  const dbCohort = await prisma.cohort.findFirst({
    where: { id: cohortId, ...accessibleCohortWhere((await auth())?.user?.id ?? null) },
    include: {
      creator: true,
      seasons: {
        include: {
          lessons: true,
        },
      },
    },
  });

  if (!dbCohort) {
    notFound();
  }

  const uiCohort = mapDbCohortToUiCohort(dbCohort);

  return <Archives cohortId={cohortId} cohort={uiCohort} />;
}

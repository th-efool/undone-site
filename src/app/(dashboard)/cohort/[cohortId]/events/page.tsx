import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
import React from 'react';
import dynamic from 'next/dynamic';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { mapDbCohortToUiCohort } from '@/src/server/infrastructure/db/postgres/mappers/cohortMapper';
import { notFound } from 'next/navigation';
import { NOINDEX_METADATA } from '@/src/server/domain/cohort/cohort-seo-render';

import type { Metadata } from 'next';

const Events = dynamic(() => import('@/src/client/screens/cohort').then((mod) => mod.Events));

export const metadata: Metadata = {
  ...NOINDEX_METADATA,
  title: 'Events',
};

export default async function EventsPage({ params }: { params: Promise<{ cohortId: string }> }) {
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

  return <Events cohortId={cohortId} cohort={uiCohort} />;
}

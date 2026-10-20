import React from 'react';
import dynamic from 'next/dynamic';
import { mapDbCohortToUiCohort } from '@/src/server/infrastructure/db/postgres/mappers/cohortMapper';
import { NOINDEX_METADATA } from '@/src/server/domain/cohort/cohort-seo-render';
import { getPublicCohort } from '@/src/server/domain/cohort/public-cohort';
import { PrivateHallOfFame } from './PrivateHallOfFame';

import type { Metadata } from 'next';

const HallOfFame = dynamic(() => import('@/src/client/screens/cohort').then((mod) => mod.HallOfFame));

export const metadata: Metadata = {
  ...NOINDEX_METADATA,
  title: 'Hall of Fame',
};

export default async function HallOfFamePage({
  params,
}: {
  params: Promise<{ cohortId: string }>;
}) {
  const { cohortId } = await params;
  const pub = await getPublicCohort(cohortId);

  if (!pub) {
    return <PrivateHallOfFame cohortId={cohortId} />;
  }

  return <HallOfFame cohortId={cohortId} cohort={mapDbCohortToUiCohort(pub.row)} />;
}

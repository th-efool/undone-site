import React from 'react';
import type { Metadata } from 'next';
import { getPublicCohort } from '@/src/server/domain/cohort/public-cohort';
import { mapDbCohortToUiCohort } from '@/src/server/infrastructure/db/postgres/mappers/cohortMapper';
import { NOINDEX_METADATA } from '@/src/server/domain/cohort/cohort-seo-render';
import { Events } from '@/src/client/screens/cohort';
import { PrivateEvents } from './PrivateEvents';

export const metadata: Metadata = {
  ...NOINDEX_METADATA,
  title: 'Events',
};

export default async function EventsPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const pub = await getPublicCohort(cohortId);

  if (!pub) {
    return <PrivateEvents cohortId={cohortId} />;
  }

  return <Events cohortId={cohortId} cohort={mapDbCohortToUiCohort(pub.row)} />;
}

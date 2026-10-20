import React from 'react';
import type { Metadata } from 'next';
import { getPublicCohort } from '@/src/server/domain/cohort/public-cohort';
import { mapDbCohortToUiCohort } from '@/src/server/infrastructure/db/postgres/mappers/cohortMapper';
import { NOINDEX_METADATA } from '@/src/server/domain/cohort/cohort-seo-render';
import { Archives } from '@/src/client/screens/cohort';
import { PrivateArchives } from './PrivateArchives';

export const metadata: Metadata = {
  ...NOINDEX_METADATA,
  title: 'Archives',
};

export default async function ArchivesPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const pub = await getPublicCohort(cohortId);

  if (!pub) {
    return <PrivateArchives cohortId={cohortId} />;
  }

  return <Archives cohortId={cohortId} cohort={mapDbCohortToUiCohort(pub.row)} />;
}

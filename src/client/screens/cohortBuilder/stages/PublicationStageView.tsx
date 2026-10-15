'use client';

import React from 'react';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import type { PublicationReceipt } from '@/src/shared/cohort-creation/publication';
import { PublicationSuccess } from '@/src/client/screens/cohortCreation/components/PublicationSuccess';
import styles from '@/src/client/screens/cohortCreation/components/ReadyWorkspace.module.css';

export interface PublicationStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction) => Promise<boolean>;
  onNavigateToDestination?: (url: string) => void;
}

export function PublicationStageView({
  workspace,
}: PublicationStageViewProps) {
  const cohortId = workspace.release?.cohortId ?? 'cohort-preview';
  const mode = workspace.release?.mode ?? 'public_publish';
  const receipt: PublicationReceipt = {
    requestId: '00000000-0000-0000-0000-000000000000',
    cohortId,
    mode,
    committedAt: workspace.release?.releasedAt ?? new Date().toISOString(),
    snapshotHash: workspace.release?.candidateHash ?? '0'.repeat(64),
  };

  return (
    <div className={styles.workspace} aria-label="Cohort publication complete">
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--creation-muted, #59677b)', fontSize: 15 }}>
          Your cohort has been released.
        </p>
      </div>
      <PublicationSuccess
        receipt={receipt}
        title={workspace.title || workspace.intent || 'Your learning cohort'}
      />
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { InteractionProvider } from '@/src/client/interaction/provider';
import {
  useWorkspaceConnection,
  useInteractionState,
} from '@/src/client/interaction/hooks';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import type { EntityRef } from 'interaction-builder/core';
import { ChatPane } from './ChatPane';
import { CohortWorkspacePane } from './CohortWorkspacePane';
import styles from './CohortBuilder.module.css';

interface AttachedEntity {
  entity: EntityRef;
  label: string;
}

interface CohortInteractionScreenProps {
  workspaceId: string;
  initialView: CohortWorkspace;
}

function InnerBuilderScreen() {
  const connection = useWorkspaceConnection();
  const state = useInteractionState<CohortWorkspace>();
  const [attachedEntity, setAttachedEntity] = useState<AttachedEntity | null>(null);

  const dotClass =
    connection === 'live'
      ? styles.dotConnected
      : connection === 'reconnecting' || connection === 'connecting'
      ? styles.dotReconnecting
      : styles.dotDisconnected;

  return (
    <div className={styles.page}>
      {/* Top Navbar */}
      <header className={styles.topBar}>
        <div className={styles.brandNav}>
          <Link href="/dashboard" className={styles.brandLink}>
            Undone
          </Link>
          <div className={styles.divider} />
          <span className={styles.workspaceTitle}>
            {state.view?.title || 'Interactive Cohort Builder'}
          </span>
        </div>

        <div className={styles.topMeta}>
          {state.lastReceipt && (
            <div className={styles.receiptNotice} role="status">
              <CheckCircle2 size={14} />
              <span>{state.lastReceipt.summary}</span>
            </div>
          )}

          {state.lastError && (
            <div className={styles.errorNotice} role="alert">
              <AlertCircle size={14} />
              <span>Action error: {state.lastError.code}</span>
            </div>
          )}

          <div className={styles.connectionBadge}>
            <span className={`${styles.dot} ${dotClass}`} />
            <span>{connection}</span>
          </div>

          <div className={styles.revBadge}>Rev #{state.revision}</div>
        </div>
      </header>

      {/* Main Split Layout */}
      <div className={styles.mainContainer}>
        <ChatPane
          attachedEntity={attachedEntity}
          onClearAttachedEntity={() => setAttachedEntity(null)}
        />
        <CohortWorkspacePane
          onSelectLessonForChat={attached => setAttachedEntity(attached)}
        />
      </div>
    </div>
  );
}

export function CohortInteractionScreen({
  workspaceId,
  initialView,
}: CohortInteractionScreenProps) {
  return (
    <InteractionProvider workspaceId={workspaceId} initialView={initialView}>
      <InnerBuilderScreen />
    </InteractionProvider>
  );
}

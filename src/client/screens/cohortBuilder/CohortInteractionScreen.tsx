'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
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
import { createCohortTransport } from './transport';

interface AttachedEntity {
  entity: EntityRef;
  label: string;
}

interface CohortInteractionScreenProps {
  workspaceId: string;
  ownerId?: string;
  initialView: CohortWorkspace;
}

function InnerBuilderScreen() {
  const connection = useWorkspaceConnection();
  const state = useInteractionState<CohortWorkspace>();
  const [attachedEntity, setAttachedEntity] = useState<AttachedEntity | null>(null);
  const [pane, setPane] = useState<'chat' | 'workspace'>('workspace');

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
          <span role="status">{Object.keys(state.pending).length ? 'Saving…' : connection === 'live' ? 'Saved' : 'Last saved state'}</span>
          {state.lastReceipt && !Object.keys(state.pending).length && (
            <div className={styles.receiptNotice} role="status">
              <CheckCircle2 size={14} />
              <span>{state.lastReceipt.summary}</span>
            </div>
          )}

          {state.lastError && !state.messages?.some(message => message.id === state.lastError!.actionId) && (
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
      <nav className={styles.paneNavigation} aria-label="Builder views">
        <button aria-pressed={pane === 'chat'} onClick={() => setPane('chat')}>Chat</button>
        <button aria-pressed={pane === 'workspace'} onClick={() => setPane('workspace')}>Workspace</button>
      </nav>
      <div className={styles.mainContainer} data-pane={pane}>
        <div className={styles.chatRegion}>
        <ChatPane
          attachedEntity={attachedEntity}
          onClearAttachedEntity={() => setAttachedEntity(null)}
        />
        </div>
        <div className={styles.workspaceRegion}>
        <nav aria-label="Workspace sections" className={styles.sectionNavigation}>
          <a href="#builder-sources">Sources</a>
          <a href="#builder-outline">Outline and evidence</a>
          <a href="#builder-release">Release</a>
        </nav>
        <CohortWorkspacePane
          onSelectLessonForChat={attached => { setAttachedEntity(attached); setPane('chat'); }}
        />
        </div>
      </div>
    </div>
  );
}

export function CohortInteractionScreen({
  workspaceId,
  initialView,
  ownerId,
}: CohortInteractionScreenProps) {
  const { data: session, status } = useSession();
  const transport = useMemo(() => createCohortTransport(workspaceId), [workspaceId, ownerId]);
  const identityLost = status === 'unauthenticated' || (status === 'authenticated' && ownerId && session?.user?.id !== ownerId);
  useEffect(() => { if (identityLost) sessionStorage.removeItem('undone:cohort-intake'); }, [identityLost]);
  if (identityLost) return <p>Session changed. Sign in again to resume this workspace.</p>;
  return (
    <InteractionProvider key={`${ownerId}:${workspaceId}`} workspaceId={workspaceId} initialView={initialView} transport={transport}>
      <InnerBuilderScreen />
    </InteractionProvider>
  );
}

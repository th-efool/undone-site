'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { InteractionProvider } from '@/src/client/interaction/provider';
import { createInteractionStore } from 'interaction-builder/client';
import { devLogger } from '@/src/shared/lib/dev-logger';
import {
  useWorkspaceConnection,
  useInteractionState,
  useDispatchAction,
} from '@/src/client/interaction/hooks';
import { type CohortWorkspace, type CohortAction, planCohortAction } from '@/src/shared/cohort-builder/contracts';
import type { EntityRef } from 'interaction-builder/core';
import { ThemeToggle } from '@/src/client/screens/landing/Hero/components/ThemeToggle';
import { useTheme } from '@/src/client/hooks/useTheme';
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
  initialRevision?: number;
}

interface InnerBuilderScreenProps {
  workspaceId: string;
  ownerId?: string;
}

function InnerBuilderScreen({ workspaceId, ownerId }: InnerBuilderScreenProps) {
  const connection = useWorkspaceConnection();
  const state = useInteractionState<CohortWorkspace>();
  const dispatchAction = useDispatchAction<CohortAction>();
  const [attachedEntity, setAttachedEntity] = useState<AttachedEntity | null>(null);
  const [pane, setPane] = useState<'chat' | 'workspace'>('workspace');
  const [collapsed, setCollapsed] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const { theme, isDark } = useTheme();

  useEffect(() => {
    const handleHighlight = () => {
      setPane('workspace');
    };
    window.addEventListener('cohort:highlight-entity', handleHighlight);
    return () => {
      window.removeEventListener('cohort:highlight-entity', handleHighlight);
    };
  }, []);

  const isChatStep = state.view?.journey?.step === 'chat';

  const stage = state.view
    ? state.view.processing.status === 'processing' ||
      state.view.processing.status === 'queued' ||
      (state.view.processing.status as string) === 'running'
      ? 'processing'
      : state.view.lessons.length > 0 || (state.view.release && state.view.release.status !== 'draft')
      ? 'review'
      : 'material'
    : 'material';

  // Unified layout: centered single-column for Plan mode, split-panel for Search/Creation
  return (
    <div
      id="main-content"
      className={styles.page}
      data-theme={theme}
      data-layout={isChatStep ? 'centered' : 'split'}
      data-variant={stage}
      data-rail-collapsed={!isChatStep && collapsed}
      data-pane={pane}
    >
      {!isChatStep && (
        <nav className={styles.paneNavigation} aria-label="Builder views">
          <button
            type="button"
            aria-pressed={pane === 'chat'}
            onClick={() => setPane('chat')}
          >
            Chat
          </button>
          <button
            type="button"
            aria-pressed={pane === 'workspace'}
            onClick={() => setPane('workspace')}
          >
            Workspace
          </button>
        </nav>
      )}

      {/* Conversation Rail (centered max-width container in chat mode; split rail in workspace mode) */}
      <aside className={styles.rail} aria-label={isChatStep ? 'Conversational cohort planning' : 'Creation conversation'}>
        <header className={styles.brandHeader} aria-label={isChatStep ? 'Plan chat header' : undefined}>
          <Link className={styles.brand} href="/" aria-label="Undone home">
            <Image
              src={isDark ? '/undone-logo-dark.svg' : '/undone-logo-transparent.svg'}
              width={42}
              height={42}
              alt=""
              priority
            />
            <span>
              <strong>UNDONE</strong>
              <em>For a more curious you.</em>
            </span>
          </Link>
          {isChatStep ? (
            <div className={styles.tools}>
              <span className={styles.srOnly}>Rev #{state.revision}</span>
              <ThemeToggle />
              <Link href="/home" className={styles.account} aria-label="Open your account">
                Y
              </Link>
            </div>
          ) : (
            <button
              type="button"
              className={styles.railToggle}
              onClick={() => setCollapsed(value => !value)}
              aria-label={collapsed ? 'Expand conversation' : 'Collapse conversation'}
              aria-expanded={!collapsed}
            >
              {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
            </button>
          )}
        </header>

        <ChatPane
          attachedEntity={attachedEntity}
          onClearAttachedEntity={() => setAttachedEntity(null)}
          connection={connection}
        />
      </aside>

      {/* Right Canvas with close button and toolbar header */}
      {!isChatStep && (
        <div className={styles.canvas}>
          <header className={styles.canvasHeader} aria-label="Workspace toolbar">
            <div className={styles.tools}>
              <button
                type="button"
                className={styles.closePanelButton}
                onClick={() => setShowCloseModal(true)}
                aria-label="Close workspace panel and return to chat"
                title="Close workspace panel and return to chat"
              >
                <X size={16} />
              </button>
              <span className={styles.srOnly}>Rev #{state.revision}</span>
              <ThemeToggle />
              <Link href="/home" className={styles.account} aria-label="Open your account">
                Y
              </Link>
            </div>
          </header>

          <div className={styles.canvasContent}>
            <CohortWorkspacePane
              workspaceId={workspaceId}
              ownerId={ownerId}
              onSelectLessonForChat={attached => {
                setAttachedEntity(attached);
                setPane('chat');
              }}
            />
          </div>
        </div>
      )}

      {/* Return to Chat Confirmation Dialog */}
      {showCloseModal && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-modal-title"
          onClick={() => setShowCloseModal(false)}
        >
          <div
            className={styles.modalContent}
            onClick={e => e.stopPropagation()}
          >
            <h3 id="close-modal-title" className={styles.modalTitle}>
              Return to conversational chat?
            </h3>
            <p className={styles.modalDesc}>
              Closing this workspace panel will return you to the centered conversational chat. Your conversation history and materials are safely preserved.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setShowCloseModal(false)}
              >
                Keep open
              </button>
              <button
                type="button"
                className={styles.modalConfirmBtn}
                onClick={async () => {
                  setShowCloseModal(false);
                  await dispatchAction({ type: 'close_panel' });
                }}
              >
                Close panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CohortInteractionScreen({
  workspaceId,
  initialView,
  initialRevision,
  ownerId,
}: CohortInteractionScreenProps) {
  const logger = useMemo(() => devLogger.scoped('CohortInteractionScreen'), []);
  const { data: session, status } = useSession();
  const transport = useMemo(() => createCohortTransport(workspaceId), [workspaceId, ownerId]);

  const store = useMemo(() => {
    logger.info(`Initializing interaction store for workspace ${workspaceId} at Rev #${initialRevision ?? 0}`);
    return createInteractionStore({
      workspaceId,
      initialView,
      initialRevision,
      transport,
      conflictResolution: 'rebase',
      plan: planCohortAction as any,
    });
  }, [workspaceId, initialView, initialRevision, transport, logger]);

  const identityLost =
    status === 'unauthenticated' ||
    (status === 'authenticated' && ownerId && session?.user?.id !== ownerId);

  useEffect(() => {
    if (identityLost) {
      logger.warn(`Identity lost or changed for workspace ${workspaceId}`);
      sessionStorage.removeItem('undone:cohort-intake');
    }
  }, [identityLost, workspaceId, logger]);

  if (identityLost) return <p>Session changed. Sign in again to resume this workspace.</p>;

  return (
    <InteractionProvider
      key={`${ownerId}:${workspaceId}`}
      store={store}
    >
      <InnerBuilderScreen workspaceId={workspaceId} ownerId={ownerId} />
    </InteractionProvider>
  );
}

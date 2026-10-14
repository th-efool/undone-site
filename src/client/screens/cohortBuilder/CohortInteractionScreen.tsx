'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { InteractionProvider } from '@/src/client/interaction/provider';
import { useWorkspaceConnection } from '@/src/client/interaction/hooks';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
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
}

function InnerBuilderScreen() {
  const connection = useWorkspaceConnection();
  const [attachedEntity, setAttachedEntity] = useState<AttachedEntity | null>(null);
  const [pane, setPane] = useState<'chat' | 'workspace'>('workspace');
  const [collapsed, setCollapsed] = useState(false);
  const { theme, isDark } = useTheme();

  return (
    <main
      id="main-content"
      aria-label="Cohort Curriculum Workspace"
      className={styles.page}
      data-theme={theme}
      data-rail-collapsed={collapsed}
      data-pane={pane}
    >
      {/* Left Conversation Rail matching legacy CreationShell */}
      <aside className={styles.rail} aria-label="Creation conversation">
        <header className={styles.brandHeader}>
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
          <button
            type="button"
            className={styles.railToggle}
            onClick={() => setCollapsed(value => !value)}
            aria-label={collapsed ? 'Expand conversation' : 'Collapse conversation'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
        </header>

        <ChatPane
          attachedEntity={attachedEntity}
          onClearAttachedEntity={() => setAttachedEntity(null)}
          connection={connection}
        />
      </aside>

      {/* Right Canvas matching legacy CreationShell */}
      <div className={styles.canvas}>
        <div className={styles.tools}>
          <ThemeToggle />
          <Link href="/home" className={styles.account} aria-label="Open your account">
            Y
          </Link>
        </div>

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

        <CohortWorkspacePane
          onSelectLessonForChat={attached => {
            setAttachedEntity(attached);
            setPane('chat');
          }}
        />
      </div>
    </main>
  );
}

export function CohortInteractionScreen({
  workspaceId,
  initialView,
  ownerId,
}: CohortInteractionScreenProps) {
  const { data: session, status } = useSession();
  const transport = useMemo(() => createCohortTransport(workspaceId), [workspaceId, ownerId]);
  const identityLost =
    status === 'unauthenticated' ||
    (status === 'authenticated' && ownerId && session?.user?.id !== ownerId);

  useEffect(() => {
    if (identityLost) sessionStorage.removeItem('undone:cohort-intake');
  }, [identityLost]);

  if (identityLost) return <p>Session changed. Sign in again to resume this workspace.</p>;

  return (
    <InteractionProvider
      key={`${ownerId}:${workspaceId}`}
      workspaceId={workspaceId}
      initialView={initialView}
      transport={transport}
    >
      <InnerBuilderScreen />
    </InteractionProvider>
  );
}

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Lightbulb, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { CohortIntake } from '@/src/shared/cohort-builder/intake';
import { useTheme } from '@/src/client/hooks/useTheme';
import { ThemeToggle } from '@/src/client/screens/landing/Hero/components/ThemeToggle';
import { RecommendationPending } from '@/src/client/screens/cohortCreation/components/RecommendationPending';
import type { useCreation } from '@/src/client/screens/cohortCreation/hooks/useCreation';
import { clearIntakeDraft, readIntakeDraft, saveIntakeDraft } from './intake-draft';
import builderStyles from './CohortBuilder.module.css';
import styles from './CohortIntakeScreen.module.css';

export function CohortIntakeScreen({ ownerId, enabled }: { ownerId: string; enabled: boolean }) {
  const [draft, setDraft] = useState<CohortIntake | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [pane, setPane] = useState<'chat' | 'workspace'>('workspace');
  const { theme, isDark } = useTheme();
  const isPlanMode = draft?.mode === 'plan';
  const logoSrc = isDark ? '/undone-logo-dark.svg' : '/undone-logo-transparent.svg';

  const submitDraft = async (intake: CohortIntake) => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/cohort-builder/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...intake, expectedOwnerId: ownerId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.code);
      // Keep acknowledged identity until navigation succeeds: retry returns the same workspace.
      window.location.assign(`/quest/build/${body.workspaceId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'INTAKE_UNAVAILABLE');
      setBusy(false);
    }
  };

  useEffect(() => {
    const saved = readIntakeDraft(ownerId);
    setDraft(saved);
    if (saved) {
      saveIntakeDraft(saved, ownerId);
      if (enabled) {
        void submitDraft(saved);
      }
    }
  }, [ownerId, enabled]);

  async function submit() {
    if (!draft || busy) return;
    await submitDraft(draft);
  }

  const creationAdapter = {
    snapshot: {
      status: 'running' as const,
      error: null,
      query: draft?.prompt ?? '',
    },
    cancel: () => {},
    runQuery: () => {},
    queryPending: false,
  } as unknown as ReturnType<typeof useCreation>;

  return (
    <div
      id="main-content"
      className={builderStyles.page}
      data-theme={theme}
      data-layout={isPlanMode ? 'centered' : 'split'}
      data-variant="material"
      data-rail-collapsed={!isPlanMode && collapsed}
      data-pane={pane}
    >
      {!isPlanMode && (
        <nav className={builderStyles.paneNavigation} aria-label="Builder views">
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

      {/* Left Conversation Rail matching AI Builder Workspace */}
      <aside className={builderStyles.rail} aria-label="Creation conversation">
        <header className={builderStyles.brandHeader}>
          <Link className={builderStyles.brand} href="/" aria-label="Undone home">
            <Image
              src={logoSrc}
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
            className={builderStyles.railToggle}
            onClick={() => setCollapsed(value => !value)}
            aria-label={collapsed ? 'Expand conversation' : 'Collapse conversation'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
        </header>

        <div className={builderStyles.railBody}>
          <div className={builderStyles.messages}>
            <div className={`${builderStyles.messageRow} ${builderStyles.messageUser}`}>
              <span className={builderStyles.youAvatar} aria-hidden="true">
                Y
              </span>
              <div className={builderStyles.userBubble}>
                <span className={builderStyles.sender}>You</span>
                <p>{draft?.prompt || 'I’m looking for something new to learn.'}</p>
              </div>
            </div>

            <div className={`${builderStyles.messageRow} ${builderStyles.messageAssistant}`}>
              <Image
                className={builderStyles.assistantAvatar}
                src={logoSrc}
                width={34}
                height={34}
                alt=""
              />
              <div className={builderStyles.assistantBubble}>
                <span className={builderStyles.sender}>Undone</span>
                <p>Let’s make a learning journey that fits you.</p>
              </div>
            </div>

            <div className={builderStyles.hint}>
              <Lightbulb size={27} strokeWidth={1.3} aria-hidden="true" />
              <div>
                <strong>Why these?</strong>
                <p>We search public cohorts for your learning intent. You can join a match or create your own.</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Right Workspace Canvas matching AI Builder Workspace */}
      {!isPlanMode && (
        <div className={builderStyles.canvas}>
        <header className={builderStyles.canvasHeader} aria-label="Workspace toolbar">
          <div className={builderStyles.tools}>
            <ThemeToggle />
            <Link href="/home" className={builderStyles.account} aria-label="Open your account">
              Y
            </Link>
          </div>
        </header>

        <div className={builderStyles.canvasContent}>
          <main className={builderStyles.rightPane} aria-label="Cohort Curriculum Workspace">
            {!enabled ? (
              <div className={styles.card}>
                <div className={styles.noticeAlert} role="status">
                  <div className={styles.cardHeader}>
                    <span className={styles.eyebrow}>Notice</span>
                    <h1 className={styles.title}>Intake Unavailable</h1>
                  </div>
                  <p>New builder intake is unavailable. Existing workspaces remain accessible.</p>
                  {draft ? (
                    <>
                      <div className={styles.promptCard}>
                        <blockquote className={styles.promptQuote}>{draft.prompt}</blockquote>
                      </div>
                      {draft.source ? (
                        <div className={styles.sourceCard}>
                          <span className={styles.sourceBadge}>Source</span>
                          <p className={styles.sourceLabel}>
                            Retained text: {draft.source.label} ({draft.source.text.length} characters)
                          </p>
                        </div>
                      ) : null}
                      <p>Your input is retained for the new builder. Please retry when creation is available.</p>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => {
                            clearIntakeDraft();
                            setDraft(null);
                          }}
                        >
                          Discard
                        </button>
                        <p style={{ margin: 0 }}>
                          <a className={styles.linkButton} href="/#explore">Return to landing</a>
                        </p>
                      </div>
                    </>
                  ) : (
                    <p>
                      No pending input. <a className={styles.linkButton} href="/#explore">Return to landing</a>.
                    </p>
                  )}
                </div>
              </div>
            ) : draft ? (
              busy ? (
                <div role="status" aria-live="polite">
                  <RecommendationPending
                    creation={creationAdapter}
                    initialQuery={draft.prompt}
                  />
                </div>
              ) : error ? (
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.eyebrow}>Connection Error</span>
                    <h1 className={styles.title}>Could not resume workspace</h1>
                  </div>
                  <div className={styles.promptCard}>
                    <blockquote className={styles.promptQuote}>{draft.prompt}</blockquote>
                  </div>
                  {draft.source ? (
                    <div className={styles.sourceCard}>
                      <span className={styles.sourceBadge}>Source</span>
                      <p className={styles.sourceLabel}>
                        Retained text: {draft.source.label} ({draft.source.text.length} characters)
                      </p>
                    </div>
                  ) : null}
                  <div className={styles.noticeError} role="alert" style={{ marginBottom: '20px' }}>
                    <p>Could not save: {error}. Your input is retained; retry when available.</p>
                  </div>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={() => void submit()}
                    >
                      Retry
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => {
                        clearIntakeDraft();
                        setDraft(null);
                      }}
                    >
                      Discard
                    </button>
                  </div>
                </div>
              ) : null
            ) : (
              <div className={styles.card} style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div className={styles.cardHeader}>
                  <span className={styles.eyebrow}>No active quest</span>
                  <h1 className={styles.title}>Start a new cohort</h1>
                </div>
                <p className={styles.subtitle}>
                  No pending input found. <a className={styles.linkButton} href="/#explore">Return to landing</a> to begin.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
      )}
    </div>
  );
}


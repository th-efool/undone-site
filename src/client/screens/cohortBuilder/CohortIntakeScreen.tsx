'use client';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LearningPromptBar } from '@/src/client/components/global/LearningPromptBar/LearningPromptBar';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowRight, Lightbulb, Sparkles, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { CohortIntake } from '@/src/shared/cohort-builder/intake';
import { useTheme } from '@/src/client/hooks/useTheme';
import { ThemeToggle } from '@/src/client/screens/landing/Hero/components/ThemeToggle';
import { RecommendationPending } from '@/src/client/screens/cohortCreation/components/RecommendationPending';
import type { useCreation } from '@/src/client/screens/cohortCreation/hooks/useCreation';
import { clearIntakeDraft, readIntakeDraft, saveIntakeDraft } from './intake-draft';
import builderStyles from './CohortBuilder.module.css';
import styles from './CohortIntakeScreen.module.css';

function useSafeRouter() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

export function CohortIntakeScreen({ ownerId, enabled }: { ownerId: string; enabled: boolean }) {
  const router = useSafeRouter();
  const [draft, setDraft] = useState<CohortIntake | null>(null);
  const [error, setError] = useState('');
  useFailureToast(error, 'Could not confirm creation. Your saved input is kept; use Retry to check again.', 'CohortIntake');
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [pane, setPane] = useState<'chat' | 'workspace'>('workspace');
  const { theme, isDark } = useTheme();
  const isPlanMode = draft?.mode === 'plan';
  const isCenteredHandoff = isPlanMode || (enabled && !!draft && busy && !error);
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
      const targetUrl = `/quest/build/${body.workspaceId}`;
      if (router) {
        router.push(targetUrl);
      } else {
        window.location.assign(targetUrl);
      }
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
      data-layout={isCenteredHandoff ? 'centered' : 'split'}
      data-variant="material"
      data-rail-collapsed={!isCenteredHandoff && collapsed}
      data-pane={pane}
    >
      {!isCenteredHandoff && (
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
              <div className={builderStyles.userBubble}>
                <p>{draft?.prompt || 'I’m looking for something new to learn.'}</p>
              </div>
            </div>

            <div className={`${builderStyles.messageRow} ${builderStyles.messageAssistant}`}>
              <div className={builderStyles.assistantSparkleWrapper} aria-hidden="true">
                <Sparkles size={18} className={builderStyles.sparkleIcon} />
              </div>
              <div className={builderStyles.assistantBubble}>
                <p>Let’s make a learning journey that fits you.</p>
                {busy && !isPlanMode && (
                  <ol className={builderStyles.chatStepChecklist} aria-label="Assistant progress steps">
                    <li className={builderStyles.chatStepItem} data-step-state="running">
                      <span className={builderStyles.stepMarker} aria-hidden="true">
                        <span className={builderStyles.stepSpinner} />
                      </span>
                      <span className={builderStyles.stepLabel}>Processing your query</span>
                    </li>
                    <li className={builderStyles.chatStepItem} data-step-state="pending">
                      <span className={builderStyles.stepMarker} aria-hidden="true">
                        <span className={builderStyles.stepPendingDot} />
                      </span>
                      <span className={builderStyles.stepLabel}>Understanding your learning goal</span>
                    </li>
                    <li className={builderStyles.chatStepItem} data-step-state="pending">
                      <span className={builderStyles.stepMarker} aria-hidden="true">
                        <span className={builderStyles.stepPendingDot} />
                      </span>
                      <span className={builderStyles.stepLabel}>Searching cohorts for you</span>
                    </li>
                  </ol>
                )}
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
      {!isCenteredHandoff && (
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
                <p className={styles.subtitle}>Describe what you want to learn or add reference materials.</p>
                {enabled ? <LearningPromptBar /> : <p>No pending input found. Intake is currently unavailable.</p>}
              </div>
            )}
          </main>
        </div>
      </div>
      )}
    </div>
  );
}


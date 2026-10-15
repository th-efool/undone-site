'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import type { CohortIntake } from '@/src/shared/cohort-builder/intake';
import { useTheme } from '@/src/client/hooks/useTheme';
import { ThemeToggle } from '@/src/client/screens/landing/Hero/components/ThemeToggle';
import { clearIntakeDraft, readIntakeDraft, saveIntakeDraft } from './intake-draft';
import styles from './CohortIntakeScreen.module.css';

export function CohortIntakeScreen({ ownerId, enabled }: { ownerId: string; enabled: boolean }) {
  const [draft, setDraft] = useState<CohortIntake | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { theme, isDark } = useTheme();

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

  return (
    <div className={styles.container} data-theme={theme}>
      <header className={styles.nav}>
        <Link className={styles.brand} href="/" aria-label="Undone home">
          <img
            src={isDark ? '/undone-logo-dark.svg' : '/undone-logo-transparent.svg'}
            width={40}
            height={40}
            alt=""
          />
          <span className={styles.brandText}>
            <strong>UNDONE</strong>
            <em>For a more curious you.</em>
          </span>
        </Link>
        <div className={styles.navActions}>
          <ThemeToggle />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.card}>
          {!enabled ? (
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
          ) : draft ? (
            busy ? (
              <div role="status" aria-live="polite" style={{ textAlign: 'center', padding: '32px 16px' }}>
                <span className={styles.eyebrow}>Preparing recommendations</span>
                <h1 className={styles.title} style={{ marginTop: '8px', marginBottom: '16px' }}>
                  Setting up your learning workspace…
                </h1>
                <div className={styles.promptCard} style={{ textAlign: 'left', maxWidth: '480px', margin: '0 auto 20px' }}>
                  <blockquote className={styles.promptQuote}>{draft.prompt}</blockquote>
                </div>
                <p className={styles.subtitle}>Finding matching cohorts and crafting your personalized path.</p>
              </div>
            ) : error ? (
              <div>
                <div className={styles.cardHeader}>
                  <span className={styles.eyebrow}>Connection Error</span>
                  <h1 className={styles.title}>Could not resume workspace</h1>
                </div>
                <div className={styles.promptCard}>
                  <blockquote className={styles.promptQuote}>{draft.prompt}</blockquote>
                </div>
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
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <div className={styles.cardHeader}>
                <span className={styles.eyebrow}>No active quest</span>
                <h1 className={styles.title}>Start a new cohort</h1>
              </div>
              <p className={styles.subtitle}>
                No pending input found. <a className={styles.linkButton} href="/#explore">Return to landing</a> to begin.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

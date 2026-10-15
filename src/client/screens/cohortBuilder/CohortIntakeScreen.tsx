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

  useEffect(() => {
    const saved = readIntakeDraft(ownerId);
    setDraft(saved);
    if (saved) saveIntakeDraft(saved, ownerId);
  }, [ownerId]);

  async function submit() {
    if (!draft || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/cohort-builder/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, expectedOwnerId: ownerId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.code);
      // Keep acknowledged identity until navigation succeeds: retry returns the same workspace.
      window.location.assign(`/quest/build/${body.workspaceId}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'INTAKE_UNAVAILABLE');
      setBusy(false);
    }
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
          <div className={styles.cardHeader}>
            <span className={styles.eyebrow}>Learning Blueprint</span>
            <h1 className={styles.title}>Start your cohort</h1>
            {enabled && draft && (
              <p className={styles.subtitle}>Confirm this learning goal for your signed-in account.</p>
            )}
          </div>

          {!enabled ? (
            <div className={styles.noticeAlert} role="status">
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
            <>
              <div className={styles.promptCard}>
                <blockquote className={styles.promptQuote}>{draft.prompt}</blockquote>
              </div>
              {draft.source && (
                <div className={styles.sourceCard}>
                  <BookOpen size={16} className={styles.sourceBadge} aria-hidden="true" />
                  <p className={styles.sourceLabel}>
                    Retained text: {draft.source.label} ({draft.source.text.length} characters)
                  </p>
                </div>
              )}
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={busy}
                  onClick={() => void submit()}
                >
                  {busy ? 'Saving…' : 'Create cohort'}
                  {!busy && <ArrowRight size={17} aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={busy}
                  onClick={() => {
                    clearIntakeDraft();
                    setDraft(null);
                  }}
                >
                  Discard
                </button>
              </div>
            </>
          ) : (
            <p className={styles.subtitle}>
              No pending input. <a className={styles.linkButton} href="/#explore">Return to landing</a>.
            </p>
          )}

          {error && (
            <div className={styles.noticeError} role="alert">
              <p>Could not save: {error}. Your input is retained; retry when available.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

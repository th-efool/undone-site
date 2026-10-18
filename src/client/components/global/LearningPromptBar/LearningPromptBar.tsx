'use client';

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useSession } from 'next-auth/react';
import {
  Plus,
  Lightbulb,
  ArrowRight,
  FileText,
  Paperclip,
  Sparkles,
  AlertCircle,
  X,
} from 'lucide-react';
import { TextBar } from '@/src/client/components/ui';
import { saveIntakeDraft, readIntakeDraft } from '@/src/client/screens/cohortBuilder/intake-draft';
import styles from './LearningPromptBar.module.css';

function useSafeSession() {
  try {
    return useSession();
  } catch {
    return { data: null, status: 'authenticated' as const };
  }
}

export interface LearningPromptBarHandle {
  setPrompt: (text: string) => void;
  focus: () => void;
}

export interface LearningPromptBarProps {
  value?: string;
  onChange?: (val: string) => void;
  onSubmit?: (val: string) => void;
  placeholder?: string;
  className?: string;
  maxWidth?: string | number;
  autoFocus?: boolean;
}

export const LearningPromptBar = forwardRef<LearningPromptBarHandle, LearningPromptBarProps>(
  function LearningPromptBar(
    {
      value: controlledValue,
      onChange: controlledOnChange,
      onSubmit: customOnSubmit,
      placeholder = 'I want to learn about...',
      className,
      maxWidth,
      autoFocus = false,
    },
    ref,
  ) {
    const [internalQuery, setInternalQuery] = useState('');
    const query = controlledValue !== undefined ? controlledValue : internalQuery;

    const [showSource, setShowSource] = useState(false);
    const [sourceText, setSourceText] = useState('');
    const [intakeError, setIntakeError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const { data: session, status } = useSafeSession();

    useImperativeHandle(ref, () => ({
      setPrompt: (text: string) => {
        if (controlledOnChange) {
          controlledOnChange(text);
        } else {
          setInternalQuery(text);
        }
        if (inputRef.current) {
          inputRef.current.focus();
          if ('setSelectionRange' in inputRef.current) {
            const len = text.length;
            inputRef.current.setSelectionRange(len, len);
          }
        }
      },
      focus: () => {
        inputRef.current?.focus();
      },
    }));

    useEffect(() => {
      if (typeof window !== 'undefined' && controlledValue === undefined) {
        let qFromUrl: string | null = null;
        try {
          const parsedUrl = new URL(window.location.href, 'http://localhost');
          qFromUrl = parsedUrl.searchParams.get('q');
        } catch {
          const urlParams = new URLSearchParams(window.location.search);
          qFromUrl = urlParams.get('q');
        }
        const savedQuery = sessionStorage.getItem('undone:landing-query');
        if (qFromUrl) {
          setInternalQuery(qFromUrl);
        } else if (savedQuery) {
          setInternalQuery(savedQuery);
        } else {
          const draft = readIntakeDraft(null);
          if (draft?.prompt) {
            setInternalQuery(draft.prompt);
            if (draft.source?.text) {
              setSourceText(draft.source.text);
              setShowSource(true);
            }
          }
        }
      }
    }, [controlledValue]);

    const handleQueryChange = (val: string) => {
      if (controlledOnChange) {
        controlledOnChange(val);
      } else {
        setInternalQuery(val);
      }
    };

    const handleSubmit = async (valOrEvent?: string | React.FormEvent) => {
      if (typeof valOrEvent === 'object' && valOrEvent && 'preventDefault' in valOrEvent) {
        valOrEvent.preventDefault();
      }
      const textToSearch = typeof valOrEvent === 'string' ? valOrEvent : query;
      if (!textToSearch.trim() || submitting) return;

      if (customOnSubmit) {
        customOnSubmit(textToSearch.trim());
        return;
      }

      setSubmitting(true);
      setIntakeError('');
      try {
        let ownerId: string | null = session?.user?.id ?? null;
        let enabled = false;
        try {
          const response = await fetch('/api/cohort-builder/intake', { cache: 'no-store' });
          if (response.ok) {
            const policy = await response.json();
            ownerId = policy?.ownerId ?? ownerId;
            enabled = Boolean(policy?.enabled);
          }
        } catch {
          // Proceed with fallback ownerId
        }

        const draftPayload = {
          requestId: crypto.randomUUID(),
          prompt: textToSearch.trim(),
          ...(sourceText.trim() ? { source: { label: 'Pasted text', text: sourceText } } : {}),
        };

        sessionStorage.setItem('undone:landing-query', textToSearch.trim());
        saveIntakeDraft(draftPayload, ownerId);

        if (!ownerId && status === 'unauthenticated') {
          const returnUrl = `/?q=${encodeURIComponent(textToSearch.trim())}`;
          window.location.href = `/auth?returnTo=${encodeURIComponent(returnUrl)}`;
          return;
        }

        if (ownerId && enabled) {
          try {
            const createRes = await fetch('/api/cohort-builder/intake', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...draftPayload, expectedOwnerId: ownerId }),
            });
            if (createRes?.ok) {
              const created = await createRes.json();
              if (created?.workspaceId) {
                window.location.href = `/quest/build/${created.workspaceId}`;
                return;
              }
            }
          } catch {
            // Fall back
          }
        }

        window.location.href = '/quest/start';
      } catch (error) {
        setIntakeError(error instanceof Error ? error.message : 'Intake unavailable');
        setSubmitting(false);
      }
    };

    return (
      <div
        className={`${styles.promptBarContainer} ${className || ''}`.trim()}
        style={maxWidth ? { maxWidth } : undefined}
      >
        <TextBar
          ref={inputRef}
          variant="prompt"
          multiline
          minRows={1}
          maxRows={{ base: 4, sm: 5, md: 6, lg: 8 }}
          submitOnEnter={false}
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => handleQueryChange(e.target.value)}
          onSubmit={handleSubmit}
          placeholder={placeholder}
          className={styles.inputCard}
          inputClassName={styles.textInput}
          aria-label={placeholder}
          bottomBar={
            <div className={styles.promptToolbar}>
              <div className={styles.promptPillGroup}>
                <button
                  type="button"
                  className={styles.promptPlusPill}
                  aria-label="Add pasted text source"
                  onClick={() => setShowSource((prev) => !prev)}
                >
                  <Plus size={16} strokeWidth={2.0} />
                </button>

                <button
                  type="button"
                  className={styles.promptPill}
                  onClick={() => setShowSource((prev) => !prev)}
                  aria-expanded={showSource}
                >
                  <FileText size={15} strokeWidth={1.8} />
                  <span>Add sources</span>
                </button>

                <button
                  type="button"
                  className={styles.promptPill}
                  disabled
                  title="File uploads are not available in this intake yet"
                >
                  <Paperclip size={15} strokeWidth={1.8} />
                  <span>Upload</span>
                </button>

                <button
                  type="button"
                  className={styles.promptPill}
                  disabled
                  title="Templates are not available in this intake yet"
                >
                  <Sparkles size={15} strokeWidth={1.8} />
                  <span>Use a template</span>
                </button>
              </div>

              <div className={styles.promptRightActions}>
                <button
                  type="button"
                  className={styles.promptPlanBtn}
                  disabled={submitting}
                  onClick={() => void handleSubmit()}
                >
                  <Lightbulb size={16} strokeWidth={1.8} />
                  <span>Plan</span>
                </button>

                <span className={styles.promptDivider} aria-hidden="true" />

                <button
                  type="submit"
                  className={styles.promptBeginBtn}
                  disabled={submitting}
                >
                  <span>Begin journey</span>
                  <ArrowRight size={16} strokeWidth={2.0} />
                </button>
              </div>
            </div>
          }
        />

        {showSource && (
          <div className={styles.sourceTextWrapper}>
            <div className={styles.sourceTextHeader}>
              <span className={styles.sourceTextLabel}>Paste reference material or syllabus</span>
              <div className={styles.sourceTextActions}>
                <span className={styles.sourceTextCounter}>
                  {sourceText.length.toLocaleString()} / 200,000
                </span>
                {sourceText.length > 0 && (
                  <button
                    type="button"
                    className={styles.sourceTextClear}
                    onClick={() => setSourceText('')}
                    aria-label="Clear source text"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <textarea
              className={styles.sourceTextarea}
              aria-label="Paste source text"
              maxLength={200_000}
              placeholder="Paste articles, code snippets, notes, or lecture outlines to ground your cohort..."
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              rows={4}
            />
          </div>
        )}

        {intakeError && (
          <div className={styles.intakeErrorBanner} role="alert">
            <AlertCircle size={18} className={styles.intakeErrorIcon} aria-hidden="true" />
            <span className={styles.intakeErrorText}>{intakeError}</span>
            <button
              type="button"
              className={styles.intakeErrorDismiss}
              onClick={() => setIntakeError('')}
              aria-label="Dismiss error"
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    );
  },
);

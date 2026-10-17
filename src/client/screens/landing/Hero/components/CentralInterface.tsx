'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import {
  Plus,
  Lightbulb,
  ArrowRight,
  FileText,
  Paperclip,
  Sparkles,
} from 'lucide-react';
import { TextBar } from '@/src/client/components/ui';
import { SuggestionPromptRow } from './SuggestionPromptRow';
import { FeaturedCohortsStrip } from './FeaturedCohortsStrip';
import styles from '../Hero.module.css';
import { saveIntakeDraft, readIntakeDraft } from '@/src/client/screens/cohortBuilder/intake-draft';
const CATEGORIES = [
  'SideQuests',
  'Trending',
  'Technology',
  'Science',
  'Arts & Humanities',
] as const;

function useSafeSession() {
  try {
    return useSession();
  } catch {
    return { data: null, status: 'authenticated' as const };
  }
}

export function CentralInterface() {
  const [query, setQuery] = useState('');
  const [showSource, setShowSource] = useState(false);
  const [sourceText, setSourceText] = useState('');
  const [intakeError, setIntakeError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('SideQuests');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const { data: session, status } = useSafeSession();

  useEffect(() => {
    if (typeof window !== 'undefined') {
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
        setQuery(qFromUrl);
      } else if (savedQuery) {
        setQuery(savedQuery);
      } else {
        const draft = readIntakeDraft(null);
        if (draft?.prompt) {
          setQuery(draft.prompt);
          if (draft.source?.text) {
            setSourceText(draft.source.text);
            setShowSource(true);
          }
        }
      }
    }
  }, []);

  const handleSelectPrompt = (promptText: string) => {
    setQuery(promptText);
    if (inputRef.current) {
      inputRef.current.focus();
      if ('setSelectionRange' in inputRef.current) {
        const len = promptText.length;
        inputRef.current.setSelectionRange(len, len);
      }
    }
  };

  const handleSubmit = async (valOrEvent?: string | React.FormEvent) => {
    if (typeof valOrEvent === 'object' && valOrEvent && 'preventDefault' in valOrEvent) {
      valOrEvent.preventDefault();
    }
    const textToSearch = typeof valOrEvent === 'string' ? valOrEvent : query;
    if (!textToSearch.trim() || submitting) return;
    setSubmitting(true);
    setIntakeError('');
    try {
      let ownerId: string | null = session?.user?.id ?? null;
      try {
        const response = await fetch('/api/cohort-builder/intake', { cache: 'no-store' });
        if (response.ok) {
          const policy = await response.json();
          ownerId = policy.ownerId ?? ownerId;
        }
      } catch {
        // Proceed on server/network error with session ownerId if available
      }

      sessionStorage.setItem('undone:landing-query', textToSearch.trim());
      saveIntakeDraft(
        {
          requestId: crypto.randomUUID(),
          prompt: textToSearch.trim(),
          ...(sourceText.trim() ? { source: { label: 'Pasted text', text: sourceText } } : {}),
        },
        ownerId
      );

      // If user is unauthenticated, redirect to auth and return straight back to landing page with query preserved
      if (!ownerId && status === 'unauthenticated') {
        const returnUrl = `/?q=${encodeURIComponent(textToSearch.trim())}`;
        window.location.href = `/auth?returnTo=${encodeURIComponent(returnUrl)}`;
        return;
      }

      window.location.href = '/quest/start';
    } catch (error) {
      setIntakeError(error instanceof Error ? error.message : 'Intake unavailable');
      setSubmitting(false);
    }
  };

  return (
    <div id="explore" className={styles.heroContent}>
      {/* Eyebrow */}
      <span className={styles.eyebrow}>A MORE CURIOUS YOU</span>

      {/* Main Heading */}
      <h1 className={styles.headline}>
        What do you want
        <br />
        to{' '}
        <span className={styles.headlineItalic}>
          explore?
          <Image
            src="/images/hero-collage/underline-flourish.svg"
            alt=""
            width={260}
            height={24}
            className={styles.underlineFlourish}
            priority
          />
        </span>
      </h1>

      {/* Subtitle */}
      <p className={styles.subtitle}>
        A little curiosity goes a long way.
      </p>

      {/* Remade Central TextBar matching reference */}
      <TextBar
        ref={inputRef}
        variant="prompt"
        multiline
        minRows={1}
        maxRows={{ base: 4, sm: 5, md: 6, lg: 8 }}
        submitOnEnter={false}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onSubmit={handleSubmit}
        placeholder="I want to learn about..."
        className={styles.inputCard}
        inputClassName={styles.textInput}
        aria-label="What do you want to learn about?"
        bottomBar={
          <div className={styles.promptToolbar}>
            <div className={styles.promptPillGroup}>
              <button
                type="button"
                className={styles.promptPlusPill}
                aria-label="Add pasted text source"
                onClick={() => setShowSource(value => !value)}
              >
                <Plus size={18} strokeWidth={2.2} />
              </button>

              <button type="button" className={styles.promptPill} onClick={() => setShowSource(value => !value)} aria-expanded={showSource}>
                <FileText size={17} strokeWidth={1.8} />
                <span>Add sources</span>
              </button>

              <button type="button" className={styles.promptPill} disabled title="File uploads are not available in this intake yet">
                <Paperclip size={17} strokeWidth={1.8} />
                <span>Upload</span>
              </button>

              <button type="button" className={styles.promptPill} disabled title="Templates are not available in this intake yet">
                <Sparkles size={17} strokeWidth={1.8} />
                <span>Use a template</span>
              </button>
            </div>

            <div className={styles.promptRightActions}>
              <button type="button" className={styles.promptPlanBtn} disabled={submitting} onClick={() => void handleSubmit()}>
                <Lightbulb size={18} strokeWidth={1.8} />
                <span>Plan</span>
              </button>

              <span className={styles.promptDivider} aria-hidden="true" />

              <button type="submit" className={styles.promptBeginBtn} disabled={submitting}>
                <span>Begin journey</span>
                <ArrowRight size={17} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        }
      />
      {showSource && <label>Paste source text
        <textarea aria-label="Paste source text" maxLength={200_000} value={sourceText}
          onChange={event => setSourceText(event.target.value)} style={{ width: '100%', minHeight: 120 }} />
      </label>}
      {intakeError && <p role="alert">{intakeError}</p>}

      {/* Suggestion Prompt Cards Row (Unfinished pursuits) */}
      <SuggestionPromptRow onSelectPrompt={handleSelectPrompt} />

      {/* Category Pills Strip */}
      <div className={styles.categoryPillsContainer} role="tablist" aria-label="Explore Categories">
        {CATEGORIES.map((category) => {
          const isSelected = selectedCategory === category;
          return (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`${styles.categoryPill} ${isSelected ? styles.categoryPillActive : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          );
        })}
      </div>

      {/* Auto Horizontally Scrolling Featured Cohorts Strip */}
      <FeaturedCohortsStrip selectedCategory={selectedCategory} />
    </div>
  );
}

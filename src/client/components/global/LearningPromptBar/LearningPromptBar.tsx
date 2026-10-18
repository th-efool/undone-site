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

export interface LearningTemplate {
  id: string;
  title: string;
  category: string;
  tagline: string;
  prompt: string;
}

export const HIGH_VALUE_TEMPLATES: LearningTemplate[] = [
  {
    id: 'fullstack',
    title: 'Full-Stack Web Architect',
    category: 'Engineering',
    tagline: 'Next.js 15, React 19, TypeScript, PostgreSQL & distributed systems',
    prompt:
      'Full-Stack Web Architect: Master modern Next.js 15, React Server Components, high-performance TypeScript patterns, relational schema design with PostgreSQL, and cloud deployments.',
  },
  {
    id: 'ml-research',
    title: 'Deep Machine Learning Research',
    category: 'AI & Data',
    tagline: 'Transformer architectures, diffusion models & PyTorch implementations',
    prompt:
      'Deep Machine Learning Research: Rigorous exploration of transformer architectures, attention mechanisms, fine-tuning pipelines (LoRA/PEFT), diffusion models, and scalable PyTorch training.',
  },
  {
    id: 'system-design',
    title: 'System Design Mastery',
    category: 'Architecture',
    tagline: 'High-throughput microservices, fault tolerance, Kafka & caching',
    prompt:
      'System Design Mastery: Build resilient distributed systems, event-driven streaming with Apache Kafka, consensus protocols, horizontal sharding, and high-concurrency caching tiers.',
  },
  {
    id: 'language',
    title: 'Accelerated Language Immersion',
    category: 'Language',
    tagline: 'High-frequency idiomatic speech, contextual vocabulary & listening',
    prompt:
      'Accelerated Language Immersion: Conversational fluency through contextual roleplays, high-frequency core vocabulary, auditory comprehension drills, and real-world idiomatic mastery.',
  },
];

export const LearningPromptBar = React.memo(
  forwardRef<LearningPromptBarHandle, LearningPromptBarProps>(
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
    const [showTemplates, setShowTemplates] = useState(false);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const templateMenuRef = useRef<HTMLDivElement>(null);
    const { data: session, status } = useSafeSession();

    useEffect(() => {
      if (!showTemplates && !showSource) return;
      const handleClickOutside = (e: MouseEvent | TouchEvent) => {
        if (showTemplates && templateMenuRef.current && !templateMenuRef.current.contains(e.target as Node)) {
          setShowTemplates(false);
        }
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (showTemplates) {
            setShowTemplates(false);
          } else if (showSource) {
            setShowSource(false);
          }
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [showTemplates, showSource]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const ext = file.name.split('.').pop()?.toLowerCase();
      const reader = new FileReader();

      if (ext === 'pdf') {
        reader.onload = (event) => {
          try {
            const buffer = event.target?.result as ArrayBuffer;
            const uint8 = new Uint8Array(buffer);
            const raw = new TextDecoder('latin1').decode(uint8);
            const matches = raw.match(/\(([^()]+)\)Tj/g);
            let extractedText = '';
            if (matches && matches.length > 0) {
              extractedText = matches.map((m) => m.slice(1, -3)).join(' ');
            }
            const textContent = extractedText.trim()
              ? `[Document: ${file.name}]\n${extractedText.trim()}`
              : `[Attached Document: ${file.name} (${Math.round(file.size / 1024)} KB)]\nReference source material loaded from document.`;
            setSourceText((prev) => (prev ? `${prev}\n\n---\n${textContent}` : textContent));
            setShowSource(true);
          } catch {
            const fallbackText = `[Attached Document: ${file.name} (${Math.round(file.size / 1024)} KB)]`;
            setSourceText((prev) => (prev ? `${prev}\n\n---\n${fallbackText}` : fallbackText));
            setShowSource(true);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = (event) => {
          const text = event.target?.result as string;
          if (typeof text === 'string') {
            const fileContent = `[Source: ${file.name}]\n${text.trim()}`;
            setSourceText((prev) => (prev ? `${prev}\n\n---\n${fileContent}` : fileContent));
            setShowSource(true);
          }
        };
        reader.readAsText(file);
      }

      // Reset file input value
      e.target.value = '';
    };

    const handleSelectTemplate = (template: LearningTemplate) => {
      handleQueryChange(template.prompt);
      setShowTemplates(false);
      if (inputRef.current) {
        inputRef.current.focus();
        if ('setSelectionRange' in inputRef.current) {
          const len = template.prompt.length;
          inputRef.current.setSelectionRange(len, len);
        }
      }
    };

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
      if (typeof window !== 'undefined') {
        let qFromUrl: string | null = null;
        try {
          const parsedUrl = new URL(window.location.href, 'http://localhost');
          qFromUrl = parsedUrl.searchParams.get('q');
        } catch {
          const urlParams = new URLSearchParams(window.location.search);
          qFromUrl = urlParams.get('q');
        }

        const storedQ =
          sessionStorage.getItem('sidequest_prompt_query_draft') ||
          localStorage.getItem('sidequest_prompt_query_draft') ||
          sessionStorage.getItem('undone:landing-query');

        const storedSrc =
          sessionStorage.getItem('sidequest_prompt_source_draft') ||
          localStorage.getItem('sidequest_prompt_source_draft');

        const storedShow =
          sessionStorage.getItem('sidequest_prompt_source_visible') ||
          localStorage.getItem('sidequest_prompt_source_visible');

        const intakeDraft = readIntakeDraft(null);

        // Restore prompt query if uncontrolled
        if (controlledValue === undefined) {
          if (qFromUrl) {
            setInternalQuery(qFromUrl);
          } else if (storedQ) {
            setInternalQuery(storedQ);
          } else if (intakeDraft?.prompt) {
            setInternalQuery(intakeDraft.prompt);
          }
        }

        // Restore pasted source text and visibility
        if (storedSrc) {
          setSourceText(storedSrc);
          setShowSource(true);
        } else if (intakeDraft?.source?.text) {
          setSourceText(intakeDraft.source.text);
          setShowSource(true);
        } else if (storedShow === 'true') {
          setShowSource(true);
        }
      }
    }, [controlledValue]);

    // Continuously auto-persist unsubmitted prompt queries and pasted sources
    useEffect(() => {
      const timer = window.setTimeout(() => {
        if (typeof window === 'undefined') return;
        try {
          if (query) {
            sessionStorage.setItem('sidequest_prompt_query_draft', query);
            localStorage.setItem('sidequest_prompt_query_draft', query);
            sessionStorage.setItem('undone:landing-query', query);
          } else {
            sessionStorage.removeItem('sidequest_prompt_query_draft');
            localStorage.removeItem('sidequest_prompt_query_draft');
          }

          if (sourceText) {
            sessionStorage.setItem('sidequest_prompt_source_draft', sourceText);
            localStorage.setItem('sidequest_prompt_source_draft', sourceText);
          } else {
            sessionStorage.removeItem('sidequest_prompt_source_draft');
            localStorage.removeItem('sidequest_prompt_source_draft');
          }

          sessionStorage.setItem('sidequest_prompt_source_visible', String(showSource));
          localStorage.setItem('sidequest_prompt_source_visible', String(showSource));
        } catch {}
      }, 200);

      return () => window.clearTimeout(timer);
    }, [query, sourceText, showSource]);

    // Flush immediately on accidental navigation or refresh before unload
    useEffect(() => {
      const handleBeforeUnload = () => {
        try {
          if (query) {
            sessionStorage.setItem('sidequest_prompt_query_draft', query);
            localStorage.setItem('sidequest_prompt_query_draft', query);
          }
          if (sourceText) {
            sessionStorage.setItem('sidequest_prompt_source_draft', sourceText);
            localStorage.setItem('sidequest_prompt_source_draft', sourceText);
          }
          sessionStorage.setItem('sidequest_prompt_source_visible', String(showSource));
          localStorage.setItem('sidequest_prompt_source_visible', String(showSource));
        } catch {}
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [query, sourceText, showSource]);

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

        // Ensure drafts survive unauthenticated auth redirects
        try {
          sessionStorage.setItem('sidequest_prompt_query_draft', textToSearch.trim());
          localStorage.setItem('sidequest_prompt_query_draft', textToSearch.trim());
          if (sourceText.trim()) {
            sessionStorage.setItem('sidequest_prompt_source_draft', sourceText.trim());
            localStorage.setItem('sidequest_prompt_source_draft', sourceText.trim());
          }
        } catch {}

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
                // Clear draft on successful transition
                try {
                  sessionStorage.removeItem('sidequest_prompt_query_draft');
                  localStorage.removeItem('sidequest_prompt_query_draft');
                  sessionStorage.removeItem('sidequest_prompt_source_draft');
                  localStorage.removeItem('sidequest_prompt_source_draft');
                } catch {}
                window.location.href = `/quest/build/${created.workspaceId}`;
                return;
              }
            }
          } catch {
            // Fall back
          }
        }

        // Clear draft on successful transition
        try {
          sessionStorage.removeItem('sidequest_prompt_query_draft');
          localStorage.removeItem('sidequest_prompt_query_draft');
          sessionStorage.removeItem('sidequest_prompt_source_draft');
          localStorage.removeItem('sidequest_prompt_source_draft');
        } catch {}

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
                  aria-expanded={showSource}
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

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.json,.pdf,text/plain,text/markdown,application/json,application/pdf"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                  aria-hidden="true"
                  tabIndex={-1}
                />

                <button
                  type="button"
                  className={styles.promptPill}
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload reference files (.txt, .md, .json, .pdf)"
                  aria-label="Upload reference material"
                >
                  <Paperclip size={15} strokeWidth={1.8} />
                  <span>Upload</span>
                </button>

                <div className={styles.templateWrapper} ref={templateMenuRef}>
                  <button
                    type="button"
                    className={`${styles.promptPill} ${showTemplates ? styles.promptPillActive : ''}`}
                    onClick={() => setShowTemplates((prev) => !prev)}
                    aria-expanded={showTemplates}
                    aria-haspopup="dialog"
                    title="Choose a curated learning template"
                  >
                    <Sparkles size={15} strokeWidth={1.8} />
                    <span>Use a template</span>
                  </button>

                  {showTemplates && (
                    <div
                      className={styles.templateMenu}
                      role="menu"
                      aria-label="Curated learning templates"
                    >
                      <div className={styles.templateMenuHeader}>
                        <span className={styles.templateMenuTitle}>Curated Pathways</span>
                        <span className={styles.templateMenuSubtitle}>
                          Select a pathway to pre-fill your prompt
                        </span>
                      </div>
                      <div className={styles.templateList}>
                        {HIGH_VALUE_TEMPLATES.map((tmpl) => (
                          <button
                            key={tmpl.id}
                            type="button"
                            className={styles.templateItem}
                            onClick={() => handleSelectTemplate(tmpl)}
                            role="menuitem"
                          >
                            <div className={styles.templateItemTop}>
                              <span className={styles.templateBadge}>{tmpl.category}</span>
                              <span className={styles.templateItemTitle}>{tmpl.title}</span>
                            </div>
                            <p className={styles.templateItemDesc}>{tmpl.tagline}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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
          <div className={styles.sourceTextWrapper} role="region" aria-label="Reference material drawer">
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
                <button
                  type="button"
                  className={styles.sourceTextClear}
                  onClick={() => setShowSource(false)}
                  aria-label="Close source material drawer"
                  title="Close (Esc)"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <textarea
              className={styles.sourceTextarea}
              aria-label="Paste source text"
              maxLength={200_000}
              placeholder="Paste articles, code snippets, notes, or lecture outlines to ground your cohort..."
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setShowSource(false);
                }
              }}
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
));

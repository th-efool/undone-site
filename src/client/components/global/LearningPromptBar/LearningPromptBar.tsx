'use client';

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useRouter } from 'next/navigation';
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
import {
  AttachmentTray,
  LinkRows,
  useComposerAttachments,
} from '@/src/client/components/global/Composer';
import styles from './LearningPromptBar.module.css';

function useSafeSession() {
  try {
    return useSession();
  } catch {
    return { data: null, status: 'authenticated' as const };
  }
}

function useSafeRouter() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

function persistPromptDraft(query: string, sourceText: string, showSource: boolean) {
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
}

function clearPromptDraft() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem('sidequest_prompt_query_draft');
    localStorage.removeItem('sidequest_prompt_query_draft');
    sessionStorage.removeItem('sidequest_prompt_source_draft');
    localStorage.removeItem('sidequest_prompt_source_draft');
  } catch {}
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
  'aria-label'?: string;
  ariaLabel?: string;
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
      'aria-label': ariaLabel,
      ariaLabel: ariaLabelAlt,
    },
    ref,
  ) {
    const [internalQuery, setInternalQuery] = useState('');
    const query = controlledValue !== undefined ? controlledValue : internalQuery;

    const [showSource, setShowSource] = useState(false);
    const [sourceTab, setSourceTab] = useState<'links' | 'text'>('links');
    const [sourceText, setSourceText] = useState('');
    const [intakeError, setIntakeError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);

    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const templateMenuRef = useRef<HTMLDivElement>(null);
    const { data: session, status } = useSafeSession();
    const router = useSafeRouter();

    // Client-device composer attachments (PDF offscreen canvas, batch YouTube, GitHub, Web DOM)
    const composerAttachments = useComposerAttachments({
      maxFiles: 10,
      maxLinks: 20,
      maxPdfSizeMb: 50,
      maxTextSizeMb: 5,
    });

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
      const files = e.target.files;
      if (!files || files.length === 0) return;
      void composerAttachments.addFiles(files);
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
        persistPromptDraft(query, sourceText, showSource);
      }, 200);

      return () => window.clearTimeout(timer);
    }, [query, sourceText, showSource]);

    // Flush immediately on accidental navigation or refresh before unload
    useEffect(() => {
      const handleBeforeUnload = () => {
        persistPromptDraft(query, sourceText, showSource);
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

    const isBusy = submitting || composerAttachments.isExtracting;

    const handleSubmit = async (mode: 'plan' | 'search' = 'search', valOrEvent?: string | React.FormEvent) => {
      if (typeof valOrEvent === 'object' && valOrEvent && 'preventDefault' in valOrEvent) {
        valOrEvent.preventDefault();
      }
      const rawText = typeof valOrEvent === 'string' ? valOrEvent : query;
      let textToSearch = rawText.trim();

      // If user submitted without text, but has attached sources or links, synthesize a default intent
      if (!textToSearch && composerAttachments.totalCount > 0) {
        const ready = composerAttachments.getReadySources();
        if (ready.length > 0) {
          textToSearch = `Study plan for ${ready[0].label}`;
        } else {
          textToSearch = 'Curriculum and study plan from reference materials';
        }
      }

      if (!textToSearch.trim() || submitting || composerAttachments.isExtracting) return;

      if (customOnSubmit) {
        customOnSubmit(textToSearch.trim());
        return;
      }

      setSubmitting(true);
      setIntakeError('');
      try {
        const ownerId: string | null = session?.user?.id ?? null;
        const readySources = composerAttachments.getReadySources();

        const draftPayload = {
          requestId: crypto.randomUUID(),
          prompt: textToSearch.trim(),
          mode,
          ...(readySources.length > 0 ? { sources: readySources } : {}),
          ...(sourceText.trim() ? { source: { label: 'Pasted text', text: sourceText.trim() } } : {}),
        };

        sessionStorage.setItem('undone:landing-query', textToSearch.trim());
        saveIntakeDraft(draftPayload, ownerId);
        persistPromptDraft(textToSearch.trim(), sourceText.trim(), showSource);

        if (!ownerId && status === 'unauthenticated') {
          const returnUrl = `/?q=${encodeURIComponent(textToSearch.trim())}&mode=${mode}`;
          const authHref = `/auth?returnTo=${encodeURIComponent(returnUrl)}`;
          if (router) router.push(authHref);
          else window.location.href = authHref;
          return;
        }

        // Direct POST to intake endpoint without blocking on a pre-flight GET
        try {
          const createRes = await fetch('/api/cohort-builder/intake', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...draftPayload, ...(ownerId ? { expectedOwnerId: ownerId } : {}) }),
          });
          if (createRes?.ok) {
            const created = await createRes.json();
            if (created?.workspaceId) {
              clearPromptDraft();
              composerAttachments.clearAll();
              const buildHref = `/quest/build/${created.workspaceId}`;
              if (router) router.push(buildHref);
              else window.location.href = buildHref;
              return;
            }
          }
        } catch {
          // Fall back to /quest/start
        }

        clearPromptDraft();
        if (router) router.push('/quest/start');
        else window.location.href = '/quest/start';
      } catch (error) {
        setIntakeError(error instanceof Error ? error.message : 'Intake unavailable');
        setSubmitting(false);
      }
    };

    const latestComposerError =
      composerAttachments.errors.length > 0
        ? composerAttachments.errors[composerAttachments.errors.length - 1]
        : '';
    const displayedError = intakeError || latestComposerError;

    return (
      <div
        className={`${styles.promptBarContainer} ${className || ''}`.trim()}
        style={maxWidth ? { maxWidth } : undefined}
      >
        {composerAttachments.files.length > 0 && (
          <div className={styles.attachmentTraySection}>
            <AttachmentTray
              files={composerAttachments.files}
              onRemoveFile={composerAttachments.removeFile}
              disabled={submitting}
            />
          </div>
        )}

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
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
              e.preventDefault();
              void handleSubmit('plan');
            }
          }}
          onSubmit={() => void handleSubmit('search')}
          placeholder={placeholder}
          className={styles.inputCard}
          inputClassName={styles.textInput}
          aria-label={ariaLabel || ariaLabelAlt || 'What do you want to learn about?'}
          bottomBar={
            <div className={styles.promptToolbar}>
              <div className={styles.promptPillGroup}>
                <button
                  type="button"
                  className={styles.promptPlusPill}
                  aria-label="Add sources"
                  aria-expanded={showSource}
                  onClick={() => {
                    setShowSource((prev) => !prev);
                    setSourceTab('links');
                  }}
                >
                  <Plus size={16} strokeWidth={2.0} />
                </button>

                <button
                  type="button"
                  className={`${styles.promptPill} ${showSource ? styles.promptPillActive : ''}`}
                  onClick={() => {
                    setShowSource((prev) => !prev);
                    setSourceTab('links');
                  }}
                  aria-expanded={showSource}
                >
                  <FileText size={15} strokeWidth={1.8} />
                  <span>
                    Add sources{composerAttachments.links.length > 0 ? ` (${composerAttachments.links.length})` : ''}
                  </span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
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
                  title="Upload reference files (.pdf, .txt, .md, .json)"
                  aria-label="Upload reference material"
                >
                  <Paperclip size={15} strokeWidth={1.8} />
                  <span>
                    Upload{composerAttachments.files.length > 0 ? ` (${composerAttachments.files.length})` : ''}
                  </span>
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
                  disabled={isBusy}
                  onClick={() => void handleSubmit('plan')}
                  title="Plan collaboratively with AI in conversational chat"
                >
                  <Lightbulb size={16} strokeWidth={1.8} />
                  <span>{composerAttachments.isExtracting ? 'Reading…' : 'Plan'}</span>
                </button>

                <span className={styles.promptDivider} aria-hidden="true" />

                <button
                  type="button"
                  className={styles.promptBeginBtn}
                  disabled={isBusy}
                  onClick={(e) => void handleSubmit('search', e)}
                  title="Search matching cohorts and begin your journey"
                >
                  <span>{composerAttachments.isExtracting ? 'Reading files…' : 'Begin journey'}</span>
                  <ArrowRight size={16} strokeWidth={2.0} />
                </button>
              </div>
            </div>
          }
        />

        {showSource && (
          <div className={styles.sourceTextWrapper} role="region" aria-label="Reference material drawer">
            <div className={styles.sourceTextHeader}>
              <div className={styles.drawerTabs}>
                <button
                  type="button"
                  className={`${styles.drawerTabBtn} ${sourceTab === 'links' ? styles.drawerTabBtnActive : ''}`}
                  onClick={() => setSourceTab('links')}
                >
                  Add links ({composerAttachments.links.length})
                </button>
                <button
                  type="button"
                  className={`${styles.drawerTabBtn} ${sourceTab === 'text' ? styles.drawerTabBtnActive : ''}`}
                  onClick={() => setSourceTab('text')}
                >
                  Paste raw text
                </button>
              </div>

              <div className={styles.sourceTextActions}>
                {sourceTab === 'text' && (
                  <span className={styles.sourceTextCounter}>
                    {sourceText.length.toLocaleString()} / 200,000
                  </span>
                )}
                {sourceTab === 'text' && sourceText.length > 0 && (
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

            {sourceTab === 'links' ? (
              <div className={styles.linkRowsWrapper}>
                <LinkRows
                  links={composerAttachments.links}
                  onAddLink={composerAttachments.addLink}
                  onRemoveLink={composerAttachments.removeLink}
                  disabled={submitting}
                />
              </div>
            ) : (
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
            )}
          </div>
        )}

        {displayedError && (
          <div className={styles.intakeErrorBanner} role="alert">
            <AlertCircle size={18} className={styles.intakeErrorIcon} aria-hidden="true" />
            <span className={styles.intakeErrorText}>{displayedError}</span>
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

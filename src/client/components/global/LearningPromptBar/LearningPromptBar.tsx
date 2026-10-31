'use client';

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle, useId } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Link as LinkIcon,
  Lightbulb,
  ArrowRight,
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
    const [internalQuery, setInternalQuery] = useState(() => {
      if (controlledValue !== undefined) return '';
      if (typeof window === 'undefined') return '';
      try {
        const parsedUrl = new URL(window.location.href, 'http://localhost');
        const q = parsedUrl.searchParams.get('q');
        if (q) return q;
      } catch {
        const urlParams = new URLSearchParams(window.location.search);
        const q = urlParams.get('q');
        if (q) return q;
      }
      try {
        const stored =
          sessionStorage.getItem('sidequest_prompt_query_draft') ||
          localStorage.getItem('sidequest_prompt_query_draft') ||
          sessionStorage.getItem('undone:landing-query');
        if (stored) return stored;
        const intakeDraft = readIntakeDraft(null);
        if (intakeDraft?.prompt) return intakeDraft.prompt;
      } catch {}
      return '';
    });
    const query = controlledValue !== undefined ? controlledValue : internalQuery;

    const linksRegionId = useId();
    const [showSource, setShowSource] = useState(() => {
      if (typeof window === 'undefined') return false;
      try {
        const storedShow =
          sessionStorage.getItem('sidequest_prompt_source_visible') ||
          localStorage.getItem('sidequest_prompt_source_visible');
        if (storedShow === 'true') return true;
        const storedSrc =
          sessionStorage.getItem('sidequest_prompt_source_draft') ||
          localStorage.getItem('sidequest_prompt_source_draft');
        if (storedSrc) return true;
        const intakeDraft = readIntakeDraft(null);
        if (intakeDraft?.source?.text || (intakeDraft?.sources && intakeDraft.sources.length > 0)) {
          return true;
        }
      } catch {}
      return false;
    });
    const [sourceText, setSourceText] = useState(() => {
      if (typeof window === 'undefined') return '';
      try {
        const storedSrc =
          sessionStorage.getItem('sidequest_prompt_source_draft') ||
          localStorage.getItem('sidequest_prompt_source_draft');
        if (storedSrc) return storedSrc;
        const intakeDraft = readIntakeDraft(null);
        if (intakeDraft?.source?.text) return intakeDraft.source.text;
      } catch {}
      return '';
    });
    const [intakeError, setIntakeError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [selectedMode, setSelectedMode] = useState<'search' | 'plan'>(() => {
      if (typeof window === 'undefined') return 'search';
      try {
        const parsedUrl = new URL(window.location.href, 'http://localhost');
        const m = parsedUrl.searchParams.get('mode');
        if (m === 'plan' || m === 'search') return m;
      } catch {
        const urlParams = new URLSearchParams(window.location.search);
        const m = urlParams.get('mode');
        if (m === 'plan' || m === 'search') return m;
      }
      try {
        const intakeDraft = readIntakeDraft(null);
        if (intakeDraft?.mode === 'plan' || intakeDraft?.mode === 'search') {
          return intakeDraft.mode;
        }
      } catch {}
      return 'search';
    });

    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const templateMenuRef = useRef<HTMLDivElement>(null);
    const submitInFlight = useRef(false);
    const intakeAttempt = useRef<{
      fingerprint: string;
      requestId: string;
    } | null>(null);
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
        const intakeDraft = readIntakeDraft(null);
        if (intakeDraft) {
          const contentPayload = {
            ownerId: session?.user?.id ?? null,
            prompt: intakeDraft.prompt,
            mode: intakeDraft.mode,
            ...(intakeDraft.sources && intakeDraft.sources.length > 0 ? { sources: intakeDraft.sources } : {}),
            ...(intakeDraft.source ? { source: intakeDraft.source } : {}),
          };
          intakeAttempt.current = {
            fingerprint: JSON.stringify(contentPayload),
            requestId: intakeDraft.requestId,
          };

          if (intakeDraft.sources && intakeDraft.sources.length > 0) {
            composerAttachments.restoreSources(intakeDraft.sources);
          }
        }
      }
    }, [composerAttachments, session?.user?.id]);

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
    const effectivePlaceholder = selectedMode === 'plan'
      ? 'Describe what you want to learn, your background, or paste links to plan...'
      : placeholder;

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

      if (!textToSearch.trim() || submitInFlight.current || submitting || composerAttachments.isExtracting) return;

      if (customOnSubmit) {
        customOnSubmit(textToSearch.trim());
        return;
      }

      submitInFlight.current = true;
      setSubmitting(true);
      setIntakeError('');
      try {
        const ownerId: string | null = session?.user?.id ?? null;
        const readySources = composerAttachments.getReadySources();

        const contentPayload = {
          ownerId,
          prompt: textToSearch.trim(),
          mode,
          ...(readySources.length > 0 ? { sources: readySources } : {}),
          ...(sourceText.trim() ? { source: { label: 'Pasted text', text: sourceText.trim() } } : {}),
        };
        const fingerprint = JSON.stringify(contentPayload);

        let requestId: string;
        if (intakeAttempt.current && intakeAttempt.current.fingerprint === fingerprint) {
          requestId = intakeAttempt.current.requestId;
        } else {
          requestId = crypto.randomUUID();
          intakeAttempt.current = { fingerprint, requestId };
        }

        const draftPayload = {
          requestId,
          prompt: textToSearch.trim(),
          mode,
          ...(readySources.length > 0 ? { sources: readySources } : {}),
          ...(sourceText.trim() ? { source: { label: 'Pasted text', text: sourceText.trim() } } : {}),
        };

        sessionStorage.setItem('undone:landing-query', textToSearch.trim());
        saveIntakeDraft(draftPayload, ownerId);
        persistPromptDraft(textToSearch.trim(), sourceText.trim(), showSource);

        if (!ownerId && status === 'unauthenticated') {
          submitInFlight.current = false;
          setSubmitting(false);
          const returnUrl = mode === 'plan'
            ? `/?q=${encodeURIComponent(textToSearch.trim())}&mode=plan`
            : `/?q=${encodeURIComponent(textToSearch.trim())}`;
          const authHref = `/auth?returnTo=${encodeURIComponent(returnUrl)}`;
          if (router) router.push(authHref);
          else window.location.href = authHref;
          return;
        }

        try {
          const createRes = await fetch('/api/cohort-builder/intake', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...draftPayload, ...(ownerId ? { expectedOwnerId: ownerId } : {}) }),
            signal: AbortSignal.timeout(15_000),
          });

          if (createRes.ok) {
            const created = await createRes.json();
            if (created?.workspaceId) {
              clearPromptDraft();
              composerAttachments.clearAll();
              intakeAttempt.current = null;
              const buildHref = `/quest/build/${created.workspaceId}`;
              if (router) router.push(buildHref);
              else window.location.href = buildHref;
              return;
            }
          }

          const errBody = await createRes.json().catch(() => ({}));
          const code = errBody?.code;
          submitInFlight.current = false;
          setSubmitting(false);

          if (createRes.status === 413 || code === 'INPUT_TOO_LARGE') {
            setIntakeError('Reference material exceeds the 3.5MB server limit. Please remove an attachment.');
            return;
          }
          if (createRes.status === 400 || code === 'INVALID_INPUT') {
            setIntakeError('Please provide a valid learning topic or curriculum intent.');
            return;
          }
          if (code) {
            setIntakeError(`Could not initialize cohort (${code}). Please retry.`);
            return;
          }
          setIntakeError('Could not confirm your request. Retry to continue.');
        } catch {
          submitInFlight.current = false;
          setSubmitting(false);
          setIntakeError('Could not confirm your request. Retry to continue.');
        }
      } catch (error) {
        submitInFlight.current = false;
        setSubmitting(false);
        setIntakeError(error instanceof Error ? error.message : 'Intake unavailable');
      }
    };

    const latestComposerError =
      composerAttachments.errors.length > 0
        ? composerAttachments.errors[composerAttachments.errors.length - 1]
        : '';
    const displayedError = intakeError || latestComposerError;

    return (
      <div
        className={`${styles.promptBarContainer} ${selectedMode === 'plan' ? styles.planModeActive : ''} ${className || ''}`.trim()}
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
          onSubmit={() => void handleSubmit(selectedMode)}
          placeholder={effectivePlaceholder}
          className={styles.inputCard}
          inputClassName={styles.textInput}
          aria-label={ariaLabel || ariaLabelAlt || 'What do you want to learn about?'}
          bottomBar={
            <>
              <div className={styles.promptToolbar}>
                <div className={styles.promptPillGroup}>
                  <button
                    type="button"
                    className={`${styles.promptPill} ${showSource ? styles.promptPillActive : ''}`}
                    onClick={() => setShowSource((prev) => !prev)}
                    aria-expanded={showSource}
                    aria-controls={linksRegionId}
                  >
                    <LinkIcon size={15} strokeWidth={1.8} />
                    <span>
                      Add link{composerAttachments.links.length > 0 ? ` (${composerAttachments.links.length})` : ''}
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
                    className={`${styles.promptPlanBtn} ${selectedMode === 'plan' ? styles.promptPlanBtnActive : ''}`}
                    disabled={isBusy}
                    aria-pressed={selectedMode === 'plan'}
                    onClick={() => {
                      setSelectedMode(current => current === 'plan' ? 'search' : 'plan');
                      inputRef.current?.focus();
                    }}
                    title="Plan collaboratively with AI in conversational chat"
                  >
                    <Lightbulb size={16} strokeWidth={selectedMode === 'plan' ? 2.2 : 1.8} />
                    <span>{composerAttachments.isExtracting ? 'Reading…' : 'Plan'}</span>
                    {selectedMode === 'plan' && (
                      <span className={styles.activePlanBadge} aria-hidden="true">✓</span>
                    )}
                  </button>

                  <span className={styles.promptDivider} aria-hidden="true" />

                  <button
                    type="button"
                    className={`${styles.promptBeginBtn} ${selectedMode === 'plan' ? styles.promptBeginBtnPlan : ''}`}
                    disabled={isBusy}
                    onClick={(e) => void handleSubmit(selectedMode, e)}
                    title={selectedMode === 'plan' ? 'Plan your cohort with AI assistant' : 'Search matching cohorts and begin your journey'}
                  >
                    <span>
                      {composerAttachments.isExtracting
                        ? 'Reading files…'
                        : selectedMode === 'plan'
                        ? 'Start planning'
                        : 'Begin journey'}
                    </span>
                    <ArrowRight size={16} strokeWidth={2.0} />
                  </button>
                </div>
              </div>

              {showSource && (
                <div
                  id={linksRegionId}
                  className={styles.inlineLinks}
                  role="region"
                  aria-label="Attached links"
                >
                  <div className={styles.inlineLinksHeader}>
                    <span>Links</span>
                    <button
                      type="button"
                      className={styles.inlineLinksClose}
                      onClick={() => setShowSource(false)}
                      aria-label="Close link input"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.stopPropagation();
                    }}
                  >
                    <LinkRows
                      links={composerAttachments.links}
                      onAddLink={composerAttachments.addLink}
                      onRemoveLink={composerAttachments.removeLink}
                      disabled={submitting}
                    />
                  </div>
                </div>
              )}

              {sourceText.trim() && (
                <details className={styles.legacySourceDetails}>
                  <summary className={styles.legacySourceSummary}>
                    <span>Previously attached text</span>
                    <button
                      type="button"
                      className={styles.legacySourceRemove}
                      onClick={(e) => {
                        e.preventDefault();
                        setSourceText('');
                      }}
                      aria-label="Remove previously attached text"
                    >
                      Remove
                    </button>
                  </summary>
                  <div className={styles.legacySourcePreview}>{sourceText}</div>
                </details>
              )}
            </>
          }
        />

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

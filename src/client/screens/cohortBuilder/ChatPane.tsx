'use client';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowUp, BookOpen, Check, LoaderCircle, Paperclip, Square, X } from 'lucide-react';
import { useWorkspaceMessages, useSendMessage, useInteractionState, useDispatchAction } from '@/src/client/interaction/hooks';
import type { CohortAction, CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { useComposerAttachments, AttachmentTray } from '@/src/client/components/global/Composer';
import { useAssistantActivity } from './useAssistantActivity';
import { sourceAttachmentAction } from './source-attachment-action';
import { stageSuggestions } from './chat-suggestions';
import type { EntityRef } from 'interaction-builder/core';
import styles from './CohortBuilder.module.css';
import { ProcessingChecklist } from './stages/ProcessingChecklist';
import dynamic from 'next/dynamic';
import { ChatMarkdown as StaticChatMarkdown } from './components/ChatMarkdown';

const DynamicChatMarkdown = dynamic(
  () => import('./components/ChatMarkdown').then((m) => m.ChatMarkdown),
  {
    loading: () => <span className="opacity-60 text-sm">...</span>,
  }
);

const ChatMarkdown = typeof process !== 'undefined' && process.env.NODE_ENV === 'test' ? StaticChatMarkdown : DynamicChatMarkdown;

interface AttachedEntity {
  entity: EntityRef;
  label: string;
}

interface ChatPaneProps {
  attachedEntity: AttachedEntity | null;
  onClearAttachedEntity: () => void;
  connection?: string;
}

export interface ChatProgressStep {
  id: string;
  label: string;
  state: 'pending' | 'running' | 'complete';
}

/** Detects when a user message in chat explicitly or implicitly asks to start/create a cohort or pick a starting branch. */
export function detectImplicitCohortStartAction(
  text: string,
  step: CohortWorkspace['journey'] extends { step: infer S } | undefined ? S | undefined : string | undefined
): CohortAction | null {
  if (step !== 'chat' && step !== 'recommendations') return null;
  const trimmed = text.trim();
  if (!trimmed || trimmed.endsWith('?')) return null;

  if (/\b(?:i\s+(?:already\s+)?have\s+(?:my\s+own\s+)?materials?|use\s+my\s+(?:own\s+)?(?:materials?|sources?|links?|files?))\b/i.test(trimmed)) {
    return { type: 'choose_starting_point', choice: 'have_material' };
  }

  if (/\b(?:find\s+materials?\s+for\s+me|start\s+with\s+a\s+goal)\b/i.test(trimmed)) {
    return { type: 'choose_starting_point', choice: 'find_material' };
  }

  if (
    /\b(?:create|start|build|make|launch|open)\s+(?:a\s+|an\s+|my\s+|our\s+|the\s+|own\s+)*(?:new\s+|custom\s+|own\s+)*(?:cohort|course|curriculum|studio)\b/i.test(trimmed) ||
    /\bcreate\s+my\s+own\b/i.test(trimmed) ||
    /\blet'?s\s+(?:start|build|create|make)\s+(?:it|this|one|a\s+cohort)\b/i.test(trimmed)
  ) {
    return { type: 'create_own_cohort' };
  }

  return null;
}

function buildTurnProgressSteps(
  latestUserText: string,
  step: string | undefined,
  hasLessons: boolean,
  activePhaseIndex: number
): ChatProgressStep[] {
  const isCohortStart = /\b(?:start|create|build|make|launch)\b.*\b(?:cohort|course|curriculum|studio)\b|\bcreate\s+my\s+own\b/i.test(latestUserText);
  const isCohortSearch = /\b(?:search|find|look\s+for|similar|browse)\b.*\bcohorts?\b/i.test(latestUserText);

  const step2Label = isCohortStart
    ? 'Preparing cohort creation studio'
    : isCohortSearch
    ? 'Understanding your learning goal'
    : step === 'review' || step === 'ready' || hasLessons
    ? 'Reviewing your curriculum structure'
    : step === 'material_input' || step === 'discovery'
    ? 'Analyzing your learning sources'
    : 'Mapping your learning pathway';

  const step3Label = isCohortStart
    ? 'Opening cohort studio'
    : isCohortSearch
    ? 'Looking for similar cohorts'
    : 'Drafting tailored response';

  const labels = ['Processing your query', step2Label, step3Label];

  return labels.map((label, idx) => ({
    id: `turn-step-${idx}`,
    label,
    state: idx < activePhaseIndex ? 'complete' : idx === activePhaseIndex ? 'running' : 'pending',
  }));
}

function ChatStepChecklist({ steps, ariaLabel = 'Assistant progress steps' }: { steps: ChatProgressStep[]; ariaLabel?: string }) {
  return (
    <ol className={styles.chatStepChecklist} aria-label={ariaLabel}>
      {steps.map(item => (
        <li
          key={item.id}
          className={styles.chatStepItem}
          data-step-state={item.state}
          aria-current={item.state === 'running' ? 'step' : undefined}
        >
          <span className={styles.stepMarker} aria-hidden="true">
            {item.state === 'complete' ? (
              <Check size={12} strokeWidth={2.8} className={styles.stepCheckIcon} />
            ) : item.state === 'running' ? (
              <LoaderCircle size={14} strokeWidth={2.4} className={styles.stepSpinnerIcon} />
            ) : (
              <span className={styles.stepPendingDot} />
            )}
          </span>
          <span className={styles.stepLabel}>{item.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function ChatPane({ attachedEntity, onClearAttachedEntity }: ChatPaneProps) {
  const messages = useWorkspaceMessages();
  const sendMessage = useSendMessage();
  const dispatchAction = useDispatchAction<CohortAction>();
  const state = useInteractionState<CohortWorkspace>();
  const activity = useAssistantActivity();
  const previousRuns = useRef(new Map<string, string>());
  const [runFailure, setRunFailure] = useState('');
  useFailureToast(runFailure, 'The assistant could not finish. Saved changes remain; send a follow-up to continue.', 'AssistantRun');
  useEffect(() => {
    for (const turn of activity.turns) {
      if (!turn.runId) continue;
      const previous = previousRuns.current.get(turn.runId);
      if (previous && previous !== 'failed' && turn.status === 'failed') setRunFailure(turn.runId);
      previousRuns.current.set(turn.runId, turn.status);
    }
  }, [activity.turns]);
  const [cancelError, setCancelError] = useState('');
  const [sendError, setSendError] = useState('');
  useFailureToast(sendError, 'Could not send. Your draft is kept; retry when ready.', 'ChatSend');
  useFailureToast(cancelError, 'Could not confirm Stop. Check the current run before retrying.', 'ChatStop');
  const committedSourceIds = useRef(new Set<string>());
  const activeTurn = activity.turns.find(turn => turn.status === 'running' || turn.status === 'queued');
  const selected = attachedEntity && state.view?.lessons.find(lesson => lesson.id === attachedEntity.entity.id);
  const staleSelection = !!attachedEntity && (!selected || selected.version !== attachedEntity.entity.version);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);
  const isInitialMount = useRef(true);
  const showsProcessing = state.view?.journey?.step === 'processing' || state.view?.journey?.step === 'ready';

  const composerAttachments = useComposerAttachments({ maxFiles: 10, maxLinks: 20 });

  const step = state.view?.journey?.step;
  const recommendations = state.view?.recommendations;
  const isRecommendationsSearching =
    step === 'recommendations' &&
    (!recommendations || recommendations.status === 'queued' || recommendations.status === 'running');

  // Interactive phase progression for cohort search checklist
  const [searchLeadPhase, setSearchLeadPhase] = useState<number>(() => (isRecommendationsSearching ? 1 : 2));
  useEffect(() => {
    if (!isRecommendationsSearching) {
      setSearchLeadPhase(2);
      return;
    }
    setSearchLeadPhase(1);
    const timer = setTimeout(() => {
      setSearchLeadPhase(2);
    }, 550);
    return () => clearTimeout(timer);
  }, [isRecommendationsSearching, state.view?.journey?.intentVersion]);

  // Interactive phase progression for general AI assistant turns
  const [turnPhaseIndex, setTurnPhaseIndex] = useState(0);
  useEffect(() => {
    if (!activeTurn) {
      setTurnPhaseIndex(0);
      return;
    }
    setTurnPhaseIndex(0);
    const t1 = setTimeout(() => setTurnPhaseIndex(1), 650);
    const t2 = setTimeout(() => setTurnPhaseIndex(2), 1600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [activeTurn?.runId, activeTurn?.status]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (scrollRef.current) {
        scrollRef.current.scrollTop = showsProcessing ? scrollRef.current.scrollHeight : 0;
      }
      return;
    }
    if (scrollRef.current && nearBottom.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, showsProcessing, recommendations?.status]);

  const handleSend = async (customText?: string) => {
    if (sending || staleSelection || composerAttachments.isExtracting) return;
    const readySources = composerAttachments.getReadySources();
    const rawText = customText ?? input;
    let textToSend = rawText.trim();

    if (!textToSend && !attachedEntity && readySources.length === 0) return;

    if (!textToSend && readySources.length > 0) {
      textToSend = readySources.length === 1
        ? `I attached ${readySources[0].label} as reference material.`
        : `I attached ${readySources.length} reference materials for our study plan.`;
    }

    setSending(true);

    try {
      setSendError('');
      for (const source of readySources) {
        if (committedSourceIds.current.has(source.id) || state.view?.sources.some(item => item.id === source.id)) continue;
        const ok = await dispatchAction(sourceAttachmentAction(source));
        if (!ok) throw new Error('Could not save an attachment. Your message and attachments are kept; retry.');
        committedSourceIds.current.add(source.id);
      }

      const implicitStageAction = detectImplicitCohortStartAction(textToSend, step);
      if (implicitStageAction) {
        void dispatchAction(implicitStageAction);
      }

      const sourceRefs: Array<{ entity: EntityRef; label: string }> = readySources.map(s => ({
        entity: { kind: 'source', id: s.id, version: state.view?.sources.find(source => source.id === s.id)?.version ?? 0 },
        label: s.label,
      }));
      const entityRefs = [
        ...(attachedEntity ? [attachedEntity] : []),
        ...sourceRefs,
      ];
      const ok = await sendMessage(textToSend, entityRefs);
      if (ok) {
        if (!customText) setInput(current => current === rawText ? '' : current);
        composerAttachments.clearAll();
        onClearAttachedEntity();
        committedSourceIds.current.clear();
      }
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Could not send. Please retry.');
    } finally {
      setSending(false);
    }
  };

  async function stopAssistant() {
    if (!activeTurn?.runId) return;
    setCancelError('');
    try {
      const response = await fetch(`/api/interaction/v1/workspaces/${state.workspaceId}/runs/${activeTurn.runId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Stopped by user' }),
      });
      if (!response.ok) throw new Error('Could not stop assistant; retry.');
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : 'Could not stop assistant');
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSend();
    }
  };

  const goal = state.view?.intent?.trim();
  const lessons = state.view?.lessons ?? [];
  const hasAssistantMessage = messages.some(message => message.role === 'assistant');
  const latestAssistantText = messages.filter(message => message.role === 'assistant').at(-1)?.parts
    .filter(part => part.type === 'text').map(part => part.text).join(' ') ?? '';
  const asksAboutBackground = /\b(background|experience|familiar|prerequisites)\b/i.test(latestAssistantText);

  const latestMessage = messages.at(-1);
  const latestUserText = useMemo(() => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    return lastUser?.parts.filter(p => p.type === 'text').map(p => p.text).join(' ') ?? goal ?? '';
  }, [messages, goal]);

  const showSearchActivityBubble =
    step === 'recommendations' ||
    (!!state.view?.journey &&
      step !== 'chat' &&
      step !== 'processing' &&
      step !== 'ready' &&
      !hasAssistantMessage &&
      (messages.length > 0 || !!recommendations));

  const searchChecklistSteps: ChatProgressStep[] = useMemo(() => {
    if (isRecommendationsSearching) {
      return [
        { id: 'search-query', label: 'Processing your query', state: 'complete' },
        {
          id: 'search-goal',
          label: 'Understanding your learning goal',
          state: searchLeadPhase >= 2 ? 'complete' : 'running',
        },
        {
          id: 'search-cohorts',
          label: 'Searching cohorts for you',
          state: searchLeadPhase >= 2 ? 'running' : 'pending',
        },
      ];
    }
    return [
      { id: 'search-query', label: 'Processing your query', state: 'complete' },
      { id: 'search-goal', label: 'Understanding your learning goal', state: 'complete' },
      { id: 'search-cohorts', label: 'Searching cohorts for you', state: 'complete' },
    ];
  }, [isRecommendationsSearching, searchLeadPhase]);

  const searchSummaryMarkdown = useMemo(() => {
    if (isRecommendationsSearching) return null;
    const topicLabel = goal || 'your learning goal';
    if (step === 'recommendations') {
      if (recommendations?.status === 'failed') {
        return `I couldn’t finish searching public cohorts for **${topicLabel}** right now. I’ve opened the studio panel on the right where you can retry the search or create your own cohort directly.`;
      }
      const matchCount = recommendations?.items?.length ?? 0;
      if (matchCount > 0) {
        return `I found **${matchCount}** matching community ${matchCount === 1 ? 'cohort' : 'cohorts'} for **${topicLabel}** and opened them on the right. You can join one directly, or click **Create your own cohort** to build a custom curriculum.`;
      }
      return `I searched our public cohorts for **${topicLabel}**, and no matching community cohorts exist yet. I’ve opened the studio on the right — click **Create your own cohort** (or tell me here how you’d like to start) to launch the first one!`;
    }
    return `I’ve opened the cohort studio on the right for **${topicLabel}**. Choose your starting point on the canvas or tell me what materials and goals you have in mind!`;
  }, [isRecommendationsSearching, goal, step, recommendations?.status, recommendations?.items?.length]);

  const isLatestUser = latestMessage?.role === 'user' && !showSearchActivityBubble;
  const hasActiveTurn =
    activity.turns.some(t => t.status === 'pending' || t.status === 'queued' || t.status === 'running') ||
    !!activeTurn;
  const showSuggestions =
    !sending &&
    !hasActiveTurn &&
    !isRecommendationsSearching &&
    !composerAttachments.isExtracting &&
    !isLatestUser;

  const suggestions = stageSuggestions(step, {
    goal,
    firstLessonTitle: lessons[0]?.title,
    asksAboutBackground,
  });

  const turnChecklistSteps = useMemo(
    () => buildTurnProgressSteps(latestUserText, step, lessons.length > 0, turnPhaseIndex),
    [latestUserText, step, lessons.length, turnPhaseIndex]
  );

  const placeholder = step === 'chat'
    ? 'What do you want to learn? Ask a question, explore topics, or paste links...'
    : step === 'recommendations'
    ? 'Describe what you want to learn...'
    : step === 'starting_point'
    ? 'Describe your starting point or material...'
    : step === 'material_input'
    ? 'Say anything...'
    : step === 'discovery'
    ? 'Refine your search or ask about sources...'
    : step === 'goal_setup'
    ? 'Describe your goal, pacing, or background...'
    : 'Type an instruction or request...';

  return (
    <div className={styles.railBody}>
      <div
        className={styles.messages}
        ref={scrollRef}
        onScroll={() => {
          const node = scrollRef.current;
          if (node) nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
        }}
      >
        {messages.map(m => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`${styles.messageRow} ${isUser ? styles.messageUser : styles.messageAssistant}`}
              >
                {!isUser && (
                  <div className={styles.assistantSparkleWrapper} aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/undone-logo.svg"
                      alt=""
                      aria-hidden="true"
                      width={20}
                      height={20}
                      className={styles.assistantMark}
                    />
                  </div>
                )}
                {isUser && (
                  (() => {
                    const entityParts = m.parts.filter(
                      (p): p is Extract<typeof p, { type: 'entity_ref' }> => p.type === 'entity_ref' && !!p.entity
                    );
                    if (entityParts.length === 0) return null;
                    return (
                      <div className={styles.userAttachmentsRow} role="group" aria-label="Attached references">
                        {entityParts.map((p, idx) => {
                          const isSource = p.entity.kind === 'source';
                          const fullTitle = p.label ?? p.entity.id;
                          return (
                            <button
                              type="button"
                              key={idx}
                              className={isSource ? styles.sourceAttachmentChip : styles.entityChip}
                              data-entity-id={p.entity.id}
                              data-entity-version={p.entity.version}
                              title={isSource ? `Source: ${fullTitle}` : `Lesson: ${fullTitle}`}
                              aria-label={isSource ? `Source: ${fullTitle}` : `Lesson: ${fullTitle}`}
                              onClick={() => {
                                if (isSource) return;
                                const targetId = p.entity.id.startsWith('lesson-') ? p.entity.id : `lesson-${p.entity.id}`;
                                document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
                              }}
                            >
                              {isSource ? (
                                <Paperclip size={11} className={styles.entityChipIcon} aria-hidden="true" />
                              ) : (
                                <BookOpen size={11} className={styles.entityChipIcon} aria-hidden="true" />
                              )}
                              <span className={styles.entityChipText}>{fullTitle}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
                <div className={isUser ? styles.userBubble : styles.assistantBubble}>
                  {isUser && !m.parts.some(p => p.type === 'text' && p.text.trim()) && (
                    <p className={styles.userText}>Shared reference materials</p>
                  )}
                  {m.parts.map((p, idx) => {
                    if (p.type === 'text') {
                      return isUser ? (
                        <p key={idx} className={styles.userText}>{p.text}</p>
                      ) : (
                        <ChatMarkdown key={idx} content={p.text} />
                      );
                    }
                    if (p.type === 'entity_ref' && p.entity && !isUser) {
                      const isSource = p.entity.kind === 'source';
                      const fullTitle = p.label ?? p.entity.id;
                      const entityId = p.entity.id;
                      const entityVersion = p.entity.version;
                      return (
                        <div key={idx} className={styles.chipsContainer}>
                          <button
                            type="button"
                            className={isSource ? styles.sourceAttachmentChip : styles.entityChip}
                            data-entity-id={entityId}
                            data-entity-version={entityVersion}
                            title={isSource ? `Source: ${fullTitle}` : `Lesson: ${fullTitle}`}
                            aria-label={isSource ? `Source: ${fullTitle}` : `Lesson: ${fullTitle}`}
                            onClick={() => {
                              if (isSource) return;
                              const targetId = entityId.startsWith('lesson-') ? entityId : `lesson-${entityId}`;
                              if (typeof window !== 'undefined') {
                                window.dispatchEvent(
                                  new CustomEvent('cohort:highlight-entity', {
                                    detail: { entityId, targetId, kind: p.entity?.kind ?? 'lesson' },
                                  })
                                );
                              }
                              const target = document.getElementById(targetId) || document.getElementById(entityId);
                              if (target) {
                                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                target.focus?.();
                              }
                            }}
                          >
                            {isSource ? (
                              <Paperclip size={12} className={styles.entityChipIcon} aria-hidden="true" />
                            ) : (
                              <BookOpen size={12} className={styles.entityChipIcon} aria-hidden="true" />
                            )}
                            <span className={styles.entityChipPrefix}>{isSource ? 'Source:' : 'Lesson:'}</span>
                            <span className={styles.entityChipText}>{fullTitle}</span>
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            );
          })}

        {showSearchActivityBubble && (
          <div className={`${styles.messageRow} ${styles.messageAssistant}`} role="status" aria-live="polite">
            <div className={styles.assistantSparkleWrapper} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/undone-logo.svg"
                alt=""
                aria-hidden="true"
                width={20}
                height={20}
                className={styles.assistantMark}
              />
            </div>
            <div className={styles.assistantBubble}>
              <ChatStepChecklist steps={searchChecklistSteps} ariaLabel="Cohort search progress" />
              {searchSummaryMarkdown && <ChatMarkdown content={searchSummaryMarkdown} />}
            </div>
          </div>
        )}

        {(step === 'processing' || step === 'ready') && state.view && (
          <ProcessingChecklist workspace={state.view} />
        )}

        {activeTurn && (
          <div className={`${styles.messageRow} ${styles.messageAssistant}`} role="status" aria-live="polite">
            <div className={styles.assistantSparkleWrapper} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/undone-logo.svg"
                alt=""
                aria-hidden="true"
                width={20}
                height={20}
                className={styles.assistantMark}
              />
            </div>
            <div className={styles.assistantBubble}>
              <ChatStepChecklist steps={turnChecklistSteps} ariaLabel="Assistant turn progress" />
              <div className={styles.thinkingContainer}>
                <div className={styles.thinkingDots} aria-label="Thinking">
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                </div>
                <span className={styles.thinkingLabel}>
                  Thinking…
                </span>
                <button
                  type="button"
                  className={styles.stopButton}
                  onClick={() => void stopAssistant()}
                  aria-label="Stop assistant turn"
                  title="Stop assistant turn"
                >
                  <Square size={11} fill="currentColor" aria-hidden="true" /> Stop
                </button>
              </div>
              {activity.turns.filter(turn => turn.status === 'pending').length > 0 && (
                <span className={styles.queuedBadge}>
                  {activity.turns.filter(turn => turn.status === 'pending').length} follow-up queued
                </span>
              )}
            </div>
          </div>
        )}
        {staleSelection && (
          <div className={styles.chatAlertRow} role="alert">
            <span>Selected lesson changed or was removed. Clear the selection, then select its current version.</span>
          </div>
        )}
      </div>

      <div className={styles.composerArea}>
        {showSuggestions && suggestions.length > 0 && (
          <div className={styles.suggestions} role="group" aria-label="Suggested next steps">
            {suggestions.slice(0, 3).map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => void handleSend(s.prompt)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <form
          className={styles.composerCard}
          onSubmit={e => {
            e.preventDefault();
            void handleSend();
          }}
        >
          {attachedEntity && (
            <div className={styles.activeRefBar}>
              <span>
                Referencing: <strong>{attachedEntity.label}</strong>
              </span>
              <button type="button" className={styles.clearRefBtn} onClick={onClearAttachedEntity}>
                <X size={14} /> Clear
              </button>
            </div>
          )}

          {composerAttachments.files.length > 0 && (
            <div className={styles.attachmentTraySection}>
              <AttachmentTray
                files={composerAttachments.files}
                onRemoveFile={composerAttachments.removeFile}
                disabled={sending}
              />
            </div>
          )}

          <div className={styles.composerInputRow}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.md,.json,application/pdf,text/plain,text/markdown,application/json"
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files) void composerAttachments.addFiles(e.target.files);
                e.target.value = '';
              }}
            />

            <button
              type="button"
              className={styles.attachBtn}
              onClick={() => fileInputRef.current?.click()}
              title="Attach reference files (.pdf, .txt, .md, .json)"
              aria-label="Attach reference file"
              disabled={sending || composerAttachments.isExtracting}
            >
              <Paperclip size={18} />
            </button>

            <textarea
              ref={textareaRef}
              aria-label="Message the cohort assistant"
              placeholder={placeholder}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              aria-busy={sending || composerAttachments.isExtracting}
              className={styles.composerTextarea}
            />

            <button
              type="submit"
              aria-label="Send message"
              className={styles.sendBtn}
              disabled={
                sending ||
                staleSelection ||
                composerAttachments.isExtracting ||
                (!input.trim() && !attachedEntity && composerAttachments.getReadySources().length === 0)
              }
            >
              <ArrowUp size={18} strokeWidth={2.4} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

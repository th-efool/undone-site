'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { ArrowUp, BookOpen, Paperclip, Square, X } from 'lucide-react';
import { useWorkspaceMessages, useSendMessage, useInteractionState, useDispatchAction } from '@/src/client/interaction/hooks';
import type { CohortAction, CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { useComposerAttachments, AttachmentTray } from '@/src/client/components/global/Composer';
import { useAssistantActivity } from './useAssistantActivity';
import { useTheme } from '@/src/client/hooks/useTheme';
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

export function ChatPane({ attachedEntity, onClearAttachedEntity, connection = 'live' }: ChatPaneProps) {
  const messages = useWorkspaceMessages();
  const sendMessage = useSendMessage();
  const dispatchAction = useDispatchAction<CohortAction>();
  const state = useInteractionState<CohortWorkspace>();
  const activity = useAssistantActivity();
  const { isDark } = useTheme();
  const [cancelError, setCancelError] = useState('');
  const activeTurn = activity.turns.find(turn => turn.status === 'running' || turn.status === 'queued');
  const selected = attachedEntity && state.view?.lessons.find(lesson => lesson.id === attachedEntity.entity.id);
  const staleSelection = !!attachedEntity && (!selected || selected.version !== attachedEntity.entity.version);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nearBottom = useRef(true);
  const isInitialMount = useRef(true);
  const showsProcessing = state.view?.journey?.step === 'processing' || state.view?.journey?.step === 'ready';

  const composerAttachments = useComposerAttachments({ maxFiles: 10, maxLinks: 20 });

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
  }, [messages.length, showsProcessing]);

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
      // 1. Dispatch attached sources directly into workspace
      for (const source of readySources) {
        const extraction = {
          text: source.text,
          locations: source.locations && source.locations.length > 0 ? source.locations : [{ start: 0, end: Math.max(source.text.length, 1) }],
          provenance: source.provenance,
          checksum: source.checksum ?? undefined,
        };

        if (source.label.toLowerCase().endsWith('.pdf') || (source.provenance as any)?.pageCount !== undefined) {
          await dispatchAction({
            type: 'add_pdf_source',
            label: source.label,
            extraction,
          });
        } else if (source.input?.kind === 'youtube' || source.label.includes('youtube.com') || source.label.includes('youtu.be')) {
          await dispatchAction({
            type: 'add_youtube_source',
            url: (source.input as any)?.url || source.label,
            label: source.label,
            mode: 'video_observation',
            extraction,
          });
        } else if (source.input?.kind === 'github' || source.label.includes('github.com')) {
          await dispatchAction({
            type: 'add_github_source',
            repoUrl: (source.input as any)?.repoUrl || source.label,
            ref: (source.input as any)?.ref || 'main',
            label: source.label,
            extraction,
          });
        } else if (source.input?.kind === 'web' || source.label.startsWith('http')) {
          await dispatchAction({
            type: 'add_web_source',
            url: (source.input as any)?.url || source.label,
            label: source.label,
            extraction,
          });
        } else {
          await dispatchAction({
            type: 'add_text_source',
            label: source.label,
            text: source.text,
          });
        }
      }

      const entityRefs = attachedEntity ? [attachedEntity] : [];
      const ok = await sendMessage(textToSend, entityRefs);
      if (ok) {
        if (!customText) setInput(current => current === rawText ? '' : current);
        composerAttachments.clearAll();
        onClearAttachedEntity();
      }
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

  const step = state.view?.journey?.step;

  const goal = state.view?.intent?.trim();
  const lessons = state.view?.lessons ?? [];
  const latestAssistantText = messages.filter(message => message.role === 'assistant').at(-1)?.parts
    .filter(part => part.type === 'text').map(part => part.text).join(' ') ?? '';
  const asksAboutBackground = /\b(background|experience|familiar|prerequisites)\b/i.test(latestAssistantText);
  const suggestions = step === 'chat' || step === 'review'
    ? [
        lessons.length
          ? `Refine the objectives for ${lessons[0].title}`
          : goal ? `Draft a deep-dive syllabus for ${goal}` : 'Help me choose a learning goal',
        asksAboutBackground
          ? `Help me assess my background${goal ? ` for ${goal}` : ''}`
          : goal ? `Add hands-on projects for ${goal}` : 'Help me assess my current background',
        `Set pace to ${state.view?.dailyMinutes === 45 ? 30 : 45} mins/day`,
        goal ? `Find external resources for ${goal}` : 'Help me choose a daily study pace',
      ]
    : step === 'recommendations'
    ? [
        'Show more advanced ones',
        'I want something more practical',
        'I’ll create my own instead',
      ]
    : step === 'discovery'
    ? [
        'Search again',
        'I’ll provide my own sources instead',
      ]
    : step === 'goal_setup'
    ? [
        '30 minutes per day',
        'For intermediate developers',
      ]
    : step === 'starting_point' || step === 'material_input'
    ? [
        'I have a YouTube playlist',
        'Find material for me',
        'I just have a goal',
      ]
    : step === 'processing'
    ? [
        'Show understanding progress',
        'Show chunking details',
        'Cancel processing',
      ]
    : step === 'ready'
    ? [
        'Show my learning experience',
        'Review my cohort',
        'What happens next?',
      ]
    : step === 'published'
    ? [
        'View cohort page',
        'Start learning in feed',
      ]
    : [
        'Make the description shorter',
        'Make the title clearer',
        'Clarify the learning objectives',
        'Add a capstone project lesson',
      ];

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

  const logoSrc = isDark ? '/undone-logo-dark.svg' : '/undone-logo-transparent.svg';

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
                {isUser ? (
                  <span className={styles.youAvatar} aria-hidden="true">
                    Y
                  </span>
                ) : (
                  <Image
                    className={styles.assistantAvatar}
                    src={logoSrc}
                    width={34}
                    height={34}
                    alt=""
                  />
                )}
                <div className={isUser ? styles.userBubble : styles.assistantBubble}>
                  <span className={styles.sender}>{isUser ? 'You' : 'Undone'}</span>
                  {m.parts.map((p, idx) => {
                    if (p.type === 'text') {
                      return isUser ? (
                        <p key={idx} className={styles.userText}>{p.text}</p>
                      ) : (
                        <ChatMarkdown key={idx} content={p.text} />
                      );
                    }
                    if (p.type === 'entity_ref' && p.entity) {
                      const fullTitle = p.label ?? p.entity.id;
                      const entityId = p.entity.id;
                      const entityVersion = p.entity.version;
                      return (
                        <div key={idx} className={styles.chipsContainer}>
                          <button
                            type="button"
                            className={styles.entityChip}
                            data-entity-id={entityId}
                            data-entity-version={entityVersion}
                            title={`Lesson: ${fullTitle}`}
                            aria-label={`Lesson: ${fullTitle}`}
                            onClick={() => {
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
                            <BookOpen size={12} className={styles.entityChipIcon} aria-hidden="true" />
                            <span className={styles.entityChipPrefix}>Lesson:</span>
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

        {(step === 'processing' || step === 'ready') && state.view && (
          <ProcessingChecklist workspace={state.view} />
        )}

        {activeTurn && (
          <div className={`${styles.messageRow} ${styles.messageAssistant}`} role="status">
            <Image
              className={styles.assistantAvatar}
              src={logoSrc}
              width={34}
              height={34}
              alt=""
            />
            <div className={styles.assistantBubble}>
              <span className={styles.sender}>Undone</span>
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

        {activity.turns.some(turn => turn.status === 'failed' || turn.status === 'canceled') && (
          <p className={styles.chatAlertRow}>Stopped or failed turns remain saved. Send a follow-up to retry the intended change.</p>
        )}

        {cancelError && (
          <div className={styles.chatAlertRow} role="alert">
            <span>{cancelError}</span>
          </div>
        )}
        {staleSelection && (
          <div className={styles.chatAlertRow} role="alert">
            <span>Selected lesson changed or was removed. Clear the selection, then select its current version.</span>
          </div>
        )}
      </div>

      <div className={styles.composerArea}>
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

        <form
          className={styles.composer}
          onSubmit={e => {
            e.preventDefault();
            void handleSend();
          }}
        >
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
            aria-label="Message the cohort assistant"
            placeholder={placeholder}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            aria-busy={sending || composerAttachments.isExtracting}
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={
              sending ||
              staleSelection ||
              composerAttachments.isExtracting ||
              (!input.trim() && !attachedEntity && composerAttachments.getReadySources().length === 0)
            }
          >
            <ArrowUp size={22} strokeWidth={2.4} />
          </button>
        </form>

        <div className={styles.suggestions}>
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => void handleSend(s)}
              disabled={sending || !!activeTurn}
            >
              {s}
            </button>
          ))}
        </div>

        <span className={styles.saved} role="status">
          {Object.keys(state.pending ?? {}).length
            ? 'Saving…'
            : connection === 'live'
            ? 'Saved to your account'
            : 'Last saved state'}
        </span>
      </div>
    </div>
  );
}

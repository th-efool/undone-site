'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { ArrowUp, BookOpen, Lightbulb, Square, X } from 'lucide-react';
import { useWorkspaceMessages, useSendMessage, useInteractionState } from '@/src/client/interaction/hooks';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { useAssistantActivity } from './useAssistantActivity';
import { useTheme } from '@/src/client/hooks/useTheme';
import type { EntityRef } from 'interaction-builder/core';
import styles from './CohortBuilder.module.css';
import { ProcessingChecklist } from './stages/ProcessingChecklist';
import { ChatMarkdown } from './components/ChatMarkdown';

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
  const nearBottom = useRef(true);
  const isInitialMount = useRef(true);
  const showsProcessing = state.view?.journey?.step === 'processing' || state.view?.journey?.step === 'ready';

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
    const textToSend = customText ?? input;
    if (sending || staleSelection || (!textToSend.trim() && !attachedEntity)) return;
    setSending(true);

    try {
      const entityRefs = attachedEntity ? [attachedEntity] : [];
      const ok = await sendMessage(textToSend, entityRefs);
      if (ok) {
        if (!customText) setInput(current => current === textToSend ? '' : current);
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const step = state.view?.journey?.step;

  const suggestions = step === 'recommendations'
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

  const hintTitle = step === 'recommendations'
    ? (state.view?.recommendations?.items.length === 0 ? 'A new path' : 'Why these?')
    : step === 'starting_point'
    ? 'We’ll keep this simple.'
    : step === 'material_input'
    ? 'You can give me multiple sources'
    : step === 'discovery'
    ? 'Discovering sources'
    : step === 'goal_setup'
    ? 'AI-authored guide'
    : step === 'processing'
    ? 'Your work stays saved'
    : step === 'ready'
    ? 'You choose what happens next'
    : step === 'published'
    ? 'Your cohort is live'
    : 'You stay in control';

  const hintText = step === 'recommendations'
    ? (state.view?.recommendations?.items.length === 0
        ? 'No matching public cohort was found. Create your own from this learning intent.'
        : 'We search public cohorts for your learning intent. You can join a match or create your own.')
    : step === 'starting_point'
    ? 'You can start with the material you already have, have me find the best resources, or just tell me your goal and I’ll figure out the rest.'
    : step === 'material_input'
    ? 'A playlist, some PDFs, a GitHub repo, articles — whatever you’ve got. I’ll understand it, break it down, and turn it into a structured learning journey.'
    : step === 'discovery'
    ? 'Review observed sources before acquiring them, or search again.'
    : step === 'goal_setup'
    ? 'Shape your learning goal and pacing. We will generate a structured learning guide.'
    : step === 'processing'
    ? 'Building progress reflects saved work. You can close this page and return while processing continues.'
    : step === 'ready'
    ? 'Go to your feed activates this cohort privately. Review cohort lets you edit it first. Public publishing is always a separate choice.'
    : step === 'published'
    ? 'Your learning experience is published and accessible from your cohort receipt.'
    : 'Suggestions can change titles, descriptions and learning objectives. Source material and publication decisions stay under your control.';

  const placeholder = step === 'recommendations'
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
        {messages.length === 0 ? (
          <>
            <div className={`${styles.messageRow} ${styles.messageUser}`}>
              <span className={styles.youAvatar} aria-hidden="true">
                Y
              </span>
              <div className={styles.userBubble}>
                <span className={styles.sender}>You</span>
                <p>{state.view?.intent || 'I’m looking for something new to learn.'}</p>
              </div>
            </div>

            <div className={`${styles.messageRow} ${styles.messageAssistant}`}>
              <Image
                className={styles.assistantAvatar}
                src={logoSrc}
                width={34}
                height={34}
                alt=""
              />
              <div className={styles.assistantBubble}>
                <span className={styles.sender}>Undone</span>
                <p>
                  {step === 'recommendations'
                    ? (state.view?.recommendations?.items.length
                        ? 'I found a few existing cohorts that might be a good fit, or we can build your own.'
                        : 'Let’s make a learning journey that fits you.')
                    : step === 'starting_point'
                    ? 'Let’s make something that fits what you actually want. Pick a starting point or describe it.'
                    : step === 'discovery'
                    ? 'I can search for grounded sources to fit your goal, or you can provide your own.'
                    : step === 'goal_setup'
                    ? 'Let’s shape your goal and daily pace to generate your learning guide.'
                    : 'I’ve got it. Let’s make a learning journey that fits you.'}
                </p>
              </div>
            </div>
          </>
        ) : (
          messages.map(m => {
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
                              const target = document.getElementById(`lesson-${entityId}`);
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
          })
        )}

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
                  {activeTurn.status === 'queued' ? 'Queued in line…' : 'Thinking…'}
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

        <div className={styles.hint}>
          <Lightbulb size={27} strokeWidth={1.3} aria-hidden="true" />
          <div>
            <strong>{hintTitle}</strong>
            <p>{hintText}</p>
          </div>
        </div>
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

        <form
          className={styles.composer}
          onSubmit={e => {
            e.preventDefault();
            void handleSend();
          }}
        >
          <textarea
            aria-label="Message the cohort assistant"
            placeholder={placeholder}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            aria-busy={sending}
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={sending || staleSelection || (!input.trim() && !attachedEntity)}
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
              disabled={sending}
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

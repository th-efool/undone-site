'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { ArrowUp, BookOpen, Lightbulb, X } from 'lucide-react';
import { useWorkspaceMessages, useSendMessage, useInteractionState } from '@/src/client/interaction/hooks';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { useAssistantActivity } from './useAssistantActivity';
import { useTheme } from '@/src/client/hooks/useTheme';
import type { EntityRef } from 'interaction-builder/core';
import styles from './CohortBuilder.module.css';

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

  useEffect(() => {
    if (scrollRef.current && nearBottom.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async (customText?: string) => {
    const textToSend = customText ?? input;
    if (sending || staleSelection || (!textToSend.trim() && !attachedEntity)) return;
    setSending(true);

    try {
      const entityRefs = attachedEntity ? [attachedEntity] : [];
      const ok = await sendMessage(textToSend, entityRefs);
      if (ok) {
        if (!customText) setInput('');
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

  const suggestions = [
    'Add a capstone project lesson',
    'Tighten audience to intermediate devs',
    'Set daily commitment to 25 mins',
    'Clarify objectives across all lessons',
  ];

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
                <p>I’ve got it. Let’s make a learning journey that fits you.</p>
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
                      return <p key={idx}>{p.text}</p>;
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

        {activeTurn && (
          <div className={styles.turnStatusNotice} role="status">
            <p>
              Assistant {activeTurn.status}. {activity.turns.filter(turn => turn.status === 'pending').length} messages waiting.
            </p>
            <button type="button" onClick={() => void stopAssistant()}>
              Stop assistant turn
            </button>
          </div>
        )}

        {activity.turns.some(turn => turn.status === 'failed' || turn.status === 'canceled') && (
          <p>Stopped or failed turns remain saved. Send a follow-up to retry the intended change.</p>
        )}

        {cancelError && <p role="alert">{cancelError}</p>}
        {staleSelection && (
          <p role="alert">
            Selected lesson changed or was removed. Clear the selection, then select its current version.
          </p>
        )}

        <div className={styles.hint}>
          <Lightbulb size={27} strokeWidth={1.3} aria-hidden="true" />
          <div>
            <strong>Grounded in your material</strong>
            <p>Chat directly with AI to draft, structure, and refine your curriculum with source provenance.</p>
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
            placeholder="Type an instruction or request..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={sending}
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
          {Object.keys(state.pending).length
            ? 'Saving…'
            : connection === 'live'
            ? 'Saved to your account'
            : 'Last saved state'}
        </span>
      </div>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, MessageSquare, X } from 'lucide-react';
import { useWorkspaceMessages, useSendMessage } from '@/src/client/interaction/hooks';
import type { EntityRef } from 'interaction-builder/core';
import styles from './CohortBuilder.module.css';

interface AttachedEntity {
  entity: EntityRef;
  label: string;
}

interface ChatPaneProps {
  attachedEntity: AttachedEntity | null;
  onClearAttachedEntity: () => void;
}

export function ChatPane({ attachedEntity, onClearAttachedEntity }: ChatPaneProps) {
  const messages = useWorkspaceMessages();
  const sendMessage = useSendMessage();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async (customText?: string) => {
    const textToSend = customText ?? input;
    if (!textToSend.trim() && !attachedEntity) return;
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

  return (
    <aside className={styles.leftPane} aria-label="AI Assistant Chat">
      <div className={styles.chatHeader}>
        <h2>
          <Sparkles size={18} color="#5a50bf" />
          Cohort Assistant
        </h2>
        <p>Chat directly with AI to draft, structure, and refine your curriculum.</p>
      </div>

      <div className={styles.messagesList} ref={scrollRef}>
        {messages.length === 0 ? (
          <div className={styles.emptyChat}>
            <MessageSquare size={32} color="#b5afc3" style={{ margin: '0 auto 12px' }} />
            <h3>Start building</h3>
            <p>
              Ask the assistant to add lessons, change learning objectives, or fine-tune your cohort intent.
            </p>
          </div>
        ) : (
          messages.map(m => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`${styles.messageRow} ${isUser ? styles.messageUser : styles.messageAssistant}`}
              >
                <div className={styles.messageSender}>
                  {isUser ? 'You' : 'Assistant'}
                </div>
                <div
                  className={`${styles.messageBubble} ${
                    isUser ? styles.bubbleUser : styles.bubbleAssistant
                  }`}
                >
                  {m.parts.map((p, idx) => {
                    if (p.type === 'text') {
                      return <span key={idx}>{p.text}</span>;
                    }
                    if (p.type === 'entity_ref' && p.entity) {
                      return (
                        <div key={idx} className={styles.chipsContainer}>
                          <span
                            className={`${styles.entityChip} ${
                              !isUser ? styles.entityChipLight : ''
                            }`}
                          >
                            [Lesson: {p.label ?? p.entity.id}]
                          </span>
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
      </div>

      {attachedEntity && (
        <div className={styles.activeRefBar}>
          <span>Referencing: <strong>{attachedEntity.label}</strong></span>
          <button className={styles.clearRefBtn} onClick={onClearAttachedEntity}>
            <X size={14} /> Clear
          </button>
        </div>
      )}

      <div className={styles.suggestionsBar}>
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            className={styles.suggestionBtn}
            onClick={() => void handleSend(s)}
            disabled={sending}
          >
            {s}
          </button>
        ))}
      </div>

      <div className={styles.chatComposer}>
        <textarea
          className={styles.chatInput}
          rows={1}
          placeholder="Type an instruction or request..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button
          className={styles.sendBtn}
          onClick={() => void handleSend()}
          disabled={sending || (!input.trim() && !attachedEntity)}
          aria-label="Send message"
        >
          <Send size={18} />
        </button>
      </div>
    </aside>
  );
}

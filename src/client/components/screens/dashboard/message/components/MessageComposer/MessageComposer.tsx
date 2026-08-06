'use client';

import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Check, Image as ImageIcon, Plus, Send, Smile } from 'lucide-react';

import { PillInput } from '@/src/client/components/global/PillInput';
import type { ReplyContext } from '../../models';

import styles from './MessageComposer.module.css';

type UploadKind = 'image' | 'pdf' | 'file' | 'video' | 'audio';
type HiddenUploadKind = Exclude<UploadKind, 'image'>;

export interface MessageComposerProps {
  value: string;
  onChange(value: string): void;
  onSend(): void;
  onUpload(file: File, kind: UploadKind): void;
  placeholder?: string;
  autoFocusWhenEmpty?: boolean;
  submitInsideInput?: boolean;
  sendButtonClassName?: string;
  inputClassName?: string;
  children?: ReactNode;
  /** Inline reply banner displayed above the composer */
  replyBanner?: ReplyContext | null;
  onReplyDismiss?(): void;
}

// Batch C: Expanded categorized emoji picker
const emojis = [
  // Faces (row 1)
  ['😀', '😂', '😍', '🥹', '😎'],
  // Reactions (row 2)
  ['🔥', '❤️', '👏', '🙌', '💯'],
  // Objects/Symbols (row 3)
  ['✅', '💡', '📌', '⭐', '🎯'],
  // Celebration/Other (row 4)
  ['🚀', '🎉', '🙏', '✨', '💪'],
];

export function MessageComposer({
  value,
  onChange,
  onSend,
  onUpload,
  placeholder = 'Type a message...',
  autoFocusWhenEmpty = false,
  submitInsideInput = false,
  sendButtonClassName,
  inputClassName,
  replyBanner,
  onReplyDismiss,
}: MessageComposerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [uploadKind, setUploadKind] = useState<HiddenUploadKind>('file');

  // Batch C: Draft saved indicator (debounced)
  const [draftSaved, setDraftSaved] = useState(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!value) {
      clearTimeout(draftTimerRef.current);
      return;
    }
    // Debounce: show "Draft saved" after 600ms of inactivity
    clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    }, 600);
    return () => clearTimeout(draftTimerRef.current);
  }, [value]);

  // Batch C: Send animation state
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocusWhenEmpty && !value) inputRef.current?.focus();
  }, [autoFocusWhenEmpty, value]);

  useEffect(() => {
    if (replyBanner) {
      inputRef.current?.focus();
    }
  }, [replyBanner]);

  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSending(true);
      setTimeout(() => setSending(false), 800);
      onSend();
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [onSend],
  );

  const insertEmoji = (emoji: string) => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
    onChange(next);
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const pickFile = (kind: HiddenUploadKind) => {
    setUploadKind(kind);
    setMenuOpen(false);
    requestAnimationFrame(() => fileRef.current?.click());
  };

  const uploadAccept =
    uploadKind === 'video' ? 'video/*' : uploadKind === 'audio' ? 'audio/*' : undefined;

  // Batch C: Send button with animation state
  const sendButtonContent = sending ? (
    <Check size={21} />
  ) : (
    <Send size={21} />
  );
  const sendButton = (
    <button
      type="submit"
      className={`${sendButtonClassName ?? ''} ${sending ? styles.sending : ''}`}
      aria-label="Send message"
    >
      {sendButtonContent}
    </button>
  );

  return (
    <>
      {/* Batch C: Reply banner above composer */}
      {replyBanner && onReplyDismiss && (
        <form
          onSubmit={(e) => e.preventDefault()}
          className={styles.composerWrapper}
        >
          <div className={styles.replyBanner}>
            <button
              type="button"
              aria-label="Dismiss reply"
              className={styles.replyDismiss}
              onClick={onReplyDismiss}
            >
              <Plus size={16} style={{ transform: 'rotate(90deg)' }} />
            </button>
            <div className={styles.replyContent}>
              <span className={styles.replyLabel}>Replying to @{replyBanner.senderName}</span>
              <span className={styles.replyPreview}>{replyBanner.previewText}</span>
            </div>
            <button
              type="button"
              aria-label="Dismiss reply"
              className={styles.replyClose}
              onClick={onReplyDismiss}
            >
              ×
            </button>
          </div>
        </form>
      )}
      <form
        className={styles.composer}
        onSubmit={submit}
      >
        {/* Batch C: Draft saved indicator */}
        {draftSaved && (
          <span className={styles.draftSaved}>Draft saved ✓</span>
        )}
        <div className={styles.toolWrap}>
        <button
          type="button"
          className={styles.plus}
          aria-label="Add attachment"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Plus size={22} />
        </button>
        {menuOpen && (
          <div className={styles.menu}>
            <button
              type="button"
              onClick={() => pickFile('file')}
            >
              Upload File
            </button>
            <button
              type="button"
              onClick={() => imageRef.current?.click()}
            >
              Upload Image
            </button>
            <button
              type="button"
              onClick={() => pickFile('video')}
            >
              Upload Video
            </button>
            <button
              type="button"
              onClick={() => pickFile('audio')}
            >
              Upload Audio
            </button>
          </div>
        )}
      </div>
      <input
        ref={fileRef}
        hidden
        type="file"
        accept={uploadAccept}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file, uploadKind);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={imageRef}
        hidden
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file, 'image');
          event.currentTarget.value = '';
        }}
      />
      <PillInput
        ref={inputRef}
        className={`${styles.input} ${inputClassName ?? ''}`}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rightSlot={
          <>
            <div className={styles.toolWrap}>
              <button
                type="button"
                aria-label="Add emoji"
                onClick={() => setEmojiOpen((open) => !open)}
              >
                <Smile size={submitInsideInput ? 22 : 21} />
              </button>
              {emojiOpen && (
                <div className={styles.emoji}>
                  {emojis.flat().map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              aria-label="Add image"
              onClick={() => imageRef.current?.click()}
            >
              <ImageIcon size={20} />
            </button>
            {submitInsideInput && sendButton}
          </>
        }
      />
      {!submitInsideInput && sendButton}
    </form>
    </>
  );
}

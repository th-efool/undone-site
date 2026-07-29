'use client';

import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Plus, Send, Smile } from 'lucide-react';

import { PillInput } from '@/src/client/components/global/PillInput';

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
}

const emojis = ['😀', '😂', '😍', '🔥', '🚀', '👏', '🙌', '✅', '💡', '📌', '🙏', '🎉'];

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
}: MessageComposerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [uploadKind, setUploadKind] = useState<HiddenUploadKind>('file');
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocusWhenEmpty && !value) inputRef.current?.focus();
  }, [autoFocusWhenEmpty, value]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSend();
    requestAnimationFrame(() => inputRef.current?.focus());
  };

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
  const sendButton = (
    <button
      type="submit"
      className={sendButtonClassName}
      aria-label="Send message"
    >
      <Send size={21} />
    </button>
  );

  return (
    <form
      className={styles.composer}
      onSubmit={submit}
    >
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
                  {emojis.map((emoji) => (
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
  );
}

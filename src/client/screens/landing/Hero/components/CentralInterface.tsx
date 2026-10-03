'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Plus,
  Lightbulb,
  ArrowRight,
  FileText,
  Paperclip,
  Sparkles,
} from 'lucide-react';
import { TextBar } from '@/src/client/components/ui';
import styles from '../Hero.module.css';

export function CentralInterface() {
  const [query, setQuery] = useState('');

  const handleSubmit = (valOrEvent?: string | React.FormEvent) => {
    if (typeof valOrEvent === 'object' && valOrEvent && 'preventDefault' in valOrEvent) {
      valOrEvent.preventDefault();
    }
    const textToSearch = typeof valOrEvent === 'string' ? valOrEvent : query;
    if (textToSearch.trim()) {
      window.location.href = `/quest/new?q=${encodeURIComponent(textToSearch.trim())}`;
    }
  };

  return (
    <div className={styles.heroContent}>
      {/* Eyebrow */}
      <span className={styles.eyebrow}>A MORE CURIOUS YOU</span>

      {/* Main Heading */}
      <h1 className={styles.headline}>
        What do you want
        <br />
        to{' '}
        <span className={styles.headlineItalic}>
          explore?
          <Image
            src="/images/hero-collage/underline-flourish.svg"
            alt=""
            width={260}
            height={24}
            className={styles.underlineFlourish}
            priority
          />
        </span>
      </h1>

      {/* Subtitle */}
      <p className={styles.subtitle}>
        Turn a curiosity, skill, or question into a learning journey.
      </p>

      {/* Remade Central TextBar matching reference */}
      <TextBar
        variant="prompt"
        multiline
        minRows={1}
        maxRows={{ base: 4, sm: 5, md: 6, lg: 8 }}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onSubmit={handleSubmit}
        placeholder="I want to learn about..."
        className={styles.inputCard}
        inputClassName={styles.textInput}
        aria-label="What do you want to learn about?"
        bottomBar={
          <div className={styles.promptToolbar}>
            <div className={styles.promptPillGroup}>
              <button
                type="button"
                className={styles.promptPlusPill}
                aria-label="Add attachment"
              >
                <Plus size={18} strokeWidth={2.2} />
              </button>

              <button type="button" className={styles.promptPill}>
                <FileText size={17} strokeWidth={1.8} />
                <span>Add sources</span>
              </button>

              <button type="button" className={styles.promptPill}>
                <Paperclip size={17} strokeWidth={1.8} />
                <span>Upload</span>
              </button>

              <button type="button" className={styles.promptPill}>
                <Sparkles size={17} strokeWidth={1.8} />
                <span>Use a template</span>
              </button>
            </div>

            <div className={styles.promptRightActions}>
              <button type="button" className={styles.promptPlanBtn}>
                <Lightbulb size={18} strokeWidth={1.8} />
                <span>Plan</span>
              </button>

              <span className={styles.promptDivider} aria-hidden="true" />

              <button type="submit" className={styles.promptBeginBtn}>
                <span>Begin journey</span>
                <ArrowRight size={17} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        }
      />
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Plus,
  Lightbulb,
  ArrowRight,
  Compass,
  GraduationCap,
  Search,
  Hammer,
  Database,
  FileText,
  LayoutTemplate,
  ChevronDown,
} from 'lucide-react';
import { TextBar } from '@/src/client/components/ui';
import styles from '../ReconstructedHero.module.css';

export function CentralInterface() {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      window.location.href = `/quest/new?q=${encodeURIComponent(query)}`;
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
            width={180}
            height={17}
            className={styles.underlineFlourish}
            priority
          />
        </span>
      </h1>

      {/* Subtitle */}
      <p className={styles.subtitle}>
        Turn a curiosity, skill, or question into a learning journey.
      </p>

      {/* Input Surface Card (Global TextBar) */}
      <TextBar
        variant="card"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onSubmit={handleSubmit}
        placeholder="I want to learn about..."
        className={styles.inputCard}
        inputClassName={styles.textInput}
        aria-label="What do you want to learn about?"
        leftSlot={
          <button
            type="button"
            className={styles.plusButton}
            aria-label="Add attachment or context"
          >
            <Plus size={18} strokeWidth={2.2} />
          </button>
        }
        rightSlot={
          <div className={styles.inputControls}>
            <button type="button" className={styles.planButton}>
              <Lightbulb size={16} strokeWidth={2} />
              <span>Plan</span>
            </button>

            <button type="submit" className={styles.beginJourneyBtn}>
              <span>Begin journey</span>
              <ArrowRight size={15} strokeWidth={2.2} />
            </button>
          </div>
        }
      />

      {/* 4 Action Tiles */}
      <div className={styles.actionTilesGrid}>
        <button type="button" className={styles.actionTile}>
          <div className={styles.tileIconSquare}>
            <Compass size={22} strokeWidth={1.8} />
          </div>
          <div className={styles.tileLabels}>
            <span className={styles.tileAction}>Explore</span>
            <span className={styles.tileTarget}>a topic</span>
          </div>
        </button>

        <button type="button" className={styles.actionTile}>
          <div className={styles.tileIconSquare}>
            <GraduationCap size={22} strokeWidth={1.8} />
          </div>
          <div className={styles.tileLabels}>
            <span className={styles.tileAction}>Learn</span>
            <span className={styles.tileTarget}>a skill</span>
          </div>
        </button>

        <button type="button" className={styles.actionTile}>
          <div className={styles.tileIconSquare}>
            <Search size={21} strokeWidth={2} />
          </div>
          <div className={styles.tileLabels}>
            <span className={styles.tileAction}>Research</span>
            <span className={styles.tileTarget}>a question</span>
          </div>
        </button>

        <button type="button" className={styles.actionTile}>
          <div className={styles.tileIconSquare}>
            <Hammer size={21} strokeWidth={1.8} />
          </div>
          <div className={styles.tileLabels}>
            <span className={styles.tileAction}>Build</span>
            <span className={styles.tileTarget}>something</span>
          </div>
        </button>
      </div>

      {/* Divider */}
      <div className={styles.dividerWrapper}>
        <div className={styles.dividerLine} />
        <span className={styles.dividerBadge}>
          or start with something you have
        </span>
      </div>

      {/* Source Pill Buttons */}
      <div className={styles.pillsRow}>
        <button type="button" className={styles.pillButton}>
          <Database size={16} strokeWidth={1.8} />
          <span>Add sources</span>
        </button>

        <button type="button" className={styles.pillButton}>
          <FileText size={16} strokeWidth={1.8} />
          <span>Upload a file</span>
        </button>

        <button type="button" className={styles.pillButton}>
          <LayoutTemplate size={16} strokeWidth={1.8} />
          <span>Use a template</span>
        </button>
      </div>

      {/* Footer affordance */}
      <a href="#how-it-works" className={styles.footerAffordance}>
        <span>See how it works</span>
        <ChevronDown size={16} strokeWidth={2} />
      </a>
    </div>
  );
}

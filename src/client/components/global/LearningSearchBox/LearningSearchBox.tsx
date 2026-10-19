'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import {
  LearningPromptBar,
  type LearningPromptBarHandle,
} from '@/src/client/components/global/LearningPromptBar';
import { SuggestionPromptRow } from '@/src/client/components/global/SuggestionPromptRow';
import { FeaturedCohortsStrip } from '@/src/client/screens/landing/Hero/components/FeaturedCohortsStrip';
import styles from '@/src/client/screens/landing/Hero/Hero.module.css';

const CATEGORIES = [
  'SideQuests',
  'Trending',
  'Technology',
  'Science',
  'Arts & Humanities',
] as const;

export function LearningSearchBox() {
  const promptBarRef = useRef<LearningPromptBarHandle>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('SideQuests');

  const handleSelectPrompt = (promptText: string) => {
    promptBarRef.current?.setPrompt(promptText);
  };

  return (
    <div id="explore" className={styles.heroContent}>
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
        A little curiosity goes a long way.
      </p>

      {/* Global Learning Prompt Bar */}
      <LearningPromptBar ref={promptBarRef} />

      {/* Suggestion Prompt Cards Row (Unfinished pursuits) */}
      <SuggestionPromptRow onSelectPrompt={handleSelectPrompt} />

      {/* Category Pills Strip */}
      <div className={styles.categoryPillsContainer} role="tablist" aria-label="Explore Categories">
        {CATEGORIES.map((category) => {
          const isSelected = selectedCategory === category;
          return (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`${styles.categoryPill} ${isSelected ? styles.categoryPillActive : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          );
        })}
      </div>

      {/* Auto Horizontally Scrolling Featured Cohorts Strip */}
      <FeaturedCohortsStrip selectedCategory={selectedCategory} />
    </div>
  );
}

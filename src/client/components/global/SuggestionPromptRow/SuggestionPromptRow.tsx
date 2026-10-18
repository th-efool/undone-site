'use client';

import React from 'react';
import { Video, GraduationCap, Bookmark, Users } from 'lucide-react';
import { SuggestionPromptCard, type PromptColorScheme } from './SuggestionPromptCard';
import styles from './SuggestionPromptRow.module.css';

export interface SuggestionPromptItem {
  id: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  text: string;
  colorScheme: PromptColorScheme;
}

export const SUGGESTIONS: SuggestionPromptItem[] = [
  {
    id: 'saved-videos',
    icon: Video,
    text: 'I have 14 hours of videos saved. Help me make time for them.',
    colorScheme: 'rose',
  },
  {
    id: 'long-course',
    icon: GraduationCap,
    text: "I have a 56-hour course I've been meaning to finish for months.",
    colorScheme: 'purple',
  },
  {
    id: 'started-course',
    icon: Bookmark,
    text: 'I started this course three months ago. I want to finally finish it.',
    colorScheme: 'blue',
  },
  {
    id: 'community',
    icon: Users,
    text: 'Find a close-knit community exploring the same thing.',
    colorScheme: 'cyan',
  },
];

export interface SuggestionPromptRowProps {
  onSelectPrompt: (text: string) => void;
  items?: SuggestionPromptItem[];
}

export function SuggestionPromptRow({
  onSelectPrompt,
  items = SUGGESTIONS,
}: SuggestionPromptRowProps) {
  return (
    <div
      className={styles.promptRow}
      role="group"
      aria-label="Example pursuits to explore"
    >
      {items.map((item) => (
        <SuggestionPromptCard
          key={item.id}
          icon={item.icon}
          text={item.text}
          colorScheme={item.colorScheme}
          onClick={() => onSelectPrompt(item.text)}
        />
      ))}
    </div>
  );
}

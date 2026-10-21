'use client';

import React from 'react';
import { Eye, Lock, Target } from 'lucide-react';
import type { useSessionGoal } from '../../hooks/useSessionGoal';
import styles from './SessionPanel.module.css';

export interface GoalEditorProps {
  goal: ReturnType<typeof useSessionGoal>;
}

export function GoalEditor({ goal }: GoalEditorProps) {
  const { committed, draft, setDraft, commit, setVisibility } = goal;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
  };

  return (
    <div className={styles.goalSection}>
      <div className={styles.goalHeader}>
        <div className={styles.goalTitleGroup}>
          <Target size={14} className={styles.goalTargetIcon} aria-hidden="true" />
          <h3 className={styles.goalTitle}>Session Goal</h3>
        </div>
        {committed.text.trim().length > 0 && (
          <div
            className={styles.committedGoalBadge}
            title={committed.text}
          >
            {committed.visibility === 'room' ? (
              <Eye size={12} aria-hidden="true" />
            ) : (
              <Lock size={12} aria-hidden="true" />
            )}
            <span>{committed.text}</span>
          </div>
        )}
      </div>

      <div className={styles.goalInputRow}>
        <div className={styles.goalInputWrapper}>
          <input
            type="text"
            className={styles.goalInput}
            placeholder="What's your goal for this session?"
            maxLength={80}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit()}
            onKeyDown={handleKeyDown}
            aria-label="What's your goal for this session?"
          />
          <span className={styles.charCounter} aria-hidden="true">
            {draft.length}/80
          </span>
        </div>
        <button
          type="button"
          className={styles.saveGoalBtn}
          onClick={() => commit()}
        >
          Save
        </button>
      </div>

      <div className={styles.visibilityControls}>
        <div
          className={styles.segmentedGroup}
          role="radiogroup"
          aria-label="Goal visibility"
        >
          <button
            type="button"
            role="radio"
            aria-checked={committed.visibility === 'private'}
            className={`${styles.segmentBtn} ${
              committed.visibility === 'private' ? styles.segmentBtnActive : ''
            }`}
            onClick={() => setVisibility('private')}
          >
            <Lock size={12} aria-hidden="true" />
            <span>Private</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={committed.visibility === 'room'}
            className={`${styles.segmentBtn} ${
              committed.visibility === 'room' ? styles.segmentBtnActive : ''
            }`}
            onClick={() => setVisibility('room')}
          >
            <Eye size={12} aria-hidden="true" />
            <span>Visible to room</span>
          </button>
        </div>

        <p className={styles.visibilityHint}>
          {committed.visibility === 'private'
            ? 'Only you can see this goal.'
            : 'Everyone in this room can see this goal next to your name.'}
        </p>
      </div>
    </div>
  );
}

export default GoalEditor;

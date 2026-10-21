'use client';

import React, { useState } from 'react';
import {
  Flame,
  Play,
  Pause,
  Square,
  Users,
  Check,
  LogOut,
  Zap,
} from 'lucide-react';
import type { UseRoomSprintReturn } from '../../hooks/useRoomSprint';
import { formatClock } from '../../utils/formatTime';
import styles from './SharedSprintWidget.module.css';

export interface SharedSprintWidgetProps {
  sprintHook: UseRoomSprintReturn;
}

export function SharedSprintWidget({ sprintHook }: SharedSprintWidgetProps) {
  const {
    sprint,
    remainingSeconds,
    isJoined,
    canControl,
    actionError,
    startSprint,
    pauseSprint,
    resumeSprint,
    stopSprint,
    joinSprint,
    leaveSprint,
  } = sprintHook;

  const [selectedDuration, setSelectedDuration] = useState<number>(25);

  const isActive = sprint?.status === 'ACTIVE';
  const isPaused = sprint?.status === 'PAUSED';
  const hasSprint = Boolean(sprint && (isActive || isPaused));

  const handleStart = () => {
    void startSprint(selectedDuration);
  };

  return (
    <aside
      className={styles.widgetContainer}
      aria-label="Shared Room Sprint"
      data-testid="shared-sprint-widget"
    >
      {/* Header Row */}
      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <Flame size={14} className={styles.titleIcon} aria-hidden="true" />
          <span className={styles.titleText}>Group Sprint</span>
        </div>

        <div className={styles.statusPillWrap}>
          {isActive ? (
            <span className={`${styles.statusPill} ${styles.statusActive}`}>
              <span className={styles.statusPulse} aria-hidden="true" />
              Active
            </span>
          ) : isPaused ? (
            <span className={`${styles.statusPill} ${styles.statusPaused}`}>
              Paused
            </span>
          ) : (
            <span className={`${styles.statusPill} ${styles.statusIdle}`}>
              Idle
            </span>
          )}
        </div>
      </div>

      {/* Error alert */}
      {actionError && (
        <div className={styles.errorBanner} role="alert">
          {actionError}
        </div>
      )}

      {/* Main Content Area */}
      {hasSprint ? (
        <>
          <div className={styles.clockRow}>
            <div className={styles.countdownDisplay} aria-live="polite">
              {formatClock(remainingSeconds)}
            </div>

            <div className={styles.sprintMeta}>
              <span className={styles.sprintTitle} title={sprint?.title || 'Shared Sprint'}>
                {sprint?.title || 'Shared Sprint'}
              </span>
              <span className={styles.participantCount}>
                <Users size={12} aria-hidden="true" />
                <span>
                  {sprint?.participantCount || 0}{' '}
                  {(sprint?.participantCount ?? 0) === 1 ? 'member' : 'members'}
                </span>
              </span>
            </div>
          </div>

          <div className={styles.actionsRow}>
            {/* Participant join / leave actions */}
            {isJoined ? (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnJoined}`}
                onClick={() => void leaveSprint()}
                title="Leave this group sprint"
              >
                <Check size={12} aria-hidden="true" />
                <span>Joined</span>
                <LogOut size={11} aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => void joinSprint()}
              >
                <Zap size={12} aria-hidden="true" />
                <span>Join Sprint</span>
              </button>
            )}

            {/* Controller actions */}
            {canControl && (
              <div className={styles.controllerControls}>
                {isActive ? (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={() => void pauseSprint()}
                    aria-label="Pause group sprint"
                    title="Pause group sprint"
                  >
                    <Pause size={12} aria-hidden="true" />
                    <span>Pause</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={() => void resumeSprint()}
                    aria-label="Resume group sprint"
                    title="Resume group sprint"
                  >
                    <Play size={12} aria-hidden="true" />
                    <span>Resume</span>
                  </button>
                )}

                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnDanger}`}
                  onClick={() => void stopSprint()}
                  aria-label="Stop group sprint"
                  title="Stop group sprint"
                >
                  <Square size={12} aria-hidden="true" />
                  <span>Stop</span>
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className={styles.actionsRow}>
          {canControl ? (
            <div className={styles.startSelectGroup}>
              <select
                className={styles.durationSelect}
                value={selectedDuration}
                onChange={(e) => setSelectedDuration(Number(e.target.value))}
                aria-label="Sprint duration in minutes"
              >
                <option value={15}>15 min</option>
                <option value={25}>25 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>

              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleStart}
              >
                <Play size={12} aria-hidden="true" />
                <span>Start Group Sprint</span>
              </button>
            </div>
          ) : (
            <span className={styles.participantCount}>
              No group sprint in progress. Hosts can start a sprint.
            </span>
          )}
        </div>
      )}
    </aside>
  );
}

export default SharedSprintWidget;

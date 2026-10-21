'use client';

import React from 'react';
import {
  Crown,
  CheckSquare,
  SlidersHorizontal,
  Info,
  LogOut,
  Users,
  Settings,
} from 'lucide-react';
import type {
  RoomDefinition,
  RoomPanelId,
  RoomParticipantView,
  Viewer,
} from '../../types';
import { ParticipantAvatar } from '../../components/ParticipantAvatar';
import styles from './RoomTopBar.module.css';

export interface RoomTopBarProps {
  room: RoomDefinition;
  viewer: Viewer;
  participants: RoomParticipantView[];
  activePanel: RoomPanelId | null;
  onTogglePanel: (id: RoomPanelId, trigger: HTMLElement) => void;
  onLeave: () => void;
  soundChip?: React.ReactNode;
  customizeOpen?: boolean;
  onToggleCustomize?: () => void;
  onOpenSettings?: () => void;
}

export function RoomTopBar({
  room,
  viewer,
  participants,
  activePanel,
  onTogglePanel,
  onLeave,
  customizeOpen,
  onToggleCustomize,
  onOpenSettings,
}: RoomTopBarProps) {
  const isAdmin = viewer.role === 'admin';
  const canCustomize = viewer.capabilities?.canControlEnvironment ?? isAdmin;
  const previewParticipants = participants.slice(0, 3);

  return (
    <header className={styles.topBar}>
      <div className={styles.leftCol}>
        <div className={styles.titleRow}>
          <div className={styles.titleBadge}>
            <h1 className={styles.roomTitle}>{room.title}</h1>
          </div>
          {isAdmin ? (
            <span className={styles.hostBadge} title="You created this room">
              <Crown size={13} aria-hidden="true" />
              <span>You&apos;re the host</span>
            </span>
          ) : (
            <span className={styles.hostText}>
              Host: {room.adminDisplayName}
            </span>
          )}
        </div>

        <p className={styles.atmosphere}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span>{room.atmosphere}</span>
          <span className={styles.separator} aria-hidden="true">|</span>
          <span>Pomodoro</span>
        </p>
      </div>

      <nav className={styles.toolbar} aria-label="Room controls">
        {/* People Button */}
        <button
          type="button"
          onClick={(e) => onTogglePanel('people', e.currentTarget)}
          aria-expanded={activePanel === 'people'}
          aria-controls="room-panel"
          aria-haspopup="dialog"
          aria-label={`People, ${participants.length} studying now`}
          title={`People · ${participants.length}`}
          className={`${styles.toolBtn} ${styles.peopleButton} ${activePanel === 'people' ? styles.toolBtnActive : ''}`}
        >
          {previewParticipants.length > 0 ? (
            <div className={styles.avatarStack} aria-hidden="true">
              {previewParticipants.map((p) => (
                <div key={p.userId} className={styles.stackItem}>
                  <ParticipantAvatar
                    name={p.displayName}
                    src={p.avatarUrl}
                    size={20}
                  />
                </div>
              ))}
            </div>
          ) : (
            <Users size={16} aria-hidden="true" />
          )}
          <span className={styles.btnLabel}>People · {participants.length}</span>
        </button>

        {/* Session (Tasks & Goal) Button */}
        <button
          type="button"
          onClick={(e) => onTogglePanel('session', e.currentTarget)}
          aria-expanded={activePanel === 'session'}
          aria-controls="room-panel"
          aria-haspopup="dialog"
          aria-label="Personal tasks and session goal"
          title="Personal tasks & goal"
          className={`${styles.toolBtn} ${activePanel === 'session' ? styles.toolBtnActive : ''}`}
        >
          <CheckSquare size={16} aria-hidden="true" />
          <span className={styles.btnLabel}>Tasks & Goal</span>
        </button>

        {/* Room / Environment Button */}
        <button
          type="button"
          onClick={(e) => {
            if (canCustomize && onToggleCustomize) {
              onToggleCustomize();
            } else {
              onTogglePanel('room', e.currentTarget);
            }
          }}
          aria-expanded={canCustomize ? Boolean(customizeOpen) : activePanel === 'room'}
          aria-controls={canCustomize ? 'room-background-dock' : 'room-panel'}
          aria-haspopup={canCustomize ? undefined : 'dialog'}
          aria-label={canCustomize ? 'Customize room environment' : 'Room information'}
          title={canCustomize ? 'Customize room' : 'Room info'}
          className={`${styles.toolBtn} ${
            (canCustomize ? customizeOpen : activePanel === 'room') ? styles.toolBtnActive : ''
          }`}
        >
          {canCustomize ? (
            <>
              <SlidersHorizontal size={16} aria-hidden="true" />
              <span className={styles.btnLabel}>Customize room</span>
            </>
          ) : (
            <>
              <Info size={16} aria-hidden="true" />
              <span className={styles.btnLabel}>Room info</span>
            </>
          )}
        </button>

        {/* Settings / Governance Button */}
        {Boolean(onOpenSettings) && (viewer.capabilities?.canEditRoom ?? (isAdmin || viewer.roomRole === 'OWNER')) && (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Manage room settings and governance"
            title="Manage room"
            className={styles.toolBtn}
          >
            <Settings size={16} aria-hidden="true" />
            <span className={styles.btnLabel}>Settings</span>
          </button>
        )}

        {/* Leave Button */}
        <button
          type="button"
          onClick={onLeave}
          aria-label="Leave room"
          title="Leave room"
          className={`${styles.toolBtn} ${styles.leaveBtn}`}
        >
          <LogOut size={16} aria-hidden="true" />
          <span className={styles.btnLabel}>Leave</span>
        </button>
      </nav>
    </header>
  );
}

export default React.memo(RoomTopBar);

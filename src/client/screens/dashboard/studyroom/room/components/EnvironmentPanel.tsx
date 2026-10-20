'use client';

import React, { useRef, useState } from 'react';
import { Crown, Volume2, VolumeX } from 'lucide-react';
import type {
  SharedEnvironmentActions,
  SharedRoomEnvironment,
} from '../../types';
import BackgroundTab from './BackgroundTab';
import MusicTab from './MusicTab';
import AmbienceTab from './AmbienceTab';
import DemoDataNote from './DemoDataNote';
import styles from './EnvironmentPanel.module.css';

export interface EnvironmentPanelProps {
  environment: SharedRoomEnvironment;
  actions: SharedEnvironmentActions;
  ambienceStatus: 'idle' | 'playing' | 'blocked' | 'unsupported';
  mutedForMe: boolean;
  onToggleMute: () => void;
  onUnlock: () => void;
  onBackgroundSelected?: () => void;
  onNotify?: (text: string) => void;
}

type TabId = 'background' | 'music' | 'ambience';

const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'background', label: 'Background' },
  { id: 'music', label: 'Music' },
  { id: 'ambience', label: 'Ambience' },
];

export function EnvironmentPanel({
  environment,
  actions,
  ambienceStatus,
  mutedForMe,
  onToggleMute,
  onBackgroundSelected,
  onNotify,
}: EnvironmentPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('background');
  const tabRefs = useRef<Map<TabId, HTMLButtonElement>>(new Map());

  const handleKeyDown = (e: React.KeyboardEvent, currentId: TabId) => {
    const currentIndex = TABS.findIndex((t) => t.id === currentId);
    let targetTab: TabId | null = null;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % TABS.length;
      targetTab = TABS[nextIndex].id;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + TABS.length) % TABS.length;
      targetTab = TABS[prevIndex].id;
    } else if (e.key === 'Home') {
      e.preventDefault();
      targetTab = TABS[0].id;
    } else if (e.key === 'End') {
      e.preventDefault();
      targetTab = TABS[TABS.length - 1].id;
    }

    if (targetTab) {
      setActiveTab(targetTab);
      tabRefs.current.get(targetTab)?.focus();
    }
  };

  return (
    <div className={styles.panel}>
      {/* Host Notice Badge */}
      <div className={styles.headerBadge}>
        <Crown size={14} aria-hidden="true" />
        <span>Host controls · changes apply to everyone</span>
      </div>

      {/* Tabs list */}
      <div
        role="tablist"
        aria-label="Room settings tabs"
        className={styles.tabList}
      >
        {TABS.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
                else tabRefs.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isSelected ? 0 : -1}
              className={`${styles.tabBtn} ${isSelected ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active Tab Panel */}
      <div
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
        className={styles.tabPanel}
      >
        {activeTab === 'background' && (
          <BackgroundTab
            selectedId={environment.backgroundId}
            onSelect={(id) => {
              actions.setBackground(id);
              onBackgroundSelected?.();
            }}
          />
        )}

        {activeTab === 'music' && (
          <MusicTab
            music={environment.music}
            onSet={actions.setMusic}
            onNotify={(msg) => onNotify?.(msg)}
          />
        )}

        {activeTab === 'ambience' && (
          <AmbienceTab
            ambience={environment.ambience}
            status={ambienceStatus}
            actions={actions}
          />
        )}
      </div>

      {/* Footer controls: Mute-for-me toggle & prototype note */}
      <div className={styles.footerSection}>
        <div className={styles.muteContainer}>
          <button
            type="button"
            className={`${styles.muteBtn} ${mutedForMe ? styles.muteBtnActive : ''}`}
            aria-pressed={mutedForMe}
            onClick={onToggleMute}
          >
            <span>Mute room sound for me</span>
            {mutedForMe ? (
              <VolumeX size={16} aria-hidden="true" />
            ) : (
              <Volume2 size={16} aria-hidden="true" />
            )}
          </button>
          <p className={styles.muteHelper}>
            Applies to ambient sound only. Use the music player&apos;s own controls for music.
          </p>
        </div>

        <DemoDataNote />
      </div>
    </div>
  );
}

export default EnvironmentPanel;

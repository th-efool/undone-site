'use client';

import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type {
  RoomPanelId,
  RoomSlug,
  Viewer,
  ViewerRole,
} from '../types';
import { getRoomBySlug } from '../data/roomCatalog';
import { MOCK_ROSTERS } from '../data/mockRosters';
import { deriveParticipants, deriveViewer } from '../utils/deriveParticipants';
import { useNow } from '../hooks/useNow';
import { usePomodoro } from '../hooks/usePomodoro';
import { usePersonalTasks } from '../hooks/usePersonalTasks';
import { useSessionGoal } from '../hooks/useSessionGoal';
import { useSharedEnvironment } from '../hooks/useSharedEnvironment';
import { useAmbientPlayback } from '../hooks/useAmbientPlayback';

import RoomBackground from './components/RoomBackground';
import RoomTopBar from './components/RoomTopBar';
import PanelShell from './components/PanelShell';
import RoomToast from './components/RoomToast';
import LeaveRoomDialog from './components/LeaveRoomDialog';
import FocusBar from './components/FocusBar';
import TimerSettingsPanel from './components/TimerSettingsPanel';
import SessionPanel from './components/SessionPanel';
import ParticipantPanel from './components/ParticipantPanel';
import RoomInfoPanel from './components/RoomInfoPanel';
import MusicPlayerDock from './components/MusicPlayerDock';
import SceneDock from './components/SceneDock';
import RoomSocial from './components/RoomSocial';
import MusicSettingsModal from './components/MusicSettingsModal';
import SoundRemixModal from './components/SoundRemixModal';

import styles from './RoomScreen.module.css';

export interface RoomScreenProps {
  roomSlug: RoomSlug;
  viewAsOverride?: ViewerRole;
}

function subscribeToMobile(callback: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mql = window.matchMedia('(max-width: 768px)');
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getMobileSnapshot(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 768px)').matches
    : false;
}

function getMobileServerSnapshot(): boolean {
  return false;
}

export function RoomScreen({ roomSlug, viewAsOverride }: RoomScreenProps) {
  const router = useRouter();
  const room = getRoomBySlug(roomSlug);

  if (!room) {
    throw new Error(`Room definition not found for slug: ${roomSlug}`);
  }

  const { data: session } = useSession();
  const viewer: Viewer = useMemo(
    () => deriveViewer({ session, room, viewAsOverride }),
    [session, room, viewAsOverride]
  );

  // Shared room state (admin controls mutations)
  const env = useSharedEnvironment(room.defaultEnvironment, viewer.userId);

  // Personal session tools
  const pomodoro = usePomodoro(room.title);
  const tasks = usePersonalTasks();
  const goal = useSessionGoal();

  // Local UI state
  const [activePanel, setActivePanel] = useState<RoomPanelId | null>(null);
  const [mutedForMe, setMutedForMe] = useState<boolean>(false);
  const isMobile = useSyncExternalStore(
    subscribeToMobile,
    getMobileSnapshot,
    getMobileServerSnapshot
  );
  const [userHiddenOverride, setUserHiddenOverride] = useState<boolean | null>(null);
  const playerHidden = userHiddenOverride ?? isMobile;

  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [leaveOpen, setLeaveOpen] = useState<boolean>(false);
  const [musicModalOpen, setMusicModalOpen] = useState<boolean>(false);
  const [soundRemixOpen, setSoundRemixOpen] = useState<boolean>(false);
  const [customizeDockOpen, setCustomizeDockOpen] = useState<boolean>(false);

  const lastTriggerRef = useRef<HTMLElement | null>(null);
  // Stored in state initializer to ensure purity and avoid ref-access during render
  const [mountedAt] = useState<number>(() => Date.now());
  const now = useNow(15_000);

  // Dynamic participants derivation enforcing privacy invariant
  const participants = useMemo(
    () =>
      deriveParticipants({
        roster: MOCK_ROSTERS[roomSlug] ?? [],
        viewer,
        goal: goal.committed,
        adminUserId: room.adminUserId,
        mountedAt,
      }),
    [roomSlug, viewer, goal.committed, room.adminUserId, mountedAt]
  );

  // Ambient sound playback engine
  const ambience = useAmbientPlayback({
    ...env.environment.ambience,
    mutedForMe,
  });

  const togglePanel = useCallback((id: RoomPanelId, trigger?: HTMLElement) => {
    setActivePanel((prev) => {
      if (prev === id) return null;
      if (trigger) {
        lastTriggerRef.current = trigger;
      }
      return id;
    });
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel(null);
    lastTriggerRef.current?.focus();
  }, []);

  // Escape key handler: closes open panel and restores trigger focus
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Escape' && activePanel !== null) {
        e.stopPropagation();
        closePanel();
      }
    },
    [activePanel, closePanel]
  );

  // Leave flow: checks if user has personal work in progress
  const hasPersonalSessionState =
    pomodoro.state.status !== 'idle' ||
    pomodoro.state.completedFocusSessions > 0 ||
    tasks.tasks.length > 0 ||
    goal.committed.text.trim().length > 0;

  const handleRequestLeave = useCallback(() => {
    if (hasPersonalSessionState) {
      setActivePanel(null);
      setLeaveOpen(true);
    } else {
      router.push('/studyroom');
    }
  }, [hasPersonalSessionState, router]);

  const handleConfirmLeave = useCallback(() => {
    setLeaveOpen(false);
    router.push('/studyroom');
  }, [router]);

  const handleBackgroundError = useCallback(() => {
    setToast({
      id: Date.now(),
      text: "Couldn't load that background image. Showing a gradient instead.",
    });
  }, []);

  const renderPanelContent = () => {
    switch (activePanel) {
      case 'session':
        return <SessionPanel goal={goal} tasks={tasks} onClose={closePanel} />;
      case 'people':
        return <ParticipantPanel participants={participants} now={now} />;
      case 'room':
        return (
          <RoomInfoPanel
            room={room}
            environment={env.environment}
            ambienceStatus={ambience.status}
            mutedForMe={mutedForMe}
            onToggleMute={() => setMutedForMe((prev) => !prev)}
            onUnlock={ambience.unlock}
          />
        );
      case 'timer':
        return (
          <TimerSettingsPanel
            settings={pomodoro.state.settings}
            status={pomodoro.state.status}
            phaseDurationMs={pomodoro.state.phaseDurationMs}
            onChange={pomodoro.updateSettings}
            onRestoreDefaults={pomodoro.restoreDefaults}
          />
        );
      default:
        return null;
    }
  };

  const getPanelTitle = () => {
    switch (activePanel) {
      case 'session':
        return 'Session Tasks & Goal';
      case 'people':
        return `People · ${participants.length}`;
      case 'room':
        return 'Room Info';
      case 'timer':
        return 'Timer Settings';
      default:
        return '';
    }
  };

  return (
    <section
      className={styles.stage}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      aria-label={`${room.title} study room`}
    >
      {/* 1. Shared background layer with gradient fallback & scrim */}
      <RoomBackground
        backgroundId={env.environment.backgroundId}
        onImageError={handleBackgroundError}
      />

      {/* 2. Top Bar & persistent chrome */}
      <RoomTopBar
        room={room}
        viewer={viewer}
        participants={participants}
        activePanel={activePanel}
        onTogglePanel={togglePanel}
        onLeave={handleRequestLeave}
        customizeOpen={customizeDockOpen}
        onToggleCustomize={() => setCustomizeDockOpen((prev) => !prev)}
      />

      {/* 3. Main Cockpit: Floating Focus Timer, Open Center Scene, Floating Social Column */}
      <div className={styles.cockpit}>
        <div className={styles.focusContainer}>
          <FocusBar
            state={pomodoro.state}
            onStart={pomodoro.start}
            onPause={pomodoro.pause}
            onResume={pomodoro.resume}
            onReset={pomodoro.reset}
            onSkip={pomodoro.skip}
            onSelectPhase={pomodoro.selectPhase}
            onOpenSettings={(trigger) => togglePanel('timer', trigger)}
            settingsOpen={activePanel === 'timer'}
            announcement={pomodoro.announcement}
            onOpenMusic={() => setMusicModalOpen(true)}
            onToggleAmbience={() => setSoundRemixOpen((prev) => !prev)}
            ambienceOpen={soundRemixOpen || activePanel === 'ambience'}
          />
        </div>

        <div className={styles.centerSpace} aria-hidden="true" />

        <div className={styles.socialContainer}>
          <RoomSocial
            participants={participants}
            viewer={viewer}
            onOpenPeople={(trigger) => togglePanel('people', trigger)}
            onNotify={(text) => setToast({ id: Date.now(), text })}
            showPeople={true}
          />
        </div>
      </div>

      {/* 4. Bottom Dock: Ambience Audio Player & Scene / Color Picker (shown when admin toggles Customize room) */}
      {customizeDockOpen && (
        <footer id="room-background-dock" className={styles.dockContainer}>
          <SceneDock
            environment={env.environment}
            actions={viewer.role === 'admin' ? env.actions : undefined}
            status={ambience.status}
            muted={mutedForMe}
            onMute={() => setMutedForMe((prev) => !prev)}
            onUnlock={ambience.unlock}
            onCustomize={(trigger) => togglePanel('room', trigger)}
            onClose={() => setCustomizeDockOpen(false)}
          />
        </footer>
      )}

      {/* 5. Persistent Music Player Dock if background room music is active */}
      {env.environment.music && (
        <div className={styles.musicDockAnchor}>
          <MusicPlayerDock
            music={env.environment.music}
            hidden={playerHidden}
            onToggleHidden={() => setUserHiddenOverride(!playerHidden)}
          />
        </div>
      )}

      {/* 4. Panel Layer: at most ONE drawer/bottom sheet active */}
      {activePanel && activePanel !== 'timer' && activePanel !== 'ambience' && (
        <PanelShell
          id="room-panel"
          title={getPanelTitle()}
          onClose={closePanel}
          variant={activePanel === 'session' ? 'modal' : 'drawer'}
        >
          {renderPanelContent()}
        </PanelShell>
      )}

      {/* Floating Timer Settings Modal */}
      {activePanel === 'timer' && (
        <TimerSettingsPanel
          settings={pomodoro.state.settings}
          status={pomodoro.state.status}
          phaseDurationMs={pomodoro.state.phaseDurationMs}
          onChange={pomodoro.updateSettings}
          onRestoreDefaults={pomodoro.restoreDefaults}
          onClose={closePanel}
        />
      )}

      {/* 5. Notifications & Leave confirmation dialog */}
      <RoomToast message={toast} onDismiss={() => setToast(null)} />
      <LeaveRoomDialog
        open={leaveOpen}
        onStay={() => setLeaveOpen(false)}
        onLeave={handleConfirmLeave}
      />

      {/* 6. Music Settings Modal */}
      <MusicSettingsModal
        isOpen={musicModalOpen}
        onClose={() => setMusicModalOpen(false)}
        music={env.environment.music}
        onSetMusic={(source) => {
          if (viewer.role === 'admin') {
            env.actions.setMusic(source);
          }
        }}
        onNotify={(text) => setToast({ id: Date.now(), text })}
      />

      {/* 7. Sound Remix Modal */}
      <SoundRemixModal
        isOpen={soundRemixOpen || activePanel === 'ambience'}
        onClose={() => {
          setSoundRemixOpen(false);
          if (activePanel === 'ambience') closePanel();
        }}
        environment={env.environment}
        actions={viewer.role === 'admin' ? env.actions : undefined}
        onSelectPreset={(presetId) => {
          if (viewer.role === 'admin') {
            env.actions.setAmbiencePreset(presetId);
          }
        }}
        onVolumeChange={(vol) => {
          if (viewer.role === 'admin') {
            env.actions.setAmbienceVolume(vol);
          }
        }}
      />
    </section>
  );
}

export default RoomScreen;

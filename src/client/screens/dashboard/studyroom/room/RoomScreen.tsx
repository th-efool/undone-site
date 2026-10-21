'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Users, Lock, ShieldAlert, Clock } from 'lucide-react';
import type {
  RoomPanelId,
  RoomSlug,
  Viewer,
  ViewerRole,
  RoomDefinition,
  BackgroundId,
} from '../types';
import type { RoomBootstrapResponse } from '@/src/shared/studyroom/contracts';
import { getRoomBySlug } from '../data/roomCatalog';
import { deriveParticipants, deriveViewer } from '../utils/deriveParticipants';
import { useNow } from '../hooks/useNow';
import { usePomodoro } from '../hooks/usePomodoro';
import { usePersonalTasks } from '../hooks/usePersonalTasks';
import { useSessionGoal } from '../hooks/useSessionGoal';
import { useSharedEnvironment } from '../hooks/useSharedEnvironment';
import { useAmbientPlayback } from '../hooks/useAmbientPlayback';
import { useRoomLifecycle } from '../hooks/useRoomLifecycle';
import { useRoomRoster } from '../hooks/useRoomRoster';

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
import RoomSettingsModal from '../components/RoomSettingsModal';

import styles from './RoomScreen.module.css';

export interface RoomScreenProps {
  roomSlug: RoomSlug | string;
  viewAsOverride?: ViewerRole;
}

function createDynamicRoomDefinition(
  slug: string,
  bootstrap?: RoomBootstrapResponse['room'] | null
): RoomDefinition {
  const title =
    bootstrap?.title ||
    slug
      .split('-')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
  const visualPresetId = (bootstrap?.visualPresetId as BackgroundId) || 'library';
  return {
    slug: slug as RoomSlug,
    title,
    atmosphere: bootstrap?.description || 'Focus and quiet company',
    previewImage: bootstrap?.thumbnail || null,
    adminUserId: bootstrap?.ownerId || 'admin',
    adminDisplayName: bootstrap?.ownerName || 'Host',
    defaultEnvironment: {
      backgroundId: visualPresetId,
      music: null,
      ambience: {
        presetId: 'rain',
        volume: 40,
        isPlaying: false,
      },
      updatedAt: 0,
      updatedByUserId: bootstrap?.ownerId || 'admin',
    },
  };
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
  const catalogRoom = getRoomBySlug(roomSlug);

  const [roomBootstrap, setRoomBootstrap] = useState<RoomBootstrapResponse | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    if (typeof fetch !== 'function') return;

    void Promise.resolve().then(() => {
      if (!ignore) {
        setBootstrapLoading(true);
      }
    });
    fetch(`/api/studyroom/${roomSlug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: RoomBootstrapResponse | null) => {
        if (!ignore && data) {
          setRoomBootstrap(data);
        }
      })
      .catch(() => {
        // Fallback gracefully in offline / mock environments
      })
      .finally(() => {
        if (!ignore) {
          setBootstrapLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [roomSlug]);

  const room = useMemo(() => {
    if (catalogRoom) return catalogRoom;
    return createDynamicRoomDefinition(roomSlug, roomBootstrap?.room);
  }, [catalogRoom, roomSlug, roomBootstrap]);

  const { data: session } = useSession();
  const viewer: Viewer = useMemo(
    () =>
      deriveViewer({
        session,
        room,
        viewAsOverride,
        roomRole: roomBootstrap?.viewer?.role,
        capabilities: roomBootstrap?.capabilities,
      }),
    [session, room, viewAsOverride, roomBootstrap?.viewer?.role, roomBootstrap?.capabilities]
  );

  // Eligibility evaluation for honest full/closed/denied states
  const eligibilityReason = roomBootstrap?.capabilities?.eligibilityReason;
  const isDenied =
    Boolean(roomBootstrap) &&
    !roomBootstrap?.capabilities?.canJoin &&
    !roomBootstrap?.viewer?.isJoined;

  const canParticipate = !isDenied && !bootstrapLoading;

  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isAcceptingTransfer, setIsAcceptingTransfer] = useState(false);

  const fetchRoomBootstrap = useCallback(() => {
    if (typeof fetch !== 'function') return;
    fetch(`/api/studyroom/${roomSlug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: RoomBootstrapResponse | null) => {
        if (data) setRoomBootstrap(data);
      })
      .catch(() => {});
  }, [roomSlug]);

  const handleAcceptTransfer = async (transferId: string) => {
    setIsAcceptingTransfer(true);
    try {
      const res = await fetch(`/api/studyroom/${roomSlug}/ownership-transfers/${transferId}/accept`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to accept ownership transfer');

      setToast({ id: Date.now(), text: 'Ownership transfer accepted! You are now the room owner.' });
      fetchRoomBootstrap();
    } catch (err: unknown) {
      setToast({ id: Date.now(), text: err instanceof Error ? err.message : 'Transfer acceptance failed' });
    } finally {
      setIsAcceptingTransfer(false);
    }
  };

  // Lease-fenced HTTP participation lifecycle
  const lifecycle = useRoomLifecycle({
    roomId: roomSlug,
    enabled: canParticipate,
    onEvicted: (reason) => {
      setToast({ id: Date.now(), text: `Disconnected: ${reason}` });
    },
  });

  // Real roster polling (15s interval)
  const { roster: liveRoster, refresh: refreshRoster } = useRoomRoster({
    roomId: roomSlug,
    enabled: canParticipate,
  });

  // Shared room state (admin/controller controls mutations, persisted to environment service)
  const env = useSharedEnvironment(room.defaultEnvironment, viewer.userId, {
    roomSlug,
    canControlEnvironment: viewer.capabilities?.canControlEnvironment ?? (viewer.role === 'admin'),
  });

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
        roster: liveRoster,
        viewer,
        goal: goal.committed,
        adminUserId: room.adminUserId,
        mountedAt,
      }),
    [liveRoster, viewer, goal.committed, room.adminUserId, mountedAt]
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
      void lifecycle.leave(false);
      router.push('/studyroom');
    }
  }, [hasPersonalSessionState, lifecycle, router]);

  const handleConfirmLeave = useCallback(() => {
    void lifecycle.leave(true);
    setLeaveOpen(false);
    router.push('/studyroom');
  }, [lifecycle, router]);

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
        return (
          <ParticipantPanel
            participants={participants}
            now={now}
            roomSlug={roomSlug}
            canManageParticipants={viewer.capabilities?.canManageParticipants ?? (viewer.role === 'admin')}
            onNotify={(text) => setToast({ id: Date.now(), text })}
            onRosterMutated={() => void refreshRoster()}
          />
        );
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

  if (isDenied && eligibilityReason && eligibilityReason !== 'ELIGIBLE') {
    let title = 'Access Restricted';
    let text = 'You do not currently have access to this study room.';
    let icon = <Lock size={28} />;
    let isWarning = false;

    if (eligibilityReason === 'ROOM_FULL') {
      title = 'Study Room is Full';
      text = 'This room has reached its maximum seat capacity. Please wait for an open seat or browse other rooms.';
      icon = <Users size={28} />;
      isWarning = true;
    } else if (eligibilityReason === 'ROOM_CLOSED') {
      title = 'Study Room is Closed';
      text = 'This room has been closed or archived by the host.';
      icon = <Lock size={28} />;
    } else if (eligibilityReason === 'ENROLLMENT_REQUIRED') {
      title = 'Cohort Enrollment Required';
      text = 'This room is private to members of this cohort. Please join or enroll in the cohort to participate.';
      icon = <Lock size={28} />;
    } else if (eligibilityReason === 'USER_BANNED') {
      title = 'Access Restricted';
      text = 'You have been restricted from participating in this study room.';
      icon = <ShieldAlert size={28} />;
    } else if (eligibilityReason === 'USER_KICKED_COOLDOWN') {
      title = 'Temporary Cooldown';
      text = 'You were recently removed from this room. Please wait a short cooldown period before rejoining.';
      icon = <Clock size={28} />;
      isWarning = true;
    }

    return (
      <main className={styles.deniedContainer}>
        <div className={styles.deniedCard} role="alert" data-testid="room-denied-stage">
          <div className={`${styles.deniedIconWrap} ${isWarning ? styles.deniedIconWrapWarning : ''}`}>
            {icon}
          </div>
          <h2 className={styles.deniedTitle}>{title}</h2>
          <p className={styles.deniedText}>{text}</p>
          <div className={styles.deniedActions}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => router.push('/studyroom')}
            >
              Browse Study Rooms
            </button>
            {roomBootstrap?.room?.cohortId && (
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => router.push(`/cohorts/${roomBootstrap.room.cohortId}`)}
              >
                View Cohort
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

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
        onOpenSettings={() => setSettingsModalOpen(true)}
      />

      {/* Pending Ownership Transfer Banner */}
      {Boolean(roomBootstrap?.pendingTransfer) &&
        roomBootstrap?.pendingTransfer?.recipientId === viewer.userId &&
        roomBootstrap?.pendingTransfer?.status === 'PENDING' && (
          <aside className={styles.transferBanner} role="alert">
            <span>You have been invited to become the owner of this study room.</span>
            <button
              type="button"
              className={styles.acceptTransferBtn}
              onClick={() => void handleAcceptTransfer(roomBootstrap.pendingTransfer!.id)}
              disabled={isAcceptingTransfer}
            >
              {isAcceptingTransfer ? 'Accepting...' : 'Accept Ownership'}
            </button>
          </aside>
        )}

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
            roomSlug={roomSlug}
            canManageParticipants={viewer.capabilities?.canManageParticipants ?? (viewer.role === 'admin')}
            onRosterMutated={() => void refreshRoster()}
            cohortTitle={roomBootstrap?.room?.cohortId ? 'Cohort' : null}
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

      {/* 8. Room Settings & Governance Modal */}
      {settingsModalOpen && (
        <RoomSettingsModal
          isOpen={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          room={{
            id: roomBootstrap?.room?.id || room.slug,
            slug: typeof roomSlug === 'string' ? roomSlug : String(roomSlug),
            title: roomBootstrap?.room?.title || room.title,
            description: roomBootstrap?.room?.description || room.atmosphere,
            listing: (roomBootstrap?.room?.listing as 'LISTED' | 'UNLISTED') || 'LISTED',
            status: (roomBootstrap?.room?.status as 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED') || 'OPEN',
            capacity: roomBootstrap?.room?.capacity || 25,
            rules: roomBootstrap?.room?.rules || null,
            tags: roomBootstrap?.room?.tags || [],
            language: roomBootstrap?.room?.language || 'en',
            revision: roomBootstrap?.room?.revision || 1,
          }}
          isOwner={viewer.capabilities?.canEditRoom ?? (viewer.role === 'admin')}
          onUpdated={() => {
            fetchRoomBootstrap();
          }}
        />
      )}
    </section>
  );
}

export default RoomScreen;

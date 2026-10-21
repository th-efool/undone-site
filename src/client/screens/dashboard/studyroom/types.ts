import type { RoomRole, RoomCapabilities } from '@/src/shared/studyroom/contracts';

/* ───────── Rooms (static catalog, shared definition) ───────── */
export type RoomSlug = 'library' | 'fireplace' | 'developer-den';

export type BackgroundId =
  | 'library'
  | 'rainy-window'
  | 'cozy-fireplace'
  | 'quiet-cafe'
  | 'forest'
  | 'seaside'
  | 'night-sky'
  | 'minimal-workspace'
  | 'solid-midnight'
  | 'solid-forest'
  | 'solid-plum'
  | 'solid-clay'
  | 'solid-slate';

export type AmbientPresetId =
  | 'rain'
  | 'thunderstorm'
  | 'fireplace'
  | 'ocean-waves'
  | 'forest'
  | 'wind'
  | 'white-noise'
  | 'pink-noise'
  | 'brown-noise'
  | 'cafe';

export interface BackgroundOption {
  id: BackgroundId;
  label: string;
  image: string | null; // public path or null → gradient only
  gradient: string; // CSS background value; always rendered as base/fallback
  focal: string; // CSS object-position
  extraScrim: number; // 0..0.25
}

export interface AmbientPreset {
  id: AmbientPresetId;
  label: string;
  icon:
    | 'CloudRain'
    | 'CloudLightning'
    | 'Flame'
    | 'Waves'
    | 'Trees'
    | 'Wind'
    | 'AudioLines'
    | 'Coffee';
  assetUrl?: string; // reserved for future real loops; unused now
}

export interface RoomDefinition {
  slug: RoomSlug;
  title: string; // 'Library' | 'Fireplace' | 'Developer Den'
  atmosphere: string; // one short line
  previewImage: string | null; // discovery card image; null → gradient of defaultEnvironment.backgroundId
  adminUserId: string; // MOCK role source; 'viewer' means the current signed-in user
  adminDisplayName: string; // shown when admin is not the viewer
  defaultEnvironment: SharedRoomEnvironment;
}

/* ───────── SHARED room configuration (admin-controlled) ───────── */
export type MusicSource =
  | {
      provider: 'youtube';
      kind: 'video' | 'playlist';
      id: string;
      startVideoId?: string;
      embedUrl: string;
      originalUrl: string;
    }
  | {
      provider: 'spotify';
      kind: 'track' | 'playlist';
      id: string;
      embedUrl: string;
      originalUrl: string;
    };

export interface SharedAmbience {
  presetId: AmbientPresetId | null;
  volume: number; // integer 0..100 (the ROOM's level)
  isPlaying: boolean;
}

export interface SharedRoomEnvironment {
  backgroundId: BackgroundId;
  music: MusicSource | null;
  ambience: SharedAmbience;
  updatedAt: number; // epoch ms; for future sync/ordering
  updatedByUserId: string; // admin id; for future sync/audit
}

/** Mutations. ONLY ever passed to admin-only components. */
export interface SharedEnvironmentActions {
  setBackground(id: BackgroundId): void;
  setMusic(source: MusicSource | null): void;
  setAmbiencePreset(id: AmbientPresetId | null): void; // non-null ⇒ isPlaying = true; null ⇒ isPlaying = false
  setAmbiencePlaying(isPlaying: boolean): void; // no-op when presetId === null
  setAmbienceVolume(volume: number): void; // clamps/rounds to 0..100
}

/* ───────── Roles ───────── */
export type ViewerRole = 'admin' | 'member';

export interface Viewer {
  userId: string; // session.user.id ?? 'demo-viewer'
  displayName: string; // session.user.name ?? 'You'
  avatarUrl: string | null; // session.user.image ?? null
  role: ViewerRole;
  roomRole?: RoomRole;
  capabilities?: RoomCapabilities;
}

/* ───────── Participants (what is visible to OTHER people) ───────── */
export interface MockPeer {
  userId: string;
  displayName: string;
  avatarUrl: null; // initials only in the prototype
  joinedMinutesAgo: number; // static, converted to absolute once at mount
  publicGoal: string | null; // the ONLY goal field a peer can expose
  role?: RoomRole;
}

export interface RoomParticipantView {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: number; // epoch ms
  publicGoal: string | null; // NEVER a private goal (no field exists for one)
  isCurrentUser: boolean;
  isAdmin: boolean;
  role?: RoomRole;
}

/* ───────── PERSONAL session state (owner-only) ───────── */
export type PomodoroPhase = 'focus' | 'shortBreak' | 'longBreak';
export type PomodoroStatus = 'idle' | 'running' | 'paused';

export interface PomodoroSettings {
  focusMinutes: number; // 1..120, default 25
  shortBreakMinutes: number; // 1..30,  default 5
  longBreakMinutes: number; // 1..60,  default 15
  longBreakEvery: number; // 2..8,   default 4
  autoStartNext: boolean; // default false
  chimeEnabled: boolean; // default true
}

export interface PomodoroState {
  settings: PomodoroSettings;
  phase: PomodoroPhase;
  status: PomodoroStatus;
  phaseDurationMs: number;
  remainingMs: number;
  endsAt: number | null;
  completedFocusSessions: number;
  completedShortBreaks: number;
  completedLongBreaks: number;
  completionSeq: number;
  lastCompletedPhase: PomodoroPhase | null;
}

export type PomodoroAction =
  | { type: 'START'; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'RESET' }
  | { type: 'SELECT_PHASE'; phase: PomodoroPhase }
  | { type: 'SKIP' }
  | { type: 'TICK'; now: number }
  | { type: 'UPDATE_SETTINGS'; patch: Partial<PomodoroSettings> }
  | {
      type: 'SYNC_SERVER_SESSION';
      status: PomodoroStatus;
      phase: PomodoroPhase;
      phaseDurationMs: number;
      remainingMs: number;
      endsAt: number | null;
    };

export interface PersonalTask {
  id: string; // `task-${n}`
  text: string; // trimmed, 1..120
  done: boolean;
  createdAt: number;
}

export type GoalVisibility = 'private' | 'room';
export interface SessionGoal {
  text: string; // '', or trimmed 1..80
  visibility: GoalVisibility; // default 'private'
}

/* ───────── Panels ───────── */
export type RoomPanelId = 'session' | 'people' | 'room' | 'timer' | 'music' | 'ambience';

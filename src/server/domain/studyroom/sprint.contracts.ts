export type SprintStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface RoomSprintSnapshot {
  id: string;
  studyRoomId: string;
  creatorId: string;
  title: string | null;
  targetDurationSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  status: SprintStatus;
  startedAt: string;
  deadline: string | null;
  pausedAt: string | null;
  endedAt: string | null;
  version: number;
  revision: number;
  participantCount: number;
  participants: Array<{
    userId: string;
    name: string;
    username: string;
    image: string;
    status: string;
    joinedAt: string;
  }>;
}

export interface StartSprintInput {
  userId: string;
  roomId: string;
  targetDurationSeconds?: number;
  title?: string;
}

export interface ControlSprintInput {
  userId: string;
  sprintId: string;
  expectedRevision: number;
}

export interface RoomEnvironmentSnapshot {
  studyRoomId: string;
  sceneId: string;
  soundscapeId: string | null;
  musicPresetId: string | null;
  musicStreamUrl: string | null;
  revision: number;
  updatedByUserId: string | null;
  updatedAt: string;
}

export interface UpdateEnvironmentInput {
  userId: string;
  roomId: string;
  sceneId?: string;
  soundscapeId?: string | null;
  musicPresetId?: string | null;
  musicStreamUrl?: string | null;
  expectedRevision?: number;
}

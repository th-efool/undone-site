import type { RoomBootstrapResponse } from '@/src/shared/studyroom/contracts';

export interface StudyRoomDTO {
  id: string;
  title: string;
  thumbnail: string;
  status: string;
  onlineCount: number;
  slug?: string;
}

export interface RoomParticipantDTO {
  id: string;
  userId: string;
  name: string;
  username: string;
  image: string;
  joinedAt: string;
  tabCount: number;
}

export interface JoinRoomResponse {
  success: boolean;
  roomId: string;
  generation: number;
  isSwitch: boolean;
  lease: {
    leaseId: string;
    tabId: string;
    expiresAt: string;
  };
}

export interface StudySessionDTO {
  id: string;
  userId: string;
  studyRoomId: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'INTERRUPTED';
  targetDurationSeconds: number;
  elapsedSeconds: number;
  startedAt: string;
  resumedAt: string | null;
  pausedAt: string | null;
  deadline: string | null;
  endedAt: string | null;
  version: number;
  serverTime: string;
}

export interface RoomEventDTO {
  eventId: string;
  sequence: number;
  type: string;
  generation: number;
  entityId: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface RoomSyncResponse {
  mode: 'SNAPSHOT' | 'DELTA';
  roomId: string;
  streamId: string;
  currentSequence: number;
  generation: number;
  roster?: RoomParticipantDTO[];
  room?: {
    id?: string;
    slug?: string;
    status?: string;
    [key: string]: unknown;
  } | null;
  events?: RoomEventDTO[];
  serverTime: string;
}

export interface ApiHttpError extends Error {
  status?: number;
}

export interface RoomChatMessageDTO {
  id: string;
  content: string;
  channelId: string;
  authorId: string;
  messageSequence: number;
  clientRequestId: string | null;
  replyToId: string | null;
  revision: number;
  editedAt: string | null;
  deletedAt: string | null;
  deletionReason: string | null;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
    username: string | null;
  };
}

export interface RoomSprintParticipantDTO {
  userId: string;
  name: string;
  username: string;
  image: string;
  status: 'JOINED' | 'COMPLETED' | 'LEFT';
  joinedAt: string;
}

export interface RoomSprintSnapshotDTO {
  id: string;
  studyRoomId: string;
  creatorId: string;
  title: string | null;
  targetDurationSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  startedAt: string;
  deadline: string | null;
  pausedAt: string | null;
  endedAt: string | null;
  version: number;
  revision: number;
  participantCount: number;
  participants: RoomSprintParticipantDTO[];
}

export interface RoomEnvironmentSnapshotDTO {
  studyRoomId: string;
  sceneId: string;
  soundscapeId: string | null;
  musicPresetId: string | null;
  musicStreamUrl: string | null;
  revision: number;
  updatedByUserId: string | null;
  updatedAt: string;
}

export const studyRoomRepository = {
  async getRooms(ifNoneMatch?: string): Promise<{ rooms: StudyRoomDTO[]; notModified: boolean; etag?: string }> {
    const headers: Record<string, string> = {};
    if (ifNoneMatch) {
      headers['If-None-Match'] = ifNoneMatch;
    }

    const res = await fetch('/api/studyroom', {
      method: 'GET',
      headers,
    });

    const etag = res.headers.get('ETag') || undefined;

    if (res.status === 304) {
      return { rooms: [], notModified: true, etag };
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch study rooms: ${res.statusText}`);
    }

    const rooms: StudyRoomDTO[] = await res.json();
    return { rooms, notModified: false, etag };
  },

  async getBootstrap(slug: string): Promise<RoomBootstrapResponse> {
    const res = await fetch(`/api/studyroom/${encodeURIComponent(slug)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = Object.assign(
        new Error(err.error || `Failed to fetch room bootstrap (${res.status})`),
        { status: res.status, data: err }
      );
      throw error;
    }
    return res.json();
  },

  async joinRoom(roomId: string, tabId?: string): Promise<JoinRoomResponse> {
    const res = await fetch('/api/studyroom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'join', roomId, tabId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to join room: ${res.statusText}`);
    }

    return res.json();
  },

  async renewLease(roomId: string, tabId: string, generation: number): Promise<{ success: boolean; expiresAt?: string }> {
    const res = await fetch('/api/studyroom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'renew_lease', roomId, tabId, generation }),
    });

    if (!res.ok) {
      return { success: false };
    }

    return res.json();
  },

  async leaveRoom(roomId?: string, tabId?: string, global = false): Promise<{ success: boolean; left: boolean }> {
    const res = await fetch('/api/studyroom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'leave', roomId, tabId, global }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to leave room: ${res.statusText}`);
    }

    return res.json();
  },

  async getRoomRoster(roomId: string): Promise<RoomParticipantDTO[]> {
    const res = await fetch(`/api/studyroom/roster?roomId=${encodeURIComponent(roomId)}`, {
      method: 'GET',
    });

    if (!res.ok) {
      if (res.status === 401) return [];
      throw new Error(`Failed to fetch room roster: ${res.statusText}`);
    }

    return res.json();
  },

  async getActiveSession(): Promise<StudySessionDTO | null> {
    const res = await fetch('/api/studyroom/session', {
      method: 'GET',
    });

    if (!res.ok) {
      if (res.status === 401) return null;
      throw new Error(`Failed to fetch active session: ${res.statusText}`);
    }

    return res.json();
  },

  async startSession(targetDurationSeconds: number, roomId?: string | null): Promise<StudySessionDTO> {
    const res = await fetch('/api/studyroom/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDurationSeconds, roomId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to start session: ${res.statusText}`);
    }

    return res.json();
  },

  async pauseSession(sessionId: string, expectedVersion?: number): Promise<StudySessionDTO> {
    const res = await fetch('/api/studyroom/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pause', sessionId, expectedVersion }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error: ApiHttpError = new Error(err.error || `Failed to pause session: ${res.statusText}`);
      error.status = res.status;
      throw error;
    }

    return res.json();
  },

  async resumeSession(sessionId: string, expectedVersion?: number): Promise<StudySessionDTO> {
    const res = await fetch('/api/studyroom/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resume', sessionId, expectedVersion }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error: ApiHttpError = new Error(err.error || `Failed to resume session: ${res.statusText}`);
      error.status = res.status;
      throw error;
    }

    return res.json();
  },

  async completeSession(sessionId: string, expectedVersion?: number): Promise<StudySessionDTO> {
    const res = await fetch('/api/studyroom/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', sessionId, expectedVersion }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error: ApiHttpError = new Error(err.error || `Failed to complete session: ${res.statusText}`);
      error.status = res.status;
      throw error;
    }

    return res.json();
  },

  async interruptSession(sessionId: string, expectedVersion?: number): Promise<StudySessionDTO> {
    const res = await fetch('/api/studyroom/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'interrupt', sessionId, expectedVersion }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error: ApiHttpError = new Error(err.error || `Failed to interrupt session: ${res.statusText}`);
      error.status = res.status;
      throw error;
    }

    return res.json();
  },

  async getSessionHistory(params?: { cursor?: string; limit?: number }): Promise<{
    sessions: StudySessionDTO[];
    nextCursor: string | null;
  }> {
    const qs = new URLSearchParams();
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.limit) qs.set('limit', String(params.limit));
    const url = `/api/studyroom/session/history${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await fetch(url, { method: 'GET' });

    if (!res.ok) {
      if (res.status === 401) return { sessions: [], nextCursor: null };
      throw new Error(`Failed to fetch session history: ${res.statusText}`);
    }

    return res.json();
  },

  async syncRoomEvents(
    roomSlug: string,
    optionsOrClientSeq?: { clientSequence?: number; limit?: number } | number,
    maybeLimit?: number
  ): Promise<RoomSyncResponse> {
    let clientSequence: number | undefined;
    let limit: number | undefined;

    if (typeof optionsOrClientSeq === 'number') {
      clientSequence = optionsOrClientSeq;
      limit = maybeLimit;
    } else if (optionsOrClientSeq && typeof optionsOrClientSeq === 'object') {
      clientSequence = optionsOrClientSeq.clientSequence;
      limit = optionsOrClientSeq.limit;
    }

    const params = new URLSearchParams();
    if (clientSequence !== undefined) {
      params.set('clientSequence', String(clientSequence));
    }
    if (limit !== undefined) {
      params.set('limit', String(limit));
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/studyroom/${encodeURIComponent(roomSlug)}/sync${query}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = Object.assign(
        new Error(err.error || `Failed to sync room events (${res.status})`),
        { status: res.status, data: err }
      );
      throw error;
    }
    return res.json();
  },

  async getChannelMessages(channelId: string, limit = 50, before?: string): Promise<RoomChatMessageDTO[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set('before', before);
    const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}/messages?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch messages (${res.status})`);
    }
    return res.json();
  },

  async sendChannelMessage(
    channelId: string,
    content: string,
    clientRequestId?: string,
    replyToId?: string
  ): Promise<RoomChatMessageDTO> {
    const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, clientRequestId, replyToId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = Object.assign(
        new Error(err.error || `Failed to send message (${res.status})`),
        { status: res.status, data: err }
      );
      throw error;
    }
    return res.json();
  },

  async getRoomEnvironment(roomSlug: string): Promise<RoomEnvironmentSnapshotDTO> {
    const res = await fetch(`/api/studyroom/${encodeURIComponent(roomSlug)}/environment`, {
      method: 'GET',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error: ApiHttpError = new Error(err.error || `Failed to fetch room environment: ${res.statusText}`);
      error.status = res.status;
      throw error;
    }
    return res.json();
  },

  async updateRoomEnvironment(
    roomSlug: string,
    payload: {
      sceneId?: string;
      soundscapeId?: string | null;
      musicPresetId?: string | null;
      musicStreamUrl?: string | null;
      expectedRevision?: number;
    }
  ): Promise<RoomEnvironmentSnapshotDTO> {
    const res = await fetch(`/api/studyroom/${encodeURIComponent(roomSlug)}/environment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error: ApiHttpError = new Error(err.error || `Failed to update room environment: ${res.statusText}`);
      error.status = res.status;
      throw error;
    }
    return res.json();
  },

  async getRoomSprint(roomSlug: string): Promise<{ sprint: RoomSprintSnapshotDTO | null }> {
    const res = await fetch(`/api/studyroom/${encodeURIComponent(roomSlug)}/sprint`, {
      method: 'GET',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error: ApiHttpError = new Error(err.error || `Failed to fetch room sprint: ${res.statusText}`);
      error.status = res.status;
      throw error;
    }
    return res.json();
  },

  async startRoomSprint(
    roomSlug: string,
    targetDurationSeconds?: number,
    title?: string
  ): Promise<RoomSprintSnapshotDTO> {
    const res = await fetch(`/api/studyroom/${encodeURIComponent(roomSlug)}/sprint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDurationSeconds, title }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error: ApiHttpError = new Error(err.error || `Failed to start sprint: ${res.statusText}`);
      error.status = res.status;
      throw error;
    }
    return res.json();
  },

  async pauseRoomSprint(
    roomSlug: string,
    sprintId: string,
    expectedRevision: number
  ): Promise<RoomSprintSnapshotDTO> {
    const res = await fetch(`/api/studyroom/${encodeURIComponent(roomSlug)}/sprint/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprintId, expectedRevision }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error: ApiHttpError = new Error(err.error || `Failed to pause sprint: ${res.statusText}`);
      error.status = res.status;
      throw error;
    }
    return res.json();
  },

  async resumeRoomSprint(
    roomSlug: string,
    sprintId: string,
    expectedRevision: number
  ): Promise<RoomSprintSnapshotDTO> {
    const res = await fetch(`/api/studyroom/${encodeURIComponent(roomSlug)}/sprint/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprintId, expectedRevision }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error: ApiHttpError = new Error(err.error || `Failed to resume sprint: ${res.statusText}`);
      error.status = res.status;
      throw error;
    }
    return res.json();
  },

  async stopRoomSprint(
    roomSlug: string,
    sprintId: string,
    expectedRevision: number
  ): Promise<RoomSprintSnapshotDTO> {
    const res = await fetch(`/api/studyroom/${encodeURIComponent(roomSlug)}/sprint/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprintId, expectedRevision }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error: ApiHttpError = new Error(err.error || `Failed to stop sprint: ${res.statusText}`);
      error.status = res.status;
      throw error;
    }
    return res.json();
  },

  async joinRoomSprint(roomSlug: string, sprintId?: string): Promise<RoomSprintSnapshotDTO> {
    const res = await fetch(`/api/studyroom/${encodeURIComponent(roomSlug)}/sprint/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprintId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error: ApiHttpError = new Error(err.error || `Failed to join sprint: ${res.statusText}`);
      error.status = res.status;
      throw error;
    }
    return res.json();
  },

  async leaveRoomSprint(roomSlug: string, sprintId?: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/studyroom/${encodeURIComponent(roomSlug)}/sprint/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprintId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error: ApiHttpError = new Error(err.error || `Failed to leave sprint: ${res.statusText}`);
      error.status = res.status;
      throw error;
    }
    return res.json();
  },

  async updateRoomGoal(params: {
    roomId: string;
    tabId: string;
    generation: number;
    publicGoal: string | null;
  }): Promise<{ success: boolean; publicGoal: string | null }> {
    const res = await fetch('/api/studyroom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_goal',
        roomId: params.roomId,
        tabId: params.tabId,
        generation: params.generation,
        publicGoal: params.publicGoal,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error: ApiHttpError = new Error(err.error || `Failed to update room goal: ${res.statusText}`);
      error.status = res.status;
      throw error;
    }
    return res.json();
  },
};

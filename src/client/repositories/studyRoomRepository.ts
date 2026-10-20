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

  async pauseSession(sessionId: string): Promise<StudySessionDTO> {
    const res = await fetch('/api/studyroom/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pause', sessionId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to pause session: ${res.statusText}`);
    }

    return res.json();
  },

  async resumeSession(sessionId: string): Promise<StudySessionDTO> {
    const res = await fetch('/api/studyroom/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resume', sessionId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to resume session: ${res.statusText}`);
    }

    return res.json();
  },

  async completeSession(sessionId: string): Promise<StudySessionDTO> {
    const res = await fetch('/api/studyroom/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', sessionId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to complete session: ${res.statusText}`);
    }

    return res.json();
  },

  async interruptSession(sessionId: string): Promise<StudySessionDTO> {
    const res = await fetch('/api/studyroom/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'interrupt', sessionId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to interrupt session: ${res.statusText}`);
    }

    return res.json();
  },
};

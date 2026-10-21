export interface StudyRoomCacheState {
  roomsSeeded: boolean;
  cachedRooms: unknown[] | null;
  cachedRoomsExpiresAt: number;
  cachedRoomsEtag: string;
}

export const studyRoomCache: StudyRoomCacheState = {
  roomsSeeded: false,
  cachedRooms: null,
  cachedRoomsExpiresAt: 0,
  cachedRoomsEtag: '',
};

export function resetRoomsSeededForTest(): void {
  studyRoomCache.roomsSeeded = false;
}

export function clearStudyRoomCacheForTest(): void {
  studyRoomCache.cachedRooms = null;
  studyRoomCache.cachedRoomsExpiresAt = 0;
  studyRoomCache.cachedRoomsEtag = '';
}

import type { RoomDefinition } from '../types';

export const ROOM_CATALOG: readonly RoomDefinition[] = [
  {
    slug: 'library',
    title: 'Library',
    atmosphere: 'Silent study & focus',
    previewImage: '/images/studyrooms/library.webp',
    adminUserId: 'demo-mira',
    adminDisplayName: 'Mira',
    defaultEnvironment: {
      backgroundId: 'library',
      music: null,
      ambience: {
        presetId: 'rain',
        volume: 40,
        isPlaying: true,
      },
      updatedAt: 0,
      updatedByUserId: 'demo-mira',
    },
  },
  {
    slug: 'fireplace',
    title: 'Fireplace',
    atmosphere: 'Warm and cozy chats',
    previewImage: '/images/studyrooms/fireplace.webp',
    adminUserId: 'viewer',
    adminDisplayName: 'You',
    defaultEnvironment: {
      backgroundId: 'cozy-fireplace',
      music: null,
      ambience: {
        presetId: 'fireplace',
        volume: 40,
        isPlaying: true,
      },
      updatedAt: 0,
      updatedByUserId: 'viewer',
    },
  },
  {
    slug: 'developer-den',
    title: 'Developer Den',
    atmosphere: 'Co-working & code reviews',
    previewImage: null,
    adminUserId: 'demo-kai',
    adminDisplayName: 'Kai',
    defaultEnvironment: {
      backgroundId: 'minimal-workspace',
      music: null,
      ambience: {
        presetId: 'brown-noise',
        volume: 35,
        isPlaying: true,
      },
      updatedAt: 0,
      updatedByUserId: 'demo-kai',
    },
  },
] as const;

export function getRoomBySlug(slug: string): RoomDefinition | undefined {
  return ROOM_CATALOG.find((room) => room.slug === slug);
}

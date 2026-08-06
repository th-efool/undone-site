/**
 * Central Mock Avatar Registry & Utility
 * Contains all 14 mock WebP avatar images available in /public/mock/avatars/
 */

export const ALL_MOCK_AVATARS = [
  '/mock/avatars/a.webp',
  '/mock/avatars/b.webp',
  '/mock/avatars/c.webp',
  '/mock/avatars/d.webp',
  '/mock/avatars/e.webp',
  '/mock/avatars/f.webp',
  '/mock/avatars/g.webp',
  '/mock/avatars/h.webp',
  '/mock/avatars/i.webp',
  '/mock/avatars/j.webp',
  '/mock/avatars/k.webp',
  '/mock/avatars/l.webp',
  '/mock/avatars/m.webp',
  '/mock/avatars/n.webp',
] as const;

export type MockAvatarUrl = (typeof ALL_MOCK_AVATARS)[number];

/**
 * Simple string hash to convert any string ID into a deterministic index.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Get a deterministic avatar URL based on a numeric index or string seed.
 */
export function getAvatar(seed: string | number): string {
  const index = typeof seed === 'number' ? seed : hashString(seed);
  return ALL_MOCK_AVATARS[index % ALL_MOCK_AVATARS.length];
}

/**
 * Get a slice of non-repeating avatar URLs for multi-avatar UI elements (e.g. active explorers).
 */
export function getAvatarSlice(count: number, offset: number = 0): string[] {
  const result: string[] = [];
  const total = ALL_MOCK_AVATARS.length;
  for (let i = 0; i < Math.min(count, total); i++) {
    result.push(ALL_MOCK_AVATARS[(offset + i) % total]);
  }
  return result;
}

/**
 * Pick a random avatar URL from the available collection.
 */
export function getRandomAvatar(): string {
  const randomIndex = Math.floor(Math.random() * ALL_MOCK_AVATARS.length);
  return ALL_MOCK_AVATARS[randomIndex];
}

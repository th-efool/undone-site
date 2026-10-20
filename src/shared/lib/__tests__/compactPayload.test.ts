import { describe, expect, it } from 'vitest';
import { compactPayload } from '../compactPayload';

describe('compactPayload', () => {
  describe('pruning top-level nulls and undefined', () => {
    it('returns undefined for top-level null and undefined', () => {
      expect(compactPayload(null)).toBeUndefined();
      expect(compactPayload(undefined)).toBeUndefined();
    });

    it('prunes null and undefined fields from top-level objects', () => {
      const input = {
        id: 'user_1',
        name: 'Alex',
        email: null,
        bio: undefined,
        active: true,
      };

      const result = compactPayload(input);

      expect(result).toEqual({
        id: 'user_1',
        name: 'Alex',
        active: true,
      });
      expect('email' in result).toBe(false);
      expect('bio' in result).toBe(false);
    });
  });

  describe('nested objects with nulls', () => {
    it('deeply prunes null and undefined fields across multiple nesting levels', () => {
      const input = {
        user: {
          name: 'Alice',
          age: null,
          profile: {
            avatar: 'https://undone.com/pic.jpg',
            bio: null,
            socials: {
              twitter: null,
              github: 'https://github.com/alice',
              website: undefined,
            },
          },
        },
        meta: {
          trackingId: null,
          version: 2,
        },
      };

      const result = compactPayload(input);

      expect(result).toEqual({
        user: {
          name: 'Alice',
          profile: {
            avatar: 'https://undone.com/pic.jpg',
            socials: {
              github: 'https://github.com/alice',
            },
          },
        },
        meta: {
          version: 2,
        },
      });
      expect((result.user.profile as any).bio).toBeUndefined();
      expect((result.user.profile.socials as any).twitter).toBeUndefined();
    });

    it('handles null-prototype objects without error', () => {
      const dict = Object.create(null);
      dict.key = 'value';
      dict.absent = null;

      const result = compactPayload(dict);
      expect(result).toEqual({ key: 'value' });
    });
  });

  describe('arrays of objects with nulls', () => {
    it('compacts each object in an array', () => {
      const items = [
        { chunkId: 'c1', lessonThumbnail: null, lessonVideoId: null, title: 'Chunk 1' },
        { chunkId: 'c2', lessonThumbnail: 'thumb.jpg', lessonVideoId: 'v123', sourceUrl: null },
      ];

      const result = compactPayload(items);

      expect(result).toEqual([
        { chunkId: 'c1', title: 'Chunk 1' },
        { chunkId: 'c2', lessonThumbnail: 'thumb.jpg', lessonVideoId: 'v123' },
      ]);
    });

    it('filters out null and undefined items within arrays', () => {
      const arrayWithNulls = ['first', null, 'second', undefined, 'third'];
      expect(compactPayload(arrayWithNulls)).toEqual(['first', 'second', 'third']);
    });

    it('compacts nested arrays cleanly', () => {
      const nested = [
        [{ id: '1', dropped: null }],
        [{ id: '2', val: 'ok' }],
      ];
      expect(compactPayload(nested)).toEqual([
        [{ id: '1' }],
        [{ id: '2', val: 'ok' }],
      ]);
    });
  });

  describe('primitives (empty strings, 0, false, null)', () => {
    it('preserves falsey primitives that are not null or undefined', () => {
      expect(compactPayload('')).toBe('');
      expect(compactPayload(0)).toBe(0);
      expect(compactPayload(-0)).toBe(-0);
      expect(compactPayload(false)).toBe(false);
      expect(compactPayload(NaN)).toBeNaN();
    });

    it('preserves truthy primitives', () => {
      expect(compactPayload('hello')).toBe('hello');
      expect(compactPayload(123)).toBe(123);
      expect(compactPayload(true)).toBe(true);
    });

    it('preserves falsey values inside objects while pruning null and undefined', () => {
      const payload = {
        zero: 0,
        emptyString: '',
        booleanFalse: false,
        booleanTrue: true,
        validNumber: 42,
        validString: 'valid',
        nullField: null,
        undefinedField: undefined,
      };

      const result = compactPayload(payload);

      expect(result).toEqual({
        zero: 0,
        emptyString: '',
        booleanFalse: false,
        booleanTrue: true,
        validNumber: 42,
        validString: 'valid',
      });
    });
  });

  describe('Date objects and non-mutation', () => {
    it('preserves Date instances without converting or corrupting them', () => {
      const date = new Date('2026-10-20T04:00:00.000Z');
      const input = {
        createdAt: date,
        deletedAt: null,
      };

      const result = compactPayload(input);

      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.createdAt.getTime()).toBe(date.getTime());
      expect('deletedAt' in result).toBe(false);
    });

    it('does not mutate the input object', () => {
      const original = { a: 1, b: null, c: { d: null, e: 2 } };
      const copy = JSON.parse(JSON.stringify(original));

      compactPayload(original);

      expect(original).toEqual(copy);
      expect(original.b).toBeNull();
      expect(original.c.d).toBeNull();
    });
  });
});

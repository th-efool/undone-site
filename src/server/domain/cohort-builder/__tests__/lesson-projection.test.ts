import { describe, expect, it } from 'vitest';
import { projectGeneratedLessons } from '../lesson-projection';

const generated = (id: string, chunk: string) => ({ id, version: 0, title: id, objective: 'Objective', sourceChunkIds: [chunk], pinned: false });

describe('lesson projection', () => {
  it('preserves pinned and manual lessons while replacing generated lessons', () => {
    const existing = [
      { ...generated('grounded:old', 'chunk-old'), pinned: true, title: 'Pinned title' },
      { ...generated('manual:one', 'chunk-a'), manualOverride: true, objective: 'My objective' },
      generated('grounded:stale', 'chunk-a'),
    ];
    const result = projectGeneratedLessons(existing, [generated('grounded:new', 'chunk-b')], new Set(['chunk-a', 'chunk-b']));
    expect(result.map(item => item.id)).toEqual(['grounded:old', 'manual:one', 'grounded:new']);
    expect(result[0].title).toBe('Pinned title');
    expect(result[1].objective).toBe('My objective');
  });

  it('marks preserved authored evidence orphaned when its chunk disappears', () => {
    const existing = [{ ...generated('manual:one', 'removed'), manualOverride: true }];
    const result = projectGeneratedLessons(existing, [], new Set());
    expect(result[0].evidenceStatus).toBe('orphaned');
  });
});

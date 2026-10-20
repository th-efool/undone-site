/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LessonRow } from '../LessonRow';
import { LessonStatus, LessonType, type Lesson } from '@/src/client/screens/cohort/models';

afterEach(cleanup);

describe('LessonRow Direct CDN Thumbnail Routing', () => {
  const baseLesson: Lesson = {
    id: 'lesson-1',
    title: 'Introduction to Docker Containers',
    type: LessonType.Video,
    duration: '12m',
    status: LessonStatus.Ready,
    totalChunks: 3,
    completedChunks: 1,
    thumbnail: '',
    videoId: 'abc123xyz',
    videoUrl: 'https://www.youtube.com/watch?v=abc123xyz',
  };

  it('renders direct YouTube edge CDN thumbnail without /_next/image proxying', () => {
    const onToggleStatus = vi.fn();
    const { container } = render(
      <LessonRow
        lesson={baseLesson}
        index={0}
        cohortId="cohort-1"
        onToggleStatus={onToggleStatus}
      />
    );

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    // Verify direct CDN source without Vercel Image Optimization compute proxy
    expect(img?.getAttribute('src')).toBe('https://i.ytimg.com/vi/abc123xyz/hqdefault.jpg');
    expect(img?.getAttribute('src')).not.toContain('/_next/image');
  });

  it('renders direct Unsplash edge CDN thumbnail when fallback is used', () => {
    const onToggleStatus = vi.fn();
    const nonVideoLesson: Lesson = {
      ...baseLesson,
      id: 'lesson-2',
      videoId: undefined,
      videoUrl: undefined,
      type: LessonType.Reading,
      thumbnail: '',
    };

    const { container } = render(
      <LessonRow
        lesson={nonVideoLesson}
        index={1}
        cohortId="cohort-1"
        onToggleStatus={onToggleStatus}
      />
    );

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe(
      'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop'
    );
    expect(img?.getAttribute('src')).not.toContain('/_next/image');
  });

  it('renders direct CDN thumbnail when lesson is locked', () => {
    const onToggleStatus = vi.fn();
    const lockedLesson: Lesson = {
      ...baseLesson,
      id: 'lesson-3',
      status: LessonStatus.Locked,
    };

    const { container } = render(
      <LessonRow
        lesson={lockedLesson}
        index={2}
        cohortId="cohort-1"
        onToggleStatus={onToggleStatus}
      />
    );

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://i.ytimg.com/vi/abc123xyz/hqdefault.jpg');
    expect(img?.getAttribute('src')).not.toContain('/_next/image');
  });

  it('renders direct custom CDN thumbnail if provided', () => {
    const onToggleStatus = vi.fn();
    const customThumbnailLesson: Lesson = {
      ...baseLesson,
      id: 'lesson-4',
      thumbnail: 'https://images.unsplash.com/photo-custom?w=800',
    };

    const { container } = render(
      <LessonRow
        lesson={customThumbnailLesson}
        index={3}
        cohortId="cohort-1"
        onToggleStatus={onToggleStatus}
      />
    );

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://images.unsplash.com/photo-custom?w=800');
    expect(img?.getAttribute('src')).not.toContain('/_next/image');
  });
});

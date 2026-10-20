// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import StudyRoomLoading from '../loading';
import StudyRoomScreen from '@/src/client/screens/dashboard/studyroom/StudyRoomScreen';

describe('Study Room Route Loading Boundary & Anti-Skeleton Verification', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the real Study Room workspace composition during loading instead of fake skeleton cards', () => {
    const { container } = render(<StudyRoomLoading />);

    // Must render the real header and room titles
    expect(screen.getByRole('heading', { level: 1, name: 'Study Rooms' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Fireplace' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Library' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Developer Den' })).toBeTruthy();

    // Must NOT contain any fake skeleton cards or grid
    expect(container.querySelector('[class*="skeletonGrid"]')).toBeNull();
    expect(container.querySelector('[class*="skeletonCard"]')).toBeNull();
    expect(container.querySelectorAll('[class*="shimmer"]').length).toBe(0);
    expect(container.querySelectorAll('[class*="skeleton"]').length).toBe(0);
  });

  it('contains zero skeleton or shimmer classes when rendering StudyRoomScreen directly', () => {
    const { container } = render(<StudyRoomScreen />);

    expect(screen.getByRole('heading', { level: 1, name: 'Study Rooms' })).toBeTruthy();
    expect(container.querySelector('[class*="skeletonGrid"]')).toBeNull();
    expect(container.querySelector('[class*="skeletonCard"]')).toBeNull();
    expect(container.querySelectorAll('[class*="shimmer"]').length).toBe(0);
    expect(container.querySelectorAll('[class*="skeleton"]').length).toBe(0);
  });
});

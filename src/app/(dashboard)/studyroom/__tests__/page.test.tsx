// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import StudyRoomPage, { metadata } from '../page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/studyroom',
  useSearchParams: () => new URLSearchParams(),
}));

describe('StudyRoomPage Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('has correct page metadata', () => {
    expect(metadata.title).toBe('Study Rooms');
    expect(metadata.description).toContain('Join virtual study rooms');
  });

  it('renders StudyRoomScreen within main element', () => {
    const { container } = render(<StudyRoomPage />);
    const main = container.querySelector('main');
    expect(main).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Study Rooms' })).toBeTruthy();
  });
});

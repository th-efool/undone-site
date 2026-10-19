// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import StudyRoomPage, { metadata } from '../page';

// Mock next-auth safely
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'test-user', name: 'Tester' } },
    status: 'authenticated',
  }),
}));

describe('StudyRoomPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
  });

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
    expect(screen.getByText('Focus Cohorts & Study Rooms')).toBeTruthy();
  });
});

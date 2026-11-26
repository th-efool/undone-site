// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';

const mockState = vi.hoisted(() => ({
  session: null as { user?: { id: string; name?: string } } | null,
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: mockState.session }),
}));

vi.mock('@/src/client/hooks/useTheme', () => ({
  useTheme: () => ({ isDark: false, mounted: true, theme: 'light', setTheme: vi.fn() }),
}));

import { HeaderNav } from '../HeaderNav';

describe('HeaderNav authentication behavior', () => {
  beforeEach(() => {
    mockState.session = null;
  });

  afterEach(() => {
    cleanup();
  });

  it('renders interested prompt and contact-us link instead of sign-in or get-started when unauthenticated', () => {
    render(<HeaderNav />);

    expect(screen.queryByRole('link', { name: /sign in/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /get started/i })).toBeNull();

    expect(screen.getByText(/interested\?/i)).toBeTruthy();

    const contactLink = screen.getByRole('link', { name: /contact us/i });
    expect(contactLink.getAttribute('href')).toBe(
      'mailto:support@undone.in?subject=Interested%20in%20Undone'
    );
  });

  it('renders dashboard and my quests links pointing to /home when authenticated', () => {
    mockState.session = { user: { id: 'test-user-123', name: 'Curious Learner' } };
    render(<HeaderNav />);

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink.getAttribute('href')).toBe('/home');

    const myQuestsLink = screen.getByRole('link', { name: /my quests/i });
    expect(myQuestsLink.getAttribute('href')).toBe('/home');

    expect(screen.queryByRole('link', { name: /sign in/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /contact us/i })).toBeNull();
  });
});

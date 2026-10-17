// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

import { CentralInterface } from '../CentralInterface';

describe('CentralInterface unauthenticated handoff', () => {
  let currentHref: string;
  let locationMock: { href: string; search: string; assign: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    currentHref = 'http://localhost:3000/';
    locationMock = {
      get href() {
        return currentHref;
      },
      set href(val: string) {
        currentHref = val;
      },
      get search() {
        return currentHref.includes('?') ? currentHref.slice(currentHref.indexOf('?')) : '';
      },
      assign: vi.fn((val: string) => {
        currentHref = val;
      }),
    };
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: locationMock,
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it('redirects unauthenticated user to /auth with returnTo landing page and preserves query in draft and sessionStorage', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: false, ownerId: null }),
    });

    render(<CentralInterface />);

    const input = screen.getByRole('textbox', { name: /what do you want to learn about/i });
    fireEvent.change(input, { target: { value: 'Learn Quantum Mechanics' } });

    const beginBtn = screen.getByRole('button', { name: /begin journey/i });
    fireEvent.click(beginBtn);

    await waitFor(() => {
      expect(locationMock.href).toBe('/auth?returnTo=%2F%3Fq%3DLearn%2520Quantum%2520Mechanics');
      expect(locationMock.href).not.toBe('/quest/start');
    });

    const savedPendingQuery = sessionStorage.getItem('undone:landing-query');
    expect(savedPendingQuery).toBe('Learn Quantum Mechanics');

    const rawDraft = sessionStorage.getItem('undone:cohort-intake');
    expect(rawDraft).toBeTruthy();
    const saved = JSON.parse(rawDraft!);
    expect(saved.ownerId).toBeNull();
    expect(saved.body.prompt).toBe('Learn Quantum Mechanics');
  });
});

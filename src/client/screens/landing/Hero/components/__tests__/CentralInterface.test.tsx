// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'owner-test-1' } }, status: 'authenticated' }),
}));

import { CentralInterface } from '../CentralInterface';
import { saveIntakeDraft } from '@/src/client/screens/cohortBuilder/intake-draft';

describe('CentralInterface homepage handoff', () => {
  let currentHref: string;
  let locationMock: { href: string; search: string; assign: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
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
    localStorage.clear();
  });

  it('navigates directly to /quest/build/[workspaceId] and saves draft to sessionStorage when intake POST succeeds', async () => {
    global.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({ workspaceId: 'ws-direct-123' }),
        };
      }
      return {
        ok: true,
        json: async () => ({ enabled: true, ownerId: 'owner-test-1' }),
      };
    });

    render(<CentralInterface />);

    const input = screen.getByRole('textbox', { name: /what do you want to learn about/i });
    fireEvent.change(input, { target: { value: 'Learn machine learning' } });

    const beginBtn = screen.getByRole('button', { name: /begin journey/i });
    fireEvent.click(beginBtn);

    await waitFor(() => {
      expect(locationMock.href).toBe('/quest/build/ws-direct-123');
      expect(locationMock.href).not.toContain('/quest/new');
    });

    const rawDraft = sessionStorage.getItem('undone:cohort-intake');
    expect(rawDraft).toBeTruthy();
    const saved = JSON.parse(rawDraft!);
    expect(saved.ownerId).toBe('owner-test-1');
    expect(saved.body.prompt).toBe('Learn machine learning');
    expect(saved.body.source).toBeUndefined();
    expect(saved.body.requestId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('toggles Plan mode without submitting, and subsequent submit sends mode plan', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ workspaceId: 'ws-plan-build-1' }),
    });

    render(<CentralInterface />);

    const input = screen.getByRole('textbox', { name: /what do you want to learn about/i });
    fireEvent.change(input, { target: { value: 'Explore quantum computing' } });

    const planBtn = screen.getByRole('button', { name: /plan/i });
    expect(planBtn.getAttribute('aria-pressed')).toBe('false');

    // Toggle Plan mode ON -> does not send network request
    fireEvent.click(planBtn);
    expect(planBtn.getAttribute('aria-pressed')).toBe('true');
    expect(global.fetch).not.toHaveBeenCalled();

    // Now submit via Start planning button
    const submitBtn = screen.getByRole('button', { name: /start planning/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(locationMock.href).toBe('/quest/build/ws-plan-build-1');
    });

    const rawDraft = sessionStorage.getItem('undone:cohort-intake');
    expect(rawDraft).toBeTruthy();
    const saved = JSON.parse(rawDraft!);
    expect(saved.ownerId).toBe('owner-test-1');
    expect(saved.body.mode).toBe('plan');
    expect(saved.body.prompt).toBe('Explore quantum computing');
  });

  it('preserves legacy attached text in draft and submits it', async () => {
    saveIntakeDraft(
      {
        requestId: '00000000-0000-4000-8000-000000000002',
        prompt: 'Analyze neuroscience paper',
        mode: 'search',
        source: { label: 'Pasted text', text: 'Synaptic plasticity and long term potentiation principles' },
      },
      'owner-test-1'
    );

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ workspaceId: 'ws-neuro-1' }),
    });

    render(<CentralInterface />);

    expect(screen.getByText('Previously attached text')).toBeTruthy();
    expect(screen.getByText('Synaptic plasticity and long term potentiation principles')).toBeTruthy();

    const beginBtn = screen.getByRole('button', { name: /begin journey/i });
    fireEvent.click(beginBtn);

    await waitFor(() => {
      expect(locationMock.href).toBe('/quest/build/ws-neuro-1');
    });

    const rawDraft = sessionStorage.getItem('undone:cohort-intake');
    expect(rawDraft).toBeTruthy();
    const saved = JSON.parse(rawDraft!);
    expect(saved.ownerId).toBe('owner-test-1');
    expect(saved.body.prompt).toBe('Analyze neuroscience paper');
    expect(saved.body.source).toEqual({
      label: 'Pasted text',
      text: 'Synaptic plasticity and long term potentiation principles',
    });
  });

  it('displays recoverable error and retains draft when intake API returns 500', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ code: 'INTAKE_UNAVAILABLE' }),
    });

    render(<CentralInterface />);

    const input = screen.getByRole('textbox', { name: /what do you want to learn about/i });
    fireEvent.change(input, { target: { value: 'Study game theory' } });

    const beginBtn = screen.getByRole('button', { name: /begin journey/i });
    fireEvent.click(beginBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    const rawDraft = sessionStorage.getItem('undone:cohort-intake');
    expect(rawDraft).toBeTruthy();
    const saved = JSON.parse(rawDraft!);
    expect(saved.body.prompt).toBe('Study game theory');
  });

  it('displays recoverable error and retains draft when fetch throws network error or timeout', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    render(<CentralInterface />);

    const input = screen.getByRole('textbox', { name: /what do you want to learn about/i });
    fireEvent.change(input, { target: { value: 'Study distributed consensus' } });

    const beginBtn = screen.getByRole('button', { name: /begin journey/i });
    fireEvent.click(beginBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText('Could not confirm your request. Retry to continue.')).toBeTruthy();
    });

    const rawDraft = sessionStorage.getItem('undone:cohort-intake');
    expect(rawDraft).toBeTruthy();
    const saved = JSON.parse(rawDraft!);
    expect(saved.body.prompt).toBe('Study distributed consensus');
  });

  it('restores query from search parameter ?q= on mount', async () => {
    currentHref = 'http://localhost:3000/?q=Learn%20Rust%20Programming';
    render(<CentralInterface />);
    const input = screen.getByRole('textbox', { name: /what do you want to learn about/i }) as HTMLInputElement;
    expect(input.value).toBe('Learn Rust Programming');
  });

  it('restores query from sessionStorage on mount', async () => {
    sessionStorage.setItem('undone:landing-query', 'Mastering TypeScript');
    render(<CentralInterface />);
    const input = screen.getByRole('textbox', { name: /what do you want to learn about/i }) as HTMLInputElement;
    expect(input.value).toBe('Mastering TypeScript');
  });
});

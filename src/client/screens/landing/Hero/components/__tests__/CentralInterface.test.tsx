// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { CentralInterface } from '../CentralInterface';

describe('CentralInterface homepage handoff', () => {
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

  it('navigates to /quest/start and saves draft to sessionStorage when policy is enabled', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, ownerId: 'owner-test-1' }),
    });

    render(<CentralInterface />);

    const input = screen.getByRole('textbox', { name: /what do you want to learn about/i });
    fireEvent.change(input, { target: { value: 'Learn machine learning' } });

    const beginBtn = screen.getByRole('button', { name: /begin journey/i });
    fireEvent.click(beginBtn);

    await waitFor(() => {
      expect(locationMock.href).toBe('/quest/start');
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

  it('navigates to /quest/start and does NOT silently navigate to v1 (/quest/new) when policy is disabled', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: false, ownerId: 'owner-disabled' }),
    });

    render(<CentralInterface />);

    const input = screen.getByRole('textbox', { name: /what do you want to learn about/i });
    fireEvent.change(input, { target: { value: 'Explore quantum computing' } });

    const beginBtn = screen.getByRole('button', { name: /begin journey/i });
    fireEvent.click(beginBtn);

    await waitFor(() => {
      expect(locationMock.href).toBe('/quest/start');
      expect(locationMock.href).not.toContain('/quest/new');
    });

    const rawDraft = sessionStorage.getItem('undone:cohort-intake');
    expect(rawDraft).toBeTruthy();
    const saved = JSON.parse(rawDraft!);
    expect(saved.ownerId).toBe('owner-disabled');
    expect(saved.body.prompt).toBe('Explore quantum computing');
  });

  it('preserves pasted source text in draft and navigates to /quest/start', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, ownerId: 'owner-test-2' }),
    });

    render(<CentralInterface />);

    const input = screen.getByRole('textbox', { name: /what do you want to learn about/i });
    fireEvent.change(input, { target: { value: 'Analyze neuroscience paper' } });

    const addSourcesBtn = screen.getByRole('button', { name: /add sources/i });
    fireEvent.click(addSourcesBtn);

    const sourceTextarea = screen.getByRole('textbox', { name: /paste source text/i });
    fireEvent.change(sourceTextarea, {
      target: { value: 'Synaptic plasticity and long term potentiation principles' },
    });

    const beginBtn = screen.getByRole('button', { name: /begin journey/i });
    fireEvent.click(beginBtn);

    await waitFor(() => {
      expect(locationMock.href).toBe('/quest/start');
      expect(locationMock.href).not.toContain('/quest/new');
    });

    const rawDraft = sessionStorage.getItem('undone:cohort-intake');
    expect(rawDraft).toBeTruthy();
    const saved = JSON.parse(rawDraft!);
    expect(saved.ownerId).toBe('owner-test-2');
    expect(saved.body.prompt).toBe('Analyze neuroscience paper');
    expect(saved.body.source).toEqual({
      label: 'Pasted text',
      text: 'Synaptic plasticity and long term potentiation principles',
    });
  });

  it('preserves draft with null ownerId and navigates to /quest/start when intake API returns 500', async () => {
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
      expect(locationMock.href).toBe('/quest/start');
      expect(locationMock.href).not.toContain('/quest/new');
    });

    const rawDraft = sessionStorage.getItem('undone:cohort-intake');
    expect(rawDraft).toBeTruthy();
    const saved = JSON.parse(rawDraft!);
    expect(saved.ownerId).toBeNull();
    expect(saved.body.prompt).toBe('Study game theory');
  });

  it('preserves draft with null ownerId and navigates to /quest/start when fetch throws network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    render(<CentralInterface />);

    const input = screen.getByRole('textbox', { name: /what do you want to learn about/i });
    fireEvent.change(input, { target: { value: 'Study distributed consensus' } });

    const planBtn = screen.getByRole('button', { name: /plan/i });
    fireEvent.click(planBtn);

    await waitFor(() => {
      expect(locationMock.href).toBe('/quest/start');
      expect(locationMock.href).not.toContain('/quest/new');
    });

    const rawDraft = sessionStorage.getItem('undone:cohort-intake');
    expect(rawDraft).toBeTruthy();
    const saved = JSON.parse(rawDraft!);
    expect(saved.ownerId).toBeNull();
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

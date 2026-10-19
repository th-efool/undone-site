// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { CohortIntakeScreen } from '../CohortIntakeScreen';
import { saveIntakeDraft } from '../intake-draft';

const draft = {
  requestId: '54103d7b-2709-4dd6-bb18-522f96b97241',
  prompt: 'Learn distributed systems',
};

let assignMock = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
  assignMock = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      href: 'http://localhost:3000/',
      assign: assignMock,
    },
    writable: true,
  });
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

it('submits valid intake and assigns location on success', async () => {
  saveIntakeDraft(draft, 'owner-1');
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ workspaceId: 'ws-12345' }),
  });
  global.fetch = fetchMock;

  render(<CohortIntakeScreen ownerId="owner-1" enabled={true} />);

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/cohort-builder/intake',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, expectedOwnerId: 'owner-1' }),
      })
    );
    expect(assignMock).toHaveBeenCalledWith('/quest/build/ws-12345');
  });
});

it('retains failed intake without sending the user to the legacy creator', async () => {
  saveIntakeDraft(draft, 'owner-1');
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ code: 'DURABLE_DRIVER_REQUIRED' }),
  });

  render(<CohortIntakeScreen ownerId="owner-1" enabled={true} />);

  await waitFor(() => {
    expect(screen.getByRole('alert').textContent).toContain('Could not save: DURABLE_DRIVER_REQUIRED');
    expect(screen.queryByRole('link', { name: /existing creator/i })).toBeNull();
  });
});

it('displays error and does NOT offer legacy alternative when draft has source text', async () => {
  const draftWithSource = {
    ...draft,
    source: {
      label: 'Pasted text',
      text: 'Specialized source text research notes',
    },
  };
  saveIntakeDraft(draftWithSource, 'owner-1');
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ code: 'DURABLE_DRIVER_REQUIRED' }),
  });

  render(<CohortIntakeScreen ownerId="owner-1" enabled={true} />);

  await waitFor(() => {
    expect(screen.getByRole('alert').textContent).toContain('Could not save: DURABLE_DRIVER_REQUIRED');
    expect(screen.getByText(/Retained text: Pasted text/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /continue with existing creator/i })).toBeNull();
  });
});

it('displays disabled notice and preserved prompt without a legacy detour', () => {
  saveIntakeDraft(draft, 'owner-1');

  render(<CohortIntakeScreen ownerId="owner-1" enabled={false} />);

  expect(
    screen.getByText('New builder intake is unavailable. Existing workspaces remain accessible.')
  ).toBeTruthy();
  expect(screen.getAllByText('Learn distributed systems').some(el => el.closest('blockquote'))).toBe(true);
  expect(screen.queryByRole('link', { name: /existing creator/i })).toBeNull();
  expect(screen.getByRole('button', { name: 'Discard' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Return to landing' }).getAttribute('href')).toBe('/#explore');
});

it('retains and displays pasted text label and character count, explains incompatibility, and does NOT offer legacy link when intake is disabled with source text', () => {
  const draftWithSource = {
    ...draft,
    source: {
      label: 'Pasted text',
      text: 'Detailed source text to preserve',
    },
  };
  saveIntakeDraft(draftWithSource, 'owner-1');

  render(<CohortIntakeScreen ownerId="owner-1" enabled={false} />);

  expect(
    screen.getByText('New builder intake is unavailable. Existing workspaces remain accessible.')
  ).toBeTruthy();
  expect(screen.getAllByText('Learn distributed systems').some(el => el.closest('blockquote'))).toBe(true);
  expect(screen.getByText(/Retained text: Pasted text \(32 characters\)/)).toBeTruthy();
  expect(
    screen.getByText('Your input is retained for the new builder. Please retry when creation is available.')
  ).toBeTruthy();
  expect(screen.queryByRole('link', { name: /continue with existing creator/i })).toBeNull();
  expect(screen.getByRole('button', { name: 'Discard' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Return to landing' }).getAttribute('href')).toBe('/#explore');
});

it('clears draft when discard is clicked in enabled state', async () => {
  saveIntakeDraft(draft, 'owner-1');
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ code: 'DURABLE_DRIVER_REQUIRED' }),
  });

  render(<CohortIntakeScreen ownerId="owner-1" enabled={true} />);

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Discard' })).toBeTruthy();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

  expect(screen.getByText(/No pending input/)).toBeTruthy();
  expect(sessionStorage.getItem('undone:cohort-intake')).toBeNull();
});

it('clears draft when discard is clicked in disabled state', () => {
  saveIntakeDraft(draft, 'owner-1');

  render(<CohortIntakeScreen ownerId="owner-1" enabled={false} />);

  fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

  expect(screen.getByText(/No pending input/)).toBeTruthy();
  expect(sessionStorage.getItem('undone:cohort-intake')).toBeNull();
});

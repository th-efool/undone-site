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

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
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

  const assignMock = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { assign: assignMock },
  });

  render(<CohortIntakeScreen ownerId="owner-1" enabled={true} />);

  expect(screen.getByText('Learn distributed systems')).toBeTruthy();
  const createButton = screen.getByRole('button', { name: 'Create cohort' });
  fireEvent.click(createButton);

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

it('displays error and presents explicit alternative to existing creator', async () => {
  saveIntakeDraft(draft, 'owner-1');
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ code: 'DURABLE_DRIVER_REQUIRED' }),
  });

  render(<CohortIntakeScreen ownerId="owner-1" enabled={true} />);

  fireEvent.click(screen.getByRole('button', { name: 'Create cohort' }));

  await waitFor(() => {
    expect(screen.getByRole('alert').textContent).toContain('Could not save: DURABLE_DRIVER_REQUIRED');
    expect(screen.getByRole('link', { name: 'Or continue with existing creator' }).getAttribute('href')).toBe(
      '/quest/new?handoff=1'
    );
  });
});

it('displays disabled notice and explicit link to existing creator when intake is disabled', () => {
  saveIntakeDraft(draft, 'owner-1');

  render(<CohortIntakeScreen ownerId="owner-1" enabled={false} />);

  expect(
    screen.getByText('New builder intake is unavailable. Existing workspaces remain accessible.')
  ).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Continue with existing creator' }).getAttribute('href')).toBe(
    '/quest/new?handoff=1'
  );
});

it('clears draft when discard is clicked', () => {
  saveIntakeDraft(draft, 'owner-1');

  render(<CohortIntakeScreen ownerId="owner-1" enabled={true} />);

  fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

  expect(screen.getByText(/No pending input/)).toBeTruthy();
  expect(sessionStorage.getItem('undone:cohort-intake')).toBeNull();
});

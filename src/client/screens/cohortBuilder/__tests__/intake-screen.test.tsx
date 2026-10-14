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

it('displays error and presents explicit alternative to existing creator when draft has no source text', async () => {
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

  fireEvent.click(screen.getByRole('button', { name: 'Create cohort' }));

  await waitFor(() => {
    expect(screen.getByRole('alert').textContent).toContain('Could not save: DURABLE_DRIVER_REQUIRED');
    expect(screen.getByText('The existing creator only supports text prompts without pasted sources.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /continue with existing creator/i })).toBeNull();
  });
});

it('displays disabled notice, preserved prompt in blockquote, and explicit link to existing creator when intake is disabled (compatible draft without source text)', () => {
  saveIntakeDraft(draft, 'owner-1');

  render(<CohortIntakeScreen ownerId="owner-1" enabled={false} />);

  expect(
    screen.getByText('New builder intake is unavailable. Existing workspaces remain accessible.')
  ).toBeTruthy();
  expect(screen.getByText('Learn distributed systems').closest('blockquote')).not.toBeNull();
  expect(screen.getByRole('link', { name: 'Continue with existing creator' }).getAttribute('href')).toBe(
    '/quest/new?handoff=1'
  );
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
  expect(screen.getByText('Learn distributed systems').closest('blockquote')).not.toBeNull();
  expect(screen.getByText(/Retained text: Pasted text \(32 characters\)/)).toBeTruthy();
  expect(
    screen.getByText('The existing creator only supports text prompts without pasted sources.')
  ).toBeTruthy();
  expect(screen.queryByRole('link', { name: /continue with existing creator/i })).toBeNull();
  expect(screen.getByRole('button', { name: 'Discard' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Return to landing' }).getAttribute('href')).toBe('/#explore');
});

it('clears draft when discard is clicked in enabled state', () => {
  saveIntakeDraft(draft, 'owner-1');

  render(<CohortIntakeScreen ownerId="owner-1" enabled={true} />);

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

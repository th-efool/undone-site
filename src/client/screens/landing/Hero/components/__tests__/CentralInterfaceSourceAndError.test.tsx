// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

import { CentralInterface } from '../CentralInterface';
import { saveIntakeDraft } from '@/src/client/screens/cohortBuilder/intake-draft';

describe('CentralInterface Source Text & Error Banner UI (ISSUE-25)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('renders Add link action and opens inline link editor with URL field', () => {
    render(<CentralInterface />);

    // Initially links region is hidden
    expect(screen.queryByRole('region', { name: 'Attached links' })).toBeNull();

    // Click "Add link"
    const addLinkBtn = screen.getByRole('button', { name: /add link/i });
    fireEvent.click(addLinkBtn);

    // Links region is now visible
    expect(screen.getByRole('region', { name: 'Attached links' })).toBeTruthy();
    const urlInput = screen.getByLabelText('Add link URL');
    expect(urlInput).toBeTruthy();
    expect(urlInput.getAttribute('data-bare-input')).toBe('true');
  });

  it('displays legacy attached source text preview with remove capability', () => {
    saveIntakeDraft(
      {
        requestId: '00000000-0000-4000-8000-000000000001',
        prompt: 'Compilers',
        mode: 'search',
        source: { label: 'Pasted text', text: 'Rust memory safety and affine types' },
      },
      null
    );

    render(<CentralInterface />);

    expect(screen.getByText('Previously attached text')).toBeTruthy();
    expect(screen.getByText('Rust memory safety and affine types')).toBeTruthy();

    const removeBtn = screen.getByRole('button', { name: 'Remove previously attached text' });
    fireEvent.click(removeBtn);

    expect(screen.queryByText('Previously attached text')).toBeNull();
  });

  it('renders themed error banner with alert role, message, and dismiss button when intake throws error', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage quota exceeded');
    });

    render(<CentralInterface />);

    const input = screen.getByRole('textbox', { name: /what do you want to learn about/i });
    fireEvent.change(input, { target: { value: 'Study compilers' } });

    const beginBtn = screen.getByRole('button', { name: /begin journey/i });
    fireEvent.click(beginBtn);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeTruthy();
      expect(screen.getByText('Storage quota exceeded')).toBeTruthy();
    });

    const dismissBtn = screen.getByRole('button', { name: /dismiss error/i });
    expect(dismissBtn).toBeTruthy();

    fireEvent.click(dismissBtn);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Storage quota exceeded')).toBeNull();
  });
});

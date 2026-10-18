// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { CentralInterface } from '../CentralInterface';

describe('CentralInterface Source Text & Error Banner UI (ISSUE-25)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it('renders styled source text card with live character counter and clear button', () => {
    render(<CentralInterface />);

    // Initially source card is hidden
    expect(screen.queryByLabelText('Paste source text')).toBeNull();

    // Click "Add sources"
    const addSourcesBtn = screen.getByRole('button', { name: /add sources/i });
    fireEvent.click(addSourcesBtn);

    // Source card should be visible
    expect(screen.getByText('Paste reference material or syllabus')).toBeTruthy();
    expect(screen.getByText('0 / 200,000')).toBeTruthy();

    const textarea = screen.getByRole('textbox', { name: /paste source text/i });
    expect(textarea.getAttribute('maxLength')).toBe('200000');

    // Type text into textarea
    fireEvent.change(textarea, { target: { value: 'Rust memory safety and affine types' } });
    expect(screen.getByText('35 / 200,000')).toBeTruthy();

    // Clear button should be visible when text is present
    const clearBtn = screen.getByRole('button', { name: /clear source text/i });
    expect(clearBtn).toBeTruthy();

    // Click clear button
    fireEvent.click(clearBtn);
    expect((textarea as HTMLTextAreaElement).value).toBe('');
    expect(screen.getByText('0 / 200,000')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /clear source text/i })).toBeNull();
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

    // Wait for the alert banner to appear
    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeTruthy();
      expect(screen.getByText('Storage quota exceeded')).toBeTruthy();
    });

    // Dismiss error button
    const dismissBtn = screen.getByRole('button', { name: /dismiss error/i });
    expect(dismissBtn).toBeTruthy();

    fireEvent.click(dismissBtn);

    // Banner should be removed
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Storage quota exceeded')).toBeNull();
  });
});

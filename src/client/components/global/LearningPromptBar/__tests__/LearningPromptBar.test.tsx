// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'test-user-123' } }, status: 'authenticated' }),
}));

import { LearningPromptBar } from '../LearningPromptBar';
import { readIntakeDraft, saveIntakeDraft } from '@/src/client/screens/cohortBuilder/intake-draft';

describe('LearningPromptBar Component (Unit B)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    pushMock.mockReset();
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders one Add link button, no Plus trigger, and no raw-text tabs', () => {
    render(<LearningPromptBar />);

    expect(screen.getByRole('button', { name: /Add link/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add sources/i })).toBeNull();
    expect(screen.queryByLabelText(/Add sources/i)).toBeNull();
    expect(screen.getByRole('button', { name: /Upload reference material/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Plan/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Begin journey/i })).toBeTruthy();

    // Expand links
    fireEvent.click(screen.getByRole('button', { name: /Add link/i }));
    expect(screen.getByRole('region', { name: 'Attached links' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Paste raw text/i })).toBeNull();
  });

  it('toggling Plan mode on and off performs zero network fetches', () => {
    render(<LearningPromptBar />);
    const input = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(input, { target: { value: 'Distributed Systems Paxos' } });

    const planBtn = screen.getByRole('button', { name: /Plan/i });
    expect(planBtn.getAttribute('aria-pressed')).toBe('false');

    // Toggle on
    fireEvent.click(planBtn);
    expect(planBtn.getAttribute('aria-pressed')).toBe('true');
    expect(fetchMock).not.toHaveBeenCalled();

    // Toggle off
    fireEvent.click(planBtn);
    expect(planBtn.getAttribute('aria-pressed')).toBe('false');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('default primary submit sends search mode once, while primary after Plan sends plan mode once', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ workspaceId: 'ws-search-1' }),
    });

    const { unmount } = render(<LearningPromptBar />);
    const input = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(input, { target: { value: 'Learning Rust' } });

    // Submit with search
    fireEvent.click(screen.getByRole('button', { name: /Begin journey/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const searchCallBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(searchCallBody.mode).toBe('search');
    expect(searchCallBody.prompt).toBe('Learning Rust');

    unmount();
    fetchMock.mockClear();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ workspaceId: 'ws-plan-1' }),
    });

    render(<LearningPromptBar />);
    const input2 = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(input2, { target: { value: 'Learning Compilers' } });

    // Toggle plan mode
    fireEvent.click(screen.getByRole('button', { name: /Plan/i }));
    fireEvent.click(screen.getByRole('button', { name: /Start planning/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const planCallBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(planCallBody.mode).toBe('plan');
    expect(planCallBody.prompt).toBe('Learning Compilers');
  });

  it('prevents double synchronous submit before rerender', async () => {
    fetchMock.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({
      ok: true,
      json: async () => ({ workspaceId: 'ws-slow-1' }),
    }), 50)));

    render(<LearningPromptBar />);
    const input = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(input, { target: { value: 'Concurrent click test' } });

    const beginBtn = screen.getByRole('button', { name: /Begin journey/i });
    // Click twice synchronously
    fireEvent.click(beginBtn);
    fireEvent.click(beginBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it('Shift+Enter remains explicit plan submission', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ workspaceId: 'ws-shift-enter' }),
    });

    render(<LearningPromptBar />);
    const input = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(input, { target: { value: 'Keyboard Shortcut Plan' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.mode).toBe('plan');
    expect(callBody.prompt).toBe('Keyboard Shortcut Plan');
  });

  it('Enter inside link rows does not submit intake and close/reopen retains links', () => {
    render(<LearningPromptBar />);

    // Open links
    fireEvent.click(screen.getByRole('button', { name: /Add link/i }));
    const urlInput = screen.getByLabelText('Add link URL');
    fireEvent.change(urlInput, { target: { value: 'https://example.com/doc' } });
    fireEvent.keyDown(urlInput, { key: 'Enter' });

    // Intake fetch was NOT called
    expect(fetchMock).not.toHaveBeenCalled();

    // Link is added in DOM
    expect(screen.getByText('example.com/doc')).toBeTruthy();

    // Close links
    fireEvent.click(screen.getByLabelText('Close link input'));
    expect(screen.queryByRole('region', { name: 'Attached links' })).toBeNull();

    // Reopen links -> link remains attached
    fireEvent.click(screen.getByRole('button', { name: /Add link/i }));
    expect(screen.getByText('example.com/doc')).toBeTruthy();
  });

  it('timeout re-enables retry with identical requestId, while changing prompt changes requestId', async () => {
    // 1. Timeout attempt
    fetchMock.mockRejectedValueOnce(new DOMException('The operation timed out', 'TimeoutError'));

    render(<LearningPromptBar />);
    const input = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(input, { target: { value: 'Retry identity test' } });

    const beginBtn = screen.getByRole('button', { name: /Begin journey/i });
    fireEvent.click(beginBtn);

    await waitFor(() => {
      expect(screen.getByText('Could not confirm your request. Retry to continue.')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstReqId = JSON.parse(fetchMock.mock.calls[0][1].body).requestId;
    expect(firstReqId).toBeTruthy();

    // 2. Retry click with same prompt fails again or returns 500
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    fireEvent.click(beginBtn);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    const secondReqId = JSON.parse(fetchMock.mock.calls[1][1].body).requestId;
    expect(secondReqId).toBe(firstReqId);

    // 3. Change prompt -> requestId changes
    fireEvent.change(input, { target: { value: 'Brand new prompt inquiry' } });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ workspaceId: 'ws-new-prompt' }),
    });
    fireEvent.click(beginBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    const thirdReqId = JSON.parse(fetchMock.mock.calls[2][1].body).requestId;
    expect(thirdReqId).not.toBe(firstReqId);
  });

  it('renders legacy attached text with preview and remove button', () => {
    saveIntakeDraft(
      {
        requestId: '00000000-0000-4000-8000-000000000001',
        prompt: 'Legacy test',
        mode: 'search',
        source: { label: 'Pasted text', text: 'Old legacy notes about algorithms' },
      },
      'test-user-123'
    );

    render(<LearningPromptBar />);
    expect(screen.getByText('Previously attached text')).toBeTruthy();
    expect(screen.getByText('Old legacy notes about algorithms')).toBeTruthy();

    const removeBtn = screen.getByRole('button', { name: 'Remove previously attached text' });
    fireEvent.click(removeBtn);

    expect(screen.queryByText('Previously attached text')).toBeNull();
  });

  it('413 retains draft and displays friendly error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 413,
      json: async () => ({ code: 'INPUT_TOO_LARGE' }),
    });

    render(<LearningPromptBar />);
    const input = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(input, { target: { value: 'Large draft test' } });

    fireEvent.click(screen.getByRole('button', { name: /Begin journey/i }));

    await waitFor(() => {
      expect(screen.getByText(/exceeds the 3.5MB server limit/i)).toBeTruthy();
    });

    const draft = readIntakeDraft('test-user-123');
    expect(draft).not.toBeNull();
    expect(draft?.prompt).toBe('Large draft test');
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import ReactDOMServer from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';

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
    expect(readIntakeDraft('test-user-123')?.requestId).toBe(firstReqId);

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
    expect(readIntakeDraft('test-user-123')?.requestId).toBe(thirdReqId);
  });

  it('request identity matches storage across retries, remounts, and payload variations', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));
    const getIntakeCalls = () => fetchMock.mock.calls.filter((call) => call[0] === '/api/cohort-builder/intake');

    // 1. Initial submission
    const { unmount, rerender } = render(<LearningPromptBar />);
    const input = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(input, { target: { value: 'Identical payload goal' } });

    const beginBtn = screen.getByRole('button', { name: /Begin journey/i });
    fireEvent.click(beginBtn);

    await waitFor(() => {
      expect(getIntakeCalls()).toHaveLength(1);
    });
    const req1 = JSON.parse(getIntakeCalls()[0][1].body).requestId;
    expect(readIntakeDraft('test-user-123')?.requestId).toBe(req1);

    // 2. Rerender between retries
    rerender(<LearningPromptBar />);
    fireEvent.click(beginBtn);

    await waitFor(() => {
      expect(getIntakeCalls()).toHaveLength(2);
    });
    const req2 = JSON.parse(getIntakeCalls()[1][1].body).requestId;
    expect(req2).toBe(req1);
    expect(readIntakeDraft('test-user-123')?.requestId).toBe(req1);

    // 3. Unmount and remount identical draft
    unmount();
    const { unmount: unmount2 } = render(<LearningPromptBar />);
    await waitFor(() => {
      const el = screen.getByLabelText('What do you want to learn about?') as HTMLTextAreaElement;
      expect(el.value).toBe('Identical payload goal');
    });
    fireEvent.click(screen.getByRole('button', { name: /Begin journey/i }));

    await waitFor(() => {
      expect(getIntakeCalls()).toHaveLength(3);
    });
    const req3 = JSON.parse(getIntakeCalls()[2][1].body).requestId;
    expect(req3).toBe(req1);
    expect(readIntakeDraft('test-user-123')?.requestId).toBe(req1);

    // 4. Same prompt but changed mode -> new requestId
    fireEvent.click(screen.getByRole('button', { name: /^Plan$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Start planning/i }));

    await waitFor(() => {
      expect(getIntakeCalls()).toHaveLength(4);
    });
    const req4 = JSON.parse(getIntakeCalls()[3][1].body).requestId;
    expect(req4).not.toBe(req1);
    expect(readIntakeDraft('test-user-123')?.requestId).toBe(req4);

    // 5. Change prompt text on mounted input -> new requestId
    const mountedInput = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(mountedInput, { target: { value: 'A completely different learning direction' } });
    fireEvent.click(screen.getByRole('button', { name: /Start planning/i }));
    await waitFor(() => {
      expect(getIntakeCalls()).toHaveLength(5);
    });
    const req5 = JSON.parse(getIntakeCalls()[4][1].body).requestId;
    expect(req5).not.toBe(req4);
    expect(readIntakeDraft('test-user-123')?.requestId).toBe(req5);

    unmount2();
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

  it('restores ready source in StrictMode and preserves user removal across rerenders', async () => {
    saveIntakeDraft({
      requestId: '00000000-0000-4000-8000-000000000002',
      prompt: 'Persisted StrictMode Goal',
      mode: 'plan',
      sources: [{
        id: 'persisted-link-1',
        version: 1,
        label: 'https://example.com/strict',
        text: 'Strict mode guide text',
        locations: [{ start: 0, end: 23 }],
        checksum: 'a'.repeat(64),
        state: 'ready',
      }],
    }, 'test-user-123');

    const { rerender } = render(
      <React.StrictMode>
        <LearningPromptBar />
      </React.StrictMode>
    );

    // Initial post-hydration restore displays link and plan button
    await waitFor(() => {
      expect(screen.getByText('example.com/strict')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /^Plan$/i }).getAttribute('aria-pressed')).toBe('true');

    // Type into prompt
    const input = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(input, { target: { value: 'User edited prompt' } });

    // Toggle Plan off
    fireEvent.click(screen.getByRole('button', { name: /^Plan$/i }));
    expect(screen.getByRole('button', { name: /^Plan$/i }).getAttribute('aria-pressed')).toBe('false');

    // Rerender with same props
    rerender(
      <React.StrictMode>
        <LearningPromptBar />
      </React.StrictMode>
    );
    expect((input as HTMLTextAreaElement).value).toBe('User edited prompt');
    expect(screen.getByRole('button', { name: /^Plan$/i }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('example.com/strict')).toBeTruthy();

    // Remove source and rerender
    const removeBtn = screen.getByLabelText(/Remove link/i);
    fireEvent.click(removeBtn);
    expect(screen.queryByText('example.com/strict')).toBeNull();

    rerender(
      <React.StrictMode>
        <LearningPromptBar />
      </React.StrictMode>
    );
    expect(screen.queryByText('example.com/strict')).toBeNull();
  });

  it('controlled value remains parent-owned without firing onChange on mount', async () => {
    saveIntakeDraft({
      requestId: '00000000-0000-4000-8000-000000000003',
      prompt: 'Draft stored prompt',
      mode: 'search',
    }, 'test-user-123');

    const onChange = vi.fn();
    render(<LearningPromptBar value="Controlled Prompt Value" onChange={onChange} />);

    await waitFor(() => {
      const input = screen.getByLabelText('What do you want to learn about?');
      expect((input as HTMLTextAreaElement).value).toBe('Controlled Prompt Value');
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('survives throwing storage without crashing and renders usable empty composer', () => {
    const originalGetItem = window.sessionStorage.getItem;
    window.sessionStorage.getItem = () => { throw new Error('Storage disabled'); };

    try {
      render(<LearningPromptBar />);
      expect(screen.getByLabelText('What do you want to learn about?')).toBeTruthy();
      expect(screen.getByRole('button', { name: /Begin journey/i })).toBeTruthy();
    } finally {
      window.sessionStorage.getItem = originalGetItem;
    }
  });

  it('hydrates server-rendered HTML cleanly without mismatch errors when client storage has draft', async () => {
    // 1. Obtain server HTML before seeding browser storage
    const serverHtml = ReactDOMServer.renderToString(<LearningPromptBar />);

    // 2. Seed draft in browser storage
    saveIntakeDraft({
      requestId: '00000000-0000-4000-8000-000000000004',
      prompt: 'Hydration goal from storage',
      mode: 'plan',
      source: { label: 'Pasted text', text: 'Hydration legacy text' },
      sources: [{
        id: 'hydrate-src-1',
        version: 1,
        label: 'https://example.com/hydrate',
        text: 'Hydrate source text',
        locations: [{ start: 0, end: 19 }],
        checksum: 'b'.repeat(64),
        state: 'ready',
      }],
    }, 'test-user-123');

    const recoverableErrors: unknown[] = [];
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      const msg = args.join(' ');
      if (msg.includes('Hydration') || msg.includes('hydrat')) {
        recoverableErrors.push(msg);
      }
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    container.innerHTML = serverHtml;

    let root: ReturnType<typeof hydrateRoot> | null = null;
    await act(async () => {
      root = hydrateRoot(container, <LearningPromptBar />, {
        onRecoverableError: (err) => {
          recoverableErrors.push(err);
        },
      });
    });

    try {
      // Must have zero hydration errors
      expect(recoverableErrors).toHaveLength(0);

      // Post-hydration effect populates restored UI
      await waitFor(() => {
        expect(screen.getByText('Hydration legacy text')).toBeTruthy();
      });
      expect(screen.getByText('example.com/hydrate')).toBeTruthy();
      expect(screen.getByRole('button', { name: /^Plan$/i }).getAttribute('aria-pressed')).toBe('true');
    } finally {
      consoleErrorSpy.mockRestore();
      if (root) {
        await act(async () => {
          root?.unmount();
        });
      }
      container.remove();
    }
  });
});

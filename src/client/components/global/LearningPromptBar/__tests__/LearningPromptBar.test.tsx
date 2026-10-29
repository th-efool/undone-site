// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { LearningPromptBar } from '../LearningPromptBar';
import { readIntakeDraft, saveIntakeDraft } from '@/src/client/screens/cohortBuilder/intake-draft';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe('LearningPromptBar Component', () => {
  it('renders input, Add sources, Upload, Plan, and Begin journey buttons', () => {
    render(<LearningPromptBar />);

    expect(screen.getByLabelText('What do you want to learn about?')).toBeDefined();
    expect(screen.getAllByRole('button', { name: /Add sources/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Upload reference material/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Plan/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Begin journey/i })).toBeDefined();
  });

  it('clicking Plan saves intake draft with mode: plan', () => {
    render(<LearningPromptBar />);

    const input = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(input, { target: { value: 'Distributed Consensus with Paxos' } });

    const planBtn = screen.getByRole('button', { name: /Plan/i });
    fireEvent.click(planBtn);

    const draft = readIntakeDraft();
    expect(draft).not.toBeNull();
    expect(draft?.prompt).toBe('Distributed Consensus with Paxos');
    expect(draft?.mode).toBe('plan');
  });

  it('clicking Begin journey saves intake draft with mode: search', () => {
    render(<LearningPromptBar />);

    const input = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(input, { target: { value: 'Machine Learning Deep Dive' } });

    const beginBtn = screen.getByRole('button', { name: /Begin journey/i });
    fireEvent.click(beginBtn);

    const draft = readIntakeDraft();
    expect(draft).not.toBeNull();
    expect(draft?.prompt).toBe('Machine Learning Deep Dive');
    expect(draft?.mode).toBe('search');
  });

  it('toggles sources drawer with Add links and Paste raw text tabs', () => {
    render(<LearningPromptBar />);

    expect(screen.queryByRole('region', { name: /Reference material drawer/i })).toBeNull();

    const addSourcesBtns = screen.getAllByRole('button', { name: /Add sources/i });
    fireEvent.click(addSourcesBtns[0]);

    expect(screen.getByRole('region', { name: /Reference material drawer/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Add links/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Paste raw text/i })).toBeDefined();

    // Switch to raw text tab
    fireEvent.click(screen.getByRole('button', { name: /Paste raw text/i }));
    expect(screen.getByLabelText('Paste source text')).toBeDefined();

    // Switch back to links tab
    fireEvent.click(screen.getByRole('button', { name: /Add links/i }));
    expect(screen.getByTestId('link-rows-container')).toBeDefined();
  });

  it('Shift+Enter submits in plan mode', () => {
    render(<LearningPromptBar />);

    const input = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(input, { target: { value: 'Keyboard Plan Shortcut Test' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    const draft = readIntakeDraft();
    expect(draft).not.toBeNull();
    expect(draft?.prompt).toBe('Keyboard Plan Shortcut Test');
    expect(draft?.mode).toBe('plan');
  });

  it('restores sources from intake draft on mount', () => {
    saveIntakeDraft(
      {
        requestId: '54103d7b-2709-4dd6-bb18-522f96b97241',
        prompt: 'Distributed Systems',
        mode: 'plan',
        sources: [
          {
            id: 's1',
            version: 1,
            label: 'Paxos_Overview.pdf',
            text: 'Paxos algorithm consensus details...',
            checksum: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            state: 'ready',
          },
        ],
      },
      null
    );

    render(<LearningPromptBar />);

    expect(screen.getByLabelText('What do you want to learn about?')).toBeDefined();
    expect(screen.getByText('Paxos_Overview.pdf')).toBeDefined();
  });
});

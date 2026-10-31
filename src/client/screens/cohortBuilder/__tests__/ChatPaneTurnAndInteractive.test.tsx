// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';

const fakeState = vi.hoisted(() => ({
  send: vi.fn(),
  view: null as CohortWorkspace | null,
  messages: [] as Array<{
    id: string;
    role: 'user' | 'assistant';
    parts: Array<
      | { type: 'text'; text: string }
      | { type: 'entity_ref'; label?: string; entity: { kind: string; id: string; version: number } }
    >;
  }>,
  turns: [] as Array<{ messageId: string; runId: string | null; status: string }>,
}));

vi.mock('@/src/client/interaction/hooks', () => ({
  useWorkspaceMessages: () => fakeState.messages,
  useSendMessage: () => fakeState.send,
  useInteractionState: () => ({ workspaceId: 'ws-test', view: fakeState.view, pending: {} }),
  useDispatchAction: () => vi.fn().mockResolvedValue(true),
}));

vi.mock('../useAssistantActivity', () => ({
  useAssistantActivity: () => ({ turns: fakeState.turns }),
}));

vi.mock('@/src/client/hooks/useTheme', () => ({
  useTheme: () => ({ isDark: false }),
}));

import { ChatPane } from '../ChatPane';
import { CurriculumStageView } from '../stages/CurriculumStageView';
import { planningSuggestions, stageSuggestions } from '../chat-suggestions';

describe('planningSuggestions pure helper', () => {
  it('handles empty goal with choose goal and assess background', () => {
    const suggestions = planningSuggestions({ asksAboutBackground: false });
    expect(suggestions.map(s => s.label)).toEqual(['Choose a goal', 'Assess my background', 'Set my pace']);
    expect(suggestions[0].prompt).toBe('Help me choose a learning goal');
    expect(suggestions[2].prompt).toBe('Help me choose a realistic daily study pace. Ask about my available time first.');
  });

  it('handles existing lesson title with refine objectives', () => {
    const suggestions = planningSuggestions({
      goal: 'TypeScript',
      firstLessonTitle: 'Type Basics',
      asksAboutBackground: false,
    });
    expect(suggestions[0]).toEqual({
      id: 'objectives',
      label: 'Refine objectives',
      prompt: 'Refine the objectives for Type Basics',
    });
  });

  it('adapts when assistant asks about background', () => {
    const suggestions = planningSuggestions({
      goal: 'Distributed Systems',
      asksAboutBackground: true,
    });
    expect(suggestions[1]).toEqual({
      id: 'background',
      label: 'Assess my background',
      prompt: 'Help me assess my current background for Distributed Systems',
    });
  });
});

describe('ChatPane & Interactive Linking (ISSUE-24)', () => {
  afterEach(() => {
    cleanup();
    fakeState.view = null;
    fakeState.messages = [];
    fakeState.turns = [];
    vi.restoreAllMocks();
  });

  const baseWorkspace: CohortWorkspace = cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Distributed Systems',
    intent: 'Master distributed consensus',
    audience: 'Software Engineers',
    dailyMinutes: 25,
    lessons: [
      {
        id: 'lesson-1',
        version: 0,
        title: 'Paxos & Consensus Basics',
        objective: 'Understand single-decree Paxos',
        sourceChunkIds: [],
        pinned: false,
      },
      {
        id: 'lesson-2',
        version: 0,
        title: 'Raft Leader Election',
        objective: 'Understand terms and elections',
        sourceChunkIds: [],
        pinned: false,
      },
    ],
  });

  it('renders short suggestion labels and sends contextual goal-aware payloads on click', () => {
    fakeState.view = { ...baseWorkspace, lessons: [], journey: { version: 1, step: 'chat', branch: null, processingStarted: false, intentVersion: 0 } };
    render(<ChatPane attachedEntity={null} onClearAttachedEntity={() => {}} />);
    expect(screen.queryByText('Undone')).toBeNull();
    expect(screen.queryByText('Conversational Planning')).toBeNull();

    const group = screen.getByRole('group', { name: 'Suggested next steps' });
    expect(group).toBeTruthy();
    const buttons = screen.getAllByRole('button').filter(b => b.parentElement === group);
    expect(buttons.length).toBeLessThanOrEqual(3);
    expect(screen.getByRole('button', { name: 'Draft a syllabus' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add projects' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Set my pace' })).toBeTruthy();

    expect(screen.queryByText('Draft a deep-dive syllabus for Master distributed consensus')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Add projects' }));
    expect(fakeState.send).toHaveBeenCalledWith('Add hands-on projects for Master distributed consensus', expect.anything());

    const textarea = screen.getByRole('textbox', { name: 'Message the cohort assistant' });
    expect(group.compareDocumentPosition(textarea) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('adapts planning suggestions to short labels and hides while turn is active', () => {
    fakeState.view = { ...baseWorkspace, journey: { version: 1, step: 'review', branch: null, processingStarted: false, intentVersion: 0 } };
    fakeState.messages = [{ id: 'background-question', role: 'assistant', parts: [{ type: 'text', text: 'What is your background in distributed systems?' }] }];
    const { rerender } = render(<ChatPane attachedEntity={null} onClearAttachedEntity={() => {}} />);

    expect(screen.getByRole('button', { name: 'Refine objectives' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Assess my background' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Set my pace' })).toBeTruthy();

    fakeState.turns = [{ messageId: 'm1', runId: 'r1', status: 'running' }];
    rerender(<ChatPane attachedEntity={null} onClearAttachedEntity={() => {}} />);
    expect(screen.queryByRole('group', { name: 'Suggested next steps' })).toBeNull();

    fakeState.turns = [];
    fakeState.messages = [
      { id: 'background-question', role: 'assistant', parts: [{ type: 'text', text: 'What is your background?' }] },
      { id: 'user-ans', role: 'user', parts: [{ type: 'text', text: 'I am a beginner' }] },
    ];
    rerender(<ChatPane attachedEntity={null} onClearAttachedEntity={() => {}} />);
    expect(screen.queryByRole('group', { name: 'Suggested next steps' })).toBeNull();

    fakeState.messages.push({
      id: 'assistant-reply',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Understood. We will start from basics.' }],
    });
    rerender(<ChatPane attachedEntity={null} onClearAttachedEntity={() => {}} />);
    expect(screen.getByRole('group', { name: 'Suggested next steps' })).toBeTruthy();
  });

  it('omits routine saved status footer across connection values and uses undone mark for assistant avatar', () => {
    fakeState.view = baseWorkspace;
    fakeState.messages = [
      { id: 'msg-asst', role: 'assistant', parts: [{ type: 'text', text: 'Hello! I am ready.' }] },
    ];

    const { rerender } = render(<ChatPane attachedEntity={null} onClearAttachedEntity={() => {}} connection="live" />);
    expect(screen.queryByText(/Saved to your account/i)).toBeNull();
    expect(screen.queryByText(/Saving…/i)).toBeNull();
    expect(screen.queryByText(/Last saved state/i)).toBeNull();

    rerender(<ChatPane attachedEntity={null} onClearAttachedEntity={() => {}} connection="offline" />);
    expect(screen.queryByText(/Last saved state/i)).toBeNull();

    const images = document.querySelectorAll('img[src="/undone-logo.svg"]');
    expect(images.length).toBeGreaterThan(0);
  });

  it('renders assistant markdown content with headings, lists, and formatted code blocks', async () => {
    fakeState.view = baseWorkspace;
    fakeState.messages = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: '### Key Principles\nHere are the tenets:\n- Safety over liveness\n- Quorum overlap\n\nRun `init_raft()` to begin.',
          },
        ],
      },
    ];

    render(<ChatPane attachedEntity={null} onClearAttachedEntity={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Key Principles').tagName).toBe('H4');
    }, { timeout: 4000 });
    expect(screen.getByText('Safety over liveness').tagName).toBe('LI');
    expect(screen.getByText('Quorum overlap').tagName).toBe('LI');
    expect(screen.getByText('init_raft()').tagName).toBe('CODE');
  });

  it('dispatches cohort:highlight-entity event and scrolls to element on entity chip click', () => {
    fakeState.view = baseWorkspace;
    fakeState.messages = [
      {
        id: 'msg-2',
        role: 'assistant',
        parts: [
          {
            type: 'entity_ref',
            label: 'Paxos & Consensus Basics',
            entity: { kind: 'lesson', id: 'lesson-1', version: 0 },
          },
        ],
      },
    ];

    const targetEl = document.createElement('div');
    targetEl.id = 'lesson-1';
    targetEl.scrollIntoView = vi.fn();
    targetEl.focus = vi.fn();
    document.body.appendChild(targetEl);

    const listener = vi.fn();
    window.addEventListener('cohort:highlight-entity', listener);

    render(<ChatPane attachedEntity={null} onClearAttachedEntity={() => {}} />);

    const chip = screen.getByRole('button', { name: /Lesson: Paxos & Consensus Basics/i });
    fireEvent.click(chip);

    expect(listener).toHaveBeenCalledTimes(1);
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.entityId).toBe('lesson-1');
    expect(detail.targetId).toBe('lesson-1');
    expect(targetEl.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(targetEl.focus).toHaveBeenCalled();

    window.removeEventListener('cohort:highlight-entity', listener);
    document.body.removeChild(targetEl);
  });

  it('renders polished thinking indicator when assistant turn is running or queued', () => {
    fakeState.view = baseWorkspace;
    fakeState.turns = [{ messageId: 'msg-turn', runId: 'run-1', status: 'running' }];

    const { rerender } = render(<ChatPane attachedEntity={null} onClearAttachedEntity={() => {}} />);

    expect(screen.getByText('Thinking…')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Stop assistant turn/i })).toBeTruthy();
    const images = document.querySelectorAll('img[src="/undone-logo.svg"]');
    expect(images.length).toBeGreaterThan(0);

    fakeState.turns = [{ messageId: 'msg-turn', runId: 'run-1', status: 'queued' }];
    rerender(<ChatPane attachedEntity={null} onClearAttachedEntity={() => {}} />);

    expect(screen.getByText('Thinking…')).toBeTruthy();
  });

  it('switches CurriculumStageView to questline tab and focuses lesson on cohort:highlight-entity', async () => {
    const dispatchAction = vi.fn().mockResolvedValue(true);
    render(
      <CurriculumStageView
        workspace={baseWorkspace}
        dispatchAction={dispatchAction}
        onSelectLessonForChat={() => {}}
      />
    );

    // Initial tab is overview
    expect(screen.getByRole('button', { name: 'Overview' }).getAttribute('aria-current')).toBe('page');

    // Dispatch highlight event inside act
    act(() => {
      window.dispatchEvent(
        new CustomEvent('cohort:highlight-entity', {
          detail: { entityId: 'lesson-1', targetId: 'lesson-1', kind: 'lesson' },
        })
      );
    });

    // Tab should automatically switch to questline
    expect(screen.getByRole('button', { name: 'Questline' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('Paxos & Consensus Basics')).toBeTruthy();
  });
});

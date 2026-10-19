// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ send: vi.fn(), view: null as import('@/src/shared/cohort-builder/contracts').CohortWorkspace | null }));
vi.mock('@/src/client/interaction/hooks', () => ({
  useWorkspaceMessages: () => [], useSendMessage: () => fake.send,
  useInteractionState: () => ({ workspaceId: 'workspace', view: fake.view, pending: {} }),
}));
vi.mock('../useAssistantActivity', () => ({ useAssistantActivity: () => ({ turns: [] }) }));
vi.mock('@/src/client/hooks/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
import { ChatPane } from '../ChatPane';
import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';
afterEach(() => { cleanup(); fake.view = null; });
it('renders the four saved processing stages in the chat rail', () => {
  fake.view = cohortWorkspaceSchema.parse({ schemaVersion: 1, title: 'Systems', intent: 'Learn systems', audience: 'Engineers', dailyMinutes: 20, lessons: [],
    sources: [{ id: 's', version: 0, label: 'Notes', text: 'Quorums overlap.', checksum: null, state: 'processing' }],
    journey: { version: 1, step: 'processing', branch: 'have_material', processingStarted: true, intentVersion: 0 },
    processing: { status: 'processing', stage: 'chunking', generation: 1, sourceFingerprint: null, error: null } });
  render(<ChatPane attachedEntity={null} onClearAttachedEntity={() => {}} />);
  expect(screen.getByRole('list', { name: 'Saved processing stages' }).children).toHaveLength(4);
  expect(screen.getByText('Chunking it into meaningful pieces')).toBeTruthy();
});
it('keeps chat writable during acknowledgement and preserves newly typed text', async () => {
  let acknowledge!: (value: boolean) => void;
  fake.send.mockImplementation(() => new Promise(resolve => { acknowledge = resolve; }));
  render(<ChatPane attachedEntity={null} onClearAttachedEntity={() => {}} />);
  const composer = screen.getByLabelText('Message the cohort assistant') as HTMLTextAreaElement;
  fireEvent.change(composer, { target: { value: 'First message' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  expect(composer.disabled).toBe(false);
  fireEvent.change(composer, { target: { value: 'My next thought' } });
  await act(async () => acknowledge(true));
  expect(composer.value).toBe('My next thought');
  expect(fake.send).toHaveBeenCalledWith('First message', []);
});

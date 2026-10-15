// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@/src/client/interaction/hooks', () => ({
  useWorkspaceMessages: () => [], useSendMessage: () => fake.send,
  useInteractionState: () => ({ workspaceId: 'workspace', view: null, pending: {} }),
}));
vi.mock('../useAssistantActivity', () => ({ useAssistantActivity: () => ({ turns: [] }) }));
vi.mock('@/src/client/hooks/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
import { ChatPane } from '../ChatPane';
afterEach(cleanup);
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

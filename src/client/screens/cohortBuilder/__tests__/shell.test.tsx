// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';
const fake = vi.hoisted(() => ({ view: null as any, connects: 0 }));
vi.mock('../useAssistantActivity', () => ({ useAssistantActivity: () => ({ turns: [], unavailable: false }) }));
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: 'authenticated', data: { user: { id: 'owner' } } }) }));
vi.mock('@/src/client/interaction/provider', () => ({ InteractionProvider: ({ children }: any) => { fake.connects++; return children; } }));
vi.mock('@/src/client/interaction/hooks', () => ({
  useWorkspaceConnection: () => 'live', useInteractionState: () => ({ view: fake.view, revision: 0, pending: {} }),
  useWorkspaceMessages: () => [], useSendMessage: () => async () => true,
  useWorkspaceView: () => fake.view, useDispatchAction: () => async () => true,
}));
import { CohortInteractionScreen } from '../CohortInteractionScreen';
import { BuilderDialog } from '../BuilderDialog';
afterEach(cleanup);
it('keeps composer and source inputs mounted through pane switches and canonical updates', () => {
  fake.view = cohortWorkspaceSchema.parse({ schemaVersion: 1, title: 'Test', intent: 'Learn', audience: '', dailyMinutes: 20, lessons: [] });
  const props = { workspaceId: 'workspace', ownerId: 'owner', initialView: fake.view };
  const result = render(<CohortInteractionScreen {...props} />);
  const composer = screen.getByLabelText('Message the cohort assistant');
  const source = screen.getByLabelText('Paste text to retain and ground this curriculum');
  fireEvent.change(composer, { target: { value: 'Keep this draft' } });
  fireEvent.change(source, { target: { value: 'Retained local writing' } });
  fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
  fireEvent.click(screen.getByRole('button', { name: 'Workspace' }));
  fake.view = { ...fake.view, title: 'Saved title' }; result.rerender(<CohortInteractionScreen {...props} />);
  expect((composer as HTMLTextAreaElement).value).toBe('Keep this draft');
  expect((source as HTMLTextAreaElement).value).toBe('Retained local writing');
  expect(screen.getByLabelText('Message the cohort assistant')).toBe(composer);
});
it('traps dialog keyboard focus and restores invoking control', () => {
  const invoking = document.createElement('button'); document.body.append(invoking); invoking.focus();
  const close = vi.fn(); const result = render(<BuilderDialog label="Edit" onClose={close}><input aria-label="Value" /><button>Save</button></BuilderDialog>);
  expect(document.activeElement).toBe(screen.getByLabelText('Value'));
  screen.getByRole('button', { name: 'Save' }).focus();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
  expect(document.activeElement).toBe(screen.getByLabelText('Value'));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }); expect(close).toHaveBeenCalledOnce();
  result.unmount(); expect(document.activeElement).toBe(invoking); invoking.remove();
});

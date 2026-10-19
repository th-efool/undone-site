// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';
const fake = vi.hoisted(() => ({ view: null as any, connects: 0, messages: [] as any[] }));
vi.mock('../useAssistantActivity', () => ({ useAssistantActivity: () => ({ turns: [], unavailable: false }) }));
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: 'authenticated', data: { user: { id: 'owner' } } }) }));
vi.mock('@/src/client/interaction/provider', () => ({ InteractionProvider: ({ children }: any) => { fake.connects++; return children; } }));
vi.mock('@/src/client/interaction/hooks', () => ({
  useWorkspaceConnection: () => 'live', useInteractionState: () => ({ view: fake.view, revision: 0, pending: {} }),
  useWorkspaceMessages: () => fake.messages ?? [], useSendMessage: () => async () => true,
  useWorkspaceView: () => fake.view, useDispatchAction: () => async () => true,
}));
import { CohortInteractionScreen } from '../CohortInteractionScreen';
import { BuilderDialog } from '../BuilderDialog';
import { getStageProgressDetails } from '../stage-selectors';
afterEach(cleanup);
it('opens the earliest unfinished stage when persisted jobs arrive out of order', () => {
  const job = (stage: string) => ({ id: stage, sourceId: stage === 'assembly' ? null : 'source', stage,
    status: 'queued', attempts: 0, error: null, retryable: false });
  fake.view = cohortWorkspaceSchema.parse({ schemaVersion: 1, title: 'Test', intent: 'Learn', audience: '', dailyMinutes: 20,
    lessons: [], sources: [{ id: 'source', version: 0, label: 'Notes', text: 'Quorums overlap.', checksum: null, state: 'processing' }],
    processing: { status: 'queued', stage: 'acquisition', generation: 1, sourceFingerprint: null, error: null,
      jobs: [job('analysis'), job('acquisition'), job('assembly'), job('chunking'), job('understanding')] } });
  render(<CohortInteractionScreen workspaceId="workspace" ownerId="owner" initialView={fake.view} />);
  expect(screen.getByRole('region', { name: 'Understanding material' })).toBeTruthy();
  expect(getStageProgressDetails(fake.view).analysis.status).toBe('pending');
  expect(getStageProgressDetails(fake.view).assembly.status).toBe('pending');
});
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

it('permits mobile pane switching both ways repeatedly without trapping the user', () => {
  fake.view = cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Distributed Systems',
    intent: 'Learn Paxos',
    audience: 'Engineers',
    dailyMinutes: 20,
    lessons: [
      { id: 'lesson-1', version: 0, title: 'Consensus Basics', objective: 'Explain consensus', sourceChunkIds: [], pinned: false },
    ],
  });
  const props = { workspaceId: 'ws-mobile', ownerId: 'owner', initialView: fake.view };
  render(<CohortInteractionScreen {...props} />);

  const main = document.getElementById('main-content')!;
  const chatBtn = screen.getByRole('button', { name: 'Chat' });
  const workspaceBtn = screen.getByRole('button', { name: 'Workspace' });

  // Initial state is workspace
  expect(main.getAttribute('data-pane')).toBe('workspace');
  expect(workspaceBtn.getAttribute('aria-pressed')).toBe('true');
  expect(chatBtn.getAttribute('aria-pressed')).toBe('false');

  // Switch to chat
  fireEvent.click(chatBtn);
  expect(main.getAttribute('data-pane')).toBe('chat');
  expect(chatBtn.getAttribute('aria-pressed')).toBe('true');
  expect(workspaceBtn.getAttribute('aria-pressed')).toBe('false');

  // Switch back to workspace
  fireEvent.click(workspaceBtn);
  expect(main.getAttribute('data-pane')).toBe('workspace');
  expect(workspaceBtn.getAttribute('aria-pressed')).toBe('true');
  expect(chatBtn.getAttribute('aria-pressed')).toBe('false');

  // Repeat back and forth
  fireEvent.click(chatBtn);
  expect(main.getAttribute('data-pane')).toBe('chat');
  fireEvent.click(workspaceBtn);
  expect(main.getAttribute('data-pane')).toBe('workspace');
  fireEvent.click(chatBtn);
  expect(main.getAttribute('data-pane')).toBe('chat');
  fireEvent.click(workspaceBtn);
  expect(main.getAttribute('data-pane')).toBe('workspace');
});

it('switches to chat when selecting a lesson for chat and allows returning to workspace with retained drafts', () => {
  fake.view = cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Distributed Systems',
    intent: 'Learn Paxos',
    audience: 'Engineers',
    dailyMinutes: 20,
    lessons: [
      { id: 'lesson-1', version: 0, title: 'Consensus Basics', objective: 'Explain consensus', sourceChunkIds: [], pinned: false },
    ],
  });
  const props = { workspaceId: 'ws-mobile', ownerId: 'owner', initialView: fake.view };
  render(<CohortInteractionScreen {...props} />);

  const main = document.getElementById('main-content')!;
  const composer = screen.getByLabelText('Message the cohort assistant');

  fireEvent.change(composer, { target: { value: 'Unsent question about consensus' } });

  // Switch to Questline tab where lessons are displayed
  fireEvent.click(screen.getByRole('button', { name: 'Questline' }));

  // Select lesson for chat
  const discussBtn = screen.getByRole('button', { name: /Discuss in chat/i });
  fireEvent.click(discussBtn);

  // Verifies navigation switched to chat
  expect(main.getAttribute('data-pane')).toBe('chat');
  expect(screen.getAllByText(/Consensus Basics/).length).toBeGreaterThanOrEqual(1);
  expect((composer as HTMLTextAreaElement).value).toBe('Unsent question about consensus');

  // Return to workspace using the persistent navigation
  const workspaceBtn = screen.getByRole('button', { name: 'Workspace' });
  fireEvent.click(workspaceBtn);

  expect(main.getAttribute('data-pane')).toBe('workspace');
  expect((composer as HTMLTextAreaElement).value).toBe('Unsent question about consensus');
});

it('mobile navigation: persistent paneNavigation is present outside canvas, switches data-pane, and maintains composer and mounted state', () => {
  fake.view = cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Mobile Shell Test',
    intent: 'Learn',
    audience: 'Everyone',
    dailyMinutes: 15,
    lessons: [],
  });
  const props = { workspaceId: 'ws-mobile-nav', ownerId: 'owner', initialView: fake.view };
  render(<CohortInteractionScreen {...props} />);

  const main = document.getElementById('main-content')!;
  const nav = screen.getByRole('navigation', { name: 'Builder views' });
  expect(nav).toBeDefined();

  const chatBtn = screen.getByRole('button', { name: 'Chat' });
  const workspaceBtn = screen.getByRole('button', { name: 'Workspace' });
  const composer = screen.getByLabelText('Message the cohort assistant');
  const source = screen.getByLabelText('Paste text to retain and ground this curriculum');

  // Type in composer and source drafts
  fireEvent.change(composer, { target: { value: 'Draft while navigating' } });
  fireEvent.change(source, { target: { value: 'Source draft' } });

  // Switch to chat view (as on mobile data-pane='chat')
  fireEvent.click(chatBtn);
  expect(main.getAttribute('data-pane')).toBe('chat');
  expect(chatBtn.getAttribute('aria-pressed')).toBe('true');
  expect(workspaceBtn.getAttribute('aria-pressed')).toBe('false');

  // Verify paneNavigation is still present and not hidden inside canvas
  expect(screen.getByRole('navigation', { name: 'Builder views' })).toBe(nav);

  // Click Workspace to switch back
  fireEvent.click(workspaceBtn);
  expect(main.getAttribute('data-pane')).toBe('workspace');
  expect(workspaceBtn.getAttribute('aria-pressed')).toBe('true');
  expect(chatBtn.getAttribute('aria-pressed')).toBe('false');

  // Click Chat again to switch back
  fireEvent.click(chatBtn);
  expect(main.getAttribute('data-pane')).toBe('chat');

  // Verify composer and source remain mounted with preserved values
  expect((composer as HTMLTextAreaElement).value).toBe('Draft while navigating');
  expect((source as HTMLTextAreaElement).value).toBe('Source draft');
  expect(screen.getByLabelText('Message the cohort assistant')).toBe(composer);
  expect(screen.getByLabelText('Paste text to retain and ground this curriculum')).toBe(source);
});

it('toolbar and entity reference layout: canvasHeader provides reserved layout space and entity chips are compact buttons', () => {
  fake.view = cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Toolbar Layout Test',
    intent: 'Learn layout',
    audience: 'Everyone',
    dailyMinutes: 15,
    lessons: [
      {
        id: 'lesson-alpha',
        version: 1,
        title: 'Very Long Comprehensive Lesson Title About Distributed System Quorums',
        objective: 'Test objective',
        sourceChunkIds: [],
        pinned: false,
      },
    ],
  });
  fake.messages = [
    {
      id: 'm-1',
      role: 'user',
      parts: [
        { type: 'text', text: 'Refine this objective.' },
        {
          type: 'entity_ref',
          entity: { kind: 'lesson', id: 'lesson-alpha', version: 1 },
          label: 'Very Long Comprehensive Lesson Title About Distributed System Quorums',
        },
      ],
      createdAt: new Date().toISOString(),
    },
  ];
  const props = { workspaceId: 'ws-layout-test', ownerId: 'owner', initialView: fake.view };
  render(<CohortInteractionScreen {...props} />);

  // 1. Reserved toolbar header exists outside workspace content
  const toolbarHeader = screen.getByRole('banner', { name: 'Workspace toolbar' });
  expect(toolbarHeader).toBeDefined();
  expect(toolbarHeader.textContent).toContain('Rev #');

  // 2. Entity reference chip is a button with title, aria-label, stable IDs, and icon
  const chipButton = screen.getByRole('button', {
    name: 'Lesson: Very Long Comprehensive Lesson Title About Distributed System Quorums',
  });
  expect(chipButton).toBeDefined();
  expect(chipButton.getAttribute('data-entity-id')).toBe('lesson-alpha');
  expect(chipButton.getAttribute('data-entity-version')).toBe('1');
  expect(chipButton.getAttribute('title')).toBe(
    'Lesson: Very Long Comprehensive Lesson Title About Distributed System Quorums'
  );
  expect(chipButton.querySelector('svg')).toBeDefined();
});


// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';
import { clearAllDraftsForTesting, CohortDraftProvider } from '../draft-context';

const fake = vi.hoisted(() => ({
  state: null as any,
  actions: [] as any[],
  succeeds: true,
  resolveDispatch: null as null | ((val: boolean) => void),
  deferred: false,
  messages: [] as any[],
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'owner' } }, status: 'authenticated' }),
}));

vi.mock('../useAssistantActivity', () => ({
  useAssistantActivity: () => ({ turns: [], unavailable: false }),
}));

vi.mock('@/src/client/interaction/provider', () => ({
  InteractionProvider: ({ children }: any) => children,
}));

vi.mock('@/src/client/interaction/hooks', () => ({
  useWorkspaceConnection: () => 'live',
  useInteractionState: () => ({ workspaceId: 'ws-test', revision: 0, view: fake.state, pending: {} }),
  useWorkspaceView: () => fake.state,
  useWorkspaceMessages: () => fake.messages ?? [],
  useSendMessage: () => async () => true,
  useDispatchAction: () => async (action: any) => {
    fake.actions.push(action);
    if (fake.deferred) {
      return new Promise<boolean>(resolve => {
        fake.resolveDispatch = resolve;
      });
    }
    return fake.succeeds;
  },
}));

import { CohortWorkspacePane } from '../CohortWorkspacePane';
import { CohortInteractionScreen } from '../CohortInteractionScreen';

beforeEach(() => {
  clearAllDraftsForTesting();
  fake.actions = [];
  fake.succeeds = true;
  fake.deferred = false;
  fake.resolveDispatch = null;
});

afterEach(() => {
  cleanup();
  clearAllDraftsForTesting();
});

describe('Checkpoint 1: Preserve Drafts and Inspection State', () => {
  it('1. Type a pasted source -> inspect another stage -> return -> text remains', async () => {
    fake.state = cohortWorkspaceSchema.parse({
      schemaVersion: 1,
      title: 'Distributed Systems',
      intent: 'Learn Paxos',
      audience: 'Engineers',
      dailyMinutes: 20,
      sources: [
        { id: 'source-1', version: 0, label: 'Existing Source', text: 'Existing text', checksum: null, state: 'ready' },
      ],
      lessons: [
        { id: 'lesson-1', version: 0, title: 'Consensus', objective: 'Understand Paxos', sourceChunkIds: [], pinned: false },
      ],
      processing: {
        status: 'ready',
        stage: 'done',
        generation: 1,
        sourceFingerprint: 'abc',
        error: null,
      },
    });

    const result = render(
      <CohortDraftProvider workspaceId="ws-test" ownerId="owner">
        <CohortWorkspacePane workspaceId="ws-test" ownerId="owner" onSelectLessonForChat={() => undefined} />
      </CohortDraftProvider>
    );

    // Find source input in curriculum stage and type draft text
    const titleInput = screen.getByPlaceholderText('e.g. Distributed systems notes');
    const textArea = screen.getByLabelText('Paste text to retain and ground this curriculum');

    fireEvent.change(titleInput, { target: { value: 'My Unsaved Source' } });
    fireEvent.change(textArea, { target: { value: 'Important notes about state machine replication' } });

    expect((titleInput as HTMLInputElement).value).toBe('My Unsaved Source');
    expect((textArea as HTMLTextAreaElement).value).toBe('Important notes about state machine replication');

    // Stepper navigation: inspect Chunking (step 2)
    const chunkingStep = screen.getByRole('button', { name: /Chunking/ });
    fireEvent.click(chunkingStep);

    // Banner indicates inspecting chunking stage
    expect(screen.getByTestId('stage-inspection-banner')).toBeTruthy();
    expect(screen.getByText(/Inspecting/)).toBeTruthy();

    // Click 'Return to active stage'
    const returnBtn = screen.getByRole('button', { name: /active stage/i });
    fireEvent.click(returnBtn);

    // Curriculum stage restored, draft text remains intact
    const restoredTitle = screen.getByPlaceholderText('e.g. Distributed systems notes');
    const restoredArea = screen.getByLabelText('Paste text to retain and ground this curriculum');
    expect((restoredTitle as HTMLInputElement).value).toBe('My Unsaved Source');
    expect((restoredArea as HTMLTextAreaElement).value).toBe('Important notes about state machine replication');
  });

  it('2. Edit a lesson -> switch stage -> return -> attempted values remain', async () => {
    fake.state = cohortWorkspaceSchema.parse({
      schemaVersion: 1,
      title: 'Distributed Systems',
      intent: 'Learn Paxos',
      audience: 'Engineers',
      dailyMinutes: 20,
      sources: [
        { id: 'source-1', version: 0, label: 'Existing Source', text: 'Existing text', checksum: null, state: 'ready' },
      ],
      lessons: [
        { id: 'lesson-1', version: 0, title: 'Consensus Basics', objective: 'Explain consensus', sourceChunkIds: [], pinned: false },
      ],
      processing: {
        status: 'ready',
        stage: 'done',
        generation: 1,
        sourceFingerprint: 'abc',
        error: null,
      },
    });

    render(
      <CohortDraftProvider workspaceId="ws-test" ownerId="owner">
        <CohortWorkspacePane workspaceId="ws-test" ownerId="owner" onSelectLessonForChat={() => undefined} />
      </CohortDraftProvider>
    );

    // Open lesson edit dialog
    const editBtn = screen.getByRole('button', { name: 'Edit lesson' });
    fireEvent.click(editBtn);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();

    // Type new title and objective
    const titleField = screen.getByLabelText('Lesson title');
    const objectiveField = screen.getByLabelText('Learning objective');

    fireEvent.change(titleField, { target: { value: 'Advanced Consensus' } });
    fireEvent.change(objectiveField, { target: { value: 'Deep dive into multi-decree Paxos' } });

    // Step away to inspect Understanding (step 1)
    const understandingStep = screen.getByRole('button', { name: /Understanding/ });
    fireEvent.click(understandingStep);

    expect(screen.getByTestId('stage-inspection-banner')).toBeTruthy();

    // Return to curriculum
    fireEvent.click(screen.getByRole('button', { name: /active stage/i }));

    // Dialog remains open and attempted values are preserved
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((screen.getByLabelText('Lesson title') as HTMLInputElement).value).toBe('Advanced Consensus');
    expect((screen.getByLabelText('Learning objective') as HTMLTextAreaElement).value).toBe('Deep dive into multi-decree Paxos');
  });

  it('3. Receive a processing event that changes active stage while editing (draft and editor remain)', async () => {
    fake.state = cohortWorkspaceSchema.parse({
      schemaVersion: 1,
      title: 'Initial Intake',
      intent: 'Learn Paxos',
      audience: 'Engineers',
      dailyMinutes: 20,
      sources: [],
      lessons: [],
      processing: {
        status: 'idle',
        stage: 'done',
        generation: 0,
        sourceFingerprint: null,
        error: null,
      },
    });

    const result = render(
      <CohortDraftProvider workspaceId="ws-test" ownerId="owner">
        <CohortWorkspacePane workspaceId="ws-test" ownerId="owner" onSelectLessonForChat={() => undefined} />
      </CohortDraftProvider>
    );

    // Typing in intake stage
    const textArea = screen.getByLabelText('Paste text to retain and ground this curriculum');
    fireEvent.change(textArea, { target: { value: 'Durable write in progress' } });

    // Simulate server update: background worker starts processing
    // activeStage transitions from 'intake' to 'understanding'
    fake.state = cohortWorkspaceSchema.parse({
      ...fake.state,
      processing: {
        status: 'processing',
        stage: 'understanding',
        generation: 1,
        sourceFingerprint: 'fp-1',
        error: null,
      },
    });

    result.rerender(
      <CohortDraftProvider workspaceId="ws-test" ownerId="owner">
        <CohortWorkspacePane workspaceId="ws-test" ownerId="owner" onSelectLessonForChat={() => undefined} />
      </CohortDraftProvider>
    );

    // Editor view MUST NOT be replaced by Understanding stage while dirty
    const retainedTextArea = screen.getByLabelText('Paste text to retain and ground this curriculum');
    expect((retainedTextArea as HTMLTextAreaElement).value).toBe('Durable write in progress');
  });

  it('4. Conflict, navigate away/back, then explicitly reapply against current version', async () => {
    fake.state = cohortWorkspaceSchema.parse({
      schemaVersion: 1,
      title: 'Distributed Systems',
      intent: 'Learn Paxos',
      audience: 'Engineers',
      dailyMinutes: 20,
      sources: [
        { id: 'source-1', version: 0, label: 'Existing Source', text: 'Existing text', checksum: null, state: 'ready' },
      ],
      lessons: [
        { id: 'lesson-1', version: 0, title: 'Consensus Basics', objective: 'Explain consensus', sourceChunkIds: [], pinned: false },
      ],
      processing: {
        status: 'ready',
        stage: 'done',
        generation: 1,
        sourceFingerprint: 'abc',
        error: null,
      },
    });

    const result = render(
      <CohortDraftProvider workspaceId="ws-test" ownerId="owner">
        <CohortWorkspacePane workspaceId="ws-test" ownerId="owner" onSelectLessonForChat={() => undefined} />
      </CohortDraftProvider>
    );

    // Open lesson edit
    fireEvent.click(screen.getByRole('button', { name: 'Edit lesson' }));
    fireEvent.change(screen.getByLabelText('Lesson title'), { target: { value: 'My Local Edit' } });

    // Remote conflict occurs: remote lesson version bumps to 1 with new title
    fake.state = cohortWorkspaceSchema.parse({
      ...fake.state,
      lessons: [
        { id: 'lesson-1', version: 1, title: 'Remote Updated Title', objective: 'Remote Objective', sourceChunkIds: [], pinned: false },
      ],
    });

    result.rerender(
      <CohortDraftProvider workspaceId="ws-test" ownerId="owner">
        <CohortWorkspacePane workspaceId="ws-test" ownerId="owner" onSelectLessonForChat={() => undefined} />
      </CohortDraftProvider>
    );

    // Inspect another stage (Analyzing, step 3) and return
    fireEvent.click(screen.getByRole('button', { name: /Analyzing/ }));
    expect(screen.getByTestId('stage-inspection-banner')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /active stage/i }));

    // Conflict banner appears in dialog
    expect(screen.getByText(/This lesson changed while you were editing/)).toBeTruthy();
    expect(screen.getAllByText(/Remote Objective/).length).toBeGreaterThanOrEqual(1);

    // User chooses to reapply against current version
    const reapplyBtn = screen.getByRole('button', { name: 'Use current version and keep my edit' });
    fireEvent.click(reapplyBtn);

    // Save changes
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Update Lesson' }));
    });

    // Dispatched edit_lesson should target current version (1) and keep local title
    expect(fake.actions).toContainEqual({
      type: 'edit_lesson',
      lessonId: 'lesson-1',
      title: 'My Local Edit',
      objective: 'Remote Objective',
    });
  });

  it('5. Source/lesson removed remotely while its draft is dirty (honest message, text retained, no misapplication)', async () => {
    fake.state = cohortWorkspaceSchema.parse({
      schemaVersion: 1,
      title: 'Distributed Systems',
      intent: 'Learn Paxos',
      audience: 'Engineers',
      dailyMinutes: 20,
      sources: [
        { id: 'source-1', version: 0, label: 'Existing Source', text: 'Existing text', checksum: null, state: 'ready' },
      ],
      lessons: [
        { id: 'lesson-1', version: 0, title: 'Consensus Basics', objective: 'Explain consensus', sourceChunkIds: [], pinned: false },
      ],
      processing: {
        status: 'ready',
        stage: 'done',
        generation: 1,
        sourceFingerprint: 'abc',
        error: null,
      },
    });

    const result = render(
      <CohortDraftProvider workspaceId="ws-test" ownerId="owner">
        <CohortWorkspacePane workspaceId="ws-test" ownerId="owner" onSelectLessonForChat={() => undefined} />
      </CohortDraftProvider>
    );

    // Start editing lesson-1
    fireEvent.click(screen.getByRole('button', { name: 'Edit lesson' }));
    fireEvent.change(screen.getByLabelText('Lesson title'), { target: { value: 'Critical Draft About Consensus' } });
    fireEvent.change(screen.getByLabelText('Learning objective'), { target: { value: 'Detailed objective' } });

    // Remote deletion occurs: lessons array is now empty
    fake.state = cohortWorkspaceSchema.parse({
      ...fake.state,
      lessons: [],
    });

    result.rerender(
      <CohortDraftProvider workspaceId="ws-test" ownerId="owner">
        <CohortWorkspacePane workspaceId="ws-test" ownerId="owner" onSelectLessonForChat={() => undefined} />
      </CohortDraftProvider>
    );

    // Honest message displayed
    expect(screen.getByText(/This lesson was removed remotely while you were editing\. Your writing is retained\./)).toBeTruthy();

    // User can save as new lesson
    const saveAsNewBtn = screen.getByRole('button', { name: 'Save as new lesson' });
    await act(async () => {
      fireEvent.click(saveAsNewBtn);
    });

    // Ensures add_lesson was dispatched, NOT edit_lesson, so no misapplication occurs
    expect(fake.actions).toEqual([
      {
        type: 'add_lesson',
        title: 'Critical Draft About Consensus',
        objective: 'Detailed objective',
      },
    ]);
  });

  it('6. Save completes after additional typing (additional typing preserved)', async () => {
    fake.deferred = true;
    fake.state = cohortWorkspaceSchema.parse({
      schemaVersion: 1,
      title: 'Intake Stage',
      intent: 'Learn Paxos',
      audience: 'Engineers',
      dailyMinutes: 20,
      sources: [],
      lessons: [],
      processing: {
        status: 'idle',
        stage: 'done',
        generation: 0,
        sourceFingerprint: null,
        error: null,
      },
    });

    render(
      <CohortDraftProvider workspaceId="ws-test" ownerId="owner">
        <CohortWorkspacePane workspaceId="ws-test" ownerId="owner" onSelectLessonForChat={() => undefined} />
      </CohortDraftProvider>
    );

    const title = screen.getByPlaceholderText('e.g. Distributed systems notes');
    const body = screen.getByLabelText('Paste text to retain and ground this curriculum');

    fireEvent.change(title, { target: { value: 'Notes' } });
    fireEvent.change(body, { target: { value: 'Initial text' } });

    // Click submit - save goes in flight
    const addBtn = screen.getByRole('button', { name: 'Add text source' });
    let savePromise: Promise<void>;
    act(() => {
      savePromise = (async () => {
        fireEvent.click(addBtn);
      })();
    });

    expect(fake.actions).toContainEqual({
      type: 'add_text_source',
      label: 'Notes',
      text: 'Initial text',
    });

    // While save is in flight, user types additional text
    fireEvent.change(body, { target: { value: 'Initial text with in-flight additions' } });

    // Save resolves successfully
    await act(async () => {
      fake.resolveDispatch!(true);
      await savePromise;
    });

    // The in-flight additions MUST be preserved and not wiped to empty
    expect((body as HTMLTextAreaElement).value).toBe('Initial text with in-flight additions');
  });

  it('7. Owner/workspace changes do not expose the previous draft (isolated per workspace)', () => {
    const ws1View = cohortWorkspaceSchema.parse({
      schemaVersion: 1,
      title: 'Workspace 1',
      intent: 'Learn Paxos',
      audience: 'Engineers',
      dailyMinutes: 20,
      sources: [],
      lessons: [],
      processing: { status: 'idle', stage: 'done', generation: 0, sourceFingerprint: null, error: null },
    });

    const ws2View = cohortWorkspaceSchema.parse({
      schemaVersion: 1,
      title: 'Workspace 2',
      intent: 'Learn Raft',
      audience: 'Engineers',
      dailyMinutes: 20,
      sources: [],
      lessons: [],
      processing: { status: 'idle', stage: 'done', generation: 0, sourceFingerprint: null, error: null },
    });

    // Render workspace 1 for owner 'alice'
    fake.state = ws1View;
    const result = render(
      <CohortDraftProvider workspaceId="ws-1" ownerId="alice">
        <CohortWorkspacePane workspaceId="ws-1" ownerId="alice" onSelectLessonForChat={() => undefined} />
      </CohortDraftProvider>
    );

    const sourceArea1 = screen.getByLabelText('Paste text to retain and ground this curriculum');
    fireEvent.change(sourceArea1, { target: { value: 'Confidential draft for workspace 1' } });
    expect((sourceArea1 as HTMLTextAreaElement).value).toBe('Confidential draft for workspace 1');

    result.unmount();

    // Render workspace 2 for owner 'alice'
    fake.state = ws2View;
    const result2 = render(
      <CohortDraftProvider workspaceId="ws-2" ownerId="alice">
        <CohortWorkspacePane workspaceId="ws-2" ownerId="alice" onSelectLessonForChat={() => undefined} />
      </CohortDraftProvider>
    );

    const sourceArea2 = screen.getByLabelText('Paste text to retain and ground this curriculum');
    // Must be completely empty, NOT leaking draft from ws-1
    expect((sourceArea2 as HTMLTextAreaElement).value).toBe('');

    result2.unmount();

    // Render workspace 1 for owner 'bob' (different owner)
    fake.state = ws1View;
    const result3 = render(
      <CohortDraftProvider workspaceId="ws-1" ownerId="bob">
        <CohortWorkspacePane workspaceId="ws-1" ownerId="bob" onSelectLessonForChat={() => undefined} />
      </CohortDraftProvider>
    );

    const sourceAreaBob = screen.getByLabelText('Paste text to retain and ground this curriculum');
    // Must be completely empty, zero leakage across owners
    expect((sourceAreaBob as HTMLTextAreaElement).value).toBe('');

    result3.unmount();

    // Return to workspace 1 for owner 'alice'
    fake.state = ws1View;
    render(
      <CohortDraftProvider workspaceId="ws-1" ownerId="alice">
        <CohortWorkspacePane workspaceId="ws-1" ownerId="alice" onSelectLessonForChat={() => undefined} />
      </CohortDraftProvider>
    );

    const restoredAreaAlice = screen.getByLabelText('Paste text to retain and ground this curriculum');
    // Restores original draft accurately
    expect((restoredAreaAlice as HTMLTextAreaElement).value).toBe('Confidential draft for workspace 1');
  });

  it('8. Mobile pane switching (Chat <-> Workspace) and stage switching together preserve state', () => {
    fake.state = cohortWorkspaceSchema.parse({
      schemaVersion: 1,
      title: 'Distributed Systems',
      intent: 'Learn Paxos',
      audience: 'Engineers',
      dailyMinutes: 20,
      sources: [
        { id: 'source-1', version: 0, label: 'Notes', text: 'Paxos notes', checksum: null, state: 'ready' },
      ],
      lessons: [
        { id: 'lesson-1', version: 0, title: 'Consensus Basics', objective: 'Explain consensus', sourceChunkIds: [], pinned: false },
      ],
      processing: {
        status: 'ready',
        stage: 'done',
        generation: 1,
        sourceFingerprint: 'abc',
        error: null,
      },
    });

    render(<CohortInteractionScreen workspaceId="ws-mobile-test" ownerId="owner" initialView={fake.state} />);

    const chatBtn = screen.getByRole('button', { name: 'Chat' });
    const workspaceBtn = screen.getByRole('button', { name: 'Workspace' });
    const composer = screen.getByLabelText('Message the cohort assistant');
    const sourceArea = screen.getByLabelText('Paste text to retain and ground this curriculum');

    // Type in chat composer and in workspace source draft
    fireEvent.change(composer, { target: { value: 'Question for assistant about quorum intersection' } });
    fireEvent.change(sourceArea, { target: { value: 'Unsaved additions to Paxos curriculum' } });

    // Switch to Chat pane
    fireEvent.click(chatBtn);
    expect(composer).toBeTruthy();
    expect((composer as HTMLTextAreaElement).value).toBe('Question for assistant about quorum intersection');

    // Switch to Workspace pane
    fireEvent.click(workspaceBtn);
    const workspaceSource = screen.getByLabelText('Paste text to retain and ground this curriculum');
    expect((workspaceSource as HTMLTextAreaElement).value).toBe('Unsaved additions to Paxos curriculum');

    // Switch stage (inspect Building/Assembly, step 4)
    const buildingStep = screen.getByRole('button', { name: /Building/ });
    fireEvent.click(buildingStep);
    expect(screen.getByTestId('stage-inspection-banner')).toBeTruthy();

    // Switch to Chat pane again while inspecting
    fireEvent.click(chatBtn);
    expect((composer as HTMLTextAreaElement).value).toBe('Question for assistant about quorum intersection');

    // Switch back to Workspace pane
    fireEvent.click(workspaceBtn);
    expect(screen.getByTestId('stage-inspection-banner')).toBeTruthy();

    // Return to active stage
    fireEvent.click(screen.getByRole('button', { name: /active stage/i }));

    // Both workspace draft and chat composer retained
    expect((screen.getByLabelText('Paste text to retain and ground this curriculum') as HTMLTextAreaElement).value).toBe(
      'Unsaved additions to Paxos curriculum'
    );
    expect((composer as HTMLTextAreaElement).value).toBe('Question for assistant about quorum intersection');
  });
});

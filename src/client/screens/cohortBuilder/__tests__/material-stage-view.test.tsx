// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  cohortWorkspaceSchema,
  type CohortWorkspace,
} from '@/src/shared/cohort-builder/contracts';

const fake = vi.hoisted(() => ({
  state: null as CohortWorkspace | null,
  actions: [] as any[],
  succeeds: true,
  session: {
    status: 'authenticated',
    data: { user: { id: 'owner-alice' } },
  } as { status: string; data: any },
}));

vi.mock('next-auth/react', () => ({
  useSession: () => fake.session,
}));

vi.mock('@/src/client/interaction/hooks', () => ({
  useWorkspaceConnection: () => 'live',
  useInteractionState: () => ({
    workspaceId: 'ws-test-123',
    revision: 2,
    view: fake.state,
  }),
  useWorkspaceView: () => fake.state,
  useDispatchAction: () => async (action: any) => {
    fake.actions.push(action);
    return fake.succeeds;
  },
  useWorkspaceMessages: () => [],
  useSendMessage: () => async () => true,
}));

vi.mock('@/src/client/interaction/provider', () => ({
  InteractionProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/src/client/lib/sourceExtractors/webClientExtractor', () => ({
  extractWebClient: vi.fn().mockResolvedValue({
    text: 'Extracted web content',
    locations: [{ start: 0, end: 20 }],
    provenance: { parserVersion: 'test', rawChecksum: 'b'.repeat(64), scope: 'main_article' },
    checksum: 'b'.repeat(64),
  }),
}));

vi.mock('@/src/client/lib/sourceExtractors/youtubeClientExtractor', () => ({
  extractYoutubeClient: vi.fn().mockResolvedValue({
    text: 'Extracted youtube transcript',
    locations: [{ start: 0, end: 28 }],
    provenance: { parserVersion: 'test', rawChecksum: 'c'.repeat(64), scope: 'video_observation' },
    checksum: 'c'.repeat(64),
  }),
}));

import { MaterialStageView } from '../stages/MaterialStageView';
import { CohortWorkspacePane } from '../CohortWorkspacePane';

function createMaterialWorkspace(overrides?: Partial<CohortWorkspace>): CohortWorkspace {
  return cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Distributed Systems Cohort',
    intent: 'Master Distributed Consensus',
    audience: 'Engineers',
    dailyMinutes: 30,
    lessons: [],
    sources: [],
    chunks: [],
    understanding: [],
    analyses: [],
    processing: {
      status: 'idle',
      stage: 'done',
      generation: 1,
      sourceFingerprint: null,
      error: null,
    },
    journey: {
      version: 1,
      step: 'material_input',
      branch: 'have_material',
      processingStarted: false,
      intentVersion: 0,
    },
    ...overrides,
  });
}

describe('MaterialStageView (Revised Intake UI)', () => {
  beforeEach(() => {
    fake.actions = [];
    fake.succeeds = true;
    fake.session = {
      status: 'authenticated',
      data: { user: { id: 'owner-alice' } },
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('1. Renders headline, URL input, help text; previews precede form in DOM', () => {
    const ws = createMaterialWorkspace({
      sources: [
        {
          id: 'src-1',
          version: 1,
          label: 'System Design Article',
          text: 'article text',
          checksum: null,
          state: 'ready',
          input: { kind: 'web', url: 'https://example.com/system-design-guide' },
        },
      ],
    });
    const { container } = render(<MaterialStageView workspace={ws} dispatchAction={async a => { fake.actions.push(a); return true; }} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Add your material' })).toBeTruthy();
    expect(screen.getByLabelText(/Public article or YouTube URL/i)).toBeTruthy();
    expect(screen.getByText(/Public YouTube videos, playlists and articles\. Up to 100 sources\./i)).toBeTruthy();

    // Verify previews section precedes inputPanel form in the DOM
    const previewsSection = screen.getByRole('region', { name: 'Added material' });
    const inputForm = container.querySelector('form');
    expect(previewsSection).toBeTruthy();
    expect(inputForm).toBeTruthy();
    expect(previewsSection.compareDocumentPosition(inputForm!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('2. Shows URL input as default; disables alternate mode buttons with "Temporarily unavailable"; no file input or textarea', () => {
    const ws = createMaterialWorkspace();
    const { container } = render(<MaterialStageView workspace={ws} dispatchAction={async a => { fake.actions.push(a); return true; }} />);

    const linkBtn = screen.getByRole('button', { name: 'Paste a link' });
    expect(linkBtn.getAttribute('aria-pressed')).toBe('true');

    const uploadBtn = screen.getByRole('button', { name: 'Upload a file' });
    expect(uploadBtn.hasAttribute('disabled')).toBe(true);
    expect(uploadBtn.getAttribute('title')).toBe('Temporarily unavailable');

    expect(screen.queryByRole('button', { name: /Paste text/i })).toBeNull();



    // Strict check: no file input and no textarea
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('3. Classifies YouTube URL versus general Web URL in single link input', async () => {
    const ws = createMaterialWorkspace();
    render(<MaterialStageView workspace={ws} dispatchAction={async a => { fake.actions.push(a); return true; }} />);

    const urlInput = screen.getByLabelText(/Public article or YouTube URL/i);

    // 1. YouTube video URL
    await act(async () => {
      fireEvent.change(urlInput, { target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    });

    expect(fake.actions).toContainEqual(expect.objectContaining({
      type: 'add_youtube_source',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      mode: 'video_observation',
    }));

    fake.actions = [];

    // 2. Regular Web article URL
    await act(async () => {
      fireEvent.change(urlInput, { target: { value: 'https://example.com/system-design' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    });

    expect(fake.actions).toContainEqual(expect.objectContaining({
      type: 'add_web_source',
      url: 'https://example.com/system-design',
      label: 'https://example.com/system-design',
    }));
  });

  it('4. Preserves failed URL input for retry when dispatchAction fails', async () => {
    fake.succeeds = false;
    const ws = createMaterialWorkspace();
    render(<MaterialStageView workspace={ws} dispatchAction={async () => false} />);

    const urlInput = screen.getByLabelText(/Public article or YouTube URL/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(urlInput, { target: { value: 'https://example.com/my-article' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    });

    // Input is preserved!
    expect(urlInput.value).toBe('https://example.com/my-article');
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/Could not add this link\. Your input was preserved for retry\./i)).toBeTruthy();
  });

  it('5. Playlist handling respects capacity: dispatches batch action up to limit and rejects if at max capacity', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        isPlaylist: true,
        title: 'Distributed Systems Course',
        videos: [
          { videoId: 'vid11111111', title: 'Lesson 1' },
          { videoId: 'vid22222222', title: 'Lesson 2' },
        ],
      }),
    });

    const ws = createMaterialWorkspace();
    render(<MaterialStageView workspace={ws} dispatchAction={async a => { fake.actions.push(a); return true; }} />);

    const urlInput = screen.getByLabelText(/Public article or YouTube URL/i);
    await act(async () => {
      fireEvent.change(urlInput, { target: { value: 'https://www.youtube.com/playlist?list=PL12345' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    });

    expect(fake.actions).toContainEqual({
      type: 'add_youtube_sources_batch',
      videos: [
        { url: 'https://www.youtube.com/watch?v=vid11111111', label: 'Lesson 1', mode: 'video_observation' },
        { url: 'https://www.youtube.com/watch?v=vid22222222', label: 'Lesson 2', mode: 'video_observation' },
      ],
    });

    // Test rejection when max capacity of 100 is reached
    fake.actions = [];
    const fullSources = Array.from({ length: 100 }, (_, i) => ({
      id: `src-${i}`,
      version: 0,
      label: `Source ${i}`,
      text: 'retained sample content',
      checksum: null,
      state: 'ready' as const,
    }));
    const fullWs = createMaterialWorkspace({ sources: fullSources });
    cleanup();
    render(<MaterialStageView workspace={fullWs} dispatchAction={async a => { fake.actions.push(a); return true; }} />);

    const urlInputFull = screen.getByLabelText(/Public article or YouTube URL/i);
    await act(async () => {
      fireEvent.change(urlInputFull, { target: { value: 'https://www.youtube.com/playlist?list=PL12345' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    });

    expect(fake.actions).toHaveLength(0);
    expect(screen.getByText(/Cannot add more sources\. Maximum capacity of 100 reached\./i)).toBeTruthy();
  });

  it('6. Rapid submit dispatches once (lock.current prevents duplicate actions)', async () => {
    let dispatchCallCount = 0;
    const ws = createMaterialWorkspace();
    render(
      <MaterialStageView
        workspace={ws}
        dispatchAction={async a => {
          dispatchCallCount++;
          fake.actions.push(a);
          await new Promise(r => setTimeout(r, 50));
          return true;
        }}
      />
    );

    const urlInput = screen.getByLabelText(/Public article or YouTube URL/i);
    await act(async () => {
      fireEvent.change(urlInput, { target: { value: 'https://example.com/single-dispatch' } });
    });

    const addBtn = screen.getByRole('button', { name: 'Add link' });
    // Trigger rapid clicks
    await act(async () => {
      fireEvent.click(addBtn);
      fireEvent.click(addBtn);
      fireEvent.click(addBtn);
    });

    expect(dispatchCallCount).toBe(1);
  });

  it('7. Renders Added Material rows with badges (PDF, Web, YouTube, GitHub, AI Guide) and only Remove button', () => {
    const ws = createMaterialWorkspace({
      sources: [
        {
          id: 'src-1',
          version: 1,
          label: 'System Design Article',
          text: 'article text',
          checksum: null,
          state: 'ready',
          input: { kind: 'web', url: 'https://example.com/system-design-guide' },
        },
        {
          id: 'src-2',
          version: 1,
          label: 'Distributed Systems Lecture',
          text: '',
          checksum: null,
          state: 'ready',
          input: {
            kind: 'youtube',
            url: 'https://www.youtube.com/watch?v=12345678901',
            mode: 'video_observation',
          },
        },
        {
          id: 'src-3',
          version: 1,
          label: 'Whitepaper PDF',
          text: 'pdf text',
          checksum: null,
          state: 'ready',
          input: { kind: 'pdf', uploadId: '11111111-1111-4111-8111-111111111111' },
        },
        {
          id: 'src-4',
          version: 1,
          label: 'Distributed Database Repo',
          text: 'code text',
          checksum: null,
          state: 'ready',
          input: { kind: 'github', repoUrl: 'https://github.com/org/db', ref: 'main' },
        },
        {
          id: 'src-5',
          version: 1,
          label: 'Authed Guide',
          text: 'guide text',
          checksum: null,
          state: 'ready',
          input: { kind: 'generated_guide', goal: 'Learn consensus', audience: 'All', dailyMinutes: 30, intentVersion: 1 },
        },
      ],
    });

    render(<MaterialStageView workspace={ws} dispatchAction={async a => { fake.actions.push(a); return true; }} />);

    expect(screen.getByText('Added material')).toBeTruthy();
    expect(screen.getByText('Web Article')).toBeTruthy();
    expect(screen.getByText('YouTube Video')).toBeTruthy();
    expect(screen.getByText('PDF Document')).toBeTruthy();
    expect(screen.getByText('GitHub Repo')).toBeTruthy();
    expect(screen.getByText('AI Guide')).toBeTruthy();

    // Verify only Remove buttons exist (no Replace buttons or status controls)
    expect(screen.getByRole('button', { name: 'Remove source 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove source 2' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Replace source/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Retry/i })).toBeNull();
  });

  it('8. Failed remove does not delete source and surfaces error alert', async () => {
    fake.succeeds = false;
    const ws = createMaterialWorkspace({
      sources: [
        {
          id: 'src-del-1',
          version: 1,
          label: 'Source To Remove',
          text: 'content',
          checksum: null,
          state: 'ready',
        },
      ],
    });

    render(<MaterialStageView workspace={ws} dispatchAction={async () => false} />);

    const removeBtn = screen.getByRole('button', { name: 'Remove source 1' });
    await act(async () => {
      fireEvent.click(removeBtn);
    });

    // Error alert is displayed and source remains
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Could not save this action. Please try again.')).toBeTruthy();
    expect(screen.getByText('Source To Remove')).toBeTruthy();
  });

  it('9. Continue CTA button calls begin_material_processing and is disabled when 0 sources', async () => {
    const wsEmpty = createMaterialWorkspace({ sources: [] });
    const { rerender } = render(
      <MaterialStageView workspace={wsEmpty} dispatchAction={async a => { fake.actions.push(a); return true; }} />
    );

    const continueBtn = screen.getByRole('button', { name: /Continue to curriculum/i });
    expect(continueBtn.hasAttribute('disabled')).toBe(true);

    const wsWithSources = createMaterialWorkspace({
      sources: [
        {
          id: 'src-1',
          version: 1,
          label: 'Notes',
          text: 'some content',
          checksum: null,
          state: 'ready',
        },
      ],
    });

    rerender(
      <MaterialStageView workspace={wsWithSources} dispatchAction={async a => { fake.actions.push(a); return true; }} />
    );

    expect(continueBtn.hasAttribute('disabled')).toBe(false);

    await act(async () => {
      fireEvent.click(continueBtn);
    });

    expect(fake.actions).toContainEqual({ type: 'begin_material_processing' });
  });
});

describe('CohortWorkspacePane integration for material_input stage', () => {
  beforeEach(() => {
    fake.actions = [];
    fake.succeeds = true;
    fake.session = {
      status: 'authenticated',
      data: { user: { id: 'owner-alice' } },
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('10. Renders top starting point tabs and dispatches back_to_starting_point on Back click', async () => {
    fake.state = createMaterialWorkspace();
    render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);

    // Compact StartingPoint tabs (2 choices in revision):
    const tab1 = screen.getByRole('button', { name: 'I already have material' });
    const tab2 = screen.getByRole('button', { name: 'Start with a goal' });

    expect(tab1).toBeTruthy();
    expect(tab2).toBeTruthy();
    expect(tab1.getAttribute('aria-pressed')).toBe('true');

    // Click back button:
    const backBtn = screen.getByRole('button', { name: 'Back to starting point' });
    await act(async () => {
      fireEvent.click(backBtn);
    });

    expect(fake.actions).toContainEqual({ type: 'back_to_starting_point' });
  });

  it('11. Allows switching starting point tab via back_to_starting_point and choose_starting_point', async () => {
    fake.state = createMaterialWorkspace();
    render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);

    const tabFind = screen.getByRole('button', { name: 'Start with a goal' });
    await act(async () => {
      fireEvent.click(tabFind);
    });

    expect(fake.actions).toContainEqual({ type: 'back_to_starting_point' });
    expect(fake.actions).toContainEqual({
      type: 'choose_starting_point',
      choice: 'find_material',
    });
  });

  it('12. Suppresses stepper nav during material_input stage', () => {
    fake.state = createMaterialWorkspace();
    render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);

    expect(screen.queryByRole('list', { name: 'Creation journey progress' })).toBeNull();
  });
});

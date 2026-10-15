// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('MaterialStageView (AFTER Screen 4)', () => {
  beforeEach(() => {
    fake.actions = [];
    fake.succeeds = true;
    fake.session = {
      status: 'authenticated',
      data: { user: { id: 'owner-alice' } },
    };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('1. Renders Screen 4 headline, eyebrow, collage note, and subtitle', () => {
    const ws = createMaterialWorkspace();
    render(<MaterialStageView workspace={ws} dispatchAction={async a => { fake.actions.push(a); return true; }} />);

    expect(screen.getByText('GIVE ME WHAT YOU’VE GOT')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('your material');
    expect(screen.getByText(/Drop your material here/i)).toBeTruthy();
    expect(screen.getByText(/You can give me multiple sources/i)).toBeTruthy();
    expect(screen.getByText(/Same content./i)).toBeTruthy();
    expect(screen.getByText(/More progress./i)).toBeTruthy();
  });

  it('2. Shows mode buttons for upload, paste, link; removes GitHub forms from default journey', () => {
    const ws = createMaterialWorkspace();
    render(<MaterialStageView workspace={ws} dispatchAction={async a => { fake.actions.push(a); return true; }} />);

    expect(screen.getByRole('button', { name: /Upload a file/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Paste text/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Paste a link$/i })).toBeTruthy();

    // GitHub should NOT be in the mode choices
    expect(screen.queryByRole('button', { name: /GitHub repository/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Notion page/i })).toBeNull();
  });

  it('3. Classifies YouTube URL versus general Web URL in single link input', async () => {
    const ws = createMaterialWorkspace();
    render(<MaterialStageView workspace={ws} dispatchAction={async a => { fake.actions.push(a); return true; }} />);

    // Switch to URL mode
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Paste a link$/i }));
    });

    const urlInput = screen.getByLabelText(/Public article or YouTube URL/i);

    // 1. YouTube video URL
    await act(async () => {
      fireEvent.change(urlInput, { target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save and acquire material/i }));
    });

    expect(fake.actions).toContainEqual({
      type: 'add_youtube_source',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      label: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      mode: 'video_observation',
      sourceId: undefined,
    });

    fake.actions = [];

    // 2. Regular Web article URL
    await act(async () => {
      fireEvent.change(urlInput, { target: { value: 'https://example.com/system-design' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save and acquire material/i }));
    });

    expect(fake.actions).toContainEqual({
      type: 'add_web_source',
      url: 'https://example.com/system-design',
      label: 'https://example.com/system-design',
      sourceId: undefined,
    });
  });

  it('4. Preserves failed URL input for retry when dispatchAction fails', async () => {
    fake.succeeds = false;
    const ws = createMaterialWorkspace();
    render(<MaterialStageView workspace={ws} dispatchAction={async () => false} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Paste a link$/i }));
    });

    const urlInput = screen.getByLabelText(/Public article or YouTube URL/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(urlInput, { target: { value: 'https://example.com/my-article' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save and acquire material/i }));
    });

    // Input is preserved!
    expect(urlInput.value).toBe('https://example.com/my-article');
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('5. Handles paste mode and dispatches add_text_source', async () => {
    const ws = createMaterialWorkspace();
    render(<MaterialStageView workspace={ws} dispatchAction={async a => { fake.actions.push(a); return true; }} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Paste text/i }));
    });

    const textInput = screen.getByLabelText(/Learning text/i);
    await act(async () => {
      fireEvent.change(textInput, { target: { value: 'Here is some rich system design text notes.' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save text source/i }));
    });

    expect(fake.actions).toContainEqual({
      type: 'add_text_source',
      label: 'Pasted text',
      text: 'Here is some rich system design text notes.',
      sourceId: undefined,
    });
  });

  it('6. Uploads PDF to owned PDF binary endpoint with required headers and never decodes with FileReader', async () => {
    const ws = createMaterialWorkspace();
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sourceId: 'src-pdf-1', uploadId: 'up-1' }),
    });

    render(
      <MaterialStageView
        workspace={ws}
        workspaceId="ws-test-123"
        revision={2}
        ownerId="owner-alice"
        dispatchAction={async a => { fake.actions.push(a); return true; }}
      />
    );

    const fileInput = document.getElementById('material-file-picker') as HTMLInputElement;
    const fakePdf = new File(['%PDF-1.4 fake binary content'], 'whitepaper.pdf', { type: 'application/pdf' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [fakePdf] } });
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchOptions] = (global.fetch as any).mock.calls[0];

    expect(fetchUrl).toBe('/api/cohort-builder/workspaces/ws-test-123/pdf');
    expect(fetchOptions.method).toBe('POST');
    expect(fetchOptions.headers['Content-Type']).toBe('application/pdf');
    expect(fetchOptions.headers['X-Workspace-Revision']).toBe('2');
    expect(fetchOptions.headers['X-Owner-Id']).toBe('owner-alice');
    expect(fetchOptions.headers['X-Source-Label']).toBe('whitepaper.pdf');
    expect(fetchOptions.headers['Idempotency-Key']).toBeTruthy();
    expect(fetchOptions.body).toBe(fakePdf);
  });

  it('7. Reads .txt or .md files with file.text() and dispatches add_text_source', async () => {
    const ws = createMaterialWorkspace();
    render(
      <MaterialStageView
        workspace={ws}
        dispatchAction={async a => { fake.actions.push(a); return true; }}
      />
    );

    const fileInput = document.getElementById('material-file-picker') as HTMLInputElement;
    const fakeTxt = new File(['Markdown notes content for consensus.'], 'notes.md', { type: 'text/markdown' });

    // Mock file.text()
    fakeTxt.text = vi.fn().mockResolvedValue('Markdown notes content for consensus.');

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [fakeTxt] } });
    });

    expect(fakeTxt.text).toHaveBeenCalled();
    expect(fake.actions).toContainEqual({
      type: 'add_text_source',
      label: 'notes.md',
      text: 'Markdown notes content for consensus.',
      sourceId: undefined,
    });
  });

  it('8. Renders Added Material rows with provenance for PDF, Web, YouTube, and GitHub', () => {
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
          locations: [
            { start: 0, end: 100 },
            { start: 100, end: 200 },
          ],
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
          label: 'Existing Repo Source',
          text: 'code text',
          checksum: null,
          state: 'ready',
          input: {
            kind: 'github',
            repoUrl: 'https://github.com/org/distributed-db',
            ref: 'main',
            paths: ['docs/architecture.md'],
          },
          locations: [{ start: 0, end: 50 }],
        },
      ],
    });

    render(<MaterialStageView workspace={ws} dispatchAction={async a => { fake.actions.push(a); return true; }} />);

    expect(screen.getByText('Added material')).toBeTruthy();
    expect(screen.getByText('System Design Article')).toBeTruthy();
    expect(screen.getByText(/2 extracted segments · https:\/\/example\.com\/system-design-guide/i)).toBeTruthy();

    expect(screen.getByText('Distributed Systems Lecture')).toBeTruthy();
    expect(screen.getByText(/Retained video observations ready · Coverage is non-exhaustive; timestamps are estimated\./i)).toBeTruthy();

    // Existing GitHub sources remain readable!
    expect(screen.getByText('Existing Repo Source')).toBeTruthy();
    expect(screen.getByText(/GitHub: https:\/\/github\.com\/org\/distributed-db · Ref: main · Paths: docs\/architecture\.md/i)).toBeTruthy();

    // Replace and Remove buttons exist for each
    expect(screen.getByRole('button', { name: /Replace source 1/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Remove source 1/i })).toBeTruthy();
  });

  it('9. Shows human-readable error beside failed source with Retry button', async () => {
    const ws = createMaterialWorkspace({
      sources: [
        {
          id: 'src-failed-1',
          version: 1,
          label: 'Failing Site',
          text: '',
          checksum: null,
          state: 'failed',
          input: { kind: 'web', url: 'https://example.com/broken-link' },
        },
      ],
      processing: {
        status: 'failed',
        stage: 'acquisition',
        generation: 1,
        sourceFingerprint: null,
        error: 'URL_NOT_FOUND',
        jobs: [
          {
            id: 'job-1',
            sourceId: 'src-failed-1',
            stage: 'acquisition',
            status: 'failed',
            attempts: 1,
            error: 'URL_NOT_FOUND',
            retryable: true,
          },
        ],
      },
    });

    render(<MaterialStageView workspace={ws} dispatchAction={async a => { fake.actions.push(a); return true; }} />);

    expect(screen.getByText(/Could not reach the website\. Verify the URL is publicly accessible\./i)).toBeTruthy();

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    expect(retryBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(retryBtn);
    });

    expect(fake.actions).toContainEqual({
      type: 'retry_text_job',
      jobId: 'job-1',
    });
  });

  it('10. Continue CTA button calls begin_material_processing and is disabled when 0 sources', async () => {
    // 0 sources: button is disabled
    const wsEmpty = createMaterialWorkspace({ sources: [] });
    const { rerender } = render(
      <MaterialStageView workspace={wsEmpty} dispatchAction={async a => { fake.actions.push(a); return true; }} />
    );

    const continueBtn = screen.getByRole('button', { name: /Continue to curriculum/i });
    expect(continueBtn.hasAttribute('disabled')).toBe(true);

    // With sources: button is enabled and calls begin_material_processing
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

    expect(screen.getByText(/Sources are saved\. Continue below to understand your material\./i)).toBeTruthy();
    expect(continueBtn.hasAttribute('disabled')).toBe(false);

    await act(async () => {
      fireEvent.click(continueBtn);
    });

    expect(fake.actions).toContainEqual({ type: 'begin_material_processing' });
  });

  it('11. Renders Supported sources and limits and Connected accounts accordions', () => {
    const ws = createMaterialWorkspace();
    render(<MaterialStageView workspace={ws} dispatchAction={async a => { fake.actions.push(a); return true; }} />);

    expect(screen.getByText('Supported sources and limits')).toBeTruthy();
    expect(screen.getByText('Connected accounts')).toBeTruthy();
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

  it('12. Renders top starting point tabs and dispatches back_to_starting_point on Back click', async () => {
    fake.state = createMaterialWorkspace();
    render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);

    // Compact StartingPoint tabs:
    const tab1 = screen.getByRole('button', { name: /I already have material/i });
    const tab2 = screen.getByRole('button', { name: /Find material for me/i });
    const tab3 = screen.getByRole('button', { name: /I just have a goal/i });

    expect(tab1).toBeTruthy();
    expect(tab2).toBeTruthy();
    expect(tab3).toBeTruthy();

    expect(tab1.getAttribute('aria-pressed')).toBe('true');

    // Click back button:
    const backBtn = screen.getByRole('button', { name: /Back to starting point/i });
    await act(async () => {
      fireEvent.click(backBtn);
    });

    expect(fake.actions).toContainEqual({ type: 'back_to_starting_point' });
  });

  it('13. Allows switching starting point tab via back_to_starting_point and choose_starting_point', async () => {
    fake.state = createMaterialWorkspace();
    render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);

    const tabFind = screen.getByRole('button', { name: /Find material for me/i });
    await act(async () => {
      fireEvent.click(tabFind);
    });

    expect(fake.actions).toContainEqual({ type: 'back_to_starting_point' });
    expect(fake.actions).toContainEqual({
      type: 'choose_starting_point',
      choice: 'find_material',
    });
  });

  it('14. Suppresses stepper nav during material_input stage', () => {
    fake.state = createMaterialWorkspace();
    render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);

    expect(screen.queryByRole('list', { name: 'Creation journey progress' })).toBeNull();
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GithubMaterial } from '../components/GithubMaterial';
import { TextMaterial } from '../components/TextMaterial';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';

afterEach(cleanup);
describe('explicit GitHub path scope', () => {
  it('restores saved paths/ref and sends only bounded user choices', async () => {
    const onAcquire = vi.fn().mockResolvedValue(true);
    render(<GithubMaterial disabled={false} initialUrl="https://github.com/Example/Lessons" initialScope={{ ref: 'lesson-branch', paths: ['README.md', 'docs'] }} onAcquire={onAcquire} />);
    expect((screen.getByLabelText('Repository paths (one per line)') as HTMLTextAreaElement).value).toBe('README.md\ndocs');
    fireEvent.click(screen.getByRole('button', { name: 'Acquire selected GitHub files' }));
    await waitFor(() => expect(onAcquire).toHaveBeenCalledWith({ url: 'https://github.com/Example/Lessons', ref: 'lesson-branch', paths: ['README.md', 'docs'] }));
    await waitFor(() => expect((screen.getByLabelText('GitHub repository URL') as HTMLInputElement).value).toBe(''));
  });
  it('rejects overlapping paths before a server request', () => {
    const onAcquire = vi.fn(); render(<GithubMaterial disabled={false} initialUrl="https://github.com/Example/Lessons" onAcquire={onAcquire} />);
    fireEvent.change(screen.getByLabelText('Repository paths (one per line)'), { target: { value: 'docs\ndocs/lesson.md' } });
    fireEvent.click(screen.getByRole('button', { name: 'Acquire selected GitHub files' }));
    expect(screen.getByRole('alert').textContent).toContain('non-overlapping'); expect(onAcquire).not.toHaveBeenCalled();
  });
  it('blocks duplicate submissions and preserves scope when queueing fails', async () => {
    let resolve!: (value: boolean) => void; const onAcquire = vi.fn(() => new Promise<boolean>(done => { resolve = done; }));
    render(<GithubMaterial disabled={false} initialUrl="https://github.com/Example/Lessons" onAcquire={onAcquire} />);
    const form = screen.getByRole('form', { name: 'GitHub material scope' }); fireEvent.submit(form); fireEvent.submit(form);
    expect(onAcquire).toHaveBeenCalledOnce(); expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    resolve(false); await waitFor(() => expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false));
    expect((screen.getByLabelText('GitHub repository URL') as HTMLInputElement).value).toBe('https://github.com/Example/Lessons');
    expect((screen.getByLabelText('Repository paths (one per line)') as HTMLTextAreaElement).value).toBe('README.md');
  });
  it('routes a pasted GitHub link to explicit scope selection before acquisition', async () => {
    const onGithub = vi.fn().mockResolvedValue(true); const onWeb = vi.fn();
    render(<TextMaterial snapshot={initialSnapshot(draftId)} uploading={false} pending={false} onUpload={vi.fn()}
      onCancelUpload={vi.fn()} onCancel={vi.fn()} onRetry={vi.fn()} onRemove={vi.fn()} onWeb={onWeb} onGithub={onGithub} />);
    fireEvent.click(screen.getByRole('button', { name: 'Paste a link' }));
    fireEvent.change(screen.getByLabelText('Public article or YouTube URL'), { target: { value: 'https://github.com/Example/Lessons' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and acquire material' }));
    expect(screen.getByLabelText('GitHub repository URL')).toBeTruthy(); expect(onWeb).not.toHaveBeenCalled(); expect(onGithub).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Repository paths (one per line)'), { target: { value: 'docs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Acquire selected GitHub files' }));
    await waitFor(() => expect(onGithub).toHaveBeenCalledWith({ url: 'https://github.com/Example/Lessons', ref: null, paths: ['docs'] }, undefined));
  });
  it('retries a failed GitHub source with the same saved scope and source ID', async () => {
    const snapshot = initialSnapshot(draftId); const onGithub = vi.fn().mockResolvedValue(true); const onWeb = vi.fn();
    render(<TextMaterial snapshot={{ ...snapshot, materials: [{ id: draftId, kind: 'github', status: 'failed', selectedUnitIds: [],
      input: { kind: 'url', url: 'https://github.com/Example/Lessons', repositoryScope: { ref: 'pinned-branch', paths: ['docs'] } } }] }}
      uploading={false} pending={false} onUpload={vi.fn()} onCancelUpload={vi.fn()} onCancel={vi.fn()} onRetry={vi.fn()} onRemove={vi.fn()} onWeb={onWeb} onGithub={onGithub} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry source 1' }));
    await waitFor(() => expect(onGithub).toHaveBeenCalledWith({ url: 'https://github.com/Example/Lessons', ref: 'pinned-branch', paths: ['docs'] }, draftId));
    expect(onWeb).not.toHaveBeenCalled();
  });
});

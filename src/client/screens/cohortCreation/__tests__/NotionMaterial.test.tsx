// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NotionMaterial } from '../components/NotionMaterial';
import { TextMaterial } from '../components/TextMaterial';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';

afterEach(cleanup);
const url = 'https://www.notion.so/11111111111141118111111111111111';
describe('explicit connected Notion selection', () => {
  it('preserves the selected page on failed queueing and blocks duplicate submissions', async () => {
    let resolve!: (saved: boolean) => void; const onAcquire = vi.fn(() => new Promise<boolean>(done => { resolve = done; }));
    render(<NotionMaterial disabled={false} initialUrl={url} onAcquire={onAcquire} />);
    const form = screen.getByRole('form', { name: 'Connected Notion page' }); fireEvent.submit(form); fireEvent.submit(form);
    expect(onAcquire).toHaveBeenCalledExactlyOnceWith(url);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    resolve(false); await waitFor(() => expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false));
    expect((screen.getByLabelText('Notion page URL') as HTMLInputElement).value).toBe(url);
  });
  it('clears the link only after confirmed saving and explains supported-text scope', async () => {
    const onAcquire = vi.fn().mockResolvedValue(true);
    render(<NotionMaterial disabled={false} initialUrl={url} onAcquire={onAcquire} />);
    expect(screen.getByText(/Linked pages, databases and media are recorded as omissions/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Acquire connected Notion page' }));
    await waitFor(() => expect((screen.getByLabelText('Notion page URL') as HTMLInputElement).value).toBe(''));
  });
  it('routes a pasted Notion URL to explicit connected page selection rather than public web extraction', async () => {
    const onNotion = vi.fn().mockResolvedValue(true); const onWeb = vi.fn();
    render(<TextMaterial snapshot={initialSnapshot(draftId)} uploading={false} pending={false} onUpload={vi.fn()}
      onCancelUpload={vi.fn()} onCancel={vi.fn()} onRetry={vi.fn()} onRemove={vi.fn()} onWeb={onWeb} onNotion={onNotion} />);
    fireEvent.click(screen.getByRole('button', { name: 'Paste a link' }));
    fireEvent.change(screen.getByLabelText('Public article or YouTube URL'), { target: { value: url } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and acquire material' }));
    expect(screen.getByLabelText('Notion page URL')).toBeTruthy(); expect(onWeb).not.toHaveBeenCalled(); expect(onNotion).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Acquire connected Notion page' }));
    await waitFor(() => expect(onNotion).toHaveBeenCalledWith(url, undefined));
  });
  it('restores owned page scope on replacement and retries a failed page with its existing material identity', async () => {
    const onNotion = vi.fn().mockResolvedValue(false); const onWeb = vi.fn();
    render(<TextMaterial snapshot={{ ...initialSnapshot(draftId), materials: [{ id: draftId, kind: 'notion',
      input: { kind: 'url', url }, status: 'failed', selectedUnitIds: [] }] }} uploading={false} pending={false} onUpload={vi.fn()}
      onCancelUpload={vi.fn()} onCancel={vi.fn()} onRetry={vi.fn()} onRemove={vi.fn()} onWeb={onWeb} onNotion={onNotion} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry source 1' }));
    await waitFor(() => expect(onNotion).toHaveBeenCalledWith(url, draftId)); expect(onWeb).not.toHaveBeenCalled();
    await waitFor(() => expect((screen.getByRole('button', { name: 'Replace source 1' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Replace source 1' })); fireEvent.click(screen.getByRole('button', { name: 'Notion page' }));
    expect((screen.getByLabelText('Notion page URL') as HTMLInputElement).value).toBe(url);
  });
});

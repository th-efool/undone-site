// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CreationConnections } from '../components/CreationConnections';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const json = (value: unknown, status = 200) => Response.json(value, { status });
describe('source connections panel', () => {
  it('loads only on demand and does not change draft/material state', async () => {
    const fetch = vi.fn(async () => json({ github: 'connected', notion: 'not_connected' }));
    vi.stubGlobal('fetch', fetch);
    render(<CreationConnections draftId={draftId} />);
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Show connections' }));
    await screen.findByText('GitHub: Connected');
    expect(fetch).toHaveBeenCalledWith(`/api/cohort-creation/drafts/${draftId}/connectors`, expect.objectContaining({ method: 'GET', credentials: 'same-origin' }));
  });
  it('connects only the selected provider and follows the server-validated Hub URL', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({ github: 'not_connected', notion: 'not_connected' }))
      .mockResolvedValueOnce(json({ connectUrl: 'https://auth.corsair.dev/connect/session' }));
    vi.stubGlobal('fetch', fetch); const navigate = vi.fn();
    render(<CreationConnections draftId={draftId} navigate={navigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show connections' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Connect Notion' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('https://auth.corsair.dev/connect/session'));
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ plugin: 'notion' }) });
  });
  it('disconnects one provider without changing the other connection', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({ github: 'connected', notion: 'connected' }))
      .mockResolvedValueOnce(json({ ok: true, disconnected: true }));
    vi.stubGlobal('fetch', fetch);
    render(<CreationConnections draftId={draftId} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show connections' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect GitHub' }));
    await screen.findByText('GitHub: Not connected');
    expect(screen.getByText('Notion: Connected')).toBeTruthy();
  });
  it('keeps failures retryable and prevents duplicate requests while pending', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json({ github: 'connected', notion: 'connected' }));
    vi.stubGlobal('fetch', fetch);
    render(<CreationConnections draftId={draftId} />);
    const button = screen.getByRole('button', { name: 'Show connections' });
    fireEvent.click(button); fireEvent.click(button);
    await screen.findByRole('alert');
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(button);
    await screen.findByText('Notion: Connected');
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('never navigates to a forged URL and disables actions when the draft is not saved', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({ github: 'not_connected', notion: 'not_connected' }))
      .mockResolvedValueOnce(json({ connectUrl: 'https://evil.test/' }));
    vi.stubGlobal('fetch', fetch); const navigate = vi.fn();
    const { rerender } = render(<CreationConnections draftId={draftId} disabled navigate={navigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show connections' }));
    expect(fetch).not.toHaveBeenCalled();
    rerender(<CreationConnections draftId={draftId} navigate={navigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show connections' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Connect GitHub' }));
    await screen.findByText('Invalid connection response.');
    expect(navigate).not.toHaveBeenCalled();
  });
});

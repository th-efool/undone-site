'use client';
import { useRef, useState, type MouseEvent } from 'react';
import { creationConnectionStatusSchema, creationConnectorSchema, type CreationConnectionStatus, type CreationConnector } from '@/src/shared/cohort-creation/connectors';

export function CreationConnections({ draftId, disabled = false, navigate = url => window.location.assign(url) }: {
  draftId: string; disabled?: boolean; navigate?: (url: string) => void;
}) {
  const [status, setStatus] = useState<CreationConnectionStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const running = useRef(false);
  async function command(method: 'GET' | 'POST' | 'DELETE', plugin?: CreationConnector) {
    if (running.current || disabled) return;
    running.current = true; setPending(true); setMessage('');
    try {
      const endpoint = `/api/cohort-creation/drafts/${encodeURIComponent(draftId)}/connectors`;
      const response = await fetch(endpoint, { method, credentials: 'same-origin', cache: 'no-store',
        signal: AbortSignal.timeout(30_000), ...(plugin ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plugin }) } : {}) });
      if (!response.ok) throw new Error(response.status === 401 ? 'Sign in again to manage connections.' : 'Connections are unavailable. Try again.');
      const result: unknown = await response.json();
      if (method === 'POST') {
        if (!result || typeof result !== 'object' || !('connectUrl' in result) || typeof result.connectUrl !== 'string') throw new Error('Invalid connection response.');
        const url = new URL(result.connectUrl);
        if (url.protocol !== 'https:' || url.hostname !== 'auth.corsair.dev' || url.username || url.password || url.port) throw new Error('Invalid connection response.');
        navigate(url.href);
      } else if (method === 'GET') setStatus(creationConnectionStatusSchema.parse(result));
      else setStatus(previous => previous && plugin ? { ...previous, [plugin]: 'not_connected' } : previous);
    } catch (error) {
      setMessage(error instanceof Error && ['Sign in again to manage connections.', 'Invalid connection response.'].includes(error.message)
        ? error.message : 'Connections are unavailable. Try again.');
    } finally { running.current = false; setPending(false); }
  }
  function handleProviderClick(event: MouseEvent<HTMLButtonElement>) {
    const plugin = creationConnectorSchema.parse(event.currentTarget.dataset.plugin);
    void command(event.currentTarget.dataset.action === 'disconnect' ? 'DELETE' : 'POST', plugin);
  }
  return <section aria-label="Source account connections">
    <h2>Account connections</h2>
    <p>Manage access to your GitHub and Notion accounts. Choose material separately.</p>
    <button type="button" disabled={disabled || pending} onClick={() => void command('GET')}>{status ? 'Refresh connections' : 'Show connections'}</button>
    {pending && <p role="status">Checking connection…</p>}
    {message && <p role="alert">{message}</p>}
    {status && (['github', 'notion'] as const).map(plugin => <div key={plugin}>
      <span>{plugin === 'github' ? 'GitHub' : 'Notion'}: {status[plugin] === 'connected' ? 'Connected' : 'Not connected'}</span>{' '}
      <button type="button" disabled={disabled || pending} data-plugin={plugin}
        data-action={status[plugin] === 'connected' ? 'disconnect' : 'connect'} onClick={handleProviderClick}>
        {status[plugin] === 'connected' ? 'Disconnect' : 'Connect'} {plugin === 'github' ? 'GitHub' : 'Notion'}
      </button>
    </div>)}
  </section>;
}

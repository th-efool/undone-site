'use client';
import { useRef, useState } from 'react';
import styles from '../CreationExperience.module.css';

export function NotionMaterial({ disabled, initialUrl = '', onAcquire }: {
  disabled: boolean; initialUrl?: string; onAcquire: (url: string) => Promise<boolean>;
}) {
  const [url, setUrl] = useState(initialUrl); const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null); const saving = useRef(false);
  return <form className={styles.form} aria-label="Connected Notion page" onSubmit={async event => {
    event.preventDefault(); if (disabled || saving.current) return;
    saving.current = true; setPending(true); setError(null);
    try { if (await onAcquire(url)) setUrl(''); }
    catch { setError('The page could not be queued. Your link is still here; retry when ready.'); }
    finally { saving.current = false; setPending(false); }
  }}>
    <p>Connect Notion under Account connections, then select a page shared with that connection.</p>
    <label htmlFor="notion-page">Notion page URL</label>
    <input id="notion-page" type="url" required maxLength={2048} disabled={disabled || pending} value={url} onChange={event => setUrl(event.target.value)} />
    <p>Use a notion.so page link. Supported page text is retained with block references. Linked pages, databases and media are recorded as omissions, rather than imported.</p>
    <p>Limits: 2,000 blocks, eight levels and 1 MiB of text per page. Oversized pages fail without truncation.</p>
    {error && <p role="alert">{error}</p>}
    <button type="submit" disabled={disabled || pending}>Acquire connected Notion page</button>
  </form>;
}

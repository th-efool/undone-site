'use client';
import { useRef, useState } from 'react';
import { githubSelectionSchema, type GithubSelection } from '@/src/shared/cohort-creation/github';
import styles from '../CreationExperience.module.css';

export function GithubMaterial({ disabled, initialUrl = '', initialScope, onAcquire }: {
  disabled: boolean; initialUrl?: string; initialScope?: { ref: string | null; paths: string[]; connection?: 'github' };
  onAcquire: (selection: GithubSelection) => Promise<boolean>;
}) {
  const [url, setUrl] = useState(initialUrl); const [paths, setPaths] = useState(initialScope?.paths.join('\n') ?? 'README.md');
  const [ref, setRef] = useState(initialScope?.ref ?? ''); const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(initialScope?.connection === 'github');
  const saving = useRef(false); const [pending, setPending] = useState(false); const busy = disabled || pending;
  return <form className={styles.form} aria-label="GitHub material scope" onSubmit={async event => {
    event.preventDefault(); if (disabled || saving.current) return;
    const selected = githubSelectionSchema.safeParse({ url, ref: ref.trim() || null, paths: paths.split('\n').map(path => path.trim()).filter(Boolean),
      ...(connected ? { connection: 'github' } : {}) });
    if (!selected.success) { setError(selected.error.issues[0]?.message ?? 'Select repository paths.'); return; }
    setError(null); saving.current = true; setPending(true);
    try { if (await onAcquire(selected.data)) { setUrl(''); setRef(''); setPaths('README.md'); } }
    finally { saving.current = false; setPending(false); }
  }}>
    <p>Select README/docs text paths. A directory includes its readable text files. Public reads use no account credentials.</p>
    <label><input type="checkbox" checked={connected} disabled={busy} onChange={event => setConnected(event.target.checked)} />Use my connected GitHub account</label>
    {connected && <p>Connect GitHub under Account connections first. Only repository access granted to your account is used.</p>}
    <label htmlFor="github-repository">GitHub repository URL</label>
    <input id="github-repository" type="url" required maxLength={2048} disabled={busy} value={url} onChange={event => setUrl(event.target.value)} />
    <label htmlFor="github-paths">Repository paths (one per line)</label>
    <textarea id="github-paths" required disabled={busy} rows={4} value={paths} onChange={event => setPaths(event.target.value)} />
    <label htmlFor="github-ref">Branch, tag or commit (optional)</label>
    <input id="github-ref" maxLength={255} disabled={busy} value={ref} onChange={event => setRef(event.target.value)} />
    <p>The selected branch is resolved once to a commit. Limits: 100 text files, 1 MiB total, and remaining draft unit capacity. Symlinks, submodules and binary files are recorded as omissions.</p>
    {error && <p role="alert">{error}</p>}
    <button type="submit" disabled={busy}>Acquire selected GitHub files</button>
  </form>;
}

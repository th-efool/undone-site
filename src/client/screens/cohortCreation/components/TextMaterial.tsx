'use client';
import { useRef, useState } from 'react';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import styles from '../CreationExperience.module.css';

export function TextMaterial({ snapshot, uploading, pending, onUpload, onCancelUpload, onCancel, onRetry, onRemove }: {
  snapshot: CreationSnapshot; uploading: boolean; pending: boolean;
  onUpload: (bytes: Blob, filename: string, materialId?: string) => Promise<boolean>; onCancelUpload: () => void;
  onCancel: () => void; onRetry: (materialId: string, assetId: string) => void;
  onRemove: (materialId: string) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [replacementId, setReplacementId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const replacement = snapshot.materials.find(source => source.id === replacementId);
  const busy = pending || removing || snapshot.status === 'running';
  const select = (files: FileList | null) => {
    if (busy || !files?.length) return;
    if (files.length !== 1 || !/\.(md|markdown|txt)$/i.test(files[0].name)) {
      setFile(null);
      setError('Select one .md, .markdown or .txt file.'); return;
    }
    setFile(files[0]); setError(null); setMode('file');
  };
  return <section aria-label="Learning material" className={styles.material}>
    <h2>Add your learning material</h2>
    <p>UTF-8 text or Markdown, up to 1 MiB per source. Files and pasted text follow the same saved acquisition flow.</p>
    {replacementId && <p role={replacement ? 'status' : 'alert'}>{replacement ? `Replacing source ${snapshot.materials.indexOf(replacement) + 1}. The current source stays selected until the replacement is saved.` : 'This source is no longer selected. Cancel replacement before adding another source.'}
      <button type="button" disabled={busy} onClick={() => setReplacementId(null)}>Cancel replacement</button></p>}
    <div className={styles.cards}>
      <button type="button" disabled={busy} aria-pressed={mode === 'file'} onClick={() => setMode('file')}>Upload a file</button>
      <button type="button" disabled={busy} aria-pressed={mode === 'paste'} onClick={() => setMode('paste')}>Paste text</button>
    </div>
    <form className={styles.form} onSubmit={async event => {
      event.preventDefault(); if (busy || (replacementId && !replacement)) return;
      const bytes = mode === 'paste' ? new Blob([text], { type: 'text/plain' }) : file ? new Blob([file], { type: /\.(md|markdown)$/i.test(file.name) ? 'text/markdown' : 'text/plain' }) : null;
      if (!bytes) { setError('Choose a file first.'); return; }
      if (await onUpload(bytes, mode === 'paste' ? 'pasted-text.txt' : file!.name, replacementId ?? undefined)) { setText(''); setFile(null); setError(null); setReplacementId(null); if (picker.current) picker.current.value = ''; }
    }}>
      {mode === 'paste' ? <><label htmlFor="material-text">Learning text</label>
        <textarea id="material-text" disabled={busy} value={text} onChange={event => setText(event.target.value)} rows={8} required /></> :
        <div className={styles.drop} onDragOver={event => event.preventDefault()} onDrop={event => {
          event.preventDefault(); select(event.dataTransfer.files);
        }}>
          <label htmlFor="material-file">Choose or drop a text/Markdown file</label>
          <input ref={picker} id="material-file" type="file" accept=".md,.markdown,.txt" disabled={busy} onChange={event => select(event.target.files)} />
          {file && <p>Selected: {file.name}</p>}
        </div>}
      <button type="submit" disabled={busy || (!!replacementId && !replacement) || (!replacement && snapshot.materials.length >= 20)}>Save and acquire material</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {uploading ? <p role="status">Uploading material… <button onClick={onCancelUpload}>Cancel upload</button></p> : pending ? <p role="status">Queuing material acquisition…</p> : null}
    {snapshot.status === 'running' && <p role="status">Acquiring retained material. You can return later. <button onClick={onCancel}>Cancel acquisition</button></p>}
    {snapshot.error && <p role="alert">{snapshot.error.message}</p>}
    <ul>{snapshot.materials.map((source, index) => <li key={source.id}>
      Source {index + 1}: {source.status === 'ready' ? 'Retained text ready' : source.status === 'acquiring' ? 'Acquiring' : source.status === 'failed' ? 'Acquisition failed' : 'Selected; acquisition pending'}
      {source.status === 'ready' && <span> · {snapshot.extractions.find(extraction => extraction.materialId === source.id)?.segmentCount ?? 0} extracted segments</span>}
      {(source.status === 'failed' || source.status === 'pending') && source.input.kind === 'upload' &&
        <button disabled={busy} onClick={() => { if (source.input.kind === 'upload') onRetry(source.id, source.input.assetId); }}>Retry source {index + 1}</button>}
      <button type="button" disabled={busy} onClick={() => { setReplacementId(source.id); setError(null); }}>Replace source {index + 1}</button>
      <button type="button" disabled={busy} onClick={async () => {
        setRemoving(true);
        try { if (await onRemove(source.id) && replacementId === source.id) setReplacementId(null); }
        finally { setRemoving(false); }
      }}>Remove source {index + 1}</button>
    </li>)}</ul>
    {!!snapshot.extractions.length && <p>Sources are saved. Curriculum processing will be added in a later milestone.</p>}
  </section>;
}

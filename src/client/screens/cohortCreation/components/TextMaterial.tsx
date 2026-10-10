'use client';
import { useRef, useState } from 'react';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import styles from '../CreationExperience.module.css';
import { YoutubeUnits } from './YoutubeUnits';
import { GithubMaterial } from './GithubMaterial';
import { NotionMaterial } from './NotionMaterial';
import type { GithubSelection } from '@/src/shared/cohort-creation/github';

export function TextMaterial({ snapshot, uploading, pending, onUpload, onCancelUpload, onCancel, onRetry, onRemove, onWeb, onSelectUnits, onObserve, onGithub, onNotion }: {
  snapshot: CreationSnapshot; uploading: boolean; pending: boolean;
  onUpload: (bytes: Blob, filename: string, materialId?: string) => Promise<boolean>; onCancelUpload: () => void;
  onCancel: () => void; onRetry: (materialId: string, assetId: string) => void;
  onRemove: (materialId: string) => Promise<boolean>;
  onWeb: (url: string, materialId?: string) => Promise<boolean>;
  onSelectUnits?: (materialId: string, unitIds: string[]) => Promise<boolean>;
  onObserve?: (materialId: string) => Promise<boolean>;
  onGithub?: (selection: GithubSelection, materialId?: string) => Promise<boolean>;
  onNotion?: (url: string, materialId?: string) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<'file' | 'paste' | 'url' | 'github' | 'notion'>('file');
  const [url, setUrl] = useState('');
  const [queuing, setQueuing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [replacementId, setReplacementId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const replacement = snapshot.materials.find(source => source.id === replacementId);
  const busy = pending || queuing || removing || snapshot.status === 'running';
  const select = (files: FileList | null) => {
    if (busy || !files?.length) return;
    if (files.length !== 1 || !/\.(md|markdown|txt|pdf)$/i.test(files[0].name)) {
      setFile(null);
      setError('Select one .pdf, .md, .markdown or .txt file.'); return;
    }
    setFile(files[0]); setError(null); setMode('file');
  };
  return <section aria-label="Learning material" className={styles.material}>
    <h2>Add your learning material</h2>
    <p>UTF-8 text or Markdown, up to 1 MiB per source. Files and pasted text follow the same saved acquisition flow.</p>
    <p>PDFs: up to 25 MiB, 200 pages and 1 MiB extracted text. Text is anchored to pages; images and annotations are not interpreted. Scanned or blank pages require OCR text or a text alternative.</p>
    <p>Public HTTPS articles are captured on the server. Main-article text is selected from HTML; the full response remains retained. Login and JavaScript-only pages require upload or paste.</p>
    <p>Public YouTube links retain metadata for source selection. Save your video choices, then generate educational observations. These are AI interpretations with estimated timestamps, not transcripts or exhaustive coverage.</p>
    {replacementId && <p role={replacement ? 'status' : 'alert'}>{replacement ? `Replacing source ${snapshot.materials.indexOf(replacement) + 1}. The current source stays selected until the replacement is saved.` : 'This source is no longer selected. Cancel replacement before adding another source.'}
      <button type="button" disabled={busy} onClick={() => setReplacementId(null)}>Cancel replacement</button></p>}
    <div className={styles.cards}>
      <button type="button" disabled={busy} aria-pressed={mode === 'file'} onClick={() => setMode('file')}>Upload a file</button>
      <button type="button" disabled={busy} aria-pressed={mode === 'paste'} onClick={() => setMode('paste')}>Paste text</button>
      <button type="button" disabled={busy} aria-pressed={mode === 'url'} onClick={() => setMode('url')}>Paste a link</button>
      {onGithub && <button type="button" disabled={busy} aria-pressed={mode === 'github'} onClick={() => setMode('github')}>GitHub repository</button>}
      {onNotion && <button type="button" disabled={busy} aria-pressed={mode === 'notion'} onClick={() => setMode('notion')}>Notion page</button>}
    </div>
    {mode === 'notion' && onNotion ? <NotionMaterial key={replacementId ?? 'new'}
      disabled={busy || (!!replacementId && !replacement) || (!replacement && snapshot.materials.length >= 20)}
      initialUrl={replacement?.kind === 'notion' && replacement.input.kind === 'url' ? replacement.input.url : url}
      onAcquire={async selected => {
        setQueuing(true);
        try { const saved = await onNotion(selected, replacementId ?? undefined); if (saved) { setReplacementId(null); setUrl(''); } return saved; }
        finally { setQueuing(false); }
      }} /> : mode === 'github' && onGithub ? <GithubMaterial key={replacementId ?? 'new'}
      disabled={busy || (!!replacementId && !replacement) || (!replacement && snapshot.materials.length >= 20)}
      initialUrl={replacement?.kind === 'github' && replacement.input.kind === 'url' ? replacement.input.url : url}
      initialScope={replacement?.input.kind === 'url' ? replacement.input.repositoryScope : undefined}
      onAcquire={async selection => { setQueuing(true); try {
        const saved = await onGithub(selection, replacementId ?? undefined); if (saved) { setReplacementId(null); setUrl(''); setError(null); } return saved;
      } finally { setQueuing(false); } }} /> : <form className={styles.form} onSubmit={async event => {
      event.preventDefault(); if (busy || (replacementId && !replacement)) return;
        if (mode === 'url') {
          try { if (onNotion && ['notion.so', 'www.notion.so'].includes(new URL(url).hostname)) { setMode('notion'); return; } } catch { /* Server validates the URL. */ }
        if (onGithub) { try { if (new URL(url).hostname === 'github.com') { setMode('github'); return; } } catch { /* Server validates other URLs. */ } }
        setQueuing(true);
        try { if (await onWeb(url, replacementId ?? undefined)) { setUrl(''); setReplacementId(null); setError(null); } }
        finally { setQueuing(false); }
        return;
      }
      const bytes = mode === 'paste' ? new Blob([text], { type: 'text/plain' }) : file ? new Blob([file], { type: /\.pdf$/i.test(file.name) ? 'application/pdf' : /\.(md|markdown)$/i.test(file.name) ? 'text/markdown' : 'text/plain' }) : null;
      if (!bytes) { setError('Choose a file first.'); return; }
      if (await onUpload(bytes, mode === 'paste' ? 'pasted-text.txt' : file!.name, replacementId ?? undefined)) { setText(''); setFile(null); setError(null); setReplacementId(null); if (picker.current) picker.current.value = ''; }
    }}>
      {mode === 'url' ? <><label htmlFor="material-url">Public article or YouTube URL</label>
        <input id="material-url" type="url" required maxLength={2048} pattern="https://.*" disabled={busy} value={url} onChange={event => setUrl(event.target.value)} /></> : mode === 'paste' ? <><label htmlFor="material-text">Learning text</label>
        <textarea id="material-text" disabled={busy} value={text} onChange={event => setText(event.target.value)} rows={8} required /></> :
        <div className={styles.drop} onDragOver={event => event.preventDefault()} onDrop={event => {
          event.preventDefault(); select(event.dataTransfer.files);
        }}>
          <label htmlFor="material-file">Choose or drop a PDF/text/Markdown file</label>
          <input ref={picker} id="material-file" type="file" accept=".pdf,.md,.markdown,.txt" disabled={busy} onChange={event => select(event.target.files)} />
          {file && <p>Selected: {file.name}</p>}
        </div>}
      <button type="submit" disabled={busy || (!!replacementId && !replacement) || (!replacement && snapshot.materials.length >= 20)}>Save and acquire material</button>
    </form>}
    {error && <p role="alert">{error}</p>}
    {uploading ? <p role="status">Uploading material… <button onClick={onCancelUpload}>Cancel upload</button></p> : pending ? <p role="status">Queuing material acquisition…</p> : null}
    {snapshot.status === 'running' && <p role="status">Acquiring retained material. You can return later. <button onClick={onCancel}>Cancel acquisition</button></p>}
    {queuing && <p role="status">Saving source selection…</p>}
    {snapshot.error && <p role="alert">{snapshot.error.message}</p>}
    <ul>{snapshot.materials.map((source, index) => <li key={source.id}>
      Source {index + 1}: {source.status === 'ready' ? ['youtube_video', 'youtube_playlist'].includes(source.kind) ? 'Retained video observations ready' : 'Retained text ready' : source.status === 'acquiring' ? 'Acquiring' : source.status === 'failed' ? 'Acquisition failed' : source.status === 'needs_input' ? 'Metadata retained; video observation pending' : 'Selected; acquisition pending'}
      {source.status === 'ready' && <span> · {snapshot.extractions.find(extraction => extraction.materialId === source.id)?.segmentCount ?? 0} extracted segments</span>}
      {source.input.kind === 'url' && <span> · {source.input.url}</span>}
      {snapshot.youtubeSources.find(preview => preview.materialId === source.id) && <span aria-live="polite"> · {snapshot.youtubeSources.find(preview => preview.materialId === source.id)!.observations.length} of {source.selectedUnitIds.length} selected video observations retained. Coverage is non-exhaustive; timestamps are estimated.</span>}
      {snapshot.extractions.find(extraction => extraction.materialId === source.id)?.selectionScope === 'main_article' && <span> · Main article selected; full page retained.</span>}
      {source.input.kind === 'url' && source.input.repositoryScope && <span> · Selected repository paths: {source.input.repositoryScope.paths.join(', ')}; ref: {source.input.repositoryScope.ref ?? 'default branch'}; access: {source.input.repositoryScope.connection ? 'your connected GitHub account' : 'public'}.</span>}
      {snapshot.extractions.find(extraction => extraction.materialId === source.id)?.selectionScope === 'selected_paths' && <span> · Exact text from selected paths retained; omissions are recorded in the source artifact.</span>}
      {snapshot.extractions.find(extraction => extraction.materialId === source.id)?.selectionScope === 'supported_page_text' && <span> · Supported Notion page text retained with block references; linked pages, databases and media are omitted.</span>}
      {!onSelectUnits && snapshot.youtubeSources.find(preview => preview.materialId === source.id) && <ul aria-label={`Source ${index + 1} videos`}>
        {snapshot.youtubeSources.find(preview => preview.materialId === source.id)!.units.map(unit => <li key={unit.unitId}>{unit.title} · {unit.durationSeconds} seconds</li>)}
      </ul>}
      {onSelectUnits && snapshot.youtubeSources.find(preview => preview.materialId === source.id) && <YoutubeUnits
        key={`${source.id}:${source.selectedUnitIds.join(',')}`} selected={source.selectedUnitIds}
        units={snapshot.youtubeSources.find(preview => preview.materialId === source.id)!.units} disabled={busy}
        onSave={ids => onSelectUnits(source.id, ids)} />}
      {onObserve && snapshot.youtubeSources.some(preview => preview.materialId === source.id) && source.status !== 'ready' &&
        <button disabled={busy || !source.selectedUnitIds.length} onClick={async () => {
          setQueuing(true); try { await onObserve(source.id); } finally { setQueuing(false); }
        }}>{source.status === 'failed' || source.status === 'pending' ? 'Resume' : 'Generate'} selected video observations for source {index + 1}</button>}
      {(source.status === 'failed' || source.status === 'pending') && source.input.kind === 'upload' &&
        <button disabled={busy} onClick={() => { if (source.input.kind === 'upload') onRetry(source.id, source.input.assetId); }}>Retry source {index + 1}</button>}
      {(source.status === 'failed' || source.status === 'pending') && source.input.kind === 'url' && !snapshot.youtubeSources.some(preview => preview.materialId === source.id) &&
        <button disabled={busy || source.kind === 'notion' && !onNotion} onClick={async () => {
          if (source.input.kind !== 'url') return; setQueuing(true);
          try { if (source.kind === 'github' && source.input.repositoryScope && onGithub) await onGithub({ url: source.input.url, ...source.input.repositoryScope }, source.id);
            else if (source.kind === 'notion') await onNotion?.(source.input.url, source.id);
            else await onWeb(source.input.url, source.id); } finally { setQueuing(false); }
        }}>Retry source {index + 1}</button>}
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

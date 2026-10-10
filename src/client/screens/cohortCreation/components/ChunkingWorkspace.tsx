'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight, FileText, Lightbulb } from 'lucide-react';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import type { ChunkingPreview } from '@/src/shared/cohort-creation/chunking';
import { loadChunkingPreview } from '../services/chunkingApi';
import { InkUnderline } from './InkUnderline';
import { ProcessingSteps } from './ProcessingSteps';
import shared from './UnderstandingProgress.module.css';
import styles from './ChunkingWorkspace.module.css';

export function ChunkingWorkspace({ snapshot, children }: { snapshot: CreationSnapshot; children: ReactNode }) {
  const [loaded, setLoaded] = useState<ChunkingPreview | null>(null);
  const [error, setError] = useState<{ revision: number; message: string } | null>(null);
  const [retry, setRetry] = useState(0); const [selected, setSelected] = useState<string | null>(null);
  const operation = snapshot.processing?.chunking; const checkpoint = operation?.checkpoint;
  const accepted = checkpoint?.completed.length ?? 0;
  useEffect(() => {
    if (!accepted) return;
    const controller = new AbortController();
    void loadChunkingPreview(snapshot.draftId, controller.signal).then(value => {
      if (!controller.signal.aborted) { setLoaded(value); setError(null); }
    }).catch(reason => { if (!controller.signal.aborted) setError({ revision: snapshot.revision, message: reason instanceof Error ? reason.message : 'Chunks unavailable.' }); });
    return () => controller.abort();
  }, [snapshot.draftId, snapshot.revision, accepted, retry]);
  const chunks = loaded?.revision === snapshot.revision ? loaded.chunks : [];
  const sources = snapshot.materials.flatMap<{ key: string; materialId: string; unitId: string | null; title: string; duration: number | null }>((material, index) => {
    const videos = snapshot.youtubeSources.find(item => item.materialId === material.id)?.units.filter(unit => material.selectedUnitIds.includes(unit.unitId));
    const title = material.input.kind === 'url' ? material.input.url : `Source ${index + 1} · ${material.kind === 'pdf' ? 'PDF' : 'Text / Markdown'}`;
    return videos?.length ? videos.map(unit => ({ key: `${material.id}:${unit.unitId}`, materialId: material.id, unitId: unit.unitId, title: unit.title, duration: unit.durationSeconds })) :
      [{ key: `${material.id}:${material.selectedUnitIds[0] ?? material.id}`, materialId: material.id, unitId: null, title, duration: null }];
  });
  const source = sources.find(item => item.key === selected) ?? sources[0];
  const selectedChunks = chunks.filter(chunk => chunk.materialId === source?.materialId && (!source.unitId || chunk.unitId === source.unitId));
  return <section aria-label="Chunking material" className={shared.workspace}>
    <ProcessingSteps current={1} />
    <div className={shared.columns}><div><header className={shared.heading}>
      <p className={shared.eyebrow}>Turning content into learning pieces</p>
      <h1>{operation?.complete ? <>Your learning<br /><span>chunks are saved.<InkUnderline className={shared.underline} /></span></> : <>Finding natural<br /><span>learning chunks…<InkUnderline className={shared.underline} /></span></>}</h1>
      <p>I’m breaking the material into meaningful pieces, based on its topics and source evidence.</p>
    </header>
    <div className={shared.inventory}><h2><FileText size={22} aria-hidden="true" />Selected material<span>{sources.length} {sources.length === 1 ? 'source' : 'sources'}</span></h2>
      <fieldset className={styles.sourceList}><legend className={styles.srOnly}>Select a source to inspect its chunks</legend>
        {sources.map((item, index) => <label key={item.key} className={styles.source} data-selected={item.key === source?.key}>
          <input type="radio" name="chunk-source" checked={item.key === source?.key} onChange={() => setSelected(item.key)} />
          <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span><span className={styles.sourceTitle}>{item.title}
            {item.duration !== null && <small>{Math.ceil(item.duration / 60)} source minutes</small>}</span>
          <small>{loaded?.revision === snapshot.revision ? `${chunks.filter(chunk => chunk.materialId === item.materialId && (!item.unitId || chunk.unitId === item.unitId)).length} chunks` : 'Pending preview'}</small><ChevronRight size={16} aria-hidden="true" />
        </label>)}
      </fieldset>
      <div className={shared.progress}>{checkpoint ? <><progress max={checkpoint.total} value={accepted} aria-label="Content partitions chunked" /><span>{accepted}/{checkpoint.total} partitions</span></> : <span>Reading retained understanding…</span>}</div>
      <div className={shared.controls}>{children}</div>
    </div></div>
    <aside className={styles.detail} id="creation-accepted-chunks" aria-label="Accepted chunks">
      <div className={styles.detailMeta}><span>Selected source</span><span>{loaded?.revision === snapshot.revision ? `${selectedChunks.length} accepted chunks loaded` : 'Waiting for preview'}</span></div>
      <h2>{source?.title ?? 'Your learning pieces'}</h2><p className={styles.intro}>Natural boundaries, grounded in your retained material.</p>
      {error?.revision === snapshot.revision ? <p role="alert">{error.message} <button onClick={() => setRetry(value => value + 1)}>Reload chunks</button></p> : !selectedChunks.length ?
        <p role="status" className={styles.empty}>{accepted && loaded?.revision !== snapshot.revision ? 'Loading accepted chunks…' : 'Chunks appear here when this source has accepted boundaries.'}</p> :
        <ol className={styles.chunks}>{selectedChunks.map((chunk, index) => <li key={chunk.id}><details>
          <summary><span className={styles.chunkNumber}>{String(index + 1).padStart(2, '0')}</span><span><small>{Math.ceil(chunk.durationSeconds / 60)} min · {chunk.durationMethod === 'source' ? 'source duration' : chunk.durationMethod === 'reading_estimate' ? 'reading estimate' : 'model estimate'}</small>
            <strong>{chunk.title.value}</strong><span className={styles.teaser}>{chunk.summary.value}</span></span><ChevronRight size={17} aria-hidden="true" /></summary>
          <div className={styles.evidence}><p>Content origin: {chunk.contentOrigin}. Coverage: {chunk.coverage.scope}{chunk.coverage.exhaustive ? '.' : ' (non-exhaustive).'}</p>
            <ul>{chunk.sourceRefs.map(ref => <li key={ref.segmentId}>{ref.anchor.kind === 'video' ? `${ref.anchor.startSeconds}–${ref.anchor.endSeconds}s${ref.anchor.estimated ? ' (estimated)' : ''}` :
              ref.anchor.kind === 'page' ? `Page ${ref.anchor.page}` : ref.anchor.kind === 'file' ? `${ref.anchor.path}:${ref.anchor.startLine}–${ref.anchor.endLine}` : ref.anchor.kind === 'block' ? `Block ${ref.anchor.blockId}` : `Text offsets ${ref.anchor.start}–${ref.anchor.end}`} · {ref.segmentId}</li>)}</ul>
            {!!chunk.coverage.limitations.length && <ul>{chunk.coverage.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul>}
          </div>
        </details></li>)}</ol>}
      <div className={shared.insight}><Lightbulb size={27} aria-hidden="true" /><p><strong>{checkpoint ? `${checkpoint.completed.reduce((sum, item) => sum + item.chunkCount, 0)} chunks accepted so far.` : 'Waiting for accepted chunk counts.'}</strong><span>Source boundaries and evidence are retained. Analysis comes next.</span></p></div>
    </aside></div>
  </section>;
}

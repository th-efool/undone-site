'use client';
import { useRef, useState } from 'react';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { FileText, Check, LoaderCircle } from 'lucide-react';
import { InkUnderline } from './InkUnderline';
import { UnderstandingConcepts } from './UnderstandingConcepts';
import { ProcessingSteps } from './ProcessingSteps';
import styles from './UnderstandingProgress.module.css';

export function UnderstandingProgress({ snapshot, disabled, onStart, onCancel, onBack, onChunk }: {
  snapshot: CreationSnapshot; disabled: boolean; onStart: () => Promise<boolean>; onCancel: () => void; onBack: () => Promise<boolean>;
  onChunk?: () => Promise<boolean>;
}) {
  const [pending, setPending] = useState(false); const saving = useRef(false);
  const checkpoint = snapshot.processing?.checkpoint; const running = snapshot.stage === 'processing' && snapshot.status === 'running';
  const start = async () => {
    if (disabled || pending || saving.current || running) return;
    saving.current = true; setPending(true);
    try { await onStart(); } finally { saving.current = false; setPending(false); }
  };
  const ready = !!snapshot.materials.length && snapshot.materials.every(source => source.status === 'ready') && snapshot.extractions.length === snapshot.materials.length;
  const controls = <div className={styles.controls}>{running ? <div role="status">
      <p>{checkpoint ? `${checkpoint.completed.length} of ${checkpoint.total} retained content partitions understood.` : 'Validating retained content; partition total is not known yet.'}</p>
      <p>Work is saved to your account. You can close this page and return.</p>
      <button onClick={onCancel}>Cancel understanding</button>
    </div> : <>
      {snapshot.processing?.complete ? <p role="status">Understanding complete. Retained summaries and concept evidence are saved. Continue to chunking before building your curriculum.</p>
        : snapshot.stage === 'processing' && <p role="status">Understanding {snapshot.status === 'canceled' ? 'canceled' : 'stopped'}. Accepted partitions remain saved.</p>}
      {snapshot.error && snapshot.stage === 'processing' && <p role="alert">{snapshot.error.message}</p>}
      {snapshot.processing && !snapshot.processing.complete && <p>A fresh request starts understanding again. Automatic worker retries reuse saved partitions.</p>}
      <button disabled={disabled || pending || !ready} onClick={start}>{snapshot.processing ? 'Start fresh understanding' : 'Understand selected material'}</button>
      {snapshot.processing?.complete && onChunk && <button disabled={disabled || pending} onClick={() => void onChunk()}>Chunk selected material</button>}
      {!ready && <p>Acquire all selected sources before continuing.</p>}
      {snapshot.stage === 'processing' && <button disabled={disabled || pending} onClick={() => void onBack()}>Back to material</button>}
    </>}</div>;
  if (snapshot.stage !== 'processing') return <section className={styles.embedded} aria-label="Understanding material"><h2>Understanding</h2>{controls}</section>;
  return <section aria-label="Understanding material" className={styles.workspace}>
    <ProcessingSteps current={0} />
    <div className={styles.columns}><div><header className={styles.heading}>
      <p className={styles.eyebrow}>Understanding your material</p><h1>{snapshot.processing?.complete ? <>Your content,<br /><span>understood.<InkUnderline className={styles.underline} /></span></> : <>Reading through<br /><span>your content…<InkUnderline className={styles.underline} /></span></>}</h1>
      <p>I’m working with your retained sources and the evidence in them.</p>
    </header>
    <div className={styles.inventory}><h2><FileText size={22} aria-hidden="true" />Selected material<span>{snapshot.materials.length} {snapshot.materials.length === 1 ? 'source' : 'sources'}</span></h2>
      <ul>{snapshot.materials.map((source, index) => {
        const extraction = snapshot.extractions.find(item => item.materialId === source.id);
        const videos = snapshot.youtubeSources.find(item => item.materialId === source.id)?.units.filter(unit => source.selectedUnitIds.includes(unit.unitId)) ?? [];
        return <li key={source.id}><div className={styles.source}><span className={styles.sourceNumber}>{String(index + 1).padStart(2, '0')}</span><div>
          <strong>{source.input.kind === 'url' ? source.input.url : `Source ${index + 1} · ${source.kind === 'pdf' ? 'PDF' : 'Text / Markdown'}`}</strong>
          <p>{extraction?.segmentCount ?? 0} retained segments · {extraction?.extractionKind.replaceAll('_', ' ') ?? source.status}</p>
        </div><Check size={18} aria-label="Content acquired" /></div>
        {!!videos.length && <ol className={styles.videos}>{videos.map(unit => <li key={unit.unitId}><span>{unit.title}</span><small>{Math.ceil(unit.durationSeconds / 60)} min</small></li>)}</ol>}
        </li>;
      })}</ul>
      <div className={styles.progress}>{checkpoint ? <><progress max={checkpoint.total} value={checkpoint.completed.length} aria-label="Content partitions understood" /><span>{checkpoint.completed.length}/{checkpoint.total} partitions</span></> : <><LoaderCircle size={18} aria-hidden="true" /><span>Reading source inventory…</span></>}</div>
      {controls}
    </div></div><UnderstandingConcepts snapshot={snapshot} /></div>
  </section>;
}

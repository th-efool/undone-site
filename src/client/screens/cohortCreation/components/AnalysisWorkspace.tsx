'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight, FileText, Lightbulb } from 'lucide-react';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import type { AnalysisPreview } from '@/src/shared/cohort-creation/analysis-preview';
import { PEDAGOGICAL_DIMENSIONS, type PedagogicalDimension } from '@/src/shared/curriculum/pedagogicalVector.types';
import { loadAnalysisPreview } from '../services/analysisApi';
import { InkUnderline } from './InkUnderline';
import { ProcessingSteps } from './ProcessingSteps';
import shared from './UnderstandingProgress.module.css';
import chunks from './ChunkingWorkspace.module.css';
import styles from './AnalysisWorkspace.module.css';

const labels: Record<PedagogicalDimension, string> = {
  cognitive_load: 'Cognitive load', practicality_actionability: 'Practicality', visual_dependence: 'Visual dependence',
  scaffolding_guidance: 'Guidance', linearity_dependency: 'Dependency', novelty_divergence: 'Novelty',
  abstraction_depth: 'Abstraction depth', pacing_density: 'Pacing / density', rigor_formality: 'Rigor',
  interactivity_agency: 'Interactivity', breadth_scope: 'Breadth', emotional_energy: 'Emotional energy',
};
const summaryDimensions: PedagogicalDimension[] = ['cognitive_load', 'practicality_actionability', 'visual_dependence', 'abstraction_depth', 'interactivity_agency'];

export function AnalysisWorkspace({ snapshot, children }: { snapshot: CreationSnapshot; children: ReactNode }) {
  const [loaded, setLoaded] = useState<AnalysisPreview | null>(null);
  const [error, setError] = useState<{ revision: number; message: string } | null>(null);
  const [retry, setRetry] = useState(0); const [selected, setSelected] = useState<string | null>(null);
  const operation = snapshot.processing?.analysis; const checkpoint = operation?.checkpoint;
  const accepted = checkpoint?.completed.length ?? 0;
  useEffect(() => {
    if (!checkpoint) return;
    const controller = new AbortController();
    void loadAnalysisPreview(snapshot.draftId, controller.signal).then(value => {
      if (!controller.signal.aborted) { setLoaded(value); setError(null); }
    }).catch(reason => { if (!controller.signal.aborted) setError({ revision: snapshot.revision, message: reason instanceof Error ? reason.message : 'Analysis unavailable.' }); });
    return () => controller.abort();
  }, [snapshot.draftId, snapshot.revision, checkpoint, retry]);
  const preview = loaded?.revision === snapshot.revision ? loaded : null;
  const analyses = new Map(preview?.analyses.map(item => [item.chunkId, item]));
  const sources = snapshot.materials.flatMap<{ key: string; materialId: string; unitId: string | null; title: string }>((material, index) => {
    const units = snapshot.youtubeSources.find(item => item.materialId === material.id)?.units.filter(unit => material.selectedUnitIds.includes(unit.unitId));
    return units?.length ? units.map(unit => ({ key: `${material.id}:${unit.unitId}`, materialId: material.id, unitId: unit.unitId, title: unit.title })) :
      [{ key: material.id, materialId: material.id, unitId: null, title: material.input.kind === 'url' ? material.input.url : `Source ${index + 1} · ${material.kind === 'pdf' ? 'PDF' : 'Text / Markdown'}` }];
  });
  const source = sources.find(item => item.key === selected) ?? sources[0];
  const sourceChunks = (item: typeof source) => preview?.chunks.filter(chunk => chunk.materialId === item?.materialId && (!item.unitId || chunk.unitId === item.unitId)) ?? [];
  const selectedChunks = sourceChunks(source);
  return <section aria-label="Analysis workspace" className={shared.workspace}>
    <ProcessingSteps current={2} />
    <div className={shared.columns}><div><header className={shared.heading}>
      <p className={shared.eyebrow}>Analyzing your material</p>
      <h1>{operation?.complete ? <>Each piece,<br /><span>understood.<InkUnderline className={shared.underline} /></span></> : <>Understanding<br /><span>each piece…<InkUnderline className={shared.underline} /></span></>}</h1>
      <p>I’m analyzing what each chunk is about, how complex it is, and how it fits into your learning experience.</p>
    </header>
    <div className={shared.inventory}><h2><FileText size={22} aria-hidden="true" />Selected material<span>{sources.length} {sources.length === 1 ? 'source' : 'sources'}</span></h2>
      <fieldset className={chunks.sourceList}><legend className={chunks.srOnly}>Select a source to inspect its analysis</legend>
        {sources.map((item, index) => <label key={item.key} className={chunks.source} data-selected={item.key === source?.key}>
          <input type="radio" name="analysis-source" checked={item.key === source?.key} onChange={() => setSelected(item.key)} />
          <span className={chunks.number}>{String(index + 1).padStart(2, '0')}</span><span className={chunks.sourceTitle}>{item.title}</span>
          <small>{preview ? `${sourceChunks(item).filter(chunk => analyses.has(chunk.id)).length}/${sourceChunks(item).length} analyzed` : 'Pending preview'}</small><ChevronRight size={16} aria-hidden="true" />
        </label>)}
      </fieldset>
      <div className={shared.progress}>{checkpoint ? <><progress max={checkpoint.total} value={accepted} aria-label="Content partitions analyzed" /><span>{accepted}/{checkpoint.total} partitions</span></> : <span>Validating retained chunks…</span>}</div>
      <div className={shared.controls}>{children}</div>
    </div></div>
    <aside className={chunks.detail} id="creation-accepted-analysis" aria-label="Accepted analysis">
      <div className={chunks.detailMeta}><span>Selected source</span><span>{preview ? `${selectedChunks.filter(chunk => analyses.has(chunk.id)).length} chunk analyses loaded` : 'Waiting for preview'}</span></div>
      <h2>{source?.title ?? 'Your learning pieces'}</h2><p className={chunks.intro}>Here’s what each piece is like, grounded in its retained source.</p>
      <p className={styles.legend}>AI estimates · normalized scores from 0 to 1. Expand a chunk for all 12 dimensions and reasoning.</p>
      {error?.revision === snapshot.revision ? <p role="alert">{error.message} <button onClick={() => setRetry(value => value + 1)}>Reload analysis</button></p> : !selectedChunks.length ?
        <p role="status" className={chunks.empty}>{checkpoint && !preview ? 'Loading saved analysis…' : 'Analysis appears here after its source inventory is saved.'}</p> :
        <ol className={`${chunks.chunks} ${styles.rows}`}>{selectedChunks.map((chunk, index) => {
          const analysis = analyses.get(chunk.id);
          return <li key={chunk.id}><details><summary>
            <span className={chunks.chunkNumber}>{String(index + 1).padStart(2, '0')}</span>
            <span><small>{Math.ceil(chunk.durationSeconds / 60)} min · {chunk.durationMethod === 'source' ? 'source duration' : chunk.durationMethod === 'reading_estimate' ? 'reading estimate' : 'model estimate'}</small>
              <strong>{chunk.title.value}</strong><span className={chunks.teaser}>{analysis ? 'Analysis saved' : 'Awaiting accepted analysis'}</span></span>
            {analysis && <span className={styles.scores}>{summaryDimensions.map((key, row) => <span key={key} className={styles.score} aria-label={`${labels[key]}: ${analysis.vector[key].toFixed(2)} out of 1`}>
              <span>{labels[key]}</span><span className={styles.dots} data-tone={row} aria-hidden="true">{Array.from({ length: 6 }, (_, dot) => <i key={dot} data-filled={dot < Math.round(analysis.vector[key] * 6)} />)}</span>
            </span>)}</span>}<ChevronRight size={17} aria-hidden="true" />
          </summary><div className={chunks.evidence}>
            <p>{chunk.summary.value}</p>
            {analysis ? <><dl className={styles.dimensions}>{PEDAGOGICAL_DIMENSIONS.map(key => <div key={key}><dt>{labels[key]}</dt><dd>{analysis.vector[key].toFixed(2)}</dd></div>)}</dl>
              <p>AI confidence: {analysis.confidence.toFixed(2)} / 1 · {analysis.isStrictlyLinear ? 'Requires sequential learning' : 'Flexible learning order'}</p>
              <p>{analysis.reasoning}</p><p>Model: {analysis.modelId} · Input revision: {analysis.inputRevision}</p></> : <p>No accepted scores yet. Work continues independently of this preview.</p>}
            <ul>{chunk.sourceRefs.map(ref => <li key={ref.segmentId}>{ref.anchor.kind === 'video' ? `${ref.anchor.startSeconds}–${ref.anchor.endSeconds}s${ref.anchor.estimated ? ' (estimated)' : ''}` :
              ref.anchor.kind === 'page' ? `Page ${ref.anchor.page}` : ref.anchor.kind === 'file' ? `${ref.anchor.path}:${ref.anchor.startLine}–${ref.anchor.endLine}` : ref.anchor.kind === 'block' ? `Block ${ref.anchor.blockId}` : `Text offsets ${ref.anchor.start}–${ref.anchor.end}`} · {ref.segmentId}</li>)}</ul>
          </div></details></li>;
        })}</ol>}
      <div className={shared.insight}><Lightbulb size={27} aria-hidden="true" /><p><strong>{checkpoint ? `${checkpoint.completed.reduce((sum, item) => sum + item.chunkCount, 0)} chunk analyses saved.` : 'Waiting for accepted analysis counts.'}</strong><span>Each chunk keeps its source evidence. Building starts when you continue.</span></p></div>
    </aside></div>
  </section>;
}

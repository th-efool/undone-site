'use client';

import { ProcessingFailures, processingFailureMessage } from './ProcessingFailures';
import React from 'react';
import { ChevronRight, FileText, Lightbulb } from 'lucide-react';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import { InkUnderline } from '@/src/client/screens/cohortCreation/components/InkUnderline';
import {
  isStageComplete,
  getStageProgressDetails,
  getValidChunks,
  getValidAnalyses,
} from '../stage-selectors';
import shared from '@/src/client/screens/cohortCreation/components/UnderstandingProgress.module.css';
import chunks from '@/src/client/screens/cohortCreation/components/ChunkingWorkspace.module.css';
import styles from '@/src/client/screens/cohortCreation/components/AnalysisWorkspace.module.css';
import { useCohortDrafts } from '../draft-context';
import { deriveChunkTitleAndSummary, deriveChunkVideoInterval, formatDurationClock } from '@/src/shared/cohort-builder/cohort-metadata';
import { computeDeterministicChunkVector, PEDAGOGICAL_DIMENSIONS, type PedagogicalDimension } from '@/src/shared/curriculum/pedagogicalVector.engine';

const dimensionLabels: Record<PedagogicalDimension, string> = {
  cognitive_load: 'Cognitive load', practicality_actionability: 'Practicality', visual_dependence: 'Visual dependence',
  scaffolding_guidance: 'Guidance', linearity_dependency: 'Dependency', novelty_divergence: 'Novelty',
  abstraction_depth: 'Abstraction depth', pacing_density: 'Pacing / density', rigor_formality: 'Rigor',
  interactivity_agency: 'Interactivity', breadth_scope: 'Breadth', emotional_energy: 'Emotional energy',
};
const summaryDimensions: PedagogicalDimension[] = ['cognitive_load', 'practicality_actionability', 'visual_dependence', 'abstraction_depth', 'interactivity_agency'];

interface AnalysisStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction) => Promise<boolean>;
}

export function AnalysisStageView({ workspace, dispatchAction }: AnalysisStageViewProps) {
  const { inspection, setInspectionState } = useCohortDrafts();
  const sources = workspace.sources ?? [];
  const validChunks = getValidChunks(workspace);
  const validAnalyses = getValidAnalyses(workspace);

  const stageProgress = getStageProgressDetails(workspace);
  const isComplete = isStageComplete(workspace, 'analysis');
  const isRunning = stageProgress.analysis.status === 'running';
  const isFailed = stageProgress.analysis.status === 'failed';

  const effectiveSelectedSourceId =
    inspection.analysisSelectedSourceId && sources.some(s => s.id === inspection.analysisSelectedSourceId)
      ? inspection.analysisSelectedSourceId
      : (sources[0]?.id ?? null);

  const currentSource = sources.find(s => s.id === effectiveSelectedSourceId) ?? sources[0];
  const sourceChunks = (item: typeof currentSource) => validChunks.filter(chunk => chunk.sourceId === item?.id).sort((a, b) => a.start - b.start);
  const selectedChunks = sourceChunks(currentSource);

  const analysesMap = new Map(validAnalyses.map(item => [item.chunkId, item]));
  const analyzedTotalCount = validChunks.filter(c => analysesMap.has(c.id)).length;
  const totalChunksCount = validChunks.length;

  return (
    <section aria-label="Analysis workspace" className={shared.workspace}>
      <div className={shared.columns}>
        <div>
          <header className={shared.heading}>
            <p className={shared.eyebrow}>Analyzing your material</p>
            <h1>
              {isComplete && !isRunning ? (
                <>
                  Each piece,<br />
                  <span>understood.<InkUnderline className={shared.underline} /></span>
                </>
              ) : (
                <>
                  Understanding<br />
                  <span>each piece…<InkUnderline className={shared.underline} /></span>
                </>
              )}
            </h1>
            <p>I’m analyzing what each chunk is about, how complex it is, and how it fits into your learning experience.</p>
          </header>

          <div className={shared.inventory}>
            <h2>
              <FileText size={22} aria-hidden="true" />
              Selected material
              <span>{sources.length} {sources.length === 1 ? 'source' : 'sources'}</span>
            </h2>

            <fieldset className={chunks.sourceList}>
              <legend className={chunks.srOnly}>Select a source to inspect its analysis</legend>
              {sources.map((item, index) => {
                const itemChunks = sourceChunks(item);
                const analyzedCount = itemChunks.filter(c => analysesMap.has(c.id)).length;
                return (
                  <label key={item.id} className={chunks.source} data-selected={item.id === currentSource?.id}>
                    <input
                      type="radio"
                      name="analysis-source"
                      checked={item.id === currentSource?.id}
                      onChange={() => setInspectionState({ analysisSelectedSourceId: item.id })}
                    />
                    <span className={chunks.number}>{String(index + 1).padStart(2, '0')}</span>
                    <span className={chunks.sourceTitle}>
                      <span className={chunks.sourceName} title={item.label}>{item.label}</span>
                    </span>
                    <small>{analyzedCount}/{itemChunks.length} analyzed</small>
                    <ChevronRight size={16} aria-hidden="true" />
                  </label>
                );
              })}
            </fieldset>

            <div className={shared.progress}>
              <progress max={totalChunksCount || 1} value={analyzedTotalCount} aria-label="Content partitions analyzed" />
              <span>{analyzedTotalCount}/{totalChunksCount} partitions analyzed</span>
            </div>

            <div className={shared.controls}>
              <ProcessingFailures workspace={workspace} dispatchAction={dispatchAction} />

              {workspace.processing.error && !workspace.processing.jobs?.some(job => job.status === 'failed') && <p role="alert">{processingFailureMessage(workspace.processing.error)}</p>}

              {isFailed && !workspace.processing.jobs?.length && (
                <button type="button" onClick={() => void dispatchAction({ type: 'retry_processing' })}>
                  Retry processing
                </button>
              )}

              {isRunning && (
                <div role="status">
                  <p>{analyzedTotalCount} of {totalChunksCount} chunks analyzed.</p>
                  <p>Work is saved to your account. You can close this page and return.</p>
                  <button type="button" onClick={() => void dispatchAction({ type: 'cancel_text_processing' })}>
                    Cancel analysis
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className={chunks.detail} id="creation-accepted-analysis" aria-label="Accepted analysis">
          <div className={chunks.detailMeta}>
            <span>Selected source</span>
            <span>{selectedChunks.filter(c => analysesMap.has(c.id)).length} chunk analyses loaded</span>
          </div>

          <h2>{currentSource?.label ?? 'Your learning pieces'}</h2>
          <p className={chunks.intro}>Here’s what each piece is like, grounded in its retained source.</p>
          <p className={styles.legend}>Deterministic estimates, normalized from 0 to 1. Expand a piece to inspect all 12 dimensions and its evidence.</p>

          {selectedChunks.length === 0 ? (
            <p role="status" className={chunks.empty}>
              Analysis appears here after its source inventory is saved.
            </p>
          ) : (
            <ol className={`${chunks.chunks} ${styles.rows}`}>
              {selectedChunks.map((chunk, index) => {
                const analysis = analysesMap.get(chunk.id);
                const copy = deriveChunkTitleAndSummary(chunk, currentSource, index, analysis?.summary);
                const interval = deriveChunkVideoInterval(chunk, currentSource, index, selectedChunks.length);
                const scored = analysis ? computeDeterministicChunkVector(chunk.text, {
                  title: `${copy.title} - ${currentSource?.label ?? ''}`, durationSeconds: interval.durationSeconds,
                  chunkIndex: index, totalChunks: selectedChunks.length,
                }) : null;
                return (
                  <li key={chunk.id}>
                    <details
                      open={inspection.analysisExpandedChunkId === chunk.id}
                      onToggle={e => {
                        const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                        if (isOpen || inspection.analysisExpandedChunkId === chunk.id) setInspectionState({ analysisExpandedChunkId: isOpen ? chunk.id : null });
                      }}
                    >
                      <summary>
                        <span className={chunks.chunkNumber}>{String(index + 1).padStart(2, '0')}</span>
                        <span>
                          <small>{formatDurationClock(interval.durationSeconds)} · {interval.isVideo ? 'estimated source interval' : 'reading estimate'}</small>
                          <strong>{copy.title}</strong>
                          <span className={chunks.teaser}>
                            {analysis ? 'Analysis saved' : 'Awaiting analysis'}
                          </span>
                        </span>
                        {scored && <span className={styles.scores}>
                          {summaryDimensions.map((key, row) => <span key={key} className={styles.score} aria-label={`${dimensionLabels[key]}: ${scored.vectorMap[key].toFixed(2)} out of 1`}>
                            <span>{dimensionLabels[key]}</span>
                            <span className={styles.dots} data-tone={row} aria-hidden="true">
                              {Array.from({ length: 6 }, (_, dot) => <i key={dot} data-filled={dot < Math.round(scored.vectorMap[key] * 6)} />)}
                            </span>
                          </span>)}
                        </span>}
                        <ChevronRight size={17} aria-hidden="true" />
                      </summary>
                      <div className={chunks.evidence}>
                        <p>{analysis?.summary ?? chunk.text}</p>
                        {scored && <dl className={styles.dimensions}>{PEDAGOGICAL_DIMENSIONS.map(key => <div key={key}>
                          <dt>{dimensionLabels[key]}</dt><dd>{scored.vectorMap[key].toFixed(2)}</dd>
                        </div>)}</dl>}
                        {analysis?.question && (
                          <p>
                            <strong>Pedagogical question:</strong> {analysis.question}
                          </p>
                        )}
                        <small>Chunk: characters {chunk.start}–{chunk.end}</small>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ol>
          )}

          <div className={shared.insight}>
            <Lightbulb size={27} aria-hidden="true" />
            <p>
              <strong>{analyzedTotalCount} chunk analyses saved.</strong>
              <span>Each chunk keeps its source evidence. Lessons are built after analysis is accepted.</span>
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

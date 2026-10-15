'use client';

import React, { useState } from 'react';
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

interface AnalysisStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction) => Promise<boolean>;
}

export function AnalysisStageView({ workspace, dispatchAction }: AnalysisStageViewProps) {
  let inspection: any = { analysisSelectedSourceId: null, analysisExpandedChunkId: null };
  let setInspectionState: any = () => {};
  try {
    const drafts = useCohortDrafts();
    inspection = drafts.inspection;
    setInspectionState = drafts.setInspectionState;
  } catch {
    // Graceful fallback when rendered outside CohortDraftProvider
  }
  const sources = workspace.sources ?? [];
  const validChunks = getValidChunks(workspace);
  const validAnalyses = getValidAnalyses(workspace);
  const status = workspace.processing.status;

  const stageProgress = getStageProgressDetails(workspace);
  const isComplete = isStageComplete(workspace, 'analysis');
  const isRunning = stageProgress.analysis.status === 'running';
  const isFailed = stageProgress.analysis.status === 'failed';

  const effectiveSelectedSourceId =
    inspection.analysisSelectedSourceId && sources.some(s => s.id === inspection.analysisSelectedSourceId)
      ? inspection.analysisSelectedSourceId
      : (sources[0]?.id ?? null);

  const currentSource = sources.find(s => s.id === effectiveSelectedSourceId) ?? sources[0];
  const sourceChunks = (item: typeof currentSource) => validChunks.filter(chunk => chunk.sourceId === item?.id);
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
              {workspace.processing.jobs?.length ? (
                <section aria-label="Source processing jobs" aria-live="polite">
                  {workspace.processing.jobs.map(job => (
                    <p key={job.id}>
                      {sources.find(s => s.id === job.sourceId)?.label ?? 'Curriculum'} · {job.stage} · {job.status}
                      {job.error && <span> · {job.error}</span>}
                      {job.status === 'failed' && (
                        job.retryable ? (
                          <button type="button" onClick={() => void dispatchAction({ type: 'retry_text_job', jobId: job.id })}>
                            Retry {job.stage}
                          </button>
                        ) : (
                          <span> · Retry limit reached; edit or remove affected source.</span>
                        )
                      )}
                    </p>
                  ))}
                  {workspace.processing.jobs.some(j => j.status === 'queued' || j.status === 'running') && (
                    <button type="button" onClick={() => void dispatchAction({ type: 'cancel_text_processing' })}>
                      Stop source processing
                    </button>
                  )}
                </section>
              ) : null}

              {workspace.processing.error && <p role="alert">{workspace.processing.error}</p>}

              {isFailed && !workspace.processing.jobs?.length && (
                <button type="button" onClick={() => void dispatchAction({ type: 'retry_processing' })}>
                  Retry processing
                </button>
              )}

              {isRunning && !workspace.processing.jobs?.length && (
                <div role="status">
                  <p>{analyzedTotalCount} of {totalChunksCount} chunks analyzed.</p>
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

          {selectedChunks.length === 0 ? (
            <p role="status" className={chunks.empty}>
              Analysis appears here after its source inventory is saved.
            </p>
          ) : (
            <ol className={`${chunks.chunks} ${styles.rows}`}>
              {selectedChunks.map((chunk, index) => {
                const analysis = analysesMap.get(chunk.id);
                return (
                  <li key={chunk.id}>
                    <details
                      open={inspection.analysisExpandedChunkId === chunk.id}
                      onToggle={e => {
                        const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                        setInspectionState({ analysisExpandedChunkId: isOpen ? chunk.id : null });
                      }}
                    >
                      <summary>
                        <span className={chunks.chunkNumber}>{String(index + 1).padStart(2, '0')}</span>
                        <span>
                          <strong>{chunk.text.slice(0, 40)}…</strong>
                          <span className={chunks.teaser}>
                            {analysis ? 'Analysis saved' : 'Awaiting analysis'}
                          </span>
                        </span>
                        <ChevronRight size={17} aria-hidden="true" />
                      </summary>
                      <div className={chunks.evidence}>
                        <p>{analysis?.summary ?? chunk.text}</p>
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
              <span>Each chunk keeps its source evidence. Building starts when you continue.</span>
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

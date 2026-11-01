'use client';

import { ProcessingFailures, processingFailureMessage } from './ProcessingFailures';
import React from 'react';
import { ChevronRight, Lightbulb, ArrowLeft, Square, RotateCcw } from 'lucide-react';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import { InkUnderline } from '@/src/client/screens/cohortCreation/components/InkUnderline';
import {
  isStageComplete,
  getStageProgressDetails,
  getValidChunks,
} from '../stage-selectors';
import shared from '@/src/client/screens/cohortCreation/components/UnderstandingProgress.module.css';
import styles from '@/src/client/screens/cohortCreation/components/ChunkingWorkspace.module.css';
import { useCohortDrafts } from '../draft-context';
import { deriveChunkTitleAndSummary, deriveChunkVideoInterval, formatDurationClock, sourceVideoId, sourceDurationSeconds } from '@/src/shared/cohort-builder/cohort-metadata';
import { YoutubeThumbnail } from '@/src/client/screens/cohortCreation/components/YoutubeThumbnail';

interface ChunkingStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction) => Promise<boolean>;
}

export function ChunkingStageView({ workspace, dispatchAction }: ChunkingStageViewProps) {
  const { inspection, setInspectionState } = useCohortDrafts();
  const sources = workspace.sources ?? [];
  const validChunks = getValidChunks(workspace);

  const stageProgress = getStageProgressDetails(workspace);
  const isComplete = isStageComplete(workspace, 'chunking');
  const isRunning = stageProgress.chunking.status === 'running';
  const isFailed = stageProgress.chunking.status === 'failed';
  const hasFailedJobs = workspace.processing.jobs?.some(job => job.status === 'failed');
  const canRetry = !isRunning && sources.length > 0 && !hasFailedJobs && (isFailed || !isComplete);
  const chunkedSourcesCount = stageProgress.chunking.completedCount;

  const effectiveSelectedSourceId =
    inspection.chunkingSelectedSourceId && sources.some(s => s.id === inspection.chunkingSelectedSourceId)
      ? inspection.chunkingSelectedSourceId
      : (sources[0]?.id ?? null);

  const currentSource = sources.find(s => s.id === effectiveSelectedSourceId) ?? sources[0];
  const currentSourceIndex = sources.findIndex(s => s.id === currentSource?.id);
  const selectedChunks = validChunks.filter(c => c.sourceId === currentSource?.id).sort((a, b) => a.start - b.start);
  const videoId = sourceVideoId(currentSource);

  return (
    <section aria-label="Chunking material" className={`${shared.workspace} ${styles.workspace}`}>
      <div className={shared.topActions}>
        <button
          type="button"
          className={shared.iconActionBtn}
          aria-label="Back to material"
          title="Back to material"
          onClick={() => void dispatchAction({ type: 'open_materials' })}
        >
          <ArrowLeft size={16} />
        </button>
        {isRunning ? (
          <button
            type="button"
            className={shared.iconActionBtn}
            aria-label="Cancel processing"
            title="Stop processing"
            onClick={() => void dispatchAction({ type: 'cancel_text_processing' })}
          >
            <Square size={15} />
          </button>
        ) : (
          canRetry && (
            <button
              type="button"
              className={shared.iconActionBtn}
              aria-label="Retry processing"
              title="Retry processing"
              onClick={() => void dispatchAction({ type: 'retry_processing' })}
            >
              <RotateCcw size={16} />
            </button>
          )
        )}
      </div>

      <div className={`${shared.columns} ${styles.columns}`}>
        <div>
          <header className={`${shared.heading} ${styles.heading}`}>
            <p className={shared.eyebrow}>Turning content into learning pieces</p>
            <h1>
              {isComplete && !isRunning ? (
                <>
                  Your learning<br />
                  <span>chunks are saved.<InkUnderline className={`${shared.underline} ${styles.headlineUnderline}`} /></span>
                </>
              ) : (
                <>
                  Finding natural<br />
                  <span>learning chunks…<InkUnderline className={`${shared.underline} ${styles.headlineUnderline}`} /></span>
                </>
              )}
            </h1>
          </header>

          <div className={`${shared.inventory} ${styles.inventory}`}>
            <div className={shared.progress}>
              <progress max={sources.length || 1} value={chunkedSourcesCount} aria-label="Content sources structured" />
              <span>{chunkedSourcesCount}/{sources.length} sources structured</span>
            </div>

            <fieldset className={styles.sourceList}>
              <legend className={styles.srOnly}>Select a source to inspect its chunks</legend>
              {sources.map((item, index) => {
                const count = validChunks.filter(c => c.sourceId === item.id).length;
                return (
                  <label key={item.id} className={styles.source} data-selected={item.id === currentSource?.id}>
                    <input
                      type="radio"
                      name="chunk-source"
                      checked={item.id === currentSource?.id}
                      onChange={() => setInspectionState({ chunkingSelectedSourceId: item.id })}
                    />
                    <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
                    {sourceVideoId(item) && <YoutubeThumbnail videoId={sourceVideoId(item)!} />}
                    <span className={styles.sourceTitle}>
                      <span className={styles.sourceName} title={item.label}>{item.label}</span>
                      {sourceDurationSeconds(item) > 0 && <small>{formatDurationClock(sourceDurationSeconds(item))}</small>}
                    </span>
                    <small>{count} {count === 1 ? 'part' : 'parts'}</small>
                    <ChevronRight size={16} aria-hidden="true" />
                  </label>
                );
              })}
            </fieldset>

            <div className={shared.controls}>
              <ProcessingFailures workspace={workspace} dispatchAction={dispatchAction} />

              {workspace.lessons.some(l => l.evidenceStatus === 'orphaned') && (
                <p role="alert">This lesson references changed or removed source text.</p>
              )}

              {isFailed && workspace.processing.error && !workspace.processing.jobs?.some(job => job.status === 'failed') && (
                <p role="alert">{processingFailureMessage(workspace.processing.error)}</p>
              )}
            </div>
          </div>
        </div>

        <aside className={styles.detail} id="creation-accepted-chunks" aria-label="Accepted chunks">
          <div className={styles.detailMeta}>
            <span>{currentSource ? `Source ${String(currentSourceIndex + 1).padStart(2, '0')}` : 'Selected source'}</span>
            <span>{selectedChunks.length} {selectedChunks.length === 1 ? 'part' : 'parts'}</span>
            {sourceDurationSeconds(currentSource) > 0 && <time>{formatDurationClock(sourceDurationSeconds(currentSource))}</time>}
          </div>

          <div className={styles.detailHeader}>
            <div>
              <h2>
                <span>{currentSource?.label ?? 'Your learning pieces'}<InkUnderline className={styles.titleUnderline} /></span>
              </h2>
              <p className={styles.intro}>Grounded in your source material.</p>
            </div>
            <p className={styles.annotation}>Open a piece to explore its content.</p>
          </div>

          {selectedChunks.length === 0 ? (
            <p role="status" className={styles.empty}>
              Learning pieces appear here as each source is structured.
            </p>
          ) : (
            <ol className={styles.chunks}>
              {selectedChunks.map((chunk, index) => {
                const interval = deriveChunkVideoInterval(chunk, currentSource, index, selectedChunks.length);
                const copy = deriveChunkTitleAndSummary(chunk, currentSource, index);
                return (
                  <li key={chunk.id}>
                    <details
                      open={inspection.chunkingExpandedChunkId === chunk.id}
                      onToggle={e => {
                        const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                        if (isOpen || inspection.chunkingExpandedChunkId === chunk.id) setInspectionState({ chunkingExpandedChunkId: isOpen ? chunk.id : null });
                      }}
                    >
                      <summary>
                        {videoId ? <YoutubeThumbnail videoId={videoId} /> : <span className={styles.chunkNumber}>{String(index + 1).padStart(2, '0')}</span>}
                        <span>
                          <span className={styles.duration}>
                            <time>{formatDurationClock(interval.durationSeconds)}</time>
                            <small>{interval.isVideo ? interval.hasTiming ? 'estimated source interval' : 'video timing unavailable' : 'reading estimate'}</small>
                          </span>
                          <strong>{copy.title}</strong>
                          <span className={styles.teaser}>{copy.summary}</span>
                        </span>
                        <ChevronRight size={17} aria-hidden="true" />
                      </summary>
                      <div className={styles.evidence}>
                        {interval.hasTiming && <p>{formatDurationClock(interval.startSeconds)} - {formatDurationClock(interval.endSeconds)}</p>}
                        <p>{chunk.text}</p>
                        <small>Source: {currentSource?.label}</small>
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
              <strong>{selectedChunks.length} learning parts from this source.</strong>
              <span>Each part keeps its direct source context.</span>
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

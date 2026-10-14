'use client';

import React, { useState } from 'react';
import { ChevronRight, FileText, Lightbulb } from 'lucide-react';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import { InkUnderline } from '@/src/client/screens/cohortCreation/components/InkUnderline';
import { ProcessingChecklist } from './ProcessingChecklist';
import shared from '@/src/client/screens/cohortCreation/components/UnderstandingProgress.module.css';
import styles from '@/src/client/screens/cohortCreation/components/ChunkingWorkspace.module.css';

interface ChunkingStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction) => Promise<boolean>;
}

export function ChunkingStageView({ workspace, dispatchAction }: ChunkingStageViewProps) {
  const sources = workspace.sources ?? [];
  const chunks = workspace.chunks ?? [];
  const status = workspace.processing.status;
  const isRunning = status === 'queued' || status === 'processing' || (status as string) === 'running';
  const isFailed = status === 'failed';
  const isComplete = chunks.length > 0 && status !== 'failed';

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(sources[0]?.id ?? null);
  const currentSource = sources.find(s => s.id === selectedSourceId) ?? sources[0];
  const currentSourceIndex = sources.findIndex(s => s.id === currentSource?.id);
  const selectedChunks = chunks.filter(c => c.sourceId === currentSource?.id);

  const chunkedSourcesCount = sources.filter(s => chunks.some(c => c.sourceId === s.id)).length;

  return (
    <section aria-label="Chunking material" className={`${shared.workspace} ${styles.workspace}`}>
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
            <p>I’m breaking the material into meaningful pieces, based on its topics and source evidence.</p>
          </header>

          <div className={`${shared.inventory} ${styles.inventory}`}>
            <h2>
              <FileText size={22} aria-hidden="true" />
              Selected material
              <span>{sources.length} {sources.length === 1 ? 'source' : 'sources'}</span>
            </h2>

            <fieldset className={styles.sourceList}>
              <legend className={styles.srOnly}>Select a source to inspect its chunks</legend>
              {sources.map((item, index) => {
                const count = chunks.filter(c => c.sourceId === item.id).length;
                return (
                  <label key={item.id} className={styles.source} data-selected={item.id === currentSource?.id}>
                    <input
                      type="radio"
                      name="chunk-source"
                      checked={item.id === currentSource?.id}
                      onChange={() => setSelectedSourceId(item.id)}
                    />
                    <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
                    <span className={styles.sourceTitle}>
                      <span className={styles.sourceName} title={item.label}>{item.label}</span>
                    </span>
                    <small>{count} chunks</small>
                    <ChevronRight size={16} aria-hidden="true" />
                  </label>
                );
              })}
            </fieldset>

            <div className={shared.progress}>
              <progress max={sources.length || 1} value={chunkedSourcesCount} aria-label="Content partitions chunked" />
              <span>{chunkedSourcesCount}/{sources.length} partitions</span>
            </div>

            <ProcessingChecklist currentStage="chunking" processingStatus={status} />

            <div className={shared.controls}>
              {workspace.lessons.some(l => l.evidenceStatus === 'orphaned') && (
                <p role="alert">This lesson references changed or removed source text.</p>
              )}

              {isRunning ? (
                <div role="status">
                  <p>{chunks.length} chunks generated across {chunkedSourcesCount} sources.</p>
                  <p>You can close this page and return while work continues.</p>
                  <button type="button" onClick={() => void dispatchAction({ type: 'cancel_text_processing' })}>
                    Cancel chunking
                  </button>
                </div>
              ) : (
                <>
                  {isFailed && (
                    <>
                      {workspace.processing.error && <p role="alert">{workspace.processing.error}</p>}
                      <button type="button" onClick={() => void dispatchAction({ type: 'retry_processing' })}>
                        Retry processing
                      </button>
                    </>
                  )}
                  {!isFailed && sources.length > 0 && (
                    <button type="button" onClick={() => void dispatchAction({ type: 'retry_processing' })}>
                      {isComplete ? 'Re-chunk selected material' : 'Chunk selected material'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <aside className={styles.detail} id="creation-accepted-chunks" aria-label="Accepted chunks">
          <div className={styles.detailMeta}>
            <span>{currentSource ? `Source ${String(currentSourceIndex + 1).padStart(2, '0')}` : 'Selected source'}</span>
            <span>{selectedChunks.length} accepted chunks</span>
          </div>

          <div className={styles.detailHeader}>
            <div>
              <h2>
                <span>{currentSource?.label ?? 'Your learning pieces'}<InkUnderline className={styles.titleUnderline} /></span>
              </h2>
              <p className={styles.intro}>Grounded in your retained material.</p>
            </div>
            <p className={styles.annotation}>Each chunk keeps its source evidence. Open a piece to explore.</p>
          </div>

          {selectedChunks.length === 0 ? (
            <p role="status" className={styles.empty}>
              Chunks appear here when this source has accepted boundaries.
            </p>
          ) : (
            <ol className={styles.chunks}>
              {selectedChunks.map((chunk, index) => (
                <li key={chunk.id}>
                  <details>
                    <summary>
                      <span className={styles.chunkNumber}>{String(index + 1).padStart(2, '0')}</span>
                      <span>
                        <span className={styles.duration}>
                          characters {chunk.start}–{chunk.end}
                        </span>
                        <strong>Chunk {index + 1}</strong>
                        <span className={styles.teaser}>{chunk.text.slice(0, 100)}…</span>
                      </span>
                      <ChevronRight size={17} aria-hidden="true" />
                    </summary>
                    <div className={styles.evidence}>
                      <p>{chunk.text}</p>
                      <small>Source: {currentSource?.label} · Checksum: {chunk.checksum.slice(0, 12)}</small>
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          )}

          <div className={shared.insight}>
            <Lightbulb size={27} aria-hidden="true" />
            <p>
              <strong>{selectedChunks.length} accepted chunks from this source.</strong>
              <span>Source boundaries and evidence are retained. Analysis comes next.</span>
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

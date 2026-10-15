'use client';

import React from 'react';
import { FileText, Check, Brain, Lightbulb, LoaderCircle } from 'lucide-react';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import { InkUnderline } from '@/src/client/screens/cohortCreation/components/InkUnderline';
import {
  isStageComplete,
  getStageProgressDetails,
} from '../stage-selectors';
import styles from '@/src/client/screens/cohortCreation/components/UnderstandingProgress.module.css';

interface UnderstandingStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction) => Promise<boolean>;
}

export function UnderstandingStageView({ workspace, dispatchAction }: UnderstandingStageViewProps) {
  const sources = workspace.sources ?? [];
  const status = workspace.processing.status;

  const stageProgress = getStageProgressDetails(workspace);
  const isComplete = isStageComplete(workspace, 'understanding');
  const isRunning = stageProgress.understanding.status === 'running';
  const isFailed = stageProgress.understanding.status === 'failed';

  const understoodCount = stageProgress.understanding.completedCount;
  const totalCount = sources.length;

  const sourceVersionMap = new Map(sources.map(s => [s.id, s.version]));
  const validUnderstanding = (workspace.understanding ?? []).filter(u => {
    const v = sourceVersionMap.get(u.sourceId);
    return v === undefined || u.sourceVersion === undefined || u.sourceVersion === v;
  });

  const allTopics = validUnderstanding.flatMap((u, uIdx) =>
    u.topics.map((topic, tIdx) => ({
      key: `${u.sourceId}:${uIdx}:${tIdx}`,
      sourceId: u.sourceId,
      topic,
    }))
  );

  return (
    <section aria-label="Understanding material" className={styles.workspace}>
      <div className={styles.columns}>
        <div>
          <header className={styles.heading}>
            <p className={styles.eyebrow}>Understanding your material</p>
            <h1>
              {isComplete && !isRunning ? (
                <>
                  Your content,<br />
                  <span>understood.<InkUnderline className={styles.underline} /></span>
                </>
              ) : (
                <>
                  Reading through<br />
                  <span>your content…<InkUnderline className={styles.underline} /></span>
                </>
              )}
            </h1>
            <p>I’m working with your retained sources and the evidence in them.</p>
          </header>

          <div className={styles.inventory}>
            <h2>
              <FileText size={22} aria-hidden="true" />
              Selected material
              <span>{sources.length} {sources.length === 1 ? 'source' : 'sources'}</span>
            </h2>

            <ul>
              {sources.map((source, index) => {
                const segmentCount = source.locations?.length ?? (source.text ? 1 : 0);
                return (
                  <li key={source.id}>
                    <div className={styles.source}>
                      <span className={styles.sourceNumber}>{String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <strong>{source.label}</strong>
                        <p>{segmentCount} retained segments · {source.state}</p>
                      </div>
                      <Check size={18} aria-label="Content acquired" />
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className={styles.progress}>
              {totalCount > 0 ? (
                <>
                  <progress max={totalCount} value={understoodCount} aria-label="Content partitions understood" />
                  <span>{understoodCount}/{totalCount} partitions understood</span>
                </>
              ) : (
                <>
                  <LoaderCircle size={18} aria-hidden="true" />
                  <span>Reading source inventory…</span>
                </>
              )}
            </div>

            <div className={styles.controls}>
              {isRunning ? (
                <div role="status">
                  <p>{understoodCount} of {totalCount} retained content partitions understood.</p>
                  <p>Work is saved to your account. You can close this page and return.</p>
                  <button type="button" onClick={() => void dispatchAction({ type: 'cancel_text_processing' })}>
                    Cancel understanding
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
                      {isComplete ? 'Re-understand selected material' : 'Understand selected material'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <aside id="creation-accepted-concepts" className={styles.concepts} aria-label="Accepted concepts">
          <header>
            <Brain size={46} strokeWidth={1.5} aria-hidden="true" />
            <div>
              <h2>Finding key ideas…</h2>
              <p>Identifying the main topics, concepts,<br />and how they appear throughout the material.</p>
            </div>
          </header>

          <span className={styles.paperNote} aria-hidden="true">
            Important ideas,<br />grounded in<br />your material.
          </span>

          {allTopics.length === 0 ? (
            <p className={styles.empty} role="status">
              Concepts appear after a retained content partition is understood.
            </p>
          ) : (
            <ul className={styles.conceptCloud}>
              {allTopics.map(item => (
                <li key={item.key}>
                  <span>{item.topic}</span>
                </li>
              ))}
            </ul>
          )}

          <div className={styles.insight}>
            <Lightbulb size={28} aria-hidden="true" />
            <p>
              <strong>{allTopics.length} key ideas identified.</strong>
              <span>Entries retain source evidence; repeated ideas may appear across partitions.</span>
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

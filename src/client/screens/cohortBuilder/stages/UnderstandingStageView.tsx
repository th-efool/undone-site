'use client';

import { ProcessingFailures, processingFailureMessage } from './ProcessingFailures';
import React from 'react';
import {
  Check,
  Brain,
  Lightbulb,
  LoaderCircle,
  AlertCircle,
  ArrowLeft,
  Square,
  RotateCcw,
} from 'lucide-react';
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

  const stageProgress = getStageProgressDetails(workspace);
  const isComplete = isStageComplete(workspace, 'understanding');
  const isRunning = stageProgress.understanding.status === 'running';
  const isFailed = stageProgress.understanding.status === 'failed';
  const hasFailedJobs = workspace.processing.jobs?.some(job => job.status === 'failed');
  const canRetry = !isRunning && sources.length > 0 && !hasFailedJobs && (isFailed || !isComplete);

  const understoodCount = stageProgress.understanding.completedCount;
  const totalCount = sources.length;

  const sourceVersionMap = new Map(sources.map(s => [s.id, s.version]));
  const validUnderstanding = (workspace.understanding ?? []).filter(u => {
    const v = sourceVersionMap.get(u.sourceId);
    return v !== undefined && u.sourceVersion === v;
  });
  const understoodSourceIds = new Set(validUnderstanding.map(u => u.sourceId));

  const topicMap = new Map<string, { topic: string; summary: string; sourceLabels: string[] }>();
  for (const understood of validUnderstanding) {
    const source = sources.find(item => item.id === understood.sourceId)!;
    for (const topic of understood.topics) {
      const key = topic.toLocaleLowerCase();
      const existing = topicMap.get(key);
      if (existing) {
        if (!existing.sourceLabels.includes(source.label)) existing.sourceLabels.push(source.label);
      } else {
        const evidence = source.text.split(/\n\s*\n|(?<=[.!?])\s+/).find(sentence => sentence.toLowerCase().includes(key)) ?? source.text;
        topicMap.set(key, { topic, summary: evidence.slice(0, 350), sourceLabels: [source.label] });
      }
    }
  }
  const allTopics = [...topicMap.values()];

  return (
    <section aria-label="Understanding material" className={styles.workspace}>
      <div className={styles.topActions}>
        <button
          type="button"
          className={styles.iconActionBtn}
          aria-label="Back to material"
          title="Back to material"
          onClick={() => void dispatchAction({ type: 'open_materials' })}
        >
          <ArrowLeft size={16} />
        </button>
        {isRunning ? (
          <button
            type="button"
            className={styles.iconActionBtn}
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
              className={styles.iconActionBtn}
              aria-label="Retry processing"
              title="Retry processing"
              onClick={() => void dispatchAction({ type: 'retry_processing' })}
            >
              <RotateCcw size={16} />
            </button>
          )
        )}
      </div>

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
          </header>

          <div className={styles.inventory}>
            <div className={styles.progress}>
              {totalCount > 0 ? (
                <>
                  <progress max={totalCount} value={understoodCount} aria-label="Sources understood" />
                  <span>{understoodCount}/{totalCount} sources understood</span>
                </>
              ) : (
                <>
                  <LoaderCircle size={18} aria-hidden="true" />
                  <span>Reading source inventory…</span>
                </>
              )}
            </div>

            <ul>
              {sources.map((source, index) => {
                const segmentCount = source.locations?.length ?? (source.text ? 1 : 0);
                const isSourceReady = source.state === 'ready' || understoodSourceIds.has(source.id);
                const isSourceFailed = source.state === 'failed';
                const statusLabel = isSourceFailed
                  ? 'Could not read source'
                  : isSourceReady
                    ? `Ready${segmentCount > 0 ? ` · ${segmentCount} ${segmentCount === 1 ? 'section' : 'sections'}` : ''}`
                    : 'Reading source…';

                return (
                  <li key={source.id}>
                    <div className={styles.source}>
                      <span className={styles.sourceNumber}>{String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <strong>{source.label}</strong>
                        <p>{statusLabel}</p>
                      </div>
                      {isSourceFailed ? (
                        <AlertCircle size={18} className={styles.errorIcon} aria-label="Source failed" />
                      ) : isSourceReady ? (
                        <Check size={18} aria-label="Content acquired" />
                      ) : (
                        <LoaderCircle size={18} className={styles.spinIcon} aria-label="Reading source" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className={styles.controls}>
              <ProcessingFailures workspace={workspace} dispatchAction={dispatchAction} />
              {isFailed && workspace.processing.error && !workspace.processing.jobs?.some(job => job.status === 'failed') && (
                <p role="alert">{processingFailureMessage(workspace.processing.error)}</p>
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
              Key ideas and concepts will appear here as each source is analyzed.
            </p>
          ) : (
            <ul className={styles.conceptCloud}>
              {allTopics.map(item => (
                <li key={item.topic}>
                  <details>
                    <summary>{item.topic}</summary>
                    <p>{item.summary}</p>
                    <small>{item.sourceLabels.join(' · ')}</small>
                  </details>
                </li>
              ))}
            </ul>
          )}

          <details className={styles.limitations}>
            <summary>Source summaries and limitations ({sources.length})</summary>
            {sources.map(source => <div key={source.id}>
              <strong>{source.label}</strong>
              <p>{source.text ? source.text.slice(0, 350) : 'Reading source material. Concepts will appear as it is processed.'}</p>
              {source.provenance?.scope === 'video_observation' && <p>Video observations with estimated timestamps.</p>}
              {source.provenance?.limitations?.map((limitation, index) => <p key={index}>{limitation}</p>)}
            </div>)}
          </details>

          <div className={styles.insight}>
            <Lightbulb size={28} aria-hidden="true" />
            <p>
              <strong>{allTopics.length} key ideas identified.</strong>
              <span>Core topics and evidence gathered directly from your material.</span>
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

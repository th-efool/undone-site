'use client';

import React from 'react';
import { Check, Circle, CircleDot, CircleX, Pause } from 'lucide-react';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import {
  getStageProgressDetails,
  type StageStatus,
  type CanonicalStage,
} from '../stage-selectors';
import styles from '@/src/client/screens/cohortCreation/components/ProcessingChecklist.module.css';

export interface ProcessingChecklistProps {
  workspace?: CohortWorkspace;
  stageDetails?: Record<CanonicalStage, StageStatus>;
  currentStage?: 'understanding' | 'chunking' | 'analysis' | 'assembly' | 'curriculum';
  processingStatus?: string;
}

const STAGES: Array<{ id: CanonicalStage; label: string }> = [
  { id: 'understanding', label: 'Reading material and finding key concepts' },
  { id: 'chunking', label: 'Chunking it into meaningful pieces' },
  { id: 'analysis', label: 'Analyzing each piece' },
  { id: 'assembly', label: 'Building your learning experience' },
];

export function ProcessingChecklist({
  workspace,
  stageDetails,
  currentStage,
  processingStatus,
}: ProcessingChecklistProps) {
  const details = React.useMemo(() => {
    if (stageDetails) {
      return stageDetails;
    }
    if (workspace) {
      return getStageProgressDetails(workspace);
    }

    // Conservative legacy fallback only when neither workspace nor stageDetails is provided
    const STAGE_ORDER: Record<string, number> = {
      understanding: 0,
      chunking: 1,
      analysis: 2,
      assembly: 3,
      curriculum: 4,
    };
    const currentIndex = currentStage ? (STAGE_ORDER[currentStage] ?? 0) : 0;

    const fallback: Record<CanonicalStage, StageStatus> = {
      understanding: { status: 'pending', completedCount: 0, totalCount: 0, failedCount: 0, retryable: false, isCanceled: false },
      chunking: { status: 'pending', completedCount: 0, totalCount: 0, failedCount: 0, retryable: false, isCanceled: false },
      analysis: { status: 'pending', completedCount: 0, totalCount: 0, failedCount: 0, retryable: false, isCanceled: false },
      assembly: { status: 'pending', completedCount: 0, totalCount: 1, failedCount: 0, retryable: false, isCanceled: false },
    };

    STAGES.forEach((stage, index) => {
      if (index < currentIndex || currentStage === 'curriculum') {
        fallback[stage.id].status = 'complete';
      } else if (index === currentIndex) {
        if (processingStatus === 'failed') fallback[stage.id].status = 'failed';
        else if (processingStatus === 'canceled') fallback[stage.id].status = 'canceled';
        else if (processingStatus === 'running' || processingStatus === 'processing' || processingStatus === 'queued') {
          fallback[stage.id].status = 'running';
        } else {
          fallback[stage.id].status = 'running';
        }
      } else {
        fallback[stage.id].status = 'pending';
      }
    });

    return fallback;
  }, [workspace, stageDetails, currentStage, processingStatus]);

  return (
    <ol className={styles.list} aria-label="Saved processing stages">
      {STAGES.map(stage => {
        const stageDetail = details[stage.id];
        const status = stageDetail?.status ?? 'pending';

        let dataState: 'complete' | 'failed' | 'canceled' | 'current' | 'pending';
        let description: string;
        let isCurrent = false;

        switch (status) {
          case 'complete':
            dataState = 'complete';
            description = 'Complete';
            break;
          case 'failed':
            dataState = 'failed';
            description = 'Failed';
            isCurrent = true;
            break;
          case 'canceled':
            dataState = 'canceled';
            description = 'Canceled';
            break;
          case 'running':
            dataState = 'current';
            description = 'In progress';
            isCurrent = true;
            break;
          case 'pending':
          default:
            dataState = 'pending';
            description = 'Pending';
            break;
        }

        const Icon =
          dataState === 'complete'
            ? Check
            : dataState === 'failed'
            ? CircleX
            : dataState === 'canceled'
            ? Pause
            : dataState === 'current'
            ? CircleDot
            : Circle;

        return (
          <li key={stage.id} data-state={dataState} aria-current={isCurrent ? 'step' : undefined}>
            <span className={styles.marker}>
              <Icon size={18} aria-hidden="true" />
            </span>
            <span>
              {stage.label}
              <span className={styles.srOnly}>: {description}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

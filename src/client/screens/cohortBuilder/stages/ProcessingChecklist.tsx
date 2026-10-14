'use client';

import React from 'react';
import { Check, Circle, CircleDot, CircleX, Pause } from 'lucide-react';
import styles from '@/src/client/screens/cohortCreation/components/ProcessingChecklist.module.css';

interface ProcessingChecklistProps {
  currentStage: 'understanding' | 'chunking' | 'analysis' | 'assembly' | 'curriculum';
  processingStatus: string;
}

const STAGES = [
  { id: 'understanding', label: 'Reading material and finding key concepts' },
  { id: 'chunking', label: 'Chunking it into meaningful pieces' },
  { id: 'analysis', label: 'Analyzing each piece' },
  { id: 'assembly', label: 'Building your learning experience' },
] as const;

const STAGE_ORDER: Record<string, number> = {
  understanding: 0,
  chunking: 1,
  analysis: 2,
  assembly: 3,
  curriculum: 4,
};

export function ProcessingChecklist({ currentStage, processingStatus }: ProcessingChecklistProps) {
  const currentIndex = STAGE_ORDER[currentStage] ?? 0;

  return (
    <ol className={styles.list} aria-label="Saved processing stages">
      {STAGES.map((stage, index) => {
        const isPast = index < currentIndex;
        const isCurrent = index === currentIndex;
        
        let status: 'complete' | 'failed' | 'canceled' | 'current' | 'pending';
        if (isPast || currentStage === 'curriculum') {
          status = 'complete';
        } else if (isCurrent) {
          if (processingStatus === 'failed') status = 'failed';
          else if (processingStatus === 'canceled') status = 'canceled';
          else status = 'current';
        } else {
          status = 'pending';
        }

        const Icon =
          status === 'complete'
            ? Check
            : status === 'failed'
            ? CircleX
            : status === 'canceled'
            ? Pause
            : status === 'current'
            ? CircleDot
            : Circle;

        const description =
          status === 'complete'
            ? 'Complete'
            : status === 'failed'
            ? 'Failed'
            : status === 'canceled'
            ? 'Canceled'
            : status === 'current'
            ? processingStatus === 'running'
              ? 'In progress'
              : 'Ready'
            : 'Pending';

        return (
          <li key={stage.id} data-state={status} aria-current={isCurrent ? 'step' : undefined}>
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

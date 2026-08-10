'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import { useWizardContext } from '../../providers/WizardProvider';
import type { PublishStage } from '../../models/launch';

import styles from './PublishingModal.module.css';

export function PublishingModal() {
  const { launchState } = useWizardContext();
  const stage = launchState.publishStage;

  if (stage === 'idle' || stage === 'live') return null;

  const stages: { id: PublishStage; label: string }[] = [
    { id: 'preparing-assets', label: 'Preparing Cohort Cover & Artwork' },
    { id: 'search-metadata', label: 'Generating Discovery & Search Index' },
    { id: 'creating-community', label: 'Provisioning Community & Chat Channels' },
    { id: 'publishing', label: 'Publishing Cohort to Network' },
  ];

  const currentStageIndex = stages.findIndex((s) => s.id === stage);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.spinner} />

        <div>
          <h3 className={styles.stageTitle}>Publishing Cohort...</h3>
          <p className={styles.stageDesc}>
            Creating your learning space, indexing discovery metadata, and provisioning community features.
          </p>
        </div>

        <div className={styles.stageList}>
          {stages.map((s, idx) => {
            const isDone = idx < currentStageIndex;
            const isActive = idx === currentStageIndex;

            return (
              <div
                key={s.id}
                className={`${styles.stageRow} ${isActive ? styles.stageRowActive : ''} ${
                  isDone ? styles.stageRowDone : ''
                }`}
              >
                {isDone ? (
                  <CheckCircle2 size={14} color="#34d399" />
                ) : (
                  <Circle size={14} color={isActive ? '#6366f1' : '#64748b'} />
                )}
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

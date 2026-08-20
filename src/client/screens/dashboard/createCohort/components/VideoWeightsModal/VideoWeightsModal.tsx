import React from 'react';
import { useWizardContext } from '../../providers/WizardProvider';
import styles from './VideoWeightsModal.module.css';

export function VideoWeightsModal() {
  const { launchState, actions } = useWizardContext();
  
  if (!launchState.isWeightsModalOpen) {
    return null;
  }

  const handleSubmit = () => {
    actions.publishCohort(true);
  };

  const handleCancel = () => {
    actions.closeWeightsModal();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2>Video Weights Required</h2>
        <p>This cohort requires video weights to proceed with publishing.</p>
        <div className={styles.actions}>
          <button onClick={handleCancel} className={styles.cancelBtn}>Cancel</button>
          <button onClick={handleSubmit} className={styles.submitBtn}>Submit with Weights</button>
        </div>
      </div>
    </div>
  );
}

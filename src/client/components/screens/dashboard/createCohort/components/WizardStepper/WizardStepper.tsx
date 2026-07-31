'use client';

import clsx from 'clsx';
import { Check } from 'lucide-react';

import type { WizardStepModel } from '../../models/createCohort';
import { useWizardContext } from '../../providers/WizardProvider';

import styles from './WizardStepper.module.css';

interface WizardStepperProps {
  steps: WizardStepModel[];
}

export function WizardStepper({ steps }: WizardStepperProps) {
  const { actions } = useWizardContext();

  return (
    <nav aria-label="Wizard progress" className={styles.root}>
      <ol className={styles.list}>
        {steps.map((step) => (
          <li
            key={step.id}
            className={clsx(styles.item, styles[step.status], step.disabled && styles.disabled)}
            aria-current={step.status === 'current' ? 'step' : undefined}
            aria-disabled={step.disabled || undefined}
            onClick={() => {
              if (!step.disabled) {
                actions.setStep(step.id);
              }
            }}
            style={{ cursor: step.disabled ? 'not-allowed' : 'pointer' }}
          >
            <span className={styles.marker} aria-hidden="true">
              {step.status === 'complete' ? <Check size={14} /> : step.index + 1}
            </span>
            <span className={styles.label}>{step.label}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

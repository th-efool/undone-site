'use client';

import clsx from 'clsx';
import { PenTool, Link2, BookOpen, Brush, Rocket } from 'lucide-react';

import type { WizardStepModel } from '../../models/createCohort';
import { useWizardContext } from '../../providers/WizardProvider';

import styles from './WizardStepper.module.css';

interface WizardStepperProps {
  steps: WizardStepModel[];
}

const stepIcons = [PenTool, Link2, BookOpen, Brush, Rocket];

export function WizardStepper({ steps }: WizardStepperProps) {
  const { actions } = useWizardContext();

  return (
    <nav aria-label="Wizard progress" className={styles.root}>
      <ol className={styles.list}>
        {steps.map((step, idx) => {
          const Icon = stepIcons[idx] || PenTool;
          const isCurrent = step.status === 'current';
          const isComplete = step.status === 'complete';

          return (
            <li
              key={step.id}
              className={clsx(styles.item, styles[step.status], step.disabled && styles.disabled)}
              aria-current={isCurrent ? 'step' : undefined}
              aria-disabled={step.disabled || undefined}
              onClick={() => {
                if (!step.disabled) {
                  actions.setStep(step.id);
                }
              }}
              title={step.label}
              style={{ cursor: step.disabled ? 'not-allowed' : 'pointer' }}
            >
              <span className={styles.marker} aria-hidden="true">
                <Icon size={16} strokeWidth={isCurrent ? 2.5 : 2} />
              </span>
              {idx < steps.length - 1 && <span className={styles.connector} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

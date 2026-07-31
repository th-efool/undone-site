'use client';

import { CheckCircle2, AlertOctagon, AlertTriangle, Lightbulb, ChevronRight } from 'lucide-react';
import type { CreateCohortStepId } from '../../models/createCohort';
import { useWizardContext } from '../../providers/WizardProvider';
import type { LaunchValidationItem } from '../../models/launch';

import styles from './LaunchChecklist.module.css';

export function LaunchChecklist() {
  const { curriculumState, state, launchState, actions } = useWizardContext();
  const curriculum = curriculumState.curriculum;

  const items: (Omit<LaunchValidationItem, 'targetStep'> & { targetStep: CreateCohortStepId })[] = [
    {
      id: 'val-1',
      severity: 'blocking',
      title: 'Cohort Title & Description',
      message: 'Cohort metadata set in Identity step.',
      targetStep: 'identity',
      passed: Boolean(state.draft.title.trim() && state.draft.description.trim()),
    },
    {
      id: 'val-2',
      severity: 'blocking',
      title: 'Learning Sources & Curriculum',
      message: 'Lessons generated from sources.',
      targetStep: 'curriculum',
      passed: Boolean(curriculum && curriculum.totalLessons > 0),
    },
    {
      id: 'val-3',
      severity: 'blocking',
      title: 'No Empty Seasons',
      message: 'Every season contains at least 1 lesson.',
      targetStep: 'curriculum',
      passed: Boolean(curriculum?.seasons.every((s) => s.lessons.length > 0)),
    },
    {
      id: 'val-4',
      severity: 'warning',
      title: 'Lesson Thumbnails',
      message: 'All lessons contain thumbnail artwork.',
      targetStep: 'curriculum',
      passed: Boolean(curriculum?.seasons.every((s) => s.lessons.every((l) => l.thumbnail))),
    },
    {
      id: 'val-5',
      severity: 'warning',
      title: 'Welcome Message',
      message: 'Onboarding welcome message set.',
      targetStep: 'publish',
      passed: Boolean(launchState.onboarding.welcomeMessage.trim()),
    },
    {
      id: 'val-6',
      severity: 'suggestion',
      title: 'Daily Goal Recommended',
      message: 'Daily study goal configured.',
      targetStep: 'publish',
      passed: Boolean(launchState.onboarding.recommendedDailyGoal.trim()),
    },
  ];

  const blockingCount = items.filter((i) => i.severity === 'blocking' && !i.passed).length;
  const warningCount = items.filter((i) => i.severity === 'warning' && !i.passed).length;
  const suggestionCount = items.filter((i) => i.severity === 'suggestion' && !i.passed).length;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <CheckCircle2 size={18} color="#34d399" />
          Launch Validation & Readiness
        </div>

        <div className={styles.badgeGroup}>
          {blockingCount > 0 && <span className={styles.tagBlocking}>{blockingCount} Blocking</span>}
          {warningCount > 0 && <span className={styles.tagWarning}>{warningCount} Warnings</span>}
          {suggestionCount > 0 && <span className={styles.tagSuggestion}>{suggestionCount} Suggestions</span>}
        </div>
      </div>

      <div className={styles.list}>
        {items.map((item) => (
          <div
            key={item.id}
            className={styles.item}
            onClick={() => actions.setStep(item.targetStep)}
            title={`Click to navigate to ${item.targetStep} step`}
          >
            <div className={styles.itemLeft}>
              {item.passed ? (
                <CheckCircle2 size={16} color="#34d399" />
              ) : item.severity === 'blocking' ? (
                <AlertOctagon size={16} color="#f87171" />
              ) : item.severity === 'warning' ? (
                <AlertTriangle size={16} color="#fbbf24" />
              ) : (
                <Lightbulb size={16} color="#60a5fa" />
              )}
              <span>
                <strong>{item.title}:</strong> {item.message}
              </span>
            </div>

            <ChevronRight size={14} color="#94a3b8" />
          </div>
        ))}
      </div>
    </div>
  );
}

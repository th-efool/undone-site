'use client';

import { useMemo } from 'react';
import {
  Monitor,
  Tablet,
  Smartphone,
  BookOpen,
  Compass,
  FileCheck,
  Calendar,
  Archive,
  Trophy,
} from 'lucide-react';
import { useWizardContext } from '../../providers/WizardProvider';
import type { LearnerPreviewTab } from '../../models/launch';
import { cohortRepository } from '@/src/client/repositories/cohortRepository';

import { Overview } from '@/src/client/screens/cohort/tabs/overview/Overview';
import { Questline } from '@/src/client/screens/cohort/tabs/questline/Questline';
import { Events } from '@/src/client/screens/cohort/tabs/events/Events';
import { Archives } from '@/src/client/screens/cohort/tabs/archives/Archives';
import { HallOfFame } from '@/src/client/screens/cohort/tabs/hallOfFame/HallOfFame';

import styles from './LearnerPreview.module.css';

export function LearnerPreview() {
  const { curriculumState, state, launchState, actions } = useWizardContext();
  const curriculum = curriculumState.curriculum;
  const viewport = launchState.deviceViewport;
  const activeTab = launchState.previewTab;

  // Register live preview cohort into repository so real tabs render authentic data
  const previewCohortId = useMemo(() => {
    if (!curriculum) return 'preview-cohort';
    const cohort = cohortRepository.registerPublishedCohort({
      cohortId: 'preview-cohort',
      title: state.draft.title || 'Untitled Cohort',
      description: state.draft.description || 'Cohort description placeholder.',
      coverImage: state.draft.coverImage || '/mock/thumbnails/docker.avif',
      difficulty: state.draft.difficulty,
      visibility: state.draft.visibility,
      curriculum,
      onboarding: launchState.onboarding,
    });
    return cohort.id;
  }, [
    curriculum,
    state.draft.title,
    state.draft.description,
    state.draft.coverImage,
    state.draft.difficulty,
    state.draft.visibility,
    launchState.onboarding,
  ]);

  if (!curriculum) return null;

  const tabs: { id: LearnerPreviewTab; label: string; icon: typeof BookOpen }[] = [
    { id: 'overview', label: 'Overview', icon: Compass },
    { id: 'questline', label: 'Questline', icon: BookOpen },
  ];

  return (
    <div className={styles.previewContainer}>
      <div className={styles.controlsBar}>
        <div className={styles.viewTabs}>
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                className={`${styles.tabBtn} ${activeTab === t.id ? styles.tabActive : ''}`}
                onClick={() => actions.setPreviewTab(t.id)}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className={styles.viewportSwitch}>
          <button
            type="button"
            className={`${styles.viewportBtn} ${viewport === 'desktop' ? styles.viewportActive : ''}`}
            onClick={() => actions.setDeviceViewport('desktop')}
            title="Desktop Viewport"
          >
            <Monitor size={15} />
          </button>
          <button
            type="button"
            className={`${styles.viewportBtn} ${viewport === 'tablet' ? styles.viewportActive : ''}`}
            onClick={() => actions.setDeviceViewport('tablet')}
            title="Tablet Viewport"
          >
            <Tablet size={15} />
          </button>
          <button
            type="button"
            className={`${styles.viewportBtn} ${viewport === 'mobile' ? styles.viewportActive : ''}`}
            onClick={() => actions.setDeviceViewport('mobile')}
            title="Mobile Viewport"
          >
            <Smartphone size={15} />
          </button>
        </div>
      </div>

      {/* Device Frame */}
      <div className={styles.deviceWrapper}>
        <div className={`${styles.viewportContainer} ${styles[`viewport${viewport}`]}`}>
          <div className={styles.previewCanvas}>
            {activeTab === 'overview' && <Overview cohortId={previewCohortId} cohort={cohortRepository.getById(previewCohortId)!} />}
            {activeTab === 'questline' && <Questline cohortId={previewCohortId} cohort={cohortRepository.getById(previewCohortId)!} />}
            {activeTab === 'events' && <Events cohortId={previewCohortId} cohort={cohortRepository.getById(previewCohortId)!} />}
            {activeTab === 'archives' && <Archives cohortId={previewCohortId} cohort={cohortRepository.getById(previewCohortId)!} />}
            {(activeTab === 'hall-of-fame' || activeTab === 'assignments' || activeTab === 'player') && (
              <HallOfFame cohortId={previewCohortId} cohort={cohortRepository.getById(previewCohortId)!} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";
import Image from 'next/image';

import { Rocket, Clock, Layers, BookOpen, AlertCircle } from 'lucide-react';
import { Badge } from '@/src/client/components/ui/Badge/Badge';
import { useWizardContext } from '../../providers/WizardProvider';
import { LearnerPreview } from '../LearnerPreview/LearnerPreview';
import { OnboardingConfig } from '../OnboardingConfig/OnboardingConfig';
import { CommunityConfig } from '../CommunityConfig/CommunityConfig';
import { JourneySettingsConfig } from '../JourneySettingsConfig/JourneySettingsConfig';
import { LaunchChecklist } from '../LaunchChecklist/LaunchChecklist';
import { PublishingModal } from '../PublishingModal/PublishingModal';
import { LaunchSuccess } from '../LaunchSuccess/LaunchSuccess';

import styles from './LaunchStep.module.css';

export function LaunchStep() {
  const { curriculumState, state, launchState, validation, actions } = useWizardContext();
  const curriculum = curriculumState.curriculum;
  const isLive = launchState.publishStage === 'live';

  if (isLive) {
    return <LaunchSuccess />;
  }

  if (!curriculum) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
        No curriculum generated yet. Please generate curriculum in Step 3 before launching.
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {/* Top Launch Summary Banner */}
      <div className={styles.summaryStrip}>
        <div className={styles.summaryLeft}>
          <Image fill
            src={state.draft.coverImage || '/mock/thumbnails/docker.avif'}
            alt={state.draft.title}
            className={styles.artwork}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/mock/thumbnails/docker.avif';
            }}
          />

          <div>
            <span className={styles.summaryTitle}>{state.draft.title || 'Untitled Cohort'}</span>
            <div className={styles.summaryMeta}>
              <span>
                <Clock size={12} style={{ display: 'inline', marginRight: 3 }} />
                {curriculum.totalHours}
              </span>
              <span>•</span>
              <span>
                <Layers size={12} style={{ display: 'inline', marginRight: 3 }} />
                {curriculum.totalSeasons} seasons
              </span>
              <span>•</span>
              <span>
                <BookOpen size={12} style={{ display: 'inline', marginRight: 3 }} />
                {curriculum.totalLessons} lessons
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Badge variant="success" size="md">
            {launchState.journeySettings.visibility}
          </Badge>

          <button
            type="button"
            onClick={actions.publishCohort}
            disabled={!validation.launch || launchState.publishStage !== 'idle'}
            className={styles.launchBtn}
          >
            <Rocket size={18} />
            Publish Cohort
          </button>
        </div>
      </div>

      {launchState.publishError && (
        <div
          style={{
            padding: '0.85rem 1rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            color: '#f87171',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={16} />
          {launchState.publishError}
        </div>
      )}

      {/* Centerpiece: Real Learner Preview */}
      <LearnerPreview />

      {/* Validation Checklist */}
      <LaunchChecklist />

      {/* Onboarding & First-Time Learner Experience */}
      <OnboardingConfig />

      {/* Community Feature Toggles */}
      <CommunityConfig />

      {/* Discovery & Visibility Settings */}
      <JourneySettingsConfig />

      {/* Publishing Progress Overlay Modal */}
      <PublishingModal />
    </div>
  );
}

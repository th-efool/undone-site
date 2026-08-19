"use client";
import Image from 'next/image';

import { Clock, Layers, BookOpen, AlertCircle } from 'lucide-react';
import { Badge } from '@/src/client/components/ui/Badge/Badge';
import { useWizardContext } from '../../providers/WizardProvider';
import { LearnerPreview } from '../LearnerPreview/LearnerPreview';
import { OnboardingConfig } from '../OnboardingConfig/OnboardingConfig';
import { CommunityConfig } from '../CommunityConfig/CommunityConfig';
import { JourneySettingsConfig } from '../JourneySettingsConfig/JourneySettingsConfig';
import { LaunchChecklist } from '../LaunchChecklist/LaunchChecklist';
import { PublishingModal } from '../PublishingModal/PublishingModal';
import { LaunchSuccess } from '../LaunchSuccess/LaunchSuccess';
import { Stack } from '@/src/client/components/global/layout/Stack';
import { Cluster } from '@/src/client/components/global/layout/Cluster';
import { Text } from '@/src/client/components/ui/Typography/Text';

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
      <div className={styles.emptyState}>
        <Text variant="muted">
          No curriculum generated yet. Please generate curriculum in Step 3 before launching.
        </Text>
      </div>
    );
  }

  return (
    <div className={styles.specSheet}>
      <div className={styles.specRow}>
        <span className={styles.specLabel}>Cohort Title</span>
        <span className={styles.specValue}>{state.draft.title || 'Untitled Cohort'}</span>
      </div>
      
      <div className={styles.specRow}>
        <span className={styles.specLabel}>Artwork</span>
        <span className={styles.specValue}>
          <Image width={90} height={56}
            src={state.draft.coverImage || '/mock/thumbnails/docker.avif'}
            alt={state.draft.title}
            className={styles.artwork}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/mock/thumbnails/docker.avif';
            }}
          />
        </span>
      </div>
      
      <div className={styles.specRow}>
        <span className={styles.specLabel}>Curriculum</span>
        <span className={styles.specValue}>
          <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
          {curriculum.totalHours} &bull; <Layers size={12} style={{ display: 'inline', margin: '0 4px' }} />
          {curriculum.totalSeasons} seasons &bull; <BookOpen size={12} style={{ display: 'inline', margin: '0 4px' }} />
          {curriculum.totalLessons} lessons
        </span>
      </div>
      
      <div className={styles.specRow}>
        <span className={styles.specLabel}>Visibility</span>
        <span className={styles.specValue}>{launchState.journeySettings.visibility}</span>
      </div>

      <div className={styles.specRow}>
        <span className={styles.specLabel}>Learner Preview</span>
        <div className={styles.specValue}>
          <LearnerPreview />
        </div>
      </div>

      <div className={styles.specRow}>
        <span className={styles.specLabel}>Launch Checklist</span>
        <div className={styles.specValue}>
          <LaunchChecklist />
        </div>
      </div>

      <div className={styles.specRow}>
        <span className={styles.specLabel}>Onboarding</span>
        <div className={styles.specValue}>
          <OnboardingConfig />
        </div>
      </div>

      <div className={styles.specRow}>
        <span className={styles.specLabel}>Community</span>
        <div className={styles.specValue}>
          <CommunityConfig />
        </div>
      </div>

      <div className={styles.specRow}>
        <span className={styles.specLabel}>Journey Settings</span>
        <div className={styles.specValue}>
          <JourneySettingsConfig />
        </div>
      </div>

      {launchState.publishError && (
        <div className={styles.specRow}>
          <span className={styles.specLabel}>Status</span>
          <div className={`${styles.specValue} ${styles.errorValue}`}>
            <AlertCircle size={16} style={{ display: 'inline', marginRight: 4 }} />
            {launchState.publishError}
          </div>
        </div>
      )}

      <PublishingModal />
    </div>
  );
}

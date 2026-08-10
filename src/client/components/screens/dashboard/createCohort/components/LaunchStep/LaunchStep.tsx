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
import { Stack } from '@/src/client/components/global/layout/Stack';
import { Cluster } from '@/src/client/components/global/layout/Cluster';
import { Surface } from '@/src/client/components/global/layout/Surface';
import { Button } from '@/src/client/components/ui/Button/Button';
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
      <Surface padding="xl" style={{ textAlign: 'center' }}>
        <Text variant="muted">
          No curriculum generated yet. Please generate curriculum in Step 3 before launching.
        </Text>
      </Surface>
    );
  }

  return (
    <Stack gap="6" className={styles.root}>
      {/* Top Launch Summary Banner */}
      <div className={styles.summaryStrip}>
        <div className={styles.summaryLeft}>
          <Image width={400} height={300}
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

        <Cluster gap="3">
          <Badge variant="success" size="md">
            {launchState.journeySettings.visibility}
          </Badge>

          <Button
            type="button"
            onClick={actions.publishCohort}
            disabled={!validation.launch || launchState.publishStage !== 'idle'}
            variant="momentum"
          >
            <Rocket size={18} />
            Publish Cohort
          </Button>
        </Cluster>
      </div>

      {launchState.publishError && (
        <Surface
          style={{
            background: 'var(--color-error-bg)',
            border: '1px solid var(--color-error)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-error)',
            fontSize: 'var(--font-small-size)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={16} />
          {launchState.publishError}
        </Surface>
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
    </Stack>
  );
}

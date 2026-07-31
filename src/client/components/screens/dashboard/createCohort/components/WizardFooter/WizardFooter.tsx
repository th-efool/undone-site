import { ChevronLeft, ChevronRight, RotateCcw, SquareDashedBottomCode, Rocket } from 'lucide-react';

import { Button } from '@/src/client/components/ui/Button/Button';
import { Cluster } from '@/src/client/components/global/layout/Cluster';
import { Stack } from '@/src/client/components/global/layout/Stack';
import { Surface } from '@/src/client/components/global/layout/Surface';
import { Text } from '@/src/client/components/ui/Typography/Text';

import type { WizardFooterModel } from '../../models/createCohort';
import { useWizardContext } from '../../providers/WizardProvider';

import styles from './WizardFooter.module.css';

interface WizardFooterProps {
  footer: WizardFooterModel;
}

export function WizardFooter({ footer }: WizardFooterProps) {
  const { state, importState, validation, actions } = useWizardContext();
  const isSources = state.currentStep === 'sources';
  const isCurriculum = state.currentStep === 'curriculum';
  const isLaunch = state.currentStep === 'publish';
  const isImporting = importState.status === 'running';
  const isFailed = importState.status === 'failed';
  const showPrevious = footer.previousVisible && !isImporting;

  let primaryLabel = footer.continueLabel;
  let primaryIcon = <ChevronRight size={16} />;
  let primaryVariant: 'primary' | 'secondary' | 'danger' = 'primary';
  const handleDetailsContinue = () => {
    if (!state.draft.title || !state.draft.title.trim()) {
      const input = document.getElementById('cohort-title');
      if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    actions.goNext();
  };

  let primaryAction = state.currentStep === 'details' ? handleDetailsContinue : actions.goNext;
  let primaryDisabled = state.currentStep === 'details' ? false : footer.continueDisabled;

  if (isSources && isImporting) {
    primaryLabel = 'Cancel import';
    primaryIcon = <SquareDashedBottomCode size={16} />;
    primaryVariant = 'danger';
    primaryAction = actions.cancelImport;
    primaryDisabled = false;
  } else if (isSources && isFailed) {
    primaryLabel = 'Retry import';
    primaryIcon = <RotateCcw size={16} />;
    primaryVariant = 'primary';
    primaryAction = actions.retryImport;
    primaryDisabled = false;
  } else if (isCurriculum) {
    primaryLabel = 'Continue to Launch';
    primaryAction = actions.goNext;
    primaryDisabled = false;
  } else if (isLaunch) {
    primaryLabel = 'Publish Cohort';
    primaryIcon = <Rocket size={16} />;
    primaryAction = actions.publishCohort;
    primaryDisabled = !validation.launch;
  }

  return (
    <Surface variant="elevated" padding="md" className={styles.root}>
      <div className={styles.inner}>
        <Stack gap="1" className={styles.progress}>
          <Text variant="small" className={styles.stepLabel}>
            {footer.currentLabel}
          </Text>
          <Text variant="small" className={styles.stepMeta}>
            {footer.progressLabel}
          </Text>
          <Text variant="muted" className={styles.helper}>
            {footer.helperText}
          </Text>
        </Stack>

        <Cluster gap="3" justify="end" className={styles.actions}>
          {showPrevious ? (
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={actions.goPrevious}
            >
              <ChevronLeft size={16} />
              Previous
            </Button>
          ) : null}

          <Button
            type="button"
            variant={primaryVariant}
            size="md"
            onClick={primaryAction}
            disabled={primaryDisabled}
          >
            {primaryLabel}
            {primaryIcon}
          </Button>
        </Cluster>
      </div>
    </Surface>
  );
}

import { ChevronLeft, ChevronRight, RotateCcw, SquareDashedBottomCode, Rocket } from 'lucide-react';

import { Button } from '@/src/client/components/ui/Button/Button';
import { Cluster } from '@/src/client/components/global/layout/Cluster';

import type { WizardFooterModel } from '../../models/createCohort';
import { useWizardContext } from '../../providers/WizardProvider';
import { CurriculumQuality } from '../CurriculumQuality/CurriculumQuality';

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
  
  let primaryAction = actions.goNext;
  let primaryDisabled = footer.continueDisabled;

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
    <div className={styles.root}>
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

        {isCurriculum && <CurriculumQuality />}

        <Button
          type="button"
          variant={primaryVariant}
          size="md"
          onClick={() => primaryAction()}
          disabled={primaryDisabled}
        >
          {primaryLabel}
          {primaryIcon}
        </Button>
      </Cluster>
    </div>
  );
}

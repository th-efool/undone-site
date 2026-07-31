import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  const { actions } = useWizardContext();

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
          {footer.previousVisible ? (
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
            variant="primary"
            size="md"
            onClick={actions.goNext}
            disabled={footer.continueDisabled}
          >
            Continue
            <ChevronRight size={16} />
          </Button>
        </Cluster>
      </div>
    </Surface>
  );
}

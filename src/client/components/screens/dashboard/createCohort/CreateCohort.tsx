'use client';

import { Container } from '@/src/client/components/global/layout/Container';
import { Stack } from '@/src/client/components/global/layout/Stack';
import { Surface } from '@/src/client/components/global/layout/Surface';
import { Heading } from '@/src/client/components/ui/Typography/Heading';
import { Text } from '@/src/client/components/ui/Typography/Text';

import { WizardProvider } from './providers/WizardProvider';
import { useCreateCohortViewModel } from './hooks/useCreateCohortModels';
import { WizardStepper } from './components/WizardStepper/WizardStepper';
import { WizardFooter } from './components/WizardFooter/WizardFooter';
import { DetailsStep } from './components/DetailsStep/DetailsStep';
import { SourcesStep } from './components/SourcesStep/SourcesStep';

import styles from './CreateCohort.module.css';

function CreateCohortScreen() {
  const model = useCreateCohortViewModel();

  return (
    <main className={styles.screen}>
      <Container size="wide">
        <Stack gap="8" className={styles.pageStack}>
          <section className={styles.header}>
            <Stack gap="3">
              <Heading level={1} className={styles.title}>
                {model.header.title}
              </Heading>
              <Text variant="lead" className={styles.description}>
                {model.header.description}
              </Text>
            </Stack>
          </section>

          <WizardStepper steps={model.steps} />

          <Surface variant="elevated" padding="xl" className={styles.surface}>
            {model.steps[0].status === 'current' && <DetailsStep details={model.details} />}

            {model.steps[1].status === 'current' && <SourcesStep sources={model.sources} />}

            {model.steps[2].status === 'current' && (
              <div className={styles.disabledStep}>
                <Heading level={2}>Curriculum</Heading>
                <Text variant="muted">This step is staged for a later prompt.</Text>
              </div>
            )}

            {model.steps[3].status === 'current' && (
              <div className={styles.disabledStep}>
                <Heading level={2}>Publish</Heading>
                <Text variant="muted">This step is staged for a later prompt.</Text>
              </div>
            )}
          </Surface>

          <WizardFooter footer={model.footer} />
        </Stack>
      </Container>
    </main>
  );
}

export function CreateCohort() {
  return (
    <WizardProvider>
      <CreateCohortScreen />
    </WizardProvider>
  );
}

'use client';

import { Container } from '@/src/client/components/global/layout/Container';
import { Stack } from '@/src/client/components/global/layout/Stack';
import { Cluster } from '@/src/client/components/global/layout/Cluster';
import { Surface } from '@/src/client/components/global/layout/Surface';
import { Heading } from '@/src/client/components/ui/Typography/Heading';
import { Text } from '@/src/client/components/ui/Typography/Text';

import { WizardProvider } from './providers/WizardProvider';
import { useCreateCohortViewModel } from './hooks/useCreateCohortModels';
import { WizardStepper } from './components/WizardStepper/WizardStepper';
import { WizardFooter } from './components/WizardFooter/WizardFooter';
import { TopicStep } from './components/TopicStep/TopicStep';
import { SourcesStep } from './components/SourcesStep/SourcesStep';
import { CurriculumStep } from './components/CurriculumStep/CurriculumStep';
import { IdentityStep } from './components/IdentityStep/IdentityStep';
import { LaunchStep } from './components/LaunchStep/LaunchStep';

import styles from './CreateCohort.module.css';

function CreateCohortScreen() {
  const model = useCreateCohortViewModel();

  return (
    <main className={styles.screen}>
      <Container size="wide">
        <Stack gap="8" className={styles.pageStack}>
          <section className={styles.header}>
            <div className={styles.headerTop}>
              <Text className={styles.appTitle}>Create Cohort</Text>
            </div>
            
            <div className={styles.headerToolbar}>
              <div className={styles.headerInfo}>
                <Text className={styles.stepTitle}>{model.header.title}</Text>
                <span className={styles.headerDivider} />
                <Text className={styles.stepDescription}>{model.header.description}</Text>
              </div>
              <WizardStepper steps={model.steps} />
            </div>
          </section>

          <div className={styles.stepContainer}>
            {model.steps[0].status === 'current' && <TopicStep details={model.details} />}

            {model.steps[1].status === 'current' && (
              <SourcesStep sources={model.sources} importWorkspace={model.importWorkspace} />
            )}

            {model.steps[2].status === 'current' && <CurriculumStep />}

            {model.steps[3].status === 'current' && <IdentityStep details={model.details} />}

            {model.steps[4].status === 'current' && <LaunchStep />}
          </div>

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

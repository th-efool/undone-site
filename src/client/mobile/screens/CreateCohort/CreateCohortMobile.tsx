'use client';

import type { UseCreateCohortViewModelResult } from '@/src/client/screens/dashboard/createCohort/hooks/useCreateCohortModels';
import { TopicStep } from '@/src/client/screens/dashboard/createCohort/components/TopicStep/TopicStep';
import { SourcesStep } from '@/src/client/screens/dashboard/createCohort/components/SourcesStep/SourcesStep';
import { CurriculumStep } from '@/src/client/screens/dashboard/createCohort/components/CurriculumStep/CurriculumStep';
import { IdentityStep } from '@/src/client/screens/dashboard/createCohort/components/IdentityStep/IdentityStep';
import { LaunchStep } from '@/src/client/screens/dashboard/createCohort/components/LaunchStep/LaunchStep';
import { WizardFooter } from '@/src/client/screens/dashboard/createCohort/components/WizardFooter/WizardFooter';

import styles from './CreateCohortMobile.module.css';

interface CreateCohortMobileProps {
  model: UseCreateCohortViewModelResult;
}

export function CreateCohortMobile({ model }: CreateCohortMobileProps) {
  return (
    <main className={styles.mobileCreateCohort}>
      <header className={styles.header}>
        <h1 className={styles.title}>{model.header.title}</h1>
        <p className={styles.stepSubtitle}>{model.header.description}</p>
      </header>

      <div className={styles.stepContent}>
        {model.steps[0].status === 'current' && <TopicStep details={model.details} />}
        {model.steps[1].status === 'current' && (
          <SourcesStep sources={model.sources} importWorkspace={model.importWorkspace} />
        )}
        {model.steps[2].status === 'current' && <CurriculumStep />}
        {model.steps[3].status === 'current' && <IdentityStep details={model.details} />}
        {model.steps[4].status === 'current' && <LaunchStep />}
      </div>

      <footer className={styles.footer}>
        <WizardFooter footer={model.footer} />
      </footer>
    </main>
  );
}

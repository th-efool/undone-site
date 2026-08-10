'use client';

import { useExperience } from '@/src/client/hooks/useExperience';
import { WizardProvider } from './providers/WizardProvider';
import { useCreateCohortViewModel } from './hooks/useCreateCohortModels';
import { CreateCohortDesktop } from './CreateCohortDesktop';
import { CreateCohortMobile } from '@/src/client/mobile/screens/CreateCohort/CreateCohortMobile';

function CreateCohortScreen() {
  const experience = useExperience();
  const model = useCreateCohortViewModel();

  if (experience === 'mobile') {
    return <CreateCohortMobile model={model} />;
  }

  return <CreateCohortDesktop model={model} />;
}

export function CreateCohort() {
  return (
    <WizardProvider>
      <CreateCohortScreen />
    </WizardProvider>
  );
}

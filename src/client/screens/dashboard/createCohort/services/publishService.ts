import type { PublishResultModel, PublishStage } from '../models/launch';
import { cohortRepository } from '@/src/client/repositories/cohortRepository';
import { apiUrl } from '@/src/shared/api/apiUrl';

import type { CreateCohortDraft } from '../models/createCohort';
import type { GeneratedCurriculum } from '@/src/shared/curriculum/curriculum.types';
import type { OnboardingConfigModel, CommunityConfigModel, JourneySettingsModel } from '../models/launch';

interface PublishCohortInput {
  draft: CreateCohortDraft;
  curriculum: GeneratedCurriculum;
  onboarding: OnboardingConfigModel;
  community: CommunityConfigModel;
  journeySettings: JourneySettingsModel;
  qualityScore: number;
}

class PublishService {
  async publishCohort(
    input: PublishCohortInput,
    onStageChange: (stage: PublishStage) => void,
  ): Promise<PublishResultModel> {
    onStageChange('preparing-assets');
    await new Promise((resolve) => setTimeout(resolve, 500));

    onStageChange('search-metadata');
    await new Promise((resolve) => setTimeout(resolve, 500));

    onStageChange('creating-community');
    await new Promise((resolve) => setTimeout(resolve, 500));

    onStageChange('publishing');

    const response = await fetch(apiUrl('/api/cohort/publish'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(body?.message || 'Publishing failed');
    }

    // Register into shared cohort repository & localStorage
    const newCohort = cohortRepository.registerPublishedCohort({
      cohortId: body.cohortId,
      title: input.draft?.title || body.cohortTitle || 'Untitled Cohort',
      description: input.draft?.description || '',
      coverImage: input.draft?.coverImage || body.coverImage || '',
      difficulty: input.draft?.difficulty || 'Intermediate',
      visibility: input.journeySettings?.visibility || 'Public',
      curriculum: input.curriculum,
      onboarding: input.onboarding,
    });

    const result: PublishResultModel = {
      ...body,
      cohortId: newCohort.id,
      cohortUrl: `/cohort/${newCohort.id}`,
      cohortTitle: newCohort.title,
      coverImage: newCohort.coverImage,
    };

    onStageChange('live');
    return result;
  }
}

export const publishService = new PublishService();

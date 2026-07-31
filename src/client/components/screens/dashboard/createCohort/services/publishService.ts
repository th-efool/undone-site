import type { PublishResultModel, PublishStage } from '../models/launch';

interface PublishCohortInput {
  draft: unknown;
  curriculum: unknown;
  onboarding: unknown;
  community: unknown;
  journeySettings: unknown;
  qualityScore: number;
}

class PublishService {
  async publishCohort(
    input: PublishCohortInput,
    onStageChange: (stage: PublishStage) => void,
  ): Promise<PublishResultModel> {
    onStageChange('preparing-assets');
    await new Promise((resolve) => setTimeout(resolve, 600));

    onStageChange('search-metadata');
    await new Promise((resolve) => setTimeout(resolve, 600));

    onStageChange('creating-community');
    await new Promise((resolve) => setTimeout(resolve, 600));

    onStageChange('publishing');

    const response = await fetch('/api/cohort/publish', {
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

    onStageChange('live');
    return body as PublishResultModel;
  }
}

export const publishService = new PublishService();

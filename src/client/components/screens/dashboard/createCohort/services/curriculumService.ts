'use client';

import { apiUrl } from '@/src/shared/api/apiUrl';
import type {
  CurriculumGenerationError,
  CurriculumGenerationInput,
  GeneratedCurriculum,
} from '@/src/shared/curriculum';

class CurriculumService {
  async generateCurriculum(input: CurriculumGenerationInput): Promise<GeneratedCurriculum> {
    const response = await fetch(apiUrl('/api/curriculum/generate'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw (body?.error ?? body ?? {
        code: 'request_failed',
        title: 'Curriculum generation failed',
        message: 'The curriculum could not be generated.',
        retryable: true,
      }) as CurriculumGenerationError;
    }

    return body as GeneratedCurriculum;
  }
}

export const curriculumService = new CurriculumService();

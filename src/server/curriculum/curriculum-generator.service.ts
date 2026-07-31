import {
  generateCurriculum,
  type CurriculumGenerationInput,
  type GeneratedCurriculum,
} from '@/src/shared/curriculum';

export class CurriculumGeneratorService {
  generate(input: CurriculumGenerationInput): GeneratedCurriculum {
    return generateCurriculum(input);
  }
}

export const curriculumGeneratorService = new CurriculumGeneratorService();

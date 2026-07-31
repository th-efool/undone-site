import { NextRequest } from 'next/server';

import { generateCurriculum, type CurriculumGenerationInput } from '@/src/shared/curriculum';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as CurriculumGenerationInput | null;

    if (!body || !Array.isArray(body.importedSources)) {
      return Response.json(
        {
          code: 'invalid_input',
          title: 'Invalid Input',
          message: 'The request body must contain imported sources.',
          retryable: false,
        },
        { status: 400 },
      );
    }

    const result = generateCurriculum({
      title: body.title || 'Curriculum',
      description: body.description || 'Generated curriculum from imported sources.',
      importedSources: body.importedSources,
    });

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate curriculum';
    return Response.json(
      {
        code: 'generation_failed',
        title: 'Curriculum Generation Failed',
        message,
        retryable: true,
      },
      { status: 500 },
    );
  }
}

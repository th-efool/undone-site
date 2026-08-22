import { NextRequest } from 'next/server';

import { generateCurriculum, type CurriculumGenerationInput } from '@/src/shared/curriculum';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as CurriculumGenerationInput | null;

    if (!body || typeof body !== 'object' || !Array.isArray(body.importedSources)) {
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

    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Curriculum';
    const description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : 'Generated curriculum from imported sources.';

    const result = generateCurriculum({
      title,
      description,
      importedSources: body.importedSources,
    });

    if (!result) {
      return Response.json(
        {
          code: 'generation_failed',
          title: 'Curriculum Generation Failed',
          message: 'Failed to produce curriculum output.',
          retryable: true,
        },
        { status: 500 },
      );
    }

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

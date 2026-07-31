import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || !body.draft || !body.curriculum) {
      return Response.json(
        {
          code: 'invalid_payload',
          title: 'Invalid Cohort Payload',
          message: 'Draft details and generated curriculum are required to publish.',
        },
        { status: 400 },
      );
    }

    const cohortId = `cohort-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const cohortTitle = body.draft.title || 'Untitled Cohort';

    return Response.json({
      cohortId,
      cohortTitle,
      cohortUrl: `/cohort/${cohortId}`,
      publishedAt: new Date().toISOString(),
      version: '1.0.0',
      visibility: body.journeySettings?.visibility || 'Public',
      totalHours: body.curriculum.totalHours || '0m',
      totalLessons: body.curriculum.totalLessons || 0,
      totalSeasons: body.curriculum.totalSeasons || 0,
      qualityScore: body.qualityScore || 90,
      coverImage: body.draft.coverImage || '/images/landing/screen.webp',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Publishing failed';
    return Response.json(
      {
        code: 'publish_error',
        title: 'Publish Failed',
        message,
      },
      { status: 500 },
    );
  }
}

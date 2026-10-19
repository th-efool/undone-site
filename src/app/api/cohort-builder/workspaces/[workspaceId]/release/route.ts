import { z } from 'zod';
import { revalidateTag, revalidatePath } from 'next/cache';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';
import { validateCohortReadiness, CohortReadinessError } from '@/src/shared/cohort-builder/readiness';
import { releaseWorkspace } from '@/src/server/domain/cohort-builder/release-service';
import { cohortTag } from '@/src/server/domain/cohort/public-cohort';

export const dynamic = 'force-dynamic';

const MAX_RELEASE_BODY = 64 * 1024;

const releaseRequestSchema = z.object({
  mode: z.enum(['private_activation', 'public_publish']).default('private_activation'),
  operationId: z.string().optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const ownerId = await getCreationOwner();
  const headers = { 'Cache-Control': 'private, no-store' };

  if (!ownerId) {
    return Response.json({ code: 'UNAUTHORIZED' }, { status: 401, headers });
  }

  if (!z.string().uuid().safeParse(workspaceId).success) {
    return Response.json({ code: 'INVALID_WORKSPACE_ID' }, { status: 400, headers });
  }

  const workspaceRow = await prisma.interactionWorkspace.findFirst({
    where: { id: workspaceId, ownerId, domainId: 'cohort', lifecycle: 'active' },
    select: { id: true, snapshot: true, revision: true },
  });

  if (!workspaceRow) {
    return Response.json({ code: 'NOT_FOUND' }, { status: 404, headers });
  }

  try {
    const workspace = cohortWorkspaceSchema.parse(workspaceRow.snapshot);
    const privateReadiness = validateCohortReadiness(workspace, 'private_activation');
    const publicReadiness = validateCohortReadiness(workspace, 'public_publish');

    return Response.json(
      {
        released: workspace.release?.status === 'released',
        release: workspace.release ?? null,
        readiness: {
          private: privateReadiness,
          public: publicReadiness,
        },
        revision: workspaceRow.revision,
      },
      { headers }
    );
  } catch (error) {
    return Response.json(
      { code: 'INVALID_WORKSPACE_DATA', message: (error as Error).message },
      { status: 500, headers }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return Response.json({ code: 'INVALID_ORIGIN' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } });
  }

  const headers = { 'Cache-Control': 'private, no-store' };

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.length > MAX_RELEASE_BODY) {
      return Response.json({ code: 'INPUT_TOO_LARGE' }, { status: 413, headers });
    }
    if (text.trim()) {
      body = JSON.parse(text);
    }
  } catch {
    return Response.json({ code: 'INVALID_JSON' }, { status: 400, headers });
  }

  const { workspaceId } = await params;
  const ownerId = await getCreationOwner();

  if (!ownerId) {
    return Response.json({ code: 'UNAUTHORIZED' }, { status: 401, headers });
  }

  if (!z.string().uuid().safeParse(workspaceId).success) {
    return Response.json({ code: 'INVALID_WORKSPACE_ID' }, { status: 400, headers });
  }

  const parseResult = releaseRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return Response.json(
      { code: 'INVALID_REQUEST', issues: parseResult.error.issues },
      { status: 400, headers }
    );
  }

  const { mode, operationId, expectedRevision } = parseResult.data;

  try {
    const result = await releaseWorkspace(prisma, {
      workspaceId,
      ownerId,
      mode,
      operationId,
      expectedRevision,
    });

    if (result.receipt.mode === 'public_publish') {
      try {
        revalidateTag(cohortTag(result.receipt.cohortId), 'max');
        revalidatePath(`/cohort/${result.receipt.cohortId}/overview`);
        revalidatePath(`/cohort/${result.receipt.cohortId}/questline`);
        revalidatePath('/sitemap.xml');
      } catch (cacheError) {
        console.error('Failed to revalidate cache after public publish:', cacheError);
      }
    }

    return Response.json(
      {
        success: true,
        receipt: result.receipt,
        revision: result.revision,
      },
      { status: 200, headers }
    );
  } catch (error) {
    if (error instanceof CohortReadinessError) {
      return Response.json(
        {
          code: 'COHORT_NOT_READY',
          message: error.message,
          report: error.report,
        },
        { status: 422, headers }
      );
    }

    const message = (error as Error).message || String(error);

    if (message.includes('WORKSPACE_NOT_FOUND')) {
      return Response.json({ code: 'WORKSPACE_NOT_FOUND', message }, { status: 404, headers });
    }
    if (message.includes('UNAUTHORIZED_OWNER')) {
      return Response.json({ code: 'UNAUTHORIZED_OWNER', message }, { status: 403, headers });
    }
    if (message.includes('WORKSPACE_ARCHIVED')) {
      return Response.json({ code: 'WORKSPACE_ARCHIVED', message }, { status: 410, headers });
    }
    if (message.includes('STALE_WORKSPACE')) {
      return Response.json({ code: 'STALE_WORKSPACE', message }, { status: 409, headers });
    }
    if (message.includes('CANNOT_DOWNGRADE_PUBLIC_COHORT')) {
      return Response.json({ code: 'CANNOT_DOWNGRADE_PUBLIC_COHORT', message }, { status: 409, headers });
    }

    return Response.json(
      { code: 'RELEASE_FAILED', message },
      { status: 500, headers }
    );
  }
}

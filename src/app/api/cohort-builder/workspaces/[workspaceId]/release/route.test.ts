import { afterEach, describe, expect, it, vi } from 'vitest';
import { CohortReadinessError } from '@/src/shared/cohort-builder/readiness';

const fake = vi.hoisted(() => ({
  owner: 'owner' as string | null,
  findFirst: vi.fn(),
  releaseResult: null as any,
  releaseError: null as any,
}));

vi.mock('@/src/server/infrastructure/auth/getCreationOwner', () => ({
  getCreationOwner: async () => fake.owner,
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    interactionWorkspace: {
      findFirst: (...args: unknown[]) => fake.findFirst(...args),
    },
  },
}));

vi.mock('@/src/server/domain/cohort-builder/release-service', () => ({
  releaseWorkspace: async () => {
    if (fake.releaseError) throw fake.releaseError;
    return fake.releaseResult;
  },
}));

import { GET, POST } from './route';

describe('Release API Route', () => {
  const validWorkspaceId = '54103d7b-2709-4dd6-bb18-522f96b97241';

  afterEach(() => {
    fake.owner = 'owner';
    fake.findFirst.mockReset();
    fake.releaseResult = null;
    fake.releaseError = null;
  });

  it('rejects unauthenticated requests with 401', async () => {
    fake.owner = null;
    const req = new Request('https://test.local/api/cohort-builder/workspaces/xyz/release', { method: 'GET' });
    const res = await GET(req, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });
    expect(res.status).toBe(401);
  });

  it('rejects invalid workspaceId with 400', async () => {
    const req = new Request('https://test.local/api/cohort-builder/workspaces/invalid-uuid/release', { method: 'GET' });
    const res = await GET(req, { params: Promise.resolve({ workspaceId: 'invalid-uuid' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when workspace does not exist', async () => {
    fake.findFirst.mockResolvedValue(null);
    const req = new Request('https://test.local/api/cohort-builder/workspaces/54103d7b-2709-4dd6-bb18-522f96b97241/release', { method: 'GET' });
    const res = await GET(req, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });
    expect(res.status).toBe(404);
  });

  it('computes readiness reports on GET for valid workspace', async () => {
    fake.findFirst.mockResolvedValue({
      id: validWorkspaceId,
      revision: 4,
      snapshot: {
        schemaVersion: 1,
        title: 'Distributed Systems',
        intent: 'Master consensus',
        audience: 'Engineers',
        dailyMinutes: 30,
        lessons: [
          { id: 'lesson-1', version: 0, title: 'Raft', objective: 'Understand leader election', sourceChunkIds: [], pinned: false },
        ],
        sources: [],
        chunks: [],
        understanding: [],
        analyses: [],
        processing: { status: 'idle', stage: 'done', generation: 0, sourceFingerprint: null, error: null },
      },
    });

    const req = new Request(`https://test.local/api/cohort-builder/workspaces/${validWorkspaceId}/release`, { method: 'GET' });
    const res = await GET(req, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.released).toBe(false);
    expect(data.readiness.private.ready).toBe(true);
    expect(data.readiness.public.ready).toBe(true);
    expect(data.revision).toBe(4);
  });

  it('POST handles release failure with 422 when cohort is not ready', async () => {
    const report = {
      ready: false,
      mode: 'public_publish' as const,
      blockers: ['Workspace has no lessons in its curriculum.'],
      warnings: [],
      checks: {
        intentValid: true,
        lessonsValid: false,
        sourcesReady: true,
        evidenceValid: true,
        processingComplete: true,
        rightsValid: true,
      },
    };
    fake.releaseError = new CohortReadinessError(report);

    const req = new Request(`https://test.local/api/cohort-builder/workspaces/${validWorkspaceId}/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'origin': 'https://test.local' },
      body: JSON.stringify({ mode: 'public_publish' }),
    });

    const res = await POST(req, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.code).toBe('COHORT_NOT_READY');
    expect(data.report.blockers).toContain('Workspace has no lessons in its curriculum.');
  });

  it('POST rejects invalid origin with 403', async () => {
    const req = new Request(`https://test.local/api/cohort-builder/workspaces/${validWorkspaceId}/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'origin': 'https://malicious.com' },
      body: JSON.stringify({ mode: 'private_activation' }),
    });

    const res = await POST(req, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe('INVALID_ORIGIN');
  });

  it('POST handles downgrade prevention with 409', async () => {
    fake.releaseError = new Error('CANNOT_DOWNGRADE_PUBLIC_COHORT: Cannot downgrade');

    const req = new Request(`https://test.local/api/cohort-builder/workspaces/${validWorkspaceId}/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'origin': 'https://test.local' },
      body: JSON.stringify({ mode: 'private_activation' }),
    });

    const res = await POST(req, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('CANNOT_DOWNGRADE_PUBLIC_COHORT');
  });

  it('POST successfully executes release and returns receipt', async () => {
    fake.releaseResult = {
      receipt: {
        cohortId: 'cohort-123',
        releasedAt: '2026-10-14T10:00:00.000Z',
        mode: 'private_activation',
        effectKey: 'cohort-release:candidate:abc',
        contentHash: 'abc',
        destinationUrl: '/play?cohort=cohort-123',
      },
      revision: 5,
    };

    const req = new Request(`https://test.local/api/cohort-builder/workspaces/${validWorkspaceId}/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'origin': 'https://test.local' },
      body: JSON.stringify({ mode: 'private_activation' }),
    });

    const res = await POST(req, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.receipt.cohortId).toBe('cohort-123');
    expect(data.receipt.destinationUrl).toBe('/play?cohort=cohort-123');
    expect(data.revision).toBe(5);
  });
});

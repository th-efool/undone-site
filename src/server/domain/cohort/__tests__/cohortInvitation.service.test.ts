import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  memberFindUnique: vi.fn(),
  cohortFindUnique: vi.fn(),
  invitationCreate: vi.fn(),
  invitationFindUnique: vi.fn(),
  invitationUpdate: vi.fn(),
  memberUpsert: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    cohortMember: {
      findUnique: mocks.memberFindUnique,
      upsert: mocks.memberUpsert,
    },
    cohort: {
      findUnique: mocks.cohortFindUnique,
    },
    cohortInvitation: {
      create: mocks.invitationCreate,
      findUnique: mocks.invitationFindUnique,
      update: mocks.invitationUpdate,
    },
    $transaction: (fn: (tx: unknown) => unknown) => fn({
      cohortInvitation: {
        findUnique: mocks.invitationFindUnique,
        update: mocks.invitationUpdate,
      },
      cohortMember: {
        upsert: mocks.memberUpsert,
      },
    }),
  },
}));

import {
  createCohortInvitation,
  acceptCohortInvitation,
  revokeCohortInvitation,
  hashInvitationToken,
} from '../cohortInvitation.service';

describe('cohortInvitation service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('token hashing produces deterministic SHA-256', () => {
    const hash1 = hashInvitationToken('token-abc');
    const hash2 = hashInvitationToken('token-abc');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('creator or moderator can create invitation', async () => {
    mocks.cohortFindUnique.mockResolvedValue({ creatorId: 'creator-1' });
    mocks.memberFindUnique.mockResolvedValue({ role: 'CREATOR' });
    mocks.invitationCreate.mockResolvedValue({
      id: 'inv-1',
      expiresAt: new Date(Date.now() + 7 * 86400 * 1000),
    });

    const result = await createCohortInvitation({
      cohortId: 'cohort-1',
      inviterId: 'creator-1',
      email: 'invitee@test.com',
      expiresInDays: 7,
    });

    expect(result.invitationId).toBe('inv-1');
    expect(result.token).toBeDefined();
    expect(mocks.invitationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cohortId: 'cohort-1',
        inviterId: 'creator-1',
        email: 'invitee@test.com',
      }),
      select: { id: true, expiresAt: true },
    });
  });

  it('unauthorized user cannot create invitation', async () => {
    mocks.cohortFindUnique.mockResolvedValue({ creatorId: 'creator-1' });
    mocks.memberFindUnique.mockResolvedValue({ role: 'EXPLORER' });

    await expect(
      createCohortInvitation({
        cohortId: 'cohort-1',
        inviterId: 'stranger-1',
      })
    ).rejects.toThrow('Unauthorized to create cohort invitation');
  });

  it('accepts valid invitation and marks accepted in transaction', async () => {
    const validInv = {
      id: 'inv-10',
      cohortId: 'cohort-10',
      revokedAt: null,
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 86400 * 1000),
      email: null,
    };
    mocks.invitationFindUnique.mockResolvedValue(validInv);
    mocks.invitationUpdate.mockResolvedValue({});
    mocks.memberUpsert.mockResolvedValue({ role: 'EXPLORER' });

    const result = await acceptCohortInvitation({
      rawToken: 'token-xyz',
      userId: 'user-new',
    });

    expect(result).toEqual({ cohortId: 'cohort-10', role: 'EXPLORER' });
    expect(mocks.invitationUpdate).toHaveBeenCalledWith({
      where: { id: 'inv-10' },
      data: expect.objectContaining({ acceptedById: 'user-new' }),
    });
    expect(mocks.memberUpsert).toHaveBeenCalledWith({
      where: { cohortId_userId: { cohortId: 'cohort-10', userId: 'user-new' } },
      update: {},
      create: { cohortId: 'cohort-10', userId: 'user-new', role: 'EXPLORER' },
    });
  });

  it('rejects expired invitation', async () => {
    mocks.invitationFindUnique.mockResolvedValue({
      id: 'inv-exp',
      cohortId: 'cohort-10',
      revokedAt: null,
      acceptedAt: null,
      expiresAt: new Date(Date.now() - 1000), // Expired
      email: null,
    });

    await expect(
      acceptCohortInvitation({
        rawToken: 'token-expired',
        userId: 'user-1',
      })
    ).rejects.toThrow('Invitation has expired');
  });

  it('rejects already used invitation', async () => {
    mocks.invitationFindUnique.mockResolvedValue({
      id: 'inv-used',
      cohortId: 'cohort-10',
      revokedAt: null,
      acceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400 * 1000),
      email: null,
    });

    await expect(
      acceptCohortInvitation({
        rawToken: 'token-used',
        userId: 'user-1',
      })
    ).rejects.toThrow('Invitation has already been used');
  });

  it('allows creator to revoke invitation', async () => {
    mocks.cohortFindUnique.mockResolvedValue({ creatorId: 'creator-1' });
    mocks.memberFindUnique.mockResolvedValue({ role: 'CREATOR' });
    mocks.invitationUpdate.mockResolvedValue({});

    await revokeCohortInvitation({
      invitationId: 'inv-1',
      cohortId: 'cohort-1',
      userId: 'creator-1',
    });

    expect(mocks.invitationUpdate).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: expect.objectContaining({ revokedAt: expect.any(Date) }),
    });
  });
});

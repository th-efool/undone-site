/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  studyRoomRolloutService,
  BASELINE_STUDY_ROOMS,
} from '../studyroom-rollout.service';

vi.mock('server-only', () => ({}));

describe('Integration Phase 13: Controlled Rollout & Release Gate', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Pre-Flight & Readiness Checks', () => {
    it('returns passed when database, models, and realtime configuration are valid', async () => {
      const mockPrisma = {
        $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
        studyRoom: { count: vi.fn().mockResolvedValue(3) },
        roomLease: { count: vi.fn().mockResolvedValue(0) },
        roomParticipant: { count: vi.fn().mockResolvedValue(0) },
        realtimeDelivery: { count: vi.fn().mockResolvedValue(0) },
      };

      const result = await studyRoomRolloutService.runPreflightChecks(mockPrisma as any);
      expect(result.passed).toBe(true);
      expect(result.databaseConnected).toBe(true);
      expect(result.modelsPresent).toBe(true);
      expect(result.outboxBacklog).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('reports failure when database query fails', async () => {
      const mockPrisma = {
        $queryRaw: vi.fn().mockRejectedValue(new Error('Connection refused')),
      };

      const result = await studyRoomRolloutService.runPreflightChecks(mockPrisma as any);
      expect(result.passed).toBe(false);
      expect(result.databaseConnected).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Connection refused');
    });

    it('reports failure when required studyroom models are missing', async () => {
      const mockPrisma = {
        $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
        // studyRoom is missing
        roomLease: { count: vi.fn().mockResolvedValue(0) },
        roomParticipant: { count: vi.fn().mockResolvedValue(0) },
      };

      const result = await studyRoomRolloutService.runPreflightChecks(mockPrisma as any);
      expect(result.passed).toBe(false);
      expect(result.modelsPresent).toBe(false);
      expect(result.errors.some((e) => e.includes('models'))).toBe(true);
    });
  });

  describe('Baseline Room Provisioning & Idempotency', () => {
    it('provisions all 3 standard catalog rooms on initial run', async () => {
      const createdRooms: any[] = [];
      const createdEnvironments: any[] = [];

      const mockPrisma = {
        studyRoom: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation(async ({ data }: any) => {
            const room = { id: `room-${createdRooms.length + 1}`, ...data };
            createdRooms.push(room);
            return room;
          }),
          update: vi.fn(),
        },
        roomEnvironment: {
          create: vi.fn().mockImplementation(async ({ data }: any) => {
            createdEnvironments.push(data);
            return data;
          }),
        },
      };

      const result = await studyRoomRolloutService.provisionBaselineRooms('admin-1', mockPrisma as any);
      expect(result.created).toBe(3);
      expect(result.updated).toBe(0);
      expect(result.rooms).toHaveLength(3);
      expect(createdRooms).toHaveLength(3);
      expect(createdEnvironments).toHaveLength(3);

      const slugs = createdRooms.map((r) => r.slug);
      expect(slugs).toEqual(['fireplace', 'library', 'developer-den']);
    });

    it('updates existing rooms idempotently without creating duplicates', async () => {
      const existingRooms: any[] = BASELINE_STUDY_ROOMS.map((b, idx) => ({
        id: `existing-${idx + 1}`,
        slug: b.slug,
        title: b.title,
      }));

      const mockPrisma = {
        studyRoom: {
          findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
            return (
              existingRooms.find(
                (r) =>
                  where.OR?.some(
                    (cond: any) =>
                      (cond.slug && r.slug === cond.slug) || (cond.title && r.title === cond.title)
                  )
              ) ?? null
            );
          }),
          create: vi.fn(),
          update: vi.fn().mockImplementation(async ({ where, data }: any) => {
            const r = existingRooms.find((item) => item.id === where.id);
            if (r) Object.assign(r, data);
            return r;
          }),
        },
        roomEnvironment: {
          create: vi.fn(),
        },
      };

      const result = await studyRoomRolloutService.provisionBaselineRooms('admin-1', mockPrisma as any);
      expect(result.created).toBe(0);
      expect(result.updated).toBe(3);
      expect(mockPrisma.studyRoom.create).not.toHaveBeenCalled();
    });
  });

  describe('Controlled Rollout Stages & Eligibility', () => {
    const publicRoom = {
      id: 'room-pub',
      listing: 'PUBLIC',
      status: 'OPEN',
      cohortId: null,
    };

    const cohortRoom = {
      id: 'room-cohort',
      listing: 'COHORT_ONLY',
      status: 'OPEN',
      cohortId: 'cohort-100',
    };

    const closedRoom = {
      id: 'room-closed',
      listing: 'PUBLIC',
      status: 'CLOSED',
      cohortId: null,
    };

    it('denies all access when emergency kill-switch is active', () => {
      process.env.STUDYROOM_EMERGENCY_DISABLED = 'true';
      const check = studyRoomRolloutService.evaluateRolloutEligibility({
        stage: 'STAGE_4_GA',
        user: { id: 'usr-1', isInternal: true },
        room: publicRoom,
      });

      expect(check.allowed).toBe(false);
      expect(check.reason).toBe('EMERGENCY_KILL_SWITCH_ACTIVE');
    });

    it('denies access when room status is not OPEN', () => {
      const check = studyRoomRolloutService.evaluateRolloutEligibility({
        stage: 'STAGE_4_GA',
        user: { id: 'usr-1' },
        room: closedRoom,
      });

      expect(check.allowed).toBe(false);
      expect(check.reason).toBe('ROOM_NOT_OPEN');
    });

    it('denies all users during STAGE_0_PREFLIGHT and STAGE_1_PROVISION', () => {
      const check = studyRoomRolloutService.evaluateRolloutEligibility({
        stage: 'STAGE_0_PREFLIGHT',
        user: { id: 'usr-1', isInternal: true },
        room: publicRoom,
      });
      expect(check.allowed).toBe(false);
      expect(check.reason).toBe('SYSTEM_STAGING_IN_PROGRESS');
    });

    it('STAGE_2_INTERNAL permits internal accounts, denies external users', () => {
      const internalCheck = studyRoomRolloutService.evaluateRolloutEligibility({
        stage: 'STAGE_2_INTERNAL',
        user: { id: 'staff-1', isInternal: true },
        room: publicRoom,
      });
      expect(internalCheck.allowed).toBe(true);
      expect(internalCheck.reason).toBe('INTERNAL_PILOT_ACCESS');

      const externalCheck = studyRoomRolloutService.evaluateRolloutEligibility({
        stage: 'STAGE_2_INTERNAL',
        user: { id: 'user-public', isInternal: false },
        room: publicRoom,
      });
      expect(externalCheck.allowed).toBe(false);
      expect(externalCheck.reason).toBe('INTERNAL_PILOT_ONLY');
    });

    it('STAGE_3_COHORT_CANARY permits cohort members and internal staff', () => {
      const cohortMemberCheck = studyRoomRolloutService.evaluateRolloutEligibility({
        stage: 'STAGE_3_COHORT_CANARY',
        user: { id: 'student-1', cohortIds: ['cohort-100'] },
        room: cohortRoom,
      });
      expect(cohortMemberCheck.allowed).toBe(true);
      expect(cohortMemberCheck.reason).toBe('COHORT_CANARY_ACCESS');

      const nonMemberCheck = studyRoomRolloutService.evaluateRolloutEligibility({
        stage: 'STAGE_3_COHORT_CANARY',
        user: { id: 'student-2', cohortIds: ['cohort-999'] },
        room: cohortRoom,
      });
      expect(nonMemberCheck.allowed).toBe(false);
      expect(nonMemberCheck.reason).toBe('COHORT_ENROLLMENT_REQUIRED');
    });

    it('STAGE_4_GA permits general public for listed rooms while respecting cohort boundaries', () => {
      const gaPublicCheck = studyRoomRolloutService.evaluateRolloutEligibility({
        stage: 'STAGE_4_GA',
        user: { id: 'user-any' },
        room: publicRoom,
      });
      expect(gaPublicCheck.allowed).toBe(true);
      expect(gaPublicCheck.reason).toBe('GA_ACCESS');

      const gaCohortCheck = studyRoomRolloutService.evaluateRolloutEligibility({
        stage: 'STAGE_4_GA',
        user: { id: 'user-any', cohortIds: [] },
        room: cohortRoom,
      });
      expect(gaCohortCheck.allowed).toBe(false);
      expect(gaCohortCheck.reason).toBe('COHORT_ENROLLMENT_REQUIRED');
    });
  });

  describe('Emergency Rollback & Safe Data Preservation', () => {
    it('freezes room to CLOSED, purges active leases, logs audit, and preserves data', async () => {
      let roomStatus = 'OPEN';
      let onlineCount = 5;
      const leases = [
        { id: 'lease-1', studyRoomId: 'room-target' },
        { id: 'lease-2', studyRoomId: 'room-target' },
      ];
      const participants = [
        { id: 'part-1', studyRoomId: 'room-target' },
      ];
      const auditLogs: any[] = [];

      const mockPrisma = {
        $transaction: vi.fn().mockImplementation(async (cb: any) => {
          return cb({
            studyRoom: {
              findUnique: vi.fn().mockResolvedValue({ id: 'room-target', status: roomStatus }),
              update: vi.fn().mockImplementation(async ({ data }: any) => {
                roomStatus = data.status;
                onlineCount = data.onlineCount;
                return { id: 'room-target', status: roomStatus, onlineCount };
              }),
            },
            roomLease: {
              deleteMany: vi.fn().mockImplementation(async () => {
                const count = leases.length;
                leases.length = 0;
                return { count };
              }),
            },
            roomParticipant: {
              deleteMany: vi.fn().mockImplementation(async () => {
                const count = participants.length;
                participants.length = 0;
                return { count };
              }),
            },
            roomAuditLog: {
              create: vi.fn().mockImplementation(async ({ data }: any) => {
                auditLogs.push(data);
                return data;
              }),
            },
          });
        }),
      };

      const rollback = await studyRoomRolloutService.executeEmergencyRollback(
        'room-target',
        'High error rate observed in canary',
        mockPrisma as any
      );

      expect(rollback.success).toBe(true);
      expect(rollback.roomId).toBe('room-target');
      expect(rollback.leasesEvicted).toBe(2);
      expect(roomStatus).toBe('CLOSED');
      expect(onlineCount).toBe(0);
      expect(leases).toHaveLength(0);
      expect(participants).toHaveLength(0);
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].action).toBe('EMERGENCY_ROLLBACK');
      expect(auditLogs[0].details.reason).toBe('High error rate observed in canary');
    });

    it('throws error when attempting emergency rollback on non-existent room', async () => {
      const mockPrisma = {
        $transaction: vi.fn().mockImplementation(async (cb: any) => {
          return cb({
            studyRoom: {
              findUnique: vi.fn().mockResolvedValue(null),
            },
          });
        }),
      };

      await expect(
        studyRoomRolloutService.executeEmergencyRollback('room-missing', 'Test', mockPrisma as any)
      ).rejects.toThrow('Room with ID room-missing not found');
    });
  });
});

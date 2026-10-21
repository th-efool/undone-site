/**
 * Authoritative study room domain contracts, DTOs, capabilities, and error types.
 * Shared between client and server. Client-safe (no node/server imports).
 */

/* ─────────────────────────────────────────────────────────────────
 * 1. ENUMS & CONSTANTS
 * ───────────────────────────────────────────────────────────────── */

export type RoomStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED';
export type RoomListing = 'LISTED' | 'UNLISTED';
export type RoomScopeKind = 'STANDALONE' | 'COHORT';

export type RoomRole = 'OWNER' | 'MODERATOR' | 'HOST' | 'PARTICIPANT' | 'VIEWER';
export type DelegatedRoomRole = 'MODERATOR' | 'HOST';

export type RoomEligibilityReason =
  | 'ELIGIBLE'
  | 'ROOM_CLOSED'
  | 'ROOM_FULL'
  | 'ENROLLMENT_REQUIRED'
  | 'USER_BANNED'
  | 'USER_KICKED_COOLDOWN'
  | 'NOT_AUTHENTICATED'
  | 'DRAFT_RESTRICTED';

export type RestrictionAction = 'REMOVE' | 'BAN';
export type TransferStatus = 'PENDING' | 'ACCEPTED' | 'CANCELLED' | 'EXPIRED';

export const STUDY_ROOM_LIMITS = {
  TITLE_MIN_LENGTH: 1,
  TITLE_MAX_LENGTH: 80,
  DESCRIPTION_MAX_LENGTH: 1000,
  RULES_MAX_LENGTH: 2000,
  TAGS_MAX_COUNT: 5,
  TAG_MAX_LENGTH: 24,
  CAPACITY_MIN: 2,
  CAPACITY_MAX: 100,
  CAPACITY_DEFAULT: 25,
  MAX_OPEN_STANDALONE_PER_USER: 3,
  MAX_CREATIONS_PER_DAY_PER_USER: 10,
  LEASE_DURATION_MS: 90 * 1000, // 90 seconds
  LEASE_RENEWAL_INTERVAL_MS: 30 * 1000, // 30 seconds
  ROSTER_POLL_INTERVAL_MS: 15 * 1000, // 15 seconds
  KICK_COOLDOWN_MS: 2 * 60 * 1000, // 2 minutes
  TRANSFER_EXPIRY_MS: 24 * 60 * 60 * 1000, // 24 hours
} as const;

export const RESERVED_ROOM_SLUGS = new Set([
  'new',
  'manage',
  'session',
  'roster',
  'api',
  'admin',
  'settings',
  'create',
  'join',
  'leave',
  'switch',
]);

/* ─────────────────────────────────────────────────────────────────
 * 2. CAPABILITIES & ROLES
 * ───────────────────────────────────────────────────────────────── */

export interface RoomCapabilities {
  canJoin: boolean;
  canEditRoom: boolean;
  canControlEnvironment: boolean;
  canManageParticipants: boolean;
  canTransferOwnership: boolean;
  canChangeLifecycle: boolean;
  canManageRoles: boolean;
  eligibilityReason: RoomEligibilityReason;
}

export interface UserRoomIdentity {
  userId: string;
  name: string | null;
  username: string | null;
  image: string | null;
  role: RoomRole;
}

/* ─────────────────────────────────────────────────────────────────
 * 3. DISCOVERY CONTRACTS (GET /api/studyroom)
 * ───────────────────────────────────────────────────────────────── */

export type DiscoveryTab = 'discover' | 'cohorts' | 'my-rooms' | 'recent';

export interface StudyRoomDiscoveryQuery {
  tab?: DiscoveryTab;
  query?: string;
  cohortId?: string;
  tag?: string;
  language?: string;
  availableOnly?: boolean;
  cursor?: string;
  limit?: number;
}

export interface StudyRoomCardDTO {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnail: string;
  visualPresetId: string | null;
  status: RoomStatus;
  listing: RoomListing;
  scopeKind: RoomScopeKind;
  cohortId: string | null;
  cohortTitle?: string | null;
  owner: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
  };
  onlineCount: number;
  capacity: number;
  tags: string[];
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudyRoomDiscoveryResponse {
  rooms: StudyRoomCardDTO[];
  nextCursor: string | null;
  totalEstimatedCount?: number;
}

/* ─────────────────────────────────────────────────────────────────
 * 4. ROOM CREATION & SETTINGS CONTRACTS
 * ───────────────────────────────────────────────────────────────── */

export interface CreateRoomInput {
  requestId: string;
  title: string;
  description?: string | null;
  scopeKind: RoomScopeKind;
  cohortId?: string | null;
  listing?: RoomListing;
  capacity?: number;
  rules?: string | null;
  tags?: string[];
  language?: string;
  visualPresetId?: string | null;
  initialSceneId?: string;
  initialAmbiencePresetId?: string | null;
  publishImmediately?: boolean;
}

export interface CreateRoomResponse {
  id: string;
  slug: string;
  title: string;
  status: RoomStatus;
  revision: number;
  isIdempotentReplay?: boolean;
}

export interface UpdateRoomSettingsInput {
  expectedRevision: number;
  title?: string;
  description?: string | null;
  listing?: RoomListing;
  capacity?: number;
  rules?: string | null;
  tags?: string[];
  language?: string;
  visualPresetId?: string | null;
}

export interface UpdateRoomSettingsResponse {
  id: string;
  slug: string;
  revision: number;
  updatedAt: string;
}

/* ─────────────────────────────────────────────────────────────────
 * 5. LIFECYCLE CONTRACTS (POST /api/studyroom/[roomSlug]/lifecycle)
 * ───────────────────────────────────────────────────────────────── */

export type LifecycleAction = 'PUBLISH' | 'CLOSE' | 'REOPEN' | 'ARCHIVE' | 'RESTORE';

export interface RoomLifecycleInput {
  action: LifecycleAction;
  expectedRevision: number;
  requestId: string;
}

export interface RoomLifecycleResponse {
  id: string;
  slug: string;
  status: RoomStatus;
  revision: number;
  occurredAt: string;
}

/* ─────────────────────────────────────────────────────────────────
 * 6. ROOM PREVIEW & BOOTSTRAP (GET /api/studyroom/[roomSlug])
 * ───────────────────────────────────────────────────────────────── */

export interface RoomBootstrapResponse {
  room: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    thumbnail: string;
    visualPresetId: string | null;
    status: RoomStatus;
    listing: RoomListing;
    scopeKind: RoomScopeKind;
    cohortId: string | null;
    cohortTitle?: string | null;
    capacity: number;
    onlineCount: number;
    rules: string | null;
    tags: string[];
    language: string;
    revision: number;
    ownerId: string;
    ownerName: string | null;
    ownerUsername: string | null;
    createdAt: string;
  };
  viewer: {
    userId: string | null;
    role: RoomRole;
    isJoined: boolean;
    leaseExpiresAt: string | null;
    generation: number | null;
  };
  capabilities: RoomCapabilities;
  pendingTransfer?: OwnershipTransferDTO | null;
}

/* ─────────────────────────────────────────────────────────────────
 * 7. PARTICIPATION & LEASES (POST /api/studyroom)
 * ───────────────────────────────────────────────────────────────── */

export interface JoinRoomPayload {
  action: 'join';
  roomId: string;
  tabId: string;
  requestId?: string;
}

export interface RenewLeasePayload {
  action: 'renew';
  roomId: string;
  tabId: string;
  generation: number;
}

export interface LeaveRoomPayload {
  action: 'leave';
  roomId?: string;
  tabId?: string;
  global?: boolean;
}

export interface JoinRoomSuccessResult {
  success: true;
  roomId: string;
  slug: string;
  generation: number;
  isSwitch: boolean;
  lease: {
    leaseId: string;
    tabId: string;
    expiresAt: string;
  };
}

export interface RenewLeaseSuccessResult {
  success: true;
  expiresAt: string;
}

export interface LeaveRoomSuccessResult {
  success: true;
  left: boolean;
  remainingLeases: number;
}

/* ─────────────────────────────────────────────────────────────────
 * 8. ROSTER CONTRACTS (GET /api/studyroom/roster)
 * ───────────────────────────────────────────────────────────────── */

export interface RoomRosterMemberDTO {
  id: string;
  userId: string;
  name: string;
  username: string;
  image: string;
  role: RoomRole;
  joinedAt: string;
  tabCount: number;
  publicGoal: string | null;
}

export interface RoomRosterResponse {
  roomId: string;
  onlineCount: number;
  capacity: number;
  members: RoomRosterMemberDTO[];
}

/* ─────────────────────────────────────────────────────────────────
 * 9. DELEGATED CONTROLLERS & ROLES
 * ───────────────────────────────────────────────────────────────── */

export interface RoomControllerDTO {
  userId: string;
  name: string | null;
  username: string | null;
  image: string | null;
  role: DelegatedRoomRole;
  assignedByUserId: string;
  assignedAt: string;
}

export interface SetRoomControllerInput {
  role: DelegatedRoomRole;
}

/* ─────────────────────────────────────────────────────────────────
 * 10. RESTRICTIONS (KICKS & BANS)
 * ───────────────────────────────────────────────────────────────── */

export interface RoomRestrictionDTO {
  id: string;
  studyRoomId: string;
  userId: string;
  userName: string | null;
  action: RestrictionAction;
  reason: string | null;
  issuedByUserId: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateRestrictionInput {
  targetUserId: string;
  action: RestrictionAction;
  reason?: string;
  durationMinutes?: number; // null/undefined => indefinite for BAN
}

export interface RemoveParticipantInput {
  targetUserId: string;
  reason?: string;
}

/* ─────────────────────────────────────────────────────────────────
 * 11. OWNERSHIP TRANSFER
 * ───────────────────────────────────────────────────────────────── */

export interface OwnershipTransferDTO {
  id: string;
  studyRoomId: string;
  senderId: string;
  recipientId: string;
  recipientName: string | null;
  status: TransferStatus;
  expectedRevision: number;
  expiresAt: string;
  createdAt: string;
}

export interface CreateOwnershipTransferInput {
  recipientUserId: string;
  expectedRevision: number;
}

/* ─────────────────────────────────────────────────────────────────
 * 12. AUDIT LOGS
 * ───────────────────────────────────────────────────────────────── */

export type RoomAuditAction =
  | 'ROOM_CREATED'
  | 'SETTINGS_UPDATED'
  | 'LIFECYCLE_CHANGED'
  | 'CONTROLLER_ASSIGNED'
  | 'CONTROLLER_REVOKED'
  | 'PARTICIPANT_REMOVED'
  | 'PARTICIPANT_BANNED'
  | 'PARTICIPANT_UNBANNED'
  | 'OWNERSHIP_TRANSFER_PROPOSED'
  | 'OWNERSHIP_TRANSFER_ACCEPTED'
  | 'OWNERSHIP_TRANSFER_CANCELLED';

export interface RoomAuditEntryDTO {
  id: string;
  action: RoomAuditAction;
  actorId: string;
  actorName: string | null;
  targetUserId: string | null;
  targetUserName: string | null;
  clientRequestId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface RoomAuditLogResponse {
  entries: RoomAuditEntryDTO[];
  nextCursor: string | null;
}

/* ─────────────────────────────────────────────────────────────────
 * 13. ERROR CATALOG & CODES
 * ───────────────────────────────────────────────────────────────── */

export type StudyRoomErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_CLOSED'
  | 'ROOM_FULL'
  | 'ENROLLMENT_REQUIRED'
  | 'USER_BANNED'
  | 'USER_KICKED_COOLDOWN'
  | 'ROOM_REVISION_CONFLICT'
  | 'ROOM_QUOTA_EXCEEDED'
  | 'ROOM_FORBIDDEN'
  | 'ROOM_UNAUTHORIZED'
  | 'ROOM_STALE_GENERATION'
  | 'ROOM_INVALID_INPUT'
  | 'ROOM_SLUG_COLLISION'
  | 'TRANSFER_INVALID'
  | 'TRANSFER_EXPIRED'
  | 'TARGET_HIERARCHY_VIOLATION';

export interface StudyRoomErrorPayload {
  error: string;
  code: StudyRoomErrorCode;
  details?: Record<string, unknown>;
  retryable?: boolean;
}

export class StudyRoomError extends Error {
  public readonly code: StudyRoomErrorCode;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;
  public readonly retryable: boolean;

  constructor(params: {
    message: string;
    code: StudyRoomErrorCode;
    status: number;
    details?: Record<string, unknown>;
    retryable?: boolean;
  }) {
    super(params.message);
    this.name = 'StudyRoomError';
    this.code = params.code;
    this.status = params.status;
    this.details = params.details;
    this.retryable = params.retryable ?? false;
  }

  toJSON(): StudyRoomErrorPayload {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
      retryable: this.retryable,
    };
  }
}

export class RoomNotFoundError extends StudyRoomError {
  constructor(message = 'Study room not found') {
    super({ message, code: 'ROOM_NOT_FOUND', status: 404 });
  }
}

export class RoomClosedError extends StudyRoomError {
  constructor(message = 'Study room is currently closed') {
    super({ message, code: 'ROOM_CLOSED', status: 409 });
  }
}

export class RoomFullError extends StudyRoomError {
  constructor(message = 'Study room is at full capacity', details?: Record<string, unknown>) {
    super({ message, code: 'ROOM_FULL', status: 409, details });
  }
}

export class RoomEnrollmentRequiredError extends StudyRoomError {
  constructor(cohortId: string, cohortTitle?: string) {
    super({
      message: 'Cohort enrollment is required to enter this study room',
      code: 'ENROLLMENT_REQUIRED',
      status: 403,
      details: { cohortId, cohortTitle },
    });
  }
}

export class RoomRestrictedError extends StudyRoomError {
  constructor(reason?: string | null, expiresAt?: string | null, action: RestrictionAction = 'BAN') {
    super({
      message: action === 'BAN' ? 'You are banned from this study room' : 'You have been removed from this room recently',
      code: action === 'BAN' ? 'USER_BANNED' : 'USER_KICKED_COOLDOWN',
      status: 403,
      details: { reason, expiresAt, action },
    });
  }
}

export class RoomConflictError extends StudyRoomError {
  constructor(message = 'Revision conflict; please refresh room settings') {
    super({ message, code: 'ROOM_REVISION_CONFLICT', status: 409, retryable: true });
  }
}

export class RoomQuotaExceededError extends StudyRoomError {
  constructor(message = 'Study room creation quota exceeded') {
    super({ message, code: 'ROOM_QUOTA_EXCEEDED', status: 429 });
  }
}

export class RoomForbiddenError extends StudyRoomError {
  constructor(message = 'Forbidden to perform room operation') {
    super({ message, code: 'ROOM_FORBIDDEN', status: 403 });
  }
}

export class RoomUnauthorizedError extends StudyRoomError {
  constructor(message = 'Authentication required') {
    super({ message, code: 'ROOM_UNAUTHORIZED', status: 401 });
  }
}

export class RoomValidationError extends StudyRoomError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({ message, code: 'ROOM_INVALID_INPUT', status: 400, details });
  }
}

export class RoomStaleGenerationError extends StudyRoomError {
  constructor(message = 'Lease renewal rejected due to stale room generation') {
    super({ message, code: 'ROOM_STALE_GENERATION', status: 409 });
  }
}

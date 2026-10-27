/**
 * Typed Error Hierarchy for Personal Workspace Persistence & Synchronization
 *
 * Provides strongly-typed, distinguishable errors across IndexedDB storage,
 * Web Locks, asset integrity verification, schema validation, and remote repository binding.
 */

export interface PersonalWorkspaceErrorOptions extends ErrorOptions {
  code?: string;
  details?: unknown;
}

/**
 * Base class for all personal workspace errors.
 */
export class PersonalWorkspaceError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, options?: PersonalWorkspaceErrorOptions) {
    super(message, options);
    this.name = this.constructor.name;
    this.code = options?.code ?? 'PERSONAL_WORKSPACE_ERROR';
    this.details = options?.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Type guard checking if an unknown value is an instance of PersonalWorkspaceError.
 */
export function isPersonalWorkspaceError(err: unknown): err is PersonalWorkspaceError {
  return err instanceof PersonalWorkspaceError;
}

/**
 * Thrown when local IndexedDB storage quota or threshold is exceeded.
 */
export class StorageQuotaExceededError extends PersonalWorkspaceError {
  public readonly quotaBytes?: number;
  public readonly requestedBytes?: number;

  constructor(
    message = 'Storage quota exceeded in local personal workspace',
    options?: { quotaBytes?: number; requestedBytes?: number; cause?: unknown }
  ) {
    super(message, {
      code: 'STORAGE_QUOTA_EXCEEDED',
      details: {
        quotaBytes: options?.quotaBytes,
        requestedBytes: options?.requestedBytes,
      },
      cause: options?.cause,
    });
    this.quotaBytes = options?.quotaBytes;
    this.requestedBytes = options?.requestedBytes;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when acquiring a multi-tab coordination lock exceeds the deadline.
 */
export class LockAcquisitionTimeoutError extends PersonalWorkspaceError {
  public readonly lockName?: string;
  public readonly timeoutMs?: number;

  constructor(
    message = 'Timed out acquiring personal workspace cross-tab lock',
    options?: { lockName?: string; timeoutMs?: number; cause?: unknown }
  ) {
    super(message, {
      code: 'LOCK_ACQUISITION_TIMEOUT',
      details: {
        lockName: options?.lockName,
        timeoutMs: options?.timeoutMs,
      },
      cause: options?.cause,
    });
    this.lockName = options?.lockName;
    this.timeoutMs = options?.timeoutMs;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown on concurrent edit divergence or compare-and-swap (CAS) ref collisions.
 */
export class ConcurrencyConflictError extends PersonalWorkspaceError {
  public readonly entityId?: string;
  public readonly entityType?: string;
  public readonly expectedGeneration?: number;
  public readonly actualGeneration?: number;
  public readonly headSha?: string;

  constructor(
    message = 'Concurrency conflict detected during personal workspace mutation',
    options?: {
      entityId?: string;
      entityType?: string;
      expectedGeneration?: number;
      actualGeneration?: number;
      headSha?: string;
      cause?: unknown;
    }
  ) {
    super(message, {
      code: 'CONCURRENCY_CONFLICT',
      details: {
        entityId: options?.entityId,
        entityType: options?.entityType,
        expectedGeneration: options?.expectedGeneration,
        actualGeneration: options?.actualGeneration,
        headSha: options?.headSha,
      },
      cause: options?.cause,
    });
    this.entityId = options?.entityId;
    this.entityType = options?.entityType;
    this.expectedGeneration = options?.expectedGeneration;
    this.actualGeneration = options?.actualGeneration;
    this.headSha = options?.headSha;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an asset payload fails cryptographic SHA-256 integrity check.
 */
export class CorruptAssetIntegrityError extends PersonalWorkspaceError {
  public readonly assetId?: string;
  public readonly expectedHash?: string;
  public readonly actualHash?: string;

  constructor(
    message = 'Asset cryptographic checksum verification failed',
    options?: {
      assetId?: string;
      expectedHash?: string;
      actualHash?: string;
      cause?: unknown;
    }
  ) {
    super(message, {
      code: 'CORRUPT_ASSET_INTEGRITY',
      details: {
        assetId: options?.assetId,
        expectedHash: options?.expectedHash,
        actualHash: options?.actualHash,
      },
      cause: options?.cause,
    });
    this.assetId = options?.assetId;
    this.expectedHash = options?.expectedHash;
    this.actualHash = options?.actualHash;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a record or document payload does not conform to the required schema.
 */
export class IncompatibleSchemaError extends PersonalWorkspaceError {
  public readonly expectedVersion?: number | string;
  public readonly actualVersion?: number | string;
  public readonly entityId?: string;
  public readonly validationErrors?: unknown;

  constructor(
    message = 'Payload does not conform to personal workspace schema',
    options?: {
      expectedVersion?: number | string;
      actualVersion?: number | string;
      entityId?: string;
      validationErrors?: unknown;
      cause?: unknown;
    }
  ) {
    super(message, {
      code: 'INCOMPATIBLE_SCHEMA',
      details: {
        expectedVersion: options?.expectedVersion,
        actualVersion: options?.actualVersion,
        entityId: options?.entityId,
        validationErrors: options?.validationErrors,
      },
      cause: options?.cause,
    });
    this.expectedVersion = options?.expectedVersion;
    this.actualVersion = options?.actualVersion;
    this.entityId = options?.entityId;
    this.validationErrors = options?.validationErrors;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when GitHub repository binding fails (e.g. public repository violation,
 * invalid permissions, or epoch mismatch).
 */
export class RepositoryBindingError extends PersonalWorkspaceError {
  public readonly userId?: string;
  public readonly repositoryId?: number | string;
  public readonly reason?: string;

  constructor(
    message = 'Personal workspace repository binding error',
    options?: {
      userId?: string;
      repositoryId?: number | string;
      reason?: string;
      cause?: unknown;
    }
  ) {
    super(message, {
      code: 'REPOSITORY_BINDING_ERROR',
      details: {
        userId: options?.userId,
        repositoryId: options?.repositoryId,
        reason: options?.reason,
      },
      cause: options?.cause,
    });
    this.userId = options?.userId;
    this.repositoryId = options?.repositoryId;
    this.reason = options?.reason;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an asset exceeds the raw binary envelope limit (3.0 MiB direct / 5.0 MiB chunked).
 */
export class AssetSizeLimitExceededError extends PersonalWorkspaceError {
  public readonly byteLength: number;
  public readonly maxBytes: number;
  public readonly isChunked: boolean;

  constructor(
    message = 'Asset exceeds maximum allowed payload size',
    options: {
      byteLength: number;
      maxBytes: number;
      isChunked: boolean;
      cause?: unknown;
    }
  ) {
    super(message, {
      code: 'ASSET_SIZE_LIMIT_EXCEEDED',
      details: {
        byteLength: options.byteLength,
        maxBytes: options.maxBytes,
        isChunked: options.isChunked,
      },
      cause: options.cause,
    });
    this.byteLength = options.byteLength;
    this.maxBytes = options.maxBytes;
    this.isChunked = options.isChunked;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an atomic transaction is aborted due to failure or cancellation.
 */
export class TransactionAbortError extends PersonalWorkspaceError {
  constructor(message = 'Transaction was aborted', options?: { cause?: unknown }) {
    super(message, {
      code: 'TRANSACTION_ABORTED',
      cause: options?.cause,
    });
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

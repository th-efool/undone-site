/**
 * Safety Assertions and Environment Isolation Guardrails for Messaging Load Tests.
 * Ensures load harnesses never run against production databases or alter non-test data.
 */

export const FIXTURE_LOAD_PREFIX = 'fixture:load:';

export class LoadEnvironmentSafetyError extends Error {
  constructor(message: string) {
    super(`[LOAD TEST SAFETY VIOLATION] ${message}`);
    this.name = 'LoadEnvironmentSafetyError';
  }
}

/**
 * Validates that the current execution environment and database target are safe for load testing.
 * Rejects production NODE_ENV, remote cloud database URLs, and unisolated targets.
 */
export function assertSafeLoadEnvironment(databaseUrl?: string): void {
  const env = process.env.NODE_ENV;
  if (env === 'production') {
    throw new LoadEnvironmentSafetyError(
      'Cannot execute load harness when NODE_ENV is set to "production".'
    );
  }

  const targetUrl = databaseUrl ?? process.env.DATABASE_URL;
  if (!targetUrl || targetUrl === 'undefined' || targetUrl.trim() === '') {
    // If running in in-memory / mock mode, targetUrl may be omitted
    return;
  }

  const forbiddenHostPatterns = [
    'supabase.co',
    'neon.tech',
    'amazonaws.com',
    'rds.amazonaws.com',
    'azure.com',
    'digitalocean.com',
    'planetscale.com',
    'railway.app',
    'render.com',
    'prod',
    'production',
  ];

  try {
    const parsed = new URL(targetUrl);
    const hostname = parsed.hostname.toLowerCase();

    for (const pattern of forbiddenHostPatterns) {
      if (hostname.includes(pattern)) {
        throw new LoadEnvironmentSafetyError(
          `Refusing to run load test against potential production host: "${hostname}". Must use local or explicitly isolated test DB.`
        );
      }
    }

    // Ensure database name clearly signals test / load isolation if not localhost
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    if (!isLocalhost) {
      const dbName = parsed.pathname.toLowerCase();
      if (!dbName.includes('test') && !dbName.includes('load') && !dbName.includes('isolated')) {
        throw new LoadEnvironmentSafetyError(
          `Remote database "${dbName}" does not contain "test", "load", or "isolated". Refusing execution.`
        );
      }
    }
  } catch (err: any) {
    if (err instanceof LoadEnvironmentSafetyError) throw err;
    throw new LoadEnvironmentSafetyError(`Invalid database URL provided ("${targetUrl}"): ${err?.message}`);
  }
}

/**
 * Asserts that a fixture identifier adheres to the isolated load test namespace.
 */
export function assertSafeFixtureId(id: string, entityType: string): void {
  if (!id.startsWith(FIXTURE_LOAD_PREFIX)) {
    throw new LoadEnvironmentSafetyError(
      `Attempted to create or mutate non-fixture ${entityType} with ID "${id}". All load test entities must start with "${FIXTURE_LOAD_PREFIX}".`
    );
  }
}

/**
 * Formats an isolated fixture identifier.
 */
export function makeFixtureId(entityType: string, suffix: string): string {
  return `${FIXTURE_LOAD_PREFIX}${entityType}:${suffix}`;
}

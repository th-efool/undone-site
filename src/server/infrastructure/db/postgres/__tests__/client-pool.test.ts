import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import pg from 'pg';
import { getPostgresPoolConfig } from '../client';

describe('PostgreSQL Pool Sizing & Serverless Connection Capping', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    const current = process.env as Record<string, string | undefined>;
    delete current.VERCEL;
    delete current.AWS_LAMBDA_FUNCTION_NAME;
    delete current.NODE_ENV;
    delete current.DATABASE_POOL_MAX;
    delete current.DATABASE_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment Detection & Default Pool Configuration', () => {
    it('returns development defaults when running in local development', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

      const config = getPostgresPoolConfig();

      expect(config.max).toBe(10);
      expect(config.idleTimeoutMillis).toBe(30000);
      expect(config.connectionTimeoutMillis).toBe(5000);
      expect(config.keepAlive).toBe(true);
      expect(config.statement_timeout).toBe(15000);
    });

    it('detects Vercel serverless environment (VERCEL=1) and caps pool size to 2', () => {
      process.env.VERCEL = '1';

      const config = getPostgresPoolConfig();

      expect(config.max).toBe(2);
      expect(config.idleTimeoutMillis).toBe(10000);
      expect(config.connectionTimeoutMillis).toBe(5000);
      expect(config.keepAlive).toBe(true);
      expect(config.statement_timeout).toBe(15000);
    });

    it('detects AWS Lambda serverless environment (AWS_LAMBDA_FUNCTION_NAME) and caps pool size to 2', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'undone-api-handler';

      const config = getPostgresPoolConfig();

      expect(config.max).toBe(2);
      expect(config.idleTimeoutMillis).toBe(10000);
      expect(config.connectionTimeoutMillis).toBe(5000);
      expect(config.keepAlive).toBe(true);
      expect(config.statement_timeout).toBe(15000);
    });

    it('detects production environment (NODE_ENV=production) and caps pool size to 2', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

      const config = getPostgresPoolConfig();

      expect(config.max).toBe(2);
      expect(config.idleTimeoutMillis).toBe(10000);
      expect(config.connectionTimeoutMillis).toBe(5000);
      expect(config.keepAlive).toBe(true);
      expect(config.statement_timeout).toBe(15000);
    });

    it('does not treat VERCEL="0" as serverless', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
      process.env.VERCEL = '0';

      const config = getPostgresPoolConfig();

      expect(config.max).toBe(10);
      expect(config.idleTimeoutMillis).toBe(30000);
    });
  });

  describe('DATABASE_POOL_MAX Environment Override', () => {
    it('allows DATABASE_POOL_MAX override in serverless environment', () => {
      process.env.VERCEL = '1';
      process.env.DATABASE_POOL_MAX = '1';

      const config = getPostgresPoolConfig();

      expect(config.max).toBe(1);
    });

    it('allows DATABASE_POOL_MAX override to a higher number in serverless environment', () => {
      process.env.VERCEL = '1';
      process.env.DATABASE_POOL_MAX = '5';

      const config = getPostgresPoolConfig();

      expect(config.max).toBe(5);
    });

    it('allows DATABASE_POOL_MAX override in development environment', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
      process.env.DATABASE_POOL_MAX = '20';

      const config = getPostgresPoolConfig();

      expect(config.max).toBe(20);
    });

    it('falls back to environment default when DATABASE_POOL_MAX is invalid non-numeric', () => {
      process.env.VERCEL = '1';
      process.env.DATABASE_POOL_MAX = 'not-a-valid-number';

      const serverlessConfig = getPostgresPoolConfig();
      expect(serverlessConfig.max).toBe(2);

      delete (process.env as Record<string, string | undefined>).VERCEL;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
      process.env.DATABASE_POOL_MAX = 'invalid';

      const devConfig = getPostgresPoolConfig();
      expect(devConfig.max).toBe(10);
    });

    it('falls back to environment default when DATABASE_POOL_MAX is empty string', () => {
      process.env.VERCEL = '1';
      process.env.DATABASE_POOL_MAX = '';

      const serverlessConfig = getPostgresPoolConfig();
      expect(serverlessConfig.max).toBe(2);

      delete (process.env as Record<string, string | undefined>).VERCEL;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
      process.env.DATABASE_POOL_MAX = '';

      const devConfig = getPostgresPoolConfig();
      expect(devConfig.max).toBe(10);
    });

    it('falls back to environment default when DATABASE_POOL_MAX is 0', () => {
      process.env.VERCEL = '1';
      process.env.DATABASE_POOL_MAX = '0';

      const serverlessConfig = getPostgresPoolConfig();
      expect(serverlessConfig.max).toBe(2);
    });
  });

  describe('Connection Timeouts & Resource Management Defaults', () => {
    it('sets fast connectionTimeoutMillis of 5000ms to fail fast during cold-starts or outages', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
      const devConfig = getPostgresPoolConfig();
      expect(devConfig.connectionTimeoutMillis).toBe(5000);

      process.env.VERCEL = '1';
      const serverlessConfig = getPostgresPoolConfig();
      expect(serverlessConfig.connectionTimeoutMillis).toBe(5000);
    });

    it('sets idleTimeoutMillis to 10000ms in serverless to clean up idle connections fast', () => {
      process.env.VERCEL = '1';

      const config = getPostgresPoolConfig();

      expect(config.idleTimeoutMillis).toBe(10000);
    });

    it('sets idleTimeoutMillis to 30000ms in development to prevent connection churning', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

      const config = getPostgresPoolConfig();

      expect(config.idleTimeoutMillis).toBe(30000);
    });

    it('enforces keepAlive: true and statement_timeout: 15000ms', () => {
      const config = getPostgresPoolConfig();

      expect(config.keepAlive).toBe(true);
      expect(config.statement_timeout).toBe(15000);
    });
  });

  describe('PoolConfig Validation & Compatibility with pg.Pool', () => {
    it('returns a valid pg.PoolConfig object', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';

      const config = getPostgresPoolConfig();

      expect(config).toBeDefined();
      expect(config.connectionString).toBe('postgresql://user:pass@localhost:5432/testdb');
      expect(typeof config.max).toBe('number');
      expect(typeof config.idleTimeoutMillis).toBe('number');
      expect(typeof config.connectionTimeoutMillis).toBe('number');
      expect(typeof config.statement_timeout).toBe('number');
      expect(typeof config.keepAlive).toBe('boolean');
    });

    it('accepts config overrides', () => {
      const config = getPostgresPoolConfig({
        max: 8,
        connectionTimeoutMillis: 3000,
        idleTimeoutMillis: 5000,
      });

      expect(config.max).toBe(8);
      expect(config.connectionTimeoutMillis).toBe(3000);
      expect(config.idleTimeoutMillis).toBe(5000);
      expect(config.keepAlive).toBe(true);
      expect(config.statement_timeout).toBe(15000);
    });

    it('can instantiate pg.Pool with the generated configuration without errors', async () => {
      process.env.VERCEL = '1';
      const config = getPostgresPoolConfig({
        connectionString: 'postgresql://postgres:postgres@localhost:5432/test',
      });

      const pool = new pg.Pool(config);
      expect(pool).toBeInstanceOf(pg.Pool);
      expect(pool.options.max).toBe(2);
      expect(pool.options.idleTimeoutMillis).toBe(10000);
      expect(pool.options.connectionTimeoutMillis).toBe(5000);

      // Clean up pool
      await pool.end();
    });
  });
});

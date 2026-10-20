import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import {
  getMongoConnectionOptions,
  connectToMongoDB,
} from '../client';

describe('MongoDB Client Connection Pooling & Hygiene', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env vars before each test
    process.env = { ...originalEnv };
    const current = process.env as Record<string, string | undefined>;
    delete current.VERCEL;
    delete current.AWS_LAMBDA_FUNCTION_NAME;
    delete current.NODE_ENV;
    delete current.MONGODB_MAX_POOL_SIZE;
    delete current.MONGODB_URI;

    // Reset global mongoose cache
    global.mongooseCache = { conn: null, promise: null };
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('getMongoConnectionOptions()', () => {
    it('should return dev pool size (10) when running in local development', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

      const options = getMongoConnectionOptions();

      expect(options.maxPoolSize).toBe(10);
      expect(options.minPoolSize).toBe(0);
      expect(options.maxIdleTimeMS).toBe(10000);
      expect(options.serverSelectionTimeoutMS).toBe(5000);
      expect(options.socketTimeoutMS).toBe(30000);
      expect(options.bufferCommands).toBe(false);
    });

    it('should detect Vercel serverless environment and cap pool size to 2', () => {
      process.env.VERCEL = '1';

      const options = getMongoConnectionOptions();

      expect(options.maxPoolSize).toBe(2);
    });

    it('should detect AWS Lambda serverless environment and cap pool size to 2', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'my-lambda-function';

      const options = getMongoConnectionOptions();

      expect(options.maxPoolSize).toBe(2);
    });

    it('should detect production environment and cap pool size to 2', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

      const options = getMongoConnectionOptions();

      expect(options.maxPoolSize).toBe(2);
    });

    it('should allow MONGODB_MAX_POOL_SIZE environment variable to override maxPoolSize in dev', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
      process.env.MONGODB_MAX_POOL_SIZE = '5';

      const options = getMongoConnectionOptions();

      expect(options.maxPoolSize).toBe(5);
    });

    it('should allow MONGODB_MAX_POOL_SIZE environment variable to override maxPoolSize in serverless', () => {
      process.env.VERCEL = '1';
      process.env.MONGODB_MAX_POOL_SIZE = '1';

      const options = getMongoConnectionOptions();

      expect(options.maxPoolSize).toBe(1);
    });

    it('should fall back to defaults if MONGODB_MAX_POOL_SIZE is invalid or not a positive number', () => {
      process.env.VERCEL = '1';
      process.env.MONGODB_MAX_POOL_SIZE = 'not-a-number';

      const serverlessOptions = getMongoConnectionOptions();
      expect(serverlessOptions.maxPoolSize).toBe(2);

      delete (process.env as Record<string, string | undefined>).VERCEL;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
      process.env.MONGODB_MAX_POOL_SIZE = '';

      const devOptions = getMongoConnectionOptions();
      expect(devOptions.maxPoolSize).toBe(10);
    });

    it('should enforce connection hygiene: minPoolSize=0, maxIdleTimeMS=10000, serverSelectionTimeoutMS=5000, bufferCommands=false', () => {
      const options = getMongoConnectionOptions();

      // Zero idle footprint prevents inactive serverless functions from locking connection slots
      expect(options.minPoolSize).toBe(0);
      // Aggressive idle reaper closes connections after 10s of inactivity
      expect(options.maxIdleTimeMS).toBe(10000);
      // Fast timeout fails in 5s rather than hanging serverless invocation for 30s
      expect(options.serverSelectionTimeoutMS).toBe(5000);
      // Standard socket timeout for active operations
      expect(options.socketTimeoutMS).toBe(30000);
      // Disabling bufferCommands prevents silent queuing and memory buildup when disconnected
      expect(options.bufferCommands).toBe(false);
    });
  });

  describe('connectToMongoDB()', () => {
    const mockUri = 'mongodb+srv://mock-cluster.mongodb.net/testdb';

    it('should throw an error if MONGODB_URI environment variable is not defined', async () => {
      delete (process.env as Record<string, string | undefined>).MONGODB_URI;

      await expect(connectToMongoDB()).rejects.toThrow(
        'Please define the MONGODB_URI environment variable inside .env.local'
      );
    });

    it('should pass getMongoConnectionOptions() into mongoose.connect', async () => {
      process.env.MONGODB_URI = mockUri;
      process.env.VERCEL = '1';

      const connectSpy = vi
        .spyOn(mongoose, 'connect')
        .mockResolvedValue(mongoose as any);

      const conn = await connectToMongoDB();

      expect(connectSpy).toHaveBeenCalledTimes(1);
      expect(connectSpy).toHaveBeenCalledWith(
        mockUri,
        expect.objectContaining({
          maxPoolSize: 2,
          minPoolSize: 0,
          maxIdleTimeMS: 10000,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 30000,
          bufferCommands: false,
        })
      );
      expect(conn).toBe(mongoose);
    });

    it('should reuse cached connection on subsequent calls', async () => {
      process.env.MONGODB_URI = mockUri;

      const connectSpy = vi
        .spyOn(mongoose, 'connect')
        .mockResolvedValue(mongoose as any);

      const conn1 = await connectToMongoDB();
      const conn2 = await connectToMongoDB();

      expect(connectSpy).toHaveBeenCalledTimes(1);
      expect(conn1).toBe(conn2);
    });

    it('should share the same promise when called concurrently', async () => {
      process.env.MONGODB_URI = mockUri;

      let resolveConnect!: (value: any) => void;
      const connectPromise = new Promise((resolve) => {
        resolveConnect = resolve;
      });

      const connectSpy = vi
        .spyOn(mongoose, 'connect')
        .mockReturnValue(connectPromise as any);

      const p1 = connectToMongoDB();
      const p2 = connectToMongoDB();

      expect(connectSpy).toHaveBeenCalledTimes(1);

      resolveConnect(mongoose);

      const [conn1, conn2] = await Promise.all([p1, p2]);
      expect(conn1).toBe(mongoose);
      expect(conn2).toBe(mongoose);
    });

    it('should reset cached promise on connection error to allow subsequent retries', async () => {
      process.env.MONGODB_URI = mockUri;

      const connectSpy = vi
        .spyOn(mongoose, 'connect')
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce(mongoose as any);

      await expect(connectToMongoDB()).rejects.toThrow('Connection failed');
      expect(global.mongooseCache.promise).toBeNull();
      expect(global.mongooseCache.conn).toBeNull();

      // Retry should now attempt connection again
      const conn = await connectToMongoDB();
      expect(connectSpy).toHaveBeenCalledTimes(2);
      expect(conn).toBe(mongoose);
    });
  });
});

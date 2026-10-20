import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeAiCacheKey,
  getCachedAiResult,
  setCachedAiResult,
  clearAiMemoryCache,
  getAiMemoryCacheSize,
  MAX_TIER1_CACHE_SIZE,
} from '../aiCache.repo';
import { AiContentCache } from '@/src/server/database/mongo/models/AiContentCache';
import * as mongoClient from '@/src/server/infrastructure/db/mongodb/client';

describe('aiCache.repo & AiContentCache', () => {
  const originalEnv = process.env;
  let connectSpy: any;
  let findOneSpy: any;
  let updateOneSpy: any;

  beforeEach(() => {
    vi.resetAllMocks();
    clearAiMemoryCache();
    process.env = { ...originalEnv, MONGODB_URI: 'mongodb://localhost:27017/test-db' };

    connectSpy = vi.spyOn(mongoClient, 'connectToMongoDB').mockResolvedValue(undefined as any);

    findOneSpy = vi.spyOn(AiContentCache, 'findOne');
    updateOneSpy = vi.spyOn(AiContentCache, 'updateOne').mockReturnValue({
      catch: vi.fn().mockImplementation((fn: (err: any) => void) => Promise.resolve()),
    } as any);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    clearAiMemoryCache();
  });

  describe('1. Deterministic Key Generation (computeAiCacheKey)', () => {
    it('produces identical SHA-256 hashes for identical string inputs', () => {
      const key1 = computeAiCacheKey('semantic_chunking', 'sample text input', 'gemini-1.5-pro');
      const key2 = computeAiCacheKey('semantic_chunking', 'sample text input', 'gemini-1.5-pro');

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64);
      expect(key1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces identical hashes for identical JSON object structures', () => {
      const inputA = { query: 'react hooks', filters: { limit: 10 } };
      const inputB = { query: 'react hooks', filters: { limit: 10 } };

      const keyA = computeAiCacheKey('vector_scoring', inputA, 'text-embedding-3-small');
      const keyB = computeAiCacheKey('vector_scoring', inputB, 'text-embedding-3-small');

      expect(keyA).toBe(keyB);
    });

    it('produces distinct hashes when operationType differs', () => {
      const key1 = computeAiCacheKey('semantic_chunking', 'same input', 'gpt-4o');
      const key2 = computeAiCacheKey('vector_scoring', 'same input', 'gpt-4o');

      expect(key1).not.toBe(key2);
    });

    it('produces distinct hashes when modelId differs', () => {
      const key1 = computeAiCacheKey('semantic_chunking', 'same input', 'gpt-4o');
      const key2 = computeAiCacheKey('semantic_chunking', 'same input', 'claude-3-5-sonnet');

      expect(key1).not.toBe(key2);
    });

    it('defaults modelId to "default" when omitted or undefined', () => {
      const keyExplicit = computeAiCacheKey('youtube_video_observation', 'video123', 'default');
      const keyOmitted = computeAiCacheKey('youtube_video_observation', 'video123');

      expect(keyOmitted).toBe(keyExplicit);
    });

    it('produces distinct hashes when input content differs', () => {
      const key1 = computeAiCacheKey('semantic_chunking', 'content A', 'gemini-1.5-pro');
      const key2 = computeAiCacheKey('semantic_chunking', 'content B', 'gemini-1.5-pro');

      expect(key1).not.toBe(key2);
    });
  });

  describe('2. Tier 1 (In-Memory LRU Cache)', () => {
    it('returns payload directly on memory hit without querying MongoDB', async () => {
      const op = 'semantic_chunking';
      const input = 'test input';
      const payload = { chunks: ['chunk1', 'chunk2'] };

      await setCachedAiResult(op, input, payload);
      expect(getAiMemoryCacheSize()).toBe(1);

      // Reset mock counts
      findOneSpy.mockClear();
      connectSpy.mockClear();

      const result = await getCachedAiResult<typeof payload>(op, input);

      expect(result).toEqual(payload);
      expect(findOneSpy).not.toHaveBeenCalled();
    });

    it('clears Tier 1 memory cache via clearAiMemoryCache', async () => {
      await setCachedAiResult('op', 'in1', { data: 1 });
      await setCachedAiResult('op', 'in2', { data: 2 });
      expect(getAiMemoryCacheSize()).toBe(2);

      clearAiMemoryCache();
      expect(getAiMemoryCacheSize()).toBe(0);
    });

    it('enforces LRU eviction when exceeding MAX_TIER1_CACHE_SIZE (1000 items)', async () => {
      // Temporarily disable MongoDB calls to focus strictly on LRU memory eviction
      delete process.env.MONGODB_URI;

      // Populate 1000 items
      for (let i = 0; i < MAX_TIER1_CACHE_SIZE; i++) {
        await setCachedAiResult('bulk_op', `item_${i}`, { index: i });
      }
      expect(getAiMemoryCacheSize()).toBe(MAX_TIER1_CACHE_SIZE);

      // Verify item_0 is present
      const firstItem = await getCachedAiResult('bulk_op', 'item_0');
      expect(firstItem).toEqual({ index: 0 });

      // Note: accessing item_0 refreshes its LRU position, so item_1 becomes oldest!
      // Add 1 more item (1001st total)
      await setCachedAiResult('bulk_op', 'item_overflow', { index: 9999 });

      expect(getAiMemoryCacheSize()).toBe(MAX_TIER1_CACHE_SIZE);

      // item_1 should have been evicted as the oldest
      const evicted = await getCachedAiResult('bulk_op', 'item_1');
      expect(evicted).toBeNull();

      // item_0 (recently refreshed) and item_overflow should still exist
      expect(await getCachedAiResult('bulk_op', 'item_0')).toEqual({ index: 0 });
      expect(await getCachedAiResult('bulk_op', 'item_overflow')).toEqual({ index: 9999 });
    });
  });

  describe('3. Tier 2 (MongoDB Persistence Retrieval)', () => {
    it('queries MongoDB when Tier 1 misses and populates Tier 1 on hit', async () => {
      const op = 'youtube_video_observation';
      const input = 'https://youtube.com/watch?v=123';
      const hash = computeAiCacheKey(op, input);
      const cachedData = { transcriptSummary: 'Important observations' };

      const execMock = vi.fn().mockResolvedValue({
        contentHash: hash,
        operationType: op,
        payload: cachedData,
      });
      const leanMock = vi.fn().mockReturnValue({ exec: execMock });
      findOneSpy.mockReturnValue({ lean: leanMock } as any);

      const result = await getCachedAiResult<typeof cachedData>(op, input);

      expect(connectSpy).toHaveBeenCalled();
      expect(findOneSpy).toHaveBeenCalledWith({ contentHash: hash });
      expect(result).toEqual(cachedData);

      // Verify Tier 1 was populated
      expect(getAiMemoryCacheSize()).toBe(1);

      // Asynchronous access metrics update
      expect(updateOneSpy).toHaveBeenCalledWith(
        { contentHash: hash },
        {
          $set: { lastAccessedAt: expect.any(Date) },
          $inc: { accessCount: 1 },
        }
      );

      // Subsequent read should hit Tier 1 directly
      findOneSpy.mockClear();
      const secondResult = await getCachedAiResult<typeof cachedData>(op, input);
      expect(secondResult).toEqual(cachedData);
      expect(findOneSpy).not.toHaveBeenCalled();
    });

    it('returns null when document is neither in Tier 1 nor MongoDB', async () => {
      const execMock = vi.fn().mockResolvedValue(null);
      const leanMock = vi.fn().mockReturnValue({ exec: execMock });
      findOneSpy.mockReturnValue({ lean: leanMock } as any);

      const result = await getCachedAiResult('missing_op', 'unknown_input');

      expect(result).toBeNull();
      expect(getAiMemoryCacheSize()).toBe(0);
    });
  });

  describe('4. Tier 2 (MongoDB Persistence Upsert)', () => {
    it('upserts document with correct metadata, byte length, and TTL fields', async () => {
      const op = 'semantic_chunking';
      const input = { text: 'chunk me please', threshold: 0.8 };
      const payload = { segments: [{ start: 0, end: 10 }] };
      const modelId = 'claude-3-haiku';
      const hash = computeAiCacheKey(op, input, modelId);
      const expectedBytes = Buffer.byteLength(JSON.stringify(input));

      await setCachedAiResult(op, input, payload, modelId);

      expect(connectSpy).toHaveBeenCalled();
      expect(updateOneSpy).toHaveBeenCalledWith(
        { contentHash: hash },
        {
          $set: {
            contentHash: hash,
            operationType: op,
            modelId,
            payload,
            inputByteLength: expectedBytes,
            lastAccessedAt: expect.any(Date),
          },
          $setOnInsert: { createdAt: expect.any(Date) },
          $inc: { accessCount: 1 },
        },
        { upsert: true }
      );
    });

    it('correctly calculates byte length for string inputs', async () => {
      const op = 'string_op';
      const input = 'Unicode input: 🚀 test \u00A9';
      const expectedBytes = Buffer.byteLength(input);
      const hash = computeAiCacheKey(op, input);

      await setCachedAiResult(op, input, { done: true });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { contentHash: hash },
        expect.objectContaining({
          $set: expect.objectContaining({
            inputByteLength: expectedBytes,
          }),
        }),
        { upsert: true }
      );
    });
  });

  describe('5. Graceful Fallbacks and Error Handling', () => {
    it('operates smoothly without errors when MONGODB_URI is undefined', async () => {
      delete process.env.MONGODB_URI;

      const op = 'no_mongo_op';
      const input = 'data';
      const payload = { success: true };

      // Set in memory
      await setCachedAiResult(op, input, payload);
      expect(connectSpy).not.toHaveBeenCalled();
      expect(updateOneSpy).not.toHaveBeenCalled();

      // Read from memory
      const hit = await getCachedAiResult(op, input);
      expect(hit).toEqual(payload);

      // Miss on unset key
      const miss = await getCachedAiResult(op, 'not_cached');
      expect(miss).toBeNull();
      expect(findOneSpy).not.toHaveBeenCalled();
    });

    it('catches and warns on MongoDB connection/read failure, returning null', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      findOneSpy.mockImplementation(() => {
        throw new Error('Connection refused to Mongo');
      });

      const result = await getCachedAiResult('error_op', 'err_input');

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        '[AiCache] MongoDB read error:',
        expect.any(Error)
      );
    });

    it('catches and warns on MongoDB write failure without rejecting', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      connectSpy.mockRejectedValue(new Error('Mongo network timeout'));

      await expect(
        setCachedAiResult('write_fail', 'data', { status: 'ok' })
      ).resolves.not.toThrow();

      expect(warnSpy).toHaveBeenCalledWith(
        '[AiCache] MongoDB write error:',
        expect.any(Error)
      );
    });
  });

  describe('6. Model Schema & Indexes Coverage', () => {
    it('declares unique contentHash index, operationType compound index, and 90-day TTL index', () => {
      const indexes = AiContentCache.schema.indexes();

      expect(indexes).toEqual(
        expect.arrayContaining([
          [{ contentHash: 1 }, expect.objectContaining({ unique: true })],
          [{ operationType: 1, createdAt: -1 }, expect.anything()],
          [
            { createdAt: 1 },
            expect.objectContaining({ expireAfterSeconds: 90 * 24 * 3600 }),
          ],
        ])
      );
    });
  });
});

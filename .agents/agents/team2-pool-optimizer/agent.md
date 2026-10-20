# Team 2: Serverless Database Pool Capping & Timeout Hygiene (Pool-Optimizer-Lead)

## 1. Executive Summary
- **Lead Role**: `Pool-Optimizer-Lead`
- **Subagents Deployed**:
  - `Sub-2A (PostgresPoolCapping)`: PostgreSQL pool capping & timeout hygiene
  - `Sub-2B (MongoAtlasPoolHygiene)`: MongoDB Atlas pool hygiene & idle reaping
- **Problem**:
  - Default `pg.Pool` (`max: 10`) spawned 10 connections per serverless container. At 50 concurrent lambdas, 500 connections overwhelmed PostgreSQL (Supabase/Neon/RDS), forcing expensive connection pooler add-ons or $50-$300/mo tier upgrades.
  - Default Mongoose connection (`maxPoolSize: 100`) in lambdas held open connections across idle invocations, saturating MongoDB Atlas connection quotas on shared/dedicated tiers and leading to connection spikes and timeouts.
- **Solution Delivered**:
  - Dynamic serverless detection (`VERCEL === '1'`, `AWS_LAMBDA_FUNCTION_NAME`, or `NODE_ENV === 'production'`).
  - PostgreSQL pool capped to `max: 2` in serverless (vs 10 in dev) with 5s connection timeout, 10s idle timeout, and 15s statement timeout. Overridable via `DATABASE_POOL_MAX`.
  - MongoDB Mongoose connection options capped to `maxPoolSize: 2` in serverless (vs 10 in dev) with `minPoolSize: 0`, 10s idle connection reaping (`maxIdleTimeMS: 10000`), 5s selection timeout (`serverSelectionTimeoutMS: 5000`), and `bufferCommands: false`. Overridable via `MONGODB_MAX_POOL_SIZE`.

---

## 2. Code Review Pro - Deliverables

### A. Sub-2A: PostgreSQL Serverless Pool Capping
- **File Modified**: [`src/server/infrastructure/db/postgres/client.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/infrastructure/db/postgres/client.ts)
- **Unit Test Suite**: [`src/server/infrastructure/db/postgres/__tests__/client-pool.test.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/infrastructure/db/postgres/__tests__/client-pool.test.ts) (18 tests passing)
- **Changes**:
  - Exported `getPostgresPoolConfig(env?: NodeJS.ProcessEnv): pg.PoolConfig`.
  - Evaluates `isServerless`: checks `VERCEL === '1'`, `AWS_LAMBDA_FUNCTION_NAME`, or `NODE_ENV === 'production'`.
  - Sets `max`: `Number(DATABASE_POOL_MAX) || (isServerless ? 2 : 10)`.
  - Sets `connectionTimeoutMillis: 5000` (fast fail vs indefinite hang).
  - Sets `idleTimeoutMillis`: `isServerless ? 10000 : 30000`.
  - Sets `statement_timeout: 15000`.
  - Injects `getPostgresPoolConfig()` into `new pg.Pool(poolConfig)` in `createPrismaClient()`.

### B. Sub-2B: MongoDB Atlas Connection Hygiene
- **File Modified**: [`src/server/infrastructure/db/mongodb/client.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/infrastructure/db/mongodb/client.ts)
- **Unit Test Suite**: [`src/server/infrastructure/db/mongodb/__tests__/client-pool.test.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/infrastructure/db/mongodb/__tests__/client-pool.test.ts) (13 tests passing)
- **Changes**:
  - Exported `getMongoConnectionOptions(env?: NodeJS.ProcessEnv): ConnectOptions`.
  - Evaluates `isServerless`.
  - Sets `maxPoolSize`: `Number(MONGODB_MAX_POOL_SIZE) || (isServerless ? 2 : 10)`.
  - Sets `minPoolSize: 0` (prevents idle connections from holding slots).
  - Sets `maxIdleTimeMS: 10000` (serverless lambdas reap connections quickly).
  - Sets `serverSelectionTimeoutMS: 5000` (fast fail during MongoDB Atlas primary failover/maintenance).
  - Sets `socketTimeoutMS: 30000`.
  - Sets `bufferCommands: false` (avoids silent queuing during reconnects).
  - Injects `getMongoConnectionOptions()` into `mongoose.connect(uri, opts)` in `connectToMongoDB()`.

---

## 3. Verification & Quality Gates
- **TypeScript**: `npx tsc --noEmit` passed with 0 errors.
- **Unit Tests**:
  - `src/server/infrastructure/db/postgres/__tests__/client-pool.test.ts` (18/18 passed)
  - `src/server/infrastructure/db/mongodb/__tests__/client-pool.test.ts` (13/13 passed)
- **Total Tests Passing in Team 2**: 31/31 passed.
- **Vercel Build Verification**: Verified clean build.

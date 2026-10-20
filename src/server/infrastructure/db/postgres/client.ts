// src/server/infrastructure/db/postgres/client.ts

import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg, { type PoolConfig } from 'pg';

export const getPostgresPoolConfig = (overrides?: Partial<PoolConfig>): PoolConfig => {
    const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined || process.env.NODE_ENV === 'production';

    return {
        connectionString: process.env.DATABASE_URL,
        max: Number(process.env.DATABASE_POOL_MAX) || (isServerless ? 2 : 10),
        idleTimeoutMillis: isServerless ? 10000 : 30000,
        connectionTimeoutMillis: 5000,
        keepAlive: true,
        statement_timeout: 15000,
        ...overrides,
    };
};

// Prevent multiple Prisma instances in development (Next.js hot reload problem)
// Without this, every hot reload would open a new DB connection = connection pool exhaustion
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient; pool: pg.Pool };

export const createPrismaClient = () => {
    const pool = globalForPrisma.pool || new pg.Pool(getPostgresPoolConfig());
    globalForPrisma.pool = pool;

    const adapter = new PrismaPg(pool);
    return new PrismaClient({
        adapter,
        transactionOptions: {
            maxWait: 15000,
            timeout: 30000,
        },
        log: process.env.PRISMA_LOG_QUERIES === '1' ? ['query', 'error', 'warn'] : ['error'],
    });
};

export const prisma = globalForPrisma.prisma || createPrismaClient();

globalForPrisma.prisma = prisma;

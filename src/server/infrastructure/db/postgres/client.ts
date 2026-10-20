// src/server/infrastructure/db/postgres/client.ts

import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Prevent multiple Prisma instances in development (Next.js hot reload problem)
// Without this, every hot reload would open a new DB connection = connection pool exhaustion
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient; pool: pg.Pool };

const createPrismaClient = () => {
    const pool = globalForPrisma.pool || new pg.Pool({
        connectionString: process.env.DATABASE_URL!,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        keepAlive: true,
        statement_timeout: 15000,
    });
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


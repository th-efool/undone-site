// src/server/infrastructure/db/postgres/client.ts

import { PrismaClient } from '@/generated/prisma/client';

// Prevent multiple Prisma instances in development (Next.js hot reload problem)
// Without this, every hot reload would open a new DB connection = connection pool exhaustion
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}
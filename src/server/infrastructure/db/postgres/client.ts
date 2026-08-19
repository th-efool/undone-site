// src/server/infrastructure/db/postgres/client.ts

import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Prevent multiple Prisma instances in development (Next.js hot reload problem)
// Without this, every hot reload would open a new DB connection = connection pool exhaustion
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const createPrismaClient = () => {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
};

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}
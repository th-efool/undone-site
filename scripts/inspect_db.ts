import { prisma } from '@/src/server/infrastructure/db/postgres/client';

async function main() {
  const cohorts = await prisma.cohort.findMany({
    include: {
      seasons: {
        include: {
          lessons: {
            where: { chunks: { not: null as any } }
          }
        }
      }
    }
  });
  
  console.log(JSON.stringify(cohorts, null, 2));
  process.exit(0);
}

main().catch(console.error);

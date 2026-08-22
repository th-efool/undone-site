import { connectToMongoDB } from '@/src/server/infrastructure/db/mongodb/client';
import { Chunk } from '@/src/server/database/mongo/models/Chunk';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

async function main() {
  await connectToMongoDB();
  
  const chunkCount = await Chunk.countDocuments();
  console.log(`MongoDB Chunks count: ${chunkCount}`);

  const lessonsWithChunks = await prisma.lesson.findMany({
    where: { chunks: { not: null } },
    select: { id: true, chunks: true }
  });
  
  console.log(`Lessons with chunks in Postgres: ${lessonsWithChunks.length}`);
  if (lessonsWithChunks.length > 0) {
    const firstLessonChunks = lessonsWithChunks[0].chunks as any[];
    console.log(`First lesson has ${firstLessonChunks.length} chunks.`);
    if (firstLessonChunks.length > 0) {
      console.log('Sample chunk from Postgres:');
      console.log(JSON.stringify(firstLessonChunks[0], null, 2));
    }
  }

  process.exit(0);
}

main().catch(console.error);

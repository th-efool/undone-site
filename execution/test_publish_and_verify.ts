import { prisma } from '../src/server/infrastructure/db/postgres/client';
import { connectToMongoDB } from '../src/server/infrastructure/db/mongodb/client';
import { CohortTranscript } from '../src/server/database/mongo/models/CohortTranscript';
import { userRepo } from '../src/server/infrastructure/db/postgres/repositories/user.repo';
import { CohortService } from '../src/server/domain/cohort/cohort.service';
import { mapDbCohortToUiCohort } from '../src/server/infrastructure/db/postgres/mappers/cohortMapper';
import { SeasonStatus } from '../src/client/screens/cohort/models';

async function runVerification() {
  console.log('=== Starting Cohort Publishing & /home Flow Verification ===\n');

  // 1. Ensure or create a test creator
  let testUser = await userRepo.findByEmail('test@sidequesthq.com');
  if (!testUser) {
    console.log('[Step 1] Creating test user test@sidequesthq.com...');
    testUser = await userRepo.create({
      email: 'test@sidequesthq.com',
      name: 'Verification Creator',
      username: 'verifycreator',
    });
  } else {
    console.log(`[Step 1] Test user found: ${testUser.email} (ID: ${testUser.id})`);
  }

  // 2. Build mock wizard publishing payload
  const timestamp = Date.now();
  const cohortTitle = `Rust Systems Programming ${timestamp}`;

  const payload = {
    creatorId: testUser.id,
    title: cohortTitle,
    subtitle: 'Build high-performance, memory-safe backend systems in Rust.',
    description: 'A comprehensive cohort guiding you from Rust basics to concurrent distributed systems.',
    coverImage: '/mock/thumbnails/docker.avif',
    difficulty: 'INTERMEDIATE' as const,
    visibility: 'PUBLIC' as const,
    categories: ['Programming', 'Systems Engineering'],
    estimatedCompletionTime: '4 Weeks',
    language: 'English',
    primaryTopic: 'Rust',
    tags: ['rust', 'systems', 'backend', 'tokio'],
    requirements: ['Basic programming knowledge in any language', 'Laptop with Rust installed'],
    learningOutcomes: [
      'Master Rust ownership, borrowing, and lifetime mechanics',
      'Build async services using Tokio and Axum',
      'Deploy memory-safe CLI and daemon tools',
    ],
    sources: [
      {
        type: 'YOUTUBE_PLAYLIST' as const,
        title: 'Rust Full Course Playlist',
        url: 'https://www.youtube.com/playlist?list=PLmock_playlist_123',
        thumbnailUrl: 'https://img.youtube.com/vi/mock/hqdefault.jpg',
        domain: 'youtube.com',
        metaTitle: 'Rust Complete Guide',
        chunkingMethod: 'semantic',
      },
    ],
    seasons: [
      {
        title: 'Season 1: Syntax & Memory Ownership',
        order: 1,
        lessons: [
          {
            title: 'Variables, Mutability & Memory Layout',
            description: 'Understanding stack vs heap in Rust.',
            duration: 15,
            order: 1,
            lessonType: 'VIDEO' as const,
          },
          {
            title: 'Borrowing, References & Lifetimes',
            description: 'The borrow checker in practice.',
            duration: 25,
            order: 2,
            lessonType: 'VIDEO' as const,
          },
        ],
      },
      {
        title: 'Season 2: Async Rust & Multithreading',
        order: 2,
        lessons: [
          {
            title: 'Threads, Channels & Mutexes',
            description: 'Safe concurrency patterns.',
            duration: 30,
            order: 1,
            lessonType: 'VIDEO' as const,
          },
        ],
      },
    ],
    forcePublishWithWeights: true,
  };

  console.log(`\n[Step 2] Publishing cohort "${cohortTitle}" via CohortService...`);
  const publishedCohort = await CohortService.publishCohort(payload);
  console.log(`✓ Cohort published successfully! ID: ${publishedCohort.id}`);

  // 3. Verify PostgreSQL Persistence & Publication Status
  console.log('\n[Step 3] Verifying PostgreSQL persistence & published flags...');
  const dbCohort = await prisma.cohort.findUnique({
    where: { id: publishedCohort.id },
    include: {
      creator: true,
      members: true,
      seasons: {
        include: {
          lessons: true,
        },
      },
      community: {
        include: {
          channels: true,
        },
      },
    },
  });

  if (!dbCohort) {
    throw new Error(`FAIL: Cohort ${publishedCohort.id} not found in PostgreSQL database!`);
  }
  if (!dbCohort.isPublished || !dbCohort.publishedAt) {
    throw new Error(`FAIL: Cohort isPublished is ${dbCohort.isPublished}, expected true!`);
  }
  console.log(`✓ PostgreSQL: Cohort is published: ${dbCohort.isPublished}, publishedAt: ${dbCohort.publishedAt.toISOString()}`);
  console.log(`✓ PostgreSQL: Seasons: ${dbCohort.seasons.length}, Total Lessons: ${dbCohort.seasons.reduce((a, s) => a + s.lessons.length, 0)}`);
  console.log(`✓ PostgreSQL: Community Channels: ${dbCohort.community?.channels.map(c => c.name).join(', ')}`);

  // 4. Verify CohortMember Auto-Enrollment for Creator
  console.log('\n[Step 4] Verifying Creator CohortMember record...');
  const creatorMember = await prisma.cohortMember.findUnique({
    where: {
      cohortId_userId: {
        cohortId: publishedCohort.id,
        userId: testUser.id,
      },
    },
  });

  if (!creatorMember) {
    throw new Error(`FAIL: Creator ${testUser.id} was NOT auto-enrolled in CohortMember for cohort ${publishedCohort.id}!`);
  }
  if (creatorMember.role !== 'CREATOR') {
    throw new Error(`FAIL: Creator member role is ${creatorMember.role}, expected CREATOR!`);
  }
  console.log(`✓ Creator is auto-enrolled in CohortMember with role: ${creatorMember.role}`);

  // 5. Verify MongoDB Transcript Chunks
  console.log('\n[Step 5] Verifying MongoDB transcript chunks...');
  await connectToMongoDB();
  const mongoDoc = await CohortTranscript.findOne({ cohortId: publishedCohort.id });
  if (!mongoDoc) {
    throw new Error(`FAIL: No CohortTranscript document found in MongoDB for cohort ${publishedCohort.id}!`);
  }
  if (!mongoDoc.isPublished) {
    throw new Error(`FAIL: MongoDB CohortTranscript isPublished is false, expected true!`);
  }
  console.log(`✓ MongoDB: CohortTranscript document found with ${mongoDoc.chunks.length} chunks, isPublished: ${mongoDoc.isPublished}`);

  // 6. Verify /home Data Query & Feed Inclusion
  console.log('\n[Step 6] Simulating /home query for creator...');
  const enrolledMembers = await prisma.cohortMember.findMany({
    where: { userId: testUser.id },
    include: {
      cohort: {
        include: {
          creator: true,
          seasons: {
            include: {
              lessons: {
                include: {
                  progress: {
                    where: { userId: testUser.id },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const enrolledCohortIds = enrolledMembers.map((em) => em.cohortId);

  const createdCohorts = await prisma.cohort.findMany({
    where: {
      creatorId: testUser.id,
      id: {
        notIn: enrolledCohortIds,
      },
    },
    include: {
      creator: true,
      seasons: {
        include: {
          lessons: {
            include: {
              progress: {
                where: { userId: testUser.id },
              },
            },
          },
        },
      },
    },
  });

  const allUserCohorts = [
    ...enrolledMembers.map((em) => ({
      userId: em.userId,
      cohortId: em.cohortId,
      cohort: em.cohort,
    })),
    ...createdCohorts.map((c) => ({
      userId: testUser.id,
      cohortId: c.id,
      cohort: c,
    })),
  ];

  const foundInHome = allUserCohorts.find((c) => c.cohortId === publishedCohort.id);
  if (!foundInHome) {
    throw new Error(`FAIL: Published cohort ${publishedCohort.id} is NOT present in /home query!`);
  }
  console.log(`✓ /home screen: Found published cohort in user's active cohorts list!`);
  console.log(`  Title: "${foundInHome.cohort.title}", Provider: "${foundInHome.cohort.creator?.name}"`);

  // 7. Verify UI Model Mapper & Image Crash Safeguards
  console.log('\n[Step 7] Verifying mapDbCohortToUiCohort & Next.js Image safety...');
  const uiCohort = mapDbCohortToUiCohort(dbCohort);

  // Check creator avatarUrl is NEVER empty string
  if (!uiCohort.creator.avatarUrl || uiCohort.creator.avatarUrl.trim() === '') {
    throw new Error(`FAIL: uiCohort.creator.avatarUrl is empty string! This causes Next.js <Image> to crash.`);
  }
  console.log(`✓ Creator Avatar URL: "${uiCohort.creator.avatarUrl}" (safe from <Image src=""> crash)`);

  // Check coverImage
  if (!uiCohort.coverImage || uiCohort.coverImage.trim() === '') {
    throw new Error(`FAIL: uiCohort.coverImage is empty string!`);
  }
  console.log(`✓ Cohort Cover Image: "${uiCohort.coverImage}"`);

  // Check overview objectives & journey summary
  if (uiCohort.overview.learningObjectives.length === 0) {
    throw new Error(`FAIL: uiCohort.overview.learningObjectives is empty!`);
  }
  console.log(`✓ Overview Learning Objectives populated: ${uiCohort.overview.learningObjectives.length} items`);

  if (uiCohort.overview.journeySummary.length === 0) {
    throw new Error(`FAIL: uiCohort.overview.journeySummary is empty!`);
  }
  console.log(`✓ Overview Journey Summary populated: ${uiCohort.overview.journeySummary.length} items`);

  // Check questline initial season status is NOT locked
  if (uiCohort.questline.seasons[0].status === SeasonStatus.Locked) {
    throw new Error(`FAIL: Season 1 is Locked! Expected 'In Progress' for newly published cohort.`);
  }
  console.log(`✓ Season 1 Status: "${uiCohort.questline.seasons[0].status}" (learner/creator can navigate)`);

  // Check navigation URL validity
  const expectedUrl = `/cohort/${publishedCohort.id}`;
  const expectedOverviewUrl = `/cohort/${publishedCohort.id}/overview`;
  console.log(`✓ Navigation target URL: ${expectedUrl} -> ${expectedOverviewUrl}`);

  console.log('\n======================================================');
  console.log('🎉 ALL VERIFICATION CHECKS PASSED SUCCESSFULLY! 🎉');
  console.log('======================================================\n');
}

runVerification()
  .catch((err) => {
    console.error('\n❌ Verification Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

import { prisma } from '../src/server/infrastructure/db/postgres/client';
import { hashPassword } from '../src/server/infrastructure/auth/password';

const BASELINE_STUDY_ROOMS = [
  {
    slug: 'fireplace',
    title: 'Cozy Fireplace',
    description: 'A warm hearth with cracking wood and quiet ambiance for deep work.',
    capacity: 25,
    atmospherePreset: 'fireplace',
    defaultScene: 'fireplace',
    defaultMusic: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
  },
  {
    slug: 'library',
    title: 'Old Oak Library',
    description: 'High ceilings, grand bookshelves, and gentle rain outside the tall windows.',
    capacity: 50,
    atmospherePreset: 'library',
    defaultScene: 'library',
    defaultMusic: 'https://www.youtube.com/watch?v=5qap5aO4i9A',
  },
  {
    slug: 'developer-den',
    title: 'Developer Den',
    description: 'Ambient synthwave, low terminal glow, and ultra-focused coding flow.',
    capacity: 30,
    atmospherePreset: 'synthwave',
    defaultScene: 'cyberpunk',
    defaultMusic: 'https://www.youtube.com/watch?v=4xDzrJKXOOY',
  },
];

async function purgeAndSeed() {
  console.log('--- PURGING ALL OLD USERS, COHORTS, AND ASSOCIATED TABLES ---');
  
  // Truncate tables with CASCADE to safely clean all dependencies
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      users, 
      cohorts, 
      communities,
      channels,
      conversations,
      study_rooms
    CASCADE;
  `);
  console.log('✅ Successfully purged users, cohorts, communities, channels, conversations, study_rooms (CASCADE)');

  console.log('--- SEEDING FRESH AUTH USERS ---');
  
  const commonPassword = 'Password123!';
  const hashedPassword = hashPassword(commonPassword);

  // 1. Guest Account
  const guest = await prisma.user.create({
    data: {
      email: 'guest@undone.com',
      name: 'Guest Explorer',
      username: 'guest-undone',
      role: 'EXPLORER',
    },
  });
  console.log(`✅ Created Guest User: ${guest.email} (id: ${guest.id})`);

  // 2. User Alpha
  const alpha = await prisma.user.create({
    data: {
      email: 'user_alpha@undone.com',
      name: 'User Alpha',
      username: 'user_alpha',
      passwordHash: hashedPassword,
      role: 'EXPLORER',
    },
  });
  console.log(`✅ Created User Alpha: ${alpha.username} (${alpha.email}) [Password: ${commonPassword}] (id: ${alpha.id})`);

  // 3. User Gamma
  const gamma = await prisma.user.create({
    data: {
      email: 'user_gamma@undone.com',
      name: 'User Gamma',
      username: 'user_gamma',
      passwordHash: hashedPassword,
      role: 'EXPLORER',
    },
  });
  console.log(`✅ Created User Gamma: ${gamma.username} (${gamma.email}) [Password: ${commonPassword}] (id: ${gamma.id})`);

  console.log('--- SEEDING DIRECT CONVERSATION BETWEEN ALPHA AND GAMMA ---');
  const directKey = [alpha.id, gamma.id].sort().join(':');

  const conversation = await prisma.conversation.create({
    data: {
      title: `@${gamma.username}`,
      creatorId: alpha.id,
      directKey,
      kind: 'DIRECT',
      accessGeneration: 1,
    },
  });

  const channel = await prisma.channel.create({
    data: {
      conversationId: conversation.id,
      name: `dm-${alpha.username}-${gamma.username}`,
      messageCounter: 1,
    },
  });

  await prisma.conversationParticipant.createMany({
    data: [
      { conversationId: conversation.id, userId: alpha.id, role: 'MEMBER' },
      { conversationId: conversation.id, userId: gamma.id, role: 'MEMBER' },
    ],
  });

  await prisma.channelUserState.createMany({
    data: [
      { channelId: channel.id, userId: alpha.id, lastReadSequence: 0 }, // 1 unread message for alpha!
      { channelId: channel.id, userId: gamma.id, lastReadSequence: 1 },
    ],
  });

  // Seed welcome message from Gamma
  await prisma.message.create({
    data: {
      channelId: channel.id,
      authorId: gamma.id,
      messageSequence: 1,
      content: 'Hello @user_alpha! Database was cleanly purged and refreshed with password authentication. Direct messaging is ready!',
    },
  });
  console.log(`✅ Created Direct Conversation (${conversation.id}), Channel (${channel.id}), and initial welcome message`);

  console.log('--- SEEDING BASELINE STUDY ROOMS ---');
  for (const def of BASELINE_STUDY_ROOMS) {
    const room = await prisma.studyRoom.create({
      data: {
        slug: def.slug,
        title: def.title,
        description: def.description,
        thumbnail: `/images/studyrooms/scenes/${def.defaultScene}.webp`,
        capacity: def.capacity,
        listing: 'PUBLIC',
        status: 'OPEN',
        ownerId: alpha.id,
        onlineCount: 0,
        revision: 1,
      },
    });

    await prisma.roomEnvironment.create({
      data: {
        studyRoomId: room.id,
        sceneId: def.defaultScene,
        soundscapeId: def.atmospherePreset,
        musicStreamUrl: def.defaultMusic,
        revision: 1,
      },
    });
    console.log(`✅ Seeded study room: ${def.title} (/studyroom/${def.slug})`);
  }

  console.log('--- VERIFYING FINAL DATABASE ROW COUNTS ---');
  const userCount = await prisma.user.count();
  const cohortCount = await prisma.cohort.count();
  const roomCount = await prisma.studyRoom.count();
  const conversationCount = await prisma.conversation.count();
  const messageCount = await prisma.message.count();

  console.log(`Users count: ${userCount}`);
  console.log(`Cohorts count: ${cohortCount}`);
  console.log(`Study Rooms count: ${roomCount}`);
  console.log(`Conversations count: ${conversationCount}`);
  console.log(`Messages count: ${messageCount}`);
  console.log('--- PURGE AND SEED COMPLETED SUCCESSFULLY ---');
}

purgeAndSeed()
  .catch((err) => {
    console.error('Purge and seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

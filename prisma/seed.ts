import 'dotenv/config';
import { Difficulty, Visibility } from '../generated/prisma';
import { prisma } from '../src/server/infrastructure/db/postgres/client';

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Create or update the Guest User
  const guestUser = await prisma.user.upsert({
    where: { email: 'guest@sidequesthq.com' },
    update: {},
    create: {
      email: 'guest@sidequesthq.com',
      name: 'Guest Explorer',
      username: 'guest',
    },
  });

  console.log(`👤 Guest user ready: ${guestUser.id}`);

  // 2. Define the 5 Cohorts
  const cohortsData = [
    {
      title: "DSA — Only What's Needed",
      subtitle: "Master Data Structures and Algorithms for Interviews",
      description: "A focused, fluff-free guide to the most common DSA concepts.",
      coverImage: "/images/cohorts/dsa.webp",
      difficulty: Difficulty.INTERMEDIATE,
      visibility: Visibility.PUBLIC,
      isPublished: true,
      creatorId: guestUser.id,
      seasons: [
        {
          title: "Season 1: Arrays & Strings",
          order: 1,
          lessons: [
            { title: "Two Pointers Technique", order: 1, duration: 600 },
            { title: "Sliding Window", order: 2, duration: 720 },
          ]
        }
      ]
    },
    {
      title: "Operating Systems",
      subtitle: "How computers actually work",
      description: "Deep dive into OS concepts, memory management, and concurrency.",
      coverImage: "/images/cohorts/os.webp",
      difficulty: Difficulty.ADVANCED,
      visibility: Visibility.PUBLIC,
      isPublished: true,
      creatorId: guestUser.id,
      seasons: [
        {
          title: "Season 1: Processes and Threads",
          order: 1,
          lessons: [
            { title: "Process Control Block", order: 1, duration: 450 },
            { title: "Multithreading", order: 2, duration: 800 },
          ]
        }
      ]
    },
    {
      title: "Celtic Mythology",
      subtitle: "Gods, Heroes, and Legends",
      description: "Explore the ancient myths of the Celtic people.",
      coverImage: "/images/cohorts/celtic.webp",
      difficulty: Difficulty.BEGINNER,
      visibility: Visibility.PUBLIC,
      isPublished: true,
      creatorId: guestUser.id,
      seasons: [
        {
          title: "Season 1: The Tuatha Dé Danann",
          order: 1,
          lessons: [
            { title: "Arrival in Ireland", order: 1, duration: 500 },
            { title: "The First Battle of Magh Tuireadh", order: 2, duration: 600 },
          ]
        }
      ]
    },
    {
      title: "Networking",
      subtitle: "The Internet Explained",
      description: "TCP/IP, OSI Model, and how data moves across the world.",
      coverImage: "/images/cohorts/networking.webp",
      difficulty: Difficulty.INTERMEDIATE,
      visibility: Visibility.PUBLIC,
      isPublished: true,
      creatorId: guestUser.id,
      seasons: [
        {
          title: "Season 1: The OSI Model",
          order: 1,
          lessons: [
            { title: "Physical & Data Link Layers", order: 1, duration: 900 },
            { title: "Network & Transport Layers", order: 2, duration: 900 },
          ]
        }
      ]
    },
    {
      title: "Rajvansh: Dynasties Of India",
      subtitle: "The Great Indian Empires",
      description: "History of the Mauryas, Guptas, Mughals, and Marathas.",
      coverImage: "/images/cohorts/rajvansh.webp",
      difficulty: Difficulty.BEGINNER,
      visibility: Visibility.PUBLIC,
      isPublished: true,
      creatorId: guestUser.id,
      seasons: [
        {
          title: "Season 1: Ancient Empires",
          order: 1,
          lessons: [
            { title: "The Mauryan Empire", order: 1, duration: 1200 },
            { title: "The Gupta Golden Age", order: 2, duration: 1000 },
          ]
        }
      ]
    }
  ];

  // 3. Create Cohorts, Seasons, Lessons, and enroll Guest
  for (const data of cohortsData) {
    const existing = await prisma.cohort.findFirst({ where: { title: data.title } });
    let cohortId = existing?.id;

    if (!existing) {
      const cohort = await prisma.cohort.create({
        data: {
          title: data.title,
          subtitle: data.subtitle,
          description: data.description,
          coverImage: data.coverImage,
          difficulty: data.difficulty,
          visibility: data.visibility,
          isPublished: data.isPublished,
          creatorId: data.creatorId,
          seasons: {
            create: data.seasons.map(season => ({
              title: season.title,
              order: season.order,
              lessons: {
                create: season.lessons
              }
            }))
          }
        }
      });
      cohortId = cohort.id;
      console.log(`✅ Created cohort: ${data.title}`);
    } else {
      console.log(`⏭️  Cohort already exists: ${data.title}`);
    }

    // Enroll guest user
    if (cohortId) {
      await prisma.cohortMember.upsert({
        where: { cohortId_userId: { cohortId, userId: guestUser.id } },
        update: {},
        create: {
          cohortId,
          userId: guestUser.id,
        }
      });
    }
  }

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

# The Core Learning Journey: Cohorts, Seasons, and Lessons

Welcome to the backend! On the frontend, you're used to managing component state and props. On the backend, our "state" lives in a database, and we define its shape using **Prisma**—a modern toolkit that translates our TypeScript-like definitions into database tables.

In SideQuestHQ, the primary learning journey is called a **Cohort**. Unlike traditional platforms that have generic "courses," a Cohort is a dedicated, structured adventure. 
Think of a Cohort like a TV series. A series has **Seasons**, and each Season has **Episodes** (which we call **Lessons** or Quests). 

Here is how we model this nested relationship in our database.

## 1. The Prisma Schema

Prisma uses a `schema.prisma` file to define our models. Let's look at the definitions for our learning journey:

```prisma
// This is an Enum (a fixed set of values) for our lesson types.
// Think of it like a TypeScript union type: 'VIDEO' | 'ARTICLE' | 'QUIZ'
enum LessonType {
  VIDEO
  ARTICLE
  QUIZ
}

model Cohort {
  id          String   @id @default(cuid()) // Unique ID, generated automatically
  title       String   // e.g., "Fullstack React Developer"
  description String?  // Optional text (the '?' means it can be null)
  difficulty  String   // e.g., "Beginner", "Intermediate"
  coverImage  String?  // URL to the banner/cover image
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // A Cohort contains a 'questline' made up of multiple Seasons.
  // This defines a one-to-many relationship: One Cohort -> Many Seasons.
  seasons     Season[] 
}

model Season {
  id          String   @id @default(cuid())
  title       String   // e.g., "The React Foundations"
  order       Int      // Used to sort seasons (1, 2, 3...)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // The Foreign Key: This links the Season back to its parent Cohort.
  cohortId    String
  cohort      Cohort   @relation(fields: [cohortId], references: [id])

  // A Season contains multiple Lessons (Quests).
  // Another one-to-many relationship: One Season -> Many Lessons.
  lessons     Lesson[]
}

model Lesson {
  id          String     @id @default(cuid())
  title       String     // e.g., "Understanding useEffect"
  description String?
  order       Int        // Used to sort lessons within a season
  duration    Int        // Estimated time in minutes
  lessonType  LessonType // Uses the enum we defined above
  videoUrl    String?    // Only needed if lessonType is VIDEO
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  // The Foreign Key: Links the Lesson back to its parent Season.
  seasonId    String
  season      Season     @relation(fields: [seasonId], references: [id])
}
```

### Why This Nested Structure?

As a frontend dev, you might wonder: *Why not just dump all lessons directly inside the Cohort in a giant JSON array?* 

In a relational database (like PostgreSQL, which Prisma usually talks to), data is flat. We don't nest arrays directly. Instead, we use **Foreign Keys** (`cohortId`, `seasonId`) to point child records to their parents.

1. **Scalability:** If a Cohort has 500 lessons, fetching the entire Cohort document every time just to show the title is terribly slow. With relations, we fetch exactly what we need, when we need it.
2. **Data Integrity:** If you delete a Season, Prisma knows exactly which Lessons belong to it and can handle the cleanup automatically.
3. **Structured Paging (The "Questline"):** Breaking the journey into Seasons gives us a natural way to group UI elements. We can query "just Season 1's lessons" without loading the whole Cohort.

## 2. Fetching the Data with Prisma Client

When you're writing a Next.js API route or Server Component, you need to query this data. Prisma generates a type-safe query client for us. 

To fetch a Cohort along with all its Seasons and Lessons, correctly ordered, we use the `include` keyword. This is Prisma's way of doing SQL "JOINs" for you.

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getFullCohort(cohortId: string) {
  const cohort = await prisma.cohort.findUnique({
    where: { 
      id: cohortId 
    },
    // The 'include' block tells Prisma to fetch the related nested data
    include: {
      seasons: {
        // Order seasons by their 'order' field ascending (1, 2, 3)
        orderBy: {
          order: 'asc',
        },
        include: {
          lessons: {
            // Order lessons within each season
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
    },
  });

  return cohort;
}
```

### Understanding the Output

The `getFullCohort` function returns an object that perfectly matches the nested structure you need for your frontend state! It will look exactly like this:

```typescript
{
  id: "cl...1",
  title: "Fullstack React Developer",
  // ...other cohort fields
  seasons: [
    {
      id: "cl...2",
      title: "The React Foundations",
      order: 1,
      lessons: [
        {
          id: "cl...3",
          title: "Understanding useEffect",
          order: 1,
          lessonType: "VIDEO",
          // ...other lesson fields
        }
      ]
    }
  ]
}
```

Because Prisma knows our schema, **TypeScript knows the exact shape of this object.** You don't have to manually write an interface for `cohort.seasons[0].lessons[0].title`—Prisma infers it natively.

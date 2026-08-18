# Phase 6: Migrating Mock Data to Real API Calls

Welcome to Phase 6. So far, you've set up the database schemas, created repositories to talk to the database, and defined the business logic. But the frontend of SideQuestHQ is still blissfully ignorant. It's still talking to `localStorage` and reading from hardcoded mock files in `src/client/mock/`.

Now it's time to connect the dots. We need to point the frontend to your shiny new backend.

As a frontend expert, you already know the UI. You know the components, the props, and how they render. The challenge now is replacing the *source* of that data without breaking the application in the process.

This document is your comprehensive deep-dive into the Migration Pattern. By the end of this guide, you will be able to take any screen in the app, track down its mock data, and confidently wire it up to your real database.

---

## 1. The Migration Strategy — Why Slow is Fast

When migrating an application from mock data to a real backend, there's a strong temptation to say, "I'm just going to rewrite all the data fetching at once."

**The Wrong Approach: The Big Bang Rewrite**
You delete all the mock files. The app turns red. You spend a week writing API routes and updating React components. The app stays red for 6 days. On day 7, maybe it works, but you're exhausted, and tracking down regressions is a nightmare because *everything* changed at once.

**The Right Approach: The Strangler Fig Pattern**
We use the "Strangler Fig" pattern (named after a tree that grows around another tree, eventually replacing it entirely). We replace the data source piece by piece, route by route, component by component. The application *always works*.

Here is our priority order for SideQuestHQ:
1. **Auth:** (Usually first, so requests have user context).
2. **Cohort Publish:** Creating data is often easier to test first.
3. **Cohort List (Explore):** Viewing the data you just created.
4. **Cohort Detail:** Viewing specific data.
5. **Notes & Interactions:** Leaving notes, enrolling.
6. **The Feed:** The most complex, aggregating data.

**The Definition of "Done" for a Migration:**
A migration for a specific feature is only "done" when:
1. The frontend reads from the real API.
2. The UI looks and behaves exactly as it did before.
3. **The old mock file is deleted.** (This is crucial to prevent zombie code).

---

## 2. The API Contract Pattern — The Most Important Concept

Your frontend components (Next.js pages, React components) expect data in a specific shape. This is defined by TypeScript interfaces.
Your database returns data in a specific shape. This is defined by the Prisma schema.

**These two shapes rarely match perfectly.**

If you send raw Prisma objects straight to the frontend, you will break the frontend. The frontend expects `{ creator: { name: "Alice" } }`, but Prisma returns `{ creatorId: "123" }`.

**The Solution: The API Contract**
The API Contract is the agreed-upon shape of the JSON that travels over the network. Both the frontend and the backend must agree to this contract.

We enforce this contract using shared TypeScript types.

1. Create a directory: `src/shared/api/`
2. Define the exact shape the frontend needs.
3. The backend API route *promises* to return this shape.
4. The frontend *trusts* it will receive this shape.

When the database shape differs from the API Contract shape, we use an **Adapter** on the backend to transform the data before sending it. We'll cover adapters in depth later.

---

## 3. Anatomy of a Perfect API Route

In Next.js App Router, API routes live in `src/app/api/.../route.ts`. Let's look at a perfectly structured POST route for publishing a cohort.

```typescript
// src/app/api/cohort/publish/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/auth.utils';
import { cohortRepository } from '@/server/repositories/cohort.repository';
import { cohortToApiContract } from '@/server/adapters/cohort.adapter';

// 1. Define the Expected Input Shape (Validation)
const PublishCohortSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  visibility: z.enum(['PUBLIC', 'PRIVATE']),
});

export async function POST(request: Request) {
  try {
    // 2. Auth Check - Who is making this request?
    const user = await requireUser();
    if (!user) {
      // 401 Unauthorized: The user is not logged in
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Parse and Validate the Request Body
    const body = await request.json();
    const parsedData = PublishCohortSchema.safeParse(body);
    
    if (!parsedData.success) {
      // 400 Bad Request: The client sent invalid data
      return NextResponse.json({ 
        error: 'Invalid data', 
        details: parsedData.error.format() 
      }, { status: 400 });
    }

    // 4. Call the Repository (Database Logic)
    const newCohort = await cohortRepository.create({
      ...parsedData.data,
      creatorId: user.id,
    });

    // 5. Transform Result to API Contract (Adapter)
    const responseData = cohortToApiContract(newCohort);

    // 6. Return JSON Response (201 Created)
    return NextResponse.json(responseData, { status: 201 });

  } catch (error) {
    // 7. Error Handling
    console.error('Failed to publish cohort:', error);
    
    // 500 Internal Server Error
    // Security Rule: NEVER return the raw 'error' object or stack trace to the client.
    return NextResponse.json({ 
      error: 'An unexpected error occurred while publishing the cohort.' 
    }, { status: 500 });
  }
}
```

### HTTP Status Codes You Need to Know:
As a frontend developer, you're used to seeing these in DevTools. Now you're the one throwing them.
- **200 OK:** GET requests, successful updates.
- **201 Created:** Successful POST requests that created a new resource.
- **400 Bad Request:** The frontend sent bad data (failed Zod validation).
- **401 Unauthorized:** The user is not logged in.
- **403 Forbidden:** Logged in, but trying to edit someone else's data.
- **404 Not Found:** Trying to fetch a cohort that doesn't exist.
- **500 Internal Server Error:** The database crashed, or your code threw an exception.

### The Try/Catch Pattern
Every single API route should be wrapped in a `try/catch` block. If the database goes down, your app should return a graceful 500 error, not crash the entire Node process. Never leak stack traces in the 500 response, as they can reveal database structure or sensitive logic to attackers.

---

## 4. Updating the Client Repository

Your frontend components currently talk to client-side repositories (e.g., `src/client/repositories/cohortRepository.ts`), which in turn read from mock files or localStorage.

We need to update these repositories to make real network requests using `fetch`.

**Before (The Mock Implementation):**
```typescript
// src/client/repositories/cohortRepository.ts (OLD)
import { mockCohorts } from '../mock/cohorts/cohortCatalog';

export const cohortRepository = {
  getExploreCohorts: async () => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockCohorts.filter(c => c.isPublished);
  }
};
```

**After (The Real Implementation):**
```typescript
// src/client/repositories/cohortRepository.ts (NEW)
import { CohortSummaryResponse } from '@/shared/api/cohort.types';

export const cohortRepository = {
  getExploreCohorts: async (): Promise<CohortSummaryResponse[]> => {
    const res = await fetch('/api/cohorts/explore', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch explore cohorts');
    }

    return res.json();
  }
};
```

Notice how clean the new implementation is. It simply makes the `fetch` call, checks `res.ok`, and throws a standard error if it fails. The React components will catch this error (usually via React Query).

---

## 5. The `src/shared/api/` Types

This is the glue between your frontend and backend.

Create a directory `src/shared/api/`. Inside, create files for each domain area, for example, `cohort.types.ts`.

```typescript
// src/shared/api/cohort.types.ts

// This is the shape the frontend Explore page needs
export interface CohortSummaryResponse {
  id: string;
  title: string;
  thumbnailUrl: string;
  creator: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  metrics: {
    explorerCount: number;
    rating: number;
  };
}

// This is the shape the frontend Cohort Detail page needs
export interface CohortDetailResponse extends CohortSummaryResponse {
  description: string;
  modules: {
    id: string;
    title: string;
    completed: boolean;
  }[];
}
```

**Rule of Thumb:** Import these types in *both* your API route (`NextResponse.json<CohortSummaryResponse[]>(...)`) and your client repository (`Promise<CohortSummaryResponse[]>`). This guarantees that if you change a property name on the backend, the frontend build will immediately fail and tell you exactly where to fix it.

---

## 6. Migration #1: Cohort Publish Route (Detailed Walkthrough)

Let's walk through replacing a specific flow.

**The Setup:**
Currently, when a user clicks "Publish" on a draft cohort, the frontend calls the mock `cohortRepository.publish()`, which updates localStorage and returns a fake success message.

**Step 1: The API Route**
We write `src/app/api/cohort/publish/route.ts` (as shown in section 3). It saves data to Postgres using Prisma.

**Step 2: The Client Repository**
Update `src/client/repositories/cohortRepository.ts`:

```typescript
export const cohortRepository = {
  // ...
  publishCohort: async (data: PublishPayload) => {
    const res = await fetch('/api/cohort/publish', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to publish');
    return res.json();
  }
}
```

**Step 3: The React Component (Using React Query)**
Find the component where the Publish button lives.

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cohortRepository } from '@/client/repositories/cohortRepository';

export function PublishButton({ cohortDraftData }) {
  const queryClient = useQueryClient();

  const publishMutation = useMutation({
    mutationFn: (data) => cohortRepository.publishCohort(data),
    onSuccess: () => {
      // Tell React Query to refetch the cohorts list, because we just added one!
      queryClient.invalidateQueries({ queryKey: ['cohorts', 'explore'] });
      // Redirect to the success page or show a toast
      toast.success('Cohort Published!');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  return (
    <button 
      onClick={() => publishMutation.mutate(cohortDraftData)}
      disabled={publishMutation.isPending}
    >
      {publishMutation.isPending ? 'Publishing...' : 'Publish'}
    </button>
  );
}
```

**Step 4: Verify with Prisma Studio**
Start the frontend, click publish. Then run `npx prisma studio` in your terminal. Look in the `Cohort` table. Did the new row appear? Does it have the correct `creatorId`? Yes? The migration is complete.

---

## 7. Migration #2: Cohort List for Explore

Now that we can publish, let's view them on the Explore page.

**Step 1: The API Route (`GET /api/cohorts/explore`)**

```typescript
// src/app/api/cohorts/explore/route.ts
import { NextResponse } from 'next/server';
import { cohortRepository } from '@/server/repositories/cohort.repository';
import { toCohortSummary } from '@/server/adapters/cohort.adapter';

export async function GET() {
  try {
    // 1. Fetch from DB
    const cohorts = await cohortRepository.findPublished();
    
    // 2. Adapt to API Contract
    const safeCohorts = cohorts.map(toCohortSummary);
    
    // 3. Return
    return NextResponse.json(safeCohorts);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch cohorts' }, { status: 500 });
  }
}
```

**Step 2: The React Component**

```tsx
import { useQuery } from '@tanstack/react-query';
import { cohortRepository } from '@/client/repositories/cohortRepository';

export function ExplorePage() {
  const { data: cohorts, isLoading, isError } = useQuery({
    queryKey: ['cohorts', 'explore'],
    queryFn: () => cohortRepository.getExploreCohorts(),
  });

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <ErrorMessage text="Failed to load Explore page" />;
  if (!cohorts || cohorts.length === 0) return <EmptyState />;

  return (
    <div className="grid">
      {cohorts.map(cohort => <CohortCard key={cohort.id} cohort={cohort} />)}
    </div>
  );
}
```

**Step 3: Delete the Mock Data**
Delete `src/client/mock/cohorts/cohortCatalog.ts`.

---

## 8. Seed Scripts — Getting Test Data In

You just migrated the Explore page, but when you load it, it's empty! Why? Because your local Postgres database is brand new and empty. 

You need test data. We do this using Prisma Seeds.

1. Create `prisma/seed.ts`.
2. Look at your old mock files (`mockCohorts`). Recreate a few of those records in the seed script using real database writes.

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // 1. Create a test user
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'Test Explorer',
    },
  });

  // 2. Create a test cohort
  await prisma.cohort.create({
    data: {
      title: 'Advanced React Patterns',
      description: 'Master React performance and patterns.',
      isPublished: true,
      creatorId: user.id,
      // ... other fields
    }
  });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Add this to `package.json`:
```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```
Run `npx prisma db seed` whenever you wipe your database and need test data again.

---

## 9. Error Handling — Making Your App Resilient

When dealing with mock data, it always loads instantly and never fails. Real networks fail. Databases time out.

**Backend Rules:**
- Always return a standard error shape: `{ error: string, details?: any }`
- Never return 200 OK if something failed. The frontend relies on status codes (`!res.ok`) to trigger error states.

**Frontend Rules:**
- Always handle the `isError` state from React Query.
- Never let the user stare at a blank screen. If the feed fails to load, show a nice `<div>Oops, couldn't load the feed right now. [Retry]</div>`.
- You already have an `EmptyState` component. Re-use it for error states with a slightly different message!

---

## 10. The Adapter Layer in Practice

Let's look at why Adapters are necessary and how to write them.

Prisma joins relations. A Prisma Cohort object with its creator included might look like this:

```typescript
// Prisma output
const prismaCohort = {
  id: "c1",
  title: "React 101",
  creatorId: "u1", // Raw foreign key
  creator: {       // Joined relation
    id: "u1",
    name: "Alice",
    email: "alice@test.com", // SENSITIVE DATA!
    hashedPassword: "...",   // SENSITIVE DATA!
  },
  // ... timestamps, internal flags
}
```

If we send this directly to the frontend, we are leaking the user's email and password hash to every person who visits the Explore page!

**The Adapter fixes this:**

```typescript
// src/server/adapters/cohort.adapter.ts
import { CohortSummaryResponse } from '@/shared/api/cohort.types';

// The input type should ideally be generated from Prisma (e.g., Prisma.CohortGetPayload<{include: {creator: true}}>)
export function toCohortSummary(prismaData: any): CohortSummaryResponse {
  return {
    id: prismaData.id,
    title: prismaData.title,
    thumbnailUrl: prismaData.thumbnailUrl || '/default-thumb.jpg',
    
    // We hand-pick exactly what to expose about the creator
    creator: {
      id: prismaData.creator.id,
      name: prismaData.creator.name,
      avatarUrl: prismaData.creator.avatarUrl || '/default-avatar.jpg',
    },
    
    // We can compute metrics on the fly if needed
    metrics: {
      explorerCount: prismaData._count?.explorers || 0,
      rating: 5.0, // Placeholder until ratings are implemented
    }
  };
}
```

Adapters are pure functions. They take data in, and return a clean, strictly-typed object out. They have no side effects and don't talk to the database, making them incredibly easy to test.

---

## 11. React Query Integration — The Complete Pattern

You are already using `@tanstack/react-query`. Here's a quick refresher on the patterns you'll use constantly during migration.

**Query Keys (`['cohorts', 'explore']`)**
Query keys are how React Query caches data. Think of them like keys in a dictionary.
- Fetching all cohorts: `['cohorts']`
- Fetching user's drafts: `['cohorts', 'drafts']`
- Fetching specific cohort: `['cohort', '123']`

**Invalidation (`queryClient.invalidateQueries`)**
When you run a `useMutation` (e.g., deleting a cohort), the cache for `['cohorts']` is now stale. You must invalidate it so React Query knows to refetch.

```tsx
const deleteMutation = useMutation({
  mutationFn: (id) => fetch(`/api/cohorts/${id}`, { method: 'DELETE' }),
  onSuccess: () => {
    // Force refetch of the list
    queryClient.invalidateQueries({ queryKey: ['cohorts'] });
  }
});
```

---

## 12. The Full Migration Checklist

For EVERY screen you migrate, run through this list:

- [ ] **Identify the mock:** Where is the data currently coming from? (e.g., `mockCohorts.ts`)
- [ ] **DB Check:** Does the Prisma schema support this data? If not, update `schema.prisma` and run `prisma db push`.
- [ ] **Define Contract:** Create/Update types in `src/shared/api/`.
- [ ] **Write Backend Logic:** Create the repository function (`find...`) and the Adapter.
- [ ] **Create API Route:** Write the GET/POST route. Test it with Postman or curl.
- [ ] **Update Frontend Repo:** Change the `src/client/repositories/...` file to use `fetch()`.
- [ ] **Component Update:** Ensure the component uses `useQuery` or `useMutation` properly.
- [ ] **Seed Data:** Add relevant test data to `prisma/seed.ts` if needed.
- [ ] **Delete Mock:** DELETE the old mock file.
- [ ] **Verify:** Run the app. Does the screen look identical to before?

You are now ready to migrate the frontend to the real backend. Pick the easiest screen (usually a list view like Explore), and start connecting the pipes!

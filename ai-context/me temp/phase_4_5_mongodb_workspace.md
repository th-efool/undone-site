# Phase 4 & 5: Deep Dive into MongoDB, Mongoose, and the UserWorkspace

Welcome to Phases 4 and 5! Up until now, you've been working with Postgres and Prisma to handle the "canonical" relational data—things like `Users`, `Cohorts`, `Lessons`, etc. 

Now, we're shifting gears. For data that is highly unstructured, nested, or specific to an individual user's state (like their Excalidraw canvases, personal notes, AI chat memories, and UI settings), we are going to use **MongoDB**. 

This document is your definitive guide to bridging the gap between your frontend expertise and backend data persistence using MongoDB and Mongoose in a Next.js 16 environment. 

---

## PART A: PHASE 4 — MongoDB + Mongoose Connection

### 1. MongoDB Fundamentals — For Someone Who Knows SQL

Since you've been using Postgres, let's map what you know to MongoDB.

**The Postgres Way (Rigid & Structured):**
- **Databases** contain **Tables**.
- **Tables** contain **Rows**.
- **Rows** contain **Columns**.
- Every row in a table *must* have the exact same columns. If you add a column, it applies to every row.

**The MongoDB Way (Flexible & Document-Based):**
- **Databases** contain **Collections**.
- **Collections** contain **Documents**.
- **Documents** contain **Fields**.
- A "document" is effectively just a JSON object (stored as BSON, Binary JSON, under the hood).
- **Documents in the same collection can have completely different shapes.** One document might have 3 fields, and another might have 50.

#### When is MongoDB BETTER than Postgres?
1. **Rapidly Evolving Schemas:** When building new features (like user settings or AI memory), you often don't know the final shape of the data. MongoDB lets you iterate without writing massive SQL migration files every time you add a field.
2. **Naturally Nested Data:** If a user has a complex workspace with canvases, notes, and preferences, in SQL you'd need 4 separate tables and expensive `JOIN` operations to get that data. In MongoDB, you can nest it all within a single document and retrieve it instantly.
3. **Sparse Data:** If User A has 50 canvases and User B has 0, MongoDB handles this effortlessly without a bunch of `NULL` columns or empty relational tables.

#### When is MongoDB WORSE?
- When you need strict ACID compliance across multiple disparate collections (like financial ledgers).
- When you need highly complex, multi-table `JOIN`s for reporting and analytics.

---

### 2. Mongoose vs Raw MongoDB Driver

You *can* talk to MongoDB directly using the official `mongodb` Node.js driver.
```typescript
// Raw Driver Example
db.collection('workspaces').findOne({ userId: '123' })
```
The problem? **Zero type safety and zero validation.** You could accidentally insert `{ usreId: "123" }` (typo!) and the raw driver would happily save it.

Enter **Mongoose**. Mongoose is an Object Data Modeling (ODM) library for MongoDB and Node.js. It's similar to how Prisma works for Postgres, but specifically tailored for MongoDB's document structure.

**What Mongoose Gives You:**
- **Schemas:** You define the structure of your data. While MongoDB itself doesn't enforce schemas, Mongoose does it at the application layer *before* the data hits the database.
- **TypeScript Integration:** You get proper types for your queries and results.
- **Virtuals & Hooks:** You can compute properties on the fly or run functions before saving.

*Analogy:* If MongoDB is a lawless wasteland where you can build anything, Mongoose is the city planner that ensures your buildings are up to code before construction begins.

---

### 3. The Connection Client — Why the Singleton Pattern?

In Next.js, hot-module replacement (HMR) during development re-executes your files every time you save. If you blindly connect to the database on file load, Next.js will spin up hundreds of connections to MongoDB, quickly hitting your Atlas connection limits (the free tier allows 100 connections).

To prevent this, we use the **Singleton Pattern** via the global scope. We cache the connection promise globally so that it persists across hot reloads.

Here is what your `src/server/infrastructure/db/mongodb/client.ts` should look like:

```typescript
// src/server/infrastructure/db/mongodb/client.ts
import mongoose from 'mongoose';

// 1. Get the connection string from environment variables
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

// 2. Define the shape of our global mongoose cache
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// 3. Attach the cache to the global object.
// In TypeScript, we have to extend the NodeJS.Global interface slightly
declare global {
  var mongooseCache: MongooseCache;
}

// Initialize the cache if it doesn't exist (first run)
let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

export async function connectToMongoDB() {
  // 4. If we already have a connection, return it immediately
  if (cached.conn) {
    return cached.conn;
  }

  // 5. If we don't have a promise currently resolving, create one
  if (!cached.promise) {
    const opts = {
      // bufferCommands: false means Mongoose will throw an error immediately 
      // if you try to query before the connection is established, 
      // rather than queuing the query indefinitely.
      bufferCommands: false, 
    };

    cached.promise = mongoose.connect(MONGODB_URI as string, opts).then((mongoose) => {
      console.log('✅ Connected to MongoDB via Mongoose');
      return mongoose;
    });
  }

  try {
    // 6. Await the promise and store the actual connection
    cached.conn = await cached.promise;
  } catch (e) {
    // If it fails, clear the promise so we can try again next time
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
```

#### Line-by-Line Highlight:
- `global.mongooseCache`: This survives Next.js hot reloads.
- `bufferCommands: false`: By default, Mongoose hides connection errors by queuing your queries until a connection is made. If the connection fails, your app just hangs. Setting this to `false` ensures it fails fast with a clear error.

---

### 4. Why You Call `connectToMongoDB()` in Every Repo Function

Because Next.js runs as a Serverless environment in production (Vercel/AWS), your server doesn't stay alive forever. It spins up, handles a request, and shuts down. 

Therefore, **you cannot rely on a persistent connection pool.** 

Instead, you must ensure the connection is active right before you query. 

```typescript
// Inside some repository function:
export async function getUserData() {
  await connectToMongoDB(); // <-- ALWAYS do this first
  return await UserModel.find({});
}
```

Don't worry about performance! `mongoose.connect()` is incredibly smart. If the connection is already active, it resolves instantly (thanks to our Singleton cache). It's essentially a free check.

---

## PART B: PHASE 5 — UserWorkspace Model

### 5. Design Philosophy: One Document Per User

In Postgres, you would likely have a `Users` table, a `Canvases` table, a `Notes` table, and a `Settings` table. Fetching a user's entire workspace requires a complex `JOIN`.

**In MongoDB, we embrace the power of nesting.** 

We will create a single `UserWorkspace` collection. Each document in this collection represents the *entirety* of a user's unstructured state. 

**Why?**
1. **Performance:** Fetching a user's entire workspace takes exactly one lightning-fast database query.
2. **Simplicity:** No need to manage foreign keys across 5 different collections.

**The Tradeoff:**
MongoDB has a hard limit of **16MB** per document. 
Is 16MB enough? Yes. A massive string of text (like a note) is just a few kilobytes. A user would need to write hundreds of novels to hit 16MB. 

*Exception:* The only time you shouldn't nest is if an array grows unboundedly. For example, if we track *every single click* a user makes, that array will eventually breach 16MB. We handle this later by using `$slice` to cap our arrays (e.g., only keeping the last 100 viewed items).

---

### 6. Mongoose Schema vs TypeScript Interface

To make Mongoose work well with TypeScript, you have to define the shape of your data **twice**:
1. The **TypeScript Interface**: Tells your IDE and compiler what the data looks like.
2. The **Mongoose Schema**: Tells the runtime validator what the data looks like when saving to the database.

Here is the setup for `src/server/infrastructure/db/mongodb/models/UserWorkspace.ts`:

```typescript
import mongoose, { Schema, Document } from 'mongoose';

// 1. The TypeScript Interfaces
export interface ICanvas {
  id: string; // Excalidraw's internal ID
  elements: any[]; // The drawing data (too complex to strictly type)
  appState: Record<string, any>; // Camera zoom, scroll, etc.
  updatedAt: Date;
}

export interface INote {
  id: string;
  title: string;
  content: string; // Markdown or rich text
  updatedAt: Date;
}

export interface IWorkspaceSettings {
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
}

// The main document interface
export interface IUserWorkspace extends Document {
  userId: string; // References the Postgres User ID
  settings: IWorkspaceSettings;
  canvases: ICanvas[];
  notes: INote[];
  aiMemory: Record<string, any>; // Flexible JSON for AI state
  recentViews: string[]; // IDs of recently viewed lessons/cohorts
  createdAt: Date;
  updatedAt: Date;
}

// 2. The Mongoose Schemas
const CanvasSchema = new Schema<ICanvas>({
  id: { type: String, required: true },
  elements: { type: Schema.Types.Mixed, default: [] }, // Mixed = "Accept any JSON"
  appState: { type: Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false }); // We use Excalidraw's ID, we don't need a Mongo ObjectId here

const NoteSchema = new Schema<INote>({
  id: { type: String, required: true },
  title: { type: String, default: 'Untitled Note' },
  content: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const WorkspaceSettingsSchema = new Schema<IWorkspaceSettings>({
  theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
  sidebarOpen: { type: Boolean, default: true }
}, { _id: false });

const UserWorkspaceSchema = new Schema<IUserWorkspace>({
  userId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true // Creates a fast lookup B-Tree index for this field
  },
  settings: { type: WorkspaceSettingsSchema, default: () => ({}) },
  canvases: { type: [CanvasSchema], default: [] },
  notes: { type: [NoteSchema], default: [] },
  aiMemory: { type: Schema.Types.Mixed, default: {} },
  recentViews: { type: [String], default: [] }
}, {
  timestamps: true, // Automatically manages createdAt and updatedAt
});

// 3. The "Next.js Hot Reload" Model Registration
export const UserWorkspace = mongoose.models.UserWorkspace || mongoose.model<IUserWorkspace>('UserWorkspace', UserWorkspaceSchema);
```

### 7. Subdocuments vs Nested Objects vs References

Notice how we built the schema:
- **Subdocuments (`canvases`, `notes`):** These are arrays of objects. We define a separate schema (`CanvasSchema`) and embed it. We explicitly set `{ _id: false }` because we want to use the IDs generated by the frontend (like Excalidraw's random IDs) rather than MongoDB's automatic ObjectIds.
- **Nested Objects (`settings`):** A single object.
- **Flexible JSON (`Schema.Types.Mixed`):** Used for `aiMemory` and `elements`. This tells Mongoose "Skip validation, just save whatever JSON object I give you." Perfect for unstructured data.

### 8. The `mongoose.models` Pattern

Look at the very last line of the file:
```typescript
export const UserWorkspace = mongoose.models.UserWorkspace || mongoose.model<IUserWorkspace>('UserWorkspace', UserWorkspaceSchema);
```
Just like the database connection, Next.js will run this file multiple times in dev mode. If you just do `mongoose.model('UserWorkspace', schema)`, the second time the file runs, Mongoose will throw a fatal error: `Cannot overwrite model once compiled`.

The `mongoose.models.UserWorkspace ||` check ensures we only compile the model once.

---

### 9. The Workspace Repository — Every Function Explained

Now we write the functions that actually manipulate this data. Create `src/server/infrastructure/db/mongodb/repositories/workspace.repo.ts`.

This is where MongoDB truly shines. We use specific **MongoDB Operators** (`$set`, `$push`, `$pull`) to manipulate nested data without having to fetch the entire document first.

```typescript
import { connectToMongoDB } from '../client';
import { UserWorkspace, ICanvas, INote } from '../models/UserWorkspace';

export class WorkspaceRepository {
  
  /**
   * 1. GET OR CREATE WORKSPACE
   * Called when a user logs in. If they don't have a workspace, initialize one.
   */
  static async getOrCreateWorkspace(userId: string) {
    await connectToMongoDB();
    
    // findOneAndUpdate with upsert: true and $setOnInsert
    // If it exists, return it. If not, create it using the defaults.
    return UserWorkspace.findOneAndUpdate(
      { userId }, // The query
      { $setOnInsert: { userId } }, // What to do if creating new
      { new: true, upsert: true } // Options: return the new doc, allow insert
    );
  }

  /**
   * 2. SAVE CANVAS (The Upsert Pattern for Arrays)
   * We want to update a specific canvas in the array. 
   * If it doesn't exist, we add it.
   */
  static async saveCanvas(userId: string, canvasData: ICanvas) {
    await connectToMongoDB();

    // Step 1: Try to update the existing canvas in the array
    const result = await UserWorkspace.updateOne(
      { userId, 'canvases.id': canvasData.id }, // Find the exact canvas
      { 
        $set: { 
          'canvases.$': canvasData // $ refers to the matched array element
        } 
      }
    );

    // Step 2: If no canvas was found to update, it's a new canvas. Push it.
    if (result.matchedCount === 0) {
      await UserWorkspace.updateOne(
        { userId },
        { $push: { canvases: canvasData } }
      );
    }
  }

  /**
   * 3. GET NOTES (Projection)
   * Don't fetch the 10MB of canvas data if the user just wants their notes list.
   */
  static async getNotesList(userId: string) {
    await connectToMongoDB();

    // The second argument is the "Projection". 
    // { notes: 1 } means "ONLY return the notes field, exclude everything else"
    const workspace = await UserWorkspace.findOne({ userId }, { notes: 1 }).lean();
    return workspace?.notes || [];
  }

  /**
   * 4. TRACK VIEW (The Bounded Array Pattern)
   * When a user views a lesson, add it to history.
   * We use $pull and $push to avoid duplicates and ensure recent ones are at the end.
   */
  static async trackRecentView(userId: string, itemId: string) {
    await connectToMongoDB();

    await UserWorkspace.updateOne(
      { userId },
      {
        // 1. Remove it if it already exists (so we can move it to the front)
        $pull: { recentViews: itemId }
      }
    );

    await UserWorkspace.updateOne(
      { userId },
      {
        $push: { 
          recentViews: {
            $each: [itemId], // The item to add
            $slice: -100 // MAGIC: Only keep the LAST 100 items in the array!
          }
        }
      }
    );
  }

  /**
   * 5. UPDATE SETTINGS (Dynamic Dot Notation)
   */
  static async updateSettings(userId: string, settingsUpdate: Partial<Record<string, any>>) {
    await connectToMongoDB();

    // Convert { theme: 'dark' } into { 'settings.theme': 'dark' }
    // This allows us to update nested fields without overwriting the whole settings object
    const updateObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(settingsUpdate)) {
      updateObj[`settings.${key}`] = value;
    }

    await UserWorkspace.updateOne(
      { userId },
      { $set: updateObj }
    );
  }
}
```

#### MongoDB Operators Explained:
- `$set`: Modifies specific fields without touching others.
- `$setOnInsert`: Only applies if a new document is being created (avoids overwriting data during an upsert).
- `$push`: Adds an item to an array.
- `$pull`: Removes an item from an array that matches a condition.
- `$each`: Used with `$push` to push multiple items, or to enable modifiers like `$slice`.
- `$slice`: Capping arrays. `$slice: -100` means "keep the last 100 items". This is how we prevent our document from ever hitting the 16MB limit!
- `$`: The positional operator. In `'canvases.$'`, it means "the index of the array that matched our query". 

---

### 10. Indexing in MongoDB

In our schema, we defined:
```typescript
userId: { type: String, required: true, unique: true, index: true }
```

**Why this matters:**
Imagine a phonebook. If it's not alphabetized, and you want to find "John Smith", you have to read every single page from page 1. This is a **Collection Scan**. It is incredibly slow and expensive.

An **Index** is like the alphabetized tabs on the side of the phonebook. It allows MongoDB to jump instantly to the exact document. 

Because *every single query* we run looks up the workspace via `userId`, making it an index is mandatory for performance. 

Setting `unique: true` creates a unique index at the database level, meaning it is mathematically impossible for two workspaces to exist with the same `userId`, preventing horrible race-condition bugs.

---

### 11. Testing MongoDB Queries

As a frontend dev, you are used to Chrome DevTools. For MongoDB, your "DevTools" is **MongoDB Compass** (a desktop app) or the **Atlas Web UI**. 

**Common Errors You Will See:**
1. `MongoServerError: E11000 duplicate key error collection`
   - **Meaning:** You tried to create a workspace with a `userId` that already exists.
2. `ValidationError: UserWorkspace validation failed: userId: Path \`userId\` is required.`
   - **Meaning:** Mongoose caught you trying to save a document without a required field. The database was never actually hit.
3. `CastError: Cast to ObjectId failed`
   - **Meaning:** You passed a string to a field that expects a MongoDB `ObjectId`, or vice versa.
4. `MongooseServerSelectionError`
   - **Meaning:** Your Next.js app cannot connect to Atlas. Check your `.env.local` `MONGODB_URI` and ensure your IP address is whitelisted in the Atlas Network Access panel.

---

### 12. Where the Frontend Connects

Right now, your Excalidraw canvas in `src/client/mobile/screens/Notes/` is saving state locally in React. When the user refreshes, it vanishes.

Here is how Phase 5 wires this up:

**1. The API Route:** Create `src/app/api/workspace/canvas/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { WorkspaceRepository } from '@/server/infrastructure/db/mongodb/repositories/workspace.repo';
// Assuming you have an auth middleware to get the user
import { getUserSession } from '@/server/auth'; 

export async function POST(req: Request) {
  try {
    const session = await getUserSession();
    if (!session) return new NextResponse('Unauthorized', { status: 401 });

    const canvasData = await req.json(); // Data from Excalidraw
    
    await WorkspaceRepository.saveCanvas(session.userId, canvasData);

    return NextResponse.json({ success: true });
  } catch (error) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}
```

**2. The Frontend Hook:**
In your frontend, you simply add a debounced fetch call to this API whenever the Excalidraw `onChange` event fires. 

```typescript
// Inside your Canvas component
const saveToDb = debounce(async (elements, appState) => {
  await fetch('/api/workspace/canvas', {
    method: 'POST',
    body: JSON.stringify({
      id: currentCanvasId,
      elements,
      appState
    })
  });
}, 2000); // Save every 2 seconds after they stop drawing
```

### Summary of Phases 4 & 5
You have successfully set up a resilient MongoDB connection, designed a highly flexible document schema for unstructured data, and written repository functions using advanced MongoDB operators. You now have the perfect backend foundation to store all user-specific state for the SideQuestHQ app!

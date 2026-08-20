import { prisma } from '../src/server/infrastructure/db/postgres/client';
import { connectToMongoDB } from '../src/server/infrastructure/db/mongodb/client';
import { UserWorkspace } from '../src/server/infrastructure/db/mongodb/models/UserWorkspace';
import { seedNotesState } from '../src/client/screens/dashboard/notes/mock/notes.seed';

const INITIAL_COLUMNS = [
  { id: 'todo',       label: 'To Do'       },
  { id: 'inprogress', label: 'In Progress' },
  { id: 'review',     label: 'Review'      },
  { id: 'done',       label: 'Done'        },
];

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

const INITIAL_CARDS: any[] = [
  { id: 1, column: 'todo',       label: 'Research competitors',    description: 'Analyze top 5 competitors and document key differentiators.', type: 'Research', priority: 'medium', updatedAt: daysAgo(2) },
  { id: 2, column: 'todo',       label: 'Write documentation',     description: 'Draft onboarding guide and API reference for the platform.',   type: 'Docs',     priority: 'low',    updatedAt: daysAgo(3) },
  { id: 3, column: 'inprogress', label: 'Implement Kanban board',  description: 'Integrate SVAR React Kanban with dark theme into Notes.',       type: 'Feature',  priority: 'high',   updatedAt: daysAgo(1) },
  { id: 4, column: 'inprogress', label: 'Design system tokens',    description: 'Define color, spacing, and typography tokens.',                type: 'UI',       priority: 'medium', updatedAt: daysAgo(2) },
  { id: 5, column: 'review',     label: 'Auth flow revamp',        description: 'Improve sign-in and sign-up UX based on user feedback.',        type: 'Auth',     priority: 'high',   updatedAt: daysAgo(4) },
  { id: 6, column: 'done',       label: 'Setup project structure', description: 'Scaffold Next.js app with TypeScript, ESLint, and Prettier.',   type: 'DevOps',   priority: 'low',    updatedAt: daysAgo(6) },
];

async function main() {
  console.log('Connecting to databases...');
  await connectToMongoDB();

  console.log('Finding guest user...');
  const user = await prisma.user.findUnique({
    where: { email: 'guest@sidequesthq.com' }
  });

  if (!user) {
    console.error('Guest user not found in Postgres!');
    process.exit(1);
  }

  console.log(`Found guest user with ID: ${user.id}`);

  // Create or update workspace
  const workspace = await UserWorkspace.findOneAndUpdate(
    { userId: user.id },
    {
      $set: {
        aiMemory: {
          notesState: seedNotesState,
        },
      },
    },
    { upsert: true, new: true }
  );

  let state = workspace.aiMemory?.notesState || seedNotesState;
  
  if (state && state.notes && state.notes.length > 0) {
      // Find the specific note to patch or just use the first one
      const targetNote = state.notes.find((n: any) => n.id === 'nb-ml-note-0') || state.notes[0];
      targetNote.kanbanColumns = INITIAL_COLUMNS;
      targetNote.kanbanCards = INITIAL_CARDS;
  }

  await UserWorkspace.updateOne(
      { userId: user.id },
      { $set: { 'aiMemory.notesState': state } }
  );

  console.log('Data seeded successfully!');
  process.exit(0);
}

main().catch(console.error);

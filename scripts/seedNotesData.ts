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

const INITIAL_CARDS: any[] = [];

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

  let state = seedNotesState;
  
  if (state && state.notes && state.notes.length > 0) {
      // Find the specific note to patch or just use the first one
      const targetNote = state.notes.find((n: any) => n.id === 'nb-ml-note-0') || state.notes[0];
      targetNote.kanbanColumns = INITIAL_COLUMNS;
      targetNote.kanbanCards = INITIAL_CARDS;
  }

  // Update root level notebooks, notes, tasks
  await UserWorkspace.updateOne(
      { userId: user.id },
      { 
        $set: { 
          notebooks: state.notebooks || [],
          notes: state.notes || [],
          tasks: [] // We can map INITIAL_CARDS to tasks here if we want, but letting them live in kanbanCards is fine for now
        } 
      },
      { upsert: true }
  );

  console.log('Data seeded successfully!');
  process.exit(0);
}

main().catch(console.error);

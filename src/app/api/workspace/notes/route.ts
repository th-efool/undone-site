import { NextResponse } from 'next/server';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { getUser } from '@/src/server/infrastructure/auth/getUser';

export async function GET() {
  try {
    const user = await getUser();
    if (!user || !user.id) return new NextResponse('Unauthorized', { status: 401 });

    const notebooks = await prisma.notebook.findMany({
      where: { userId: user.id },
      orderBy: { order: 'asc' },
    });

    const notes = await prisma.note.findMany({
      where: { notebook: { userId: user.id } },
      orderBy: { order: 'asc' },
    });

    const tasks = await prisma.task.findMany({
      where: { note: { notebook: { userId: user.id } } },
    });

    const mappedNotes = notes.map((note: any) => ({
      ...note,
      content: '', 
      publicLink: Boolean(note.publicLink),
      sharedWith: [],
      linkedConceptIds: [],
      linkedResourceIds: [],
      ownerId: null,
      learningPathId: null,
      revision: null,
    }));

    if (notebooks.length === 0) {
      const now = new Date().toISOString();
      return NextResponse.json({
        notebooks: [
          {
            id: 'nb-diary',
            title: 'SideQuestHQ diary',
            description: '',
            color: '#4f46e5',
            favorite: false,
            shared: false,
            archived: false,
            collapsed: false,
            createdAt: now,
            updatedAt: now,
            order: 0,
          },
        ],
        notes: [],
        tasks: [],
        selectedNotebookId: null,
        selectedNoteId: null,
        notebookSort: 'manual',
        noteSort: 'manual',
        filter: 'all'
      });
    }

    return NextResponse.json({
      notebooks,
      notes: mappedNotes,
      tasks,
      selectedNotebookId: null,
      selectedNoteId: null,
      notebookSort: 'manual',
      noteSort: 'manual',
      filter: 'all'
    });
  } catch (error) {
    console.error('Error in GET /api/workspace/notes:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getUser();
    if (!user || !user.id) return new NextResponse('Unauthorized', { status: 401 });

    const body = await request.json();
    const { notebooks = [], notes = [], tasks = [] } = body;

    const incomingNbIds = notebooks.map((n: any) => n.id);
    const incomingNoteIds = notes.map((n: any) => n.id);
    const incomingTaskIds = tasks.map((t: any) => t.id);

    await prisma.$transaction(async (tx: any) => {
      // 1. Fetch existing user-owned data to check ownership
      const existingNotebooks = await tx.notebook.findMany({ where: { userId: user.id }, select: { id: true } });
      const userNbIds = new Set(existingNotebooks.map((n: any) => n.id));

      const existingNotes = await tx.note.findMany({ where: { notebook: { userId: user.id } }, select: { id: true } });
      const userNoteIds = new Set(existingNotes.map((n: any) => n.id));

      const existingTasks = await tx.task.findMany({ where: { note: { notebook: { userId: user.id } } }, select: { id: true } });
      const userTaskIds = new Set(existingTasks.map((t: any) => t.id));

      // 2. Delete items absent from the payload but belonging to the user
      await tx.task.deleteMany({
        where: { note: { notebook: { userId: user.id } }, id: { notIn: incomingTaskIds } }
      });
      await tx.note.deleteMany({
        where: { notebook: { userId: user.id }, id: { notIn: incomingNoteIds } }
      });
      await tx.notebook.deleteMany({
        where: { userId: user.id, id: { notIn: incomingNbIds } }
      });

      const validNbIds = new Set([...userNbIds, ...incomingNbIds]);
      const validNoteIds = new Set([...userNoteIds, ...incomingNoteIds]);

      // 3. Update or Create with ownership checks using Promise.all to avoid N+1
      await Promise.all(notebooks.map((nb: any) => {
        const data = {
          title: nb.title || 'Untitled',
          description: nb.description || null,
          color: nb.color || null,
          icon: nb.icon || null,
          favorite: nb.favorite || false,
          shared: nb.shared || false,
          archived: nb.archived || false,
          collapsed: nb.collapsed || false,
          order: nb.order || 0,
        };
        if (userNbIds.has(nb.id)) {
          return tx.notebook.update({ where: { id: nb.id }, data });
        } else {
          return tx.notebook.create({ data: { id: nb.id, userId: user.id, ...data } });
        }
      }));

      await Promise.all(notes.filter((n: any) => n.notebookId && validNbIds.has(n.notebookId)).map((note: any) => {
        const data = {
          notebookId: note.notebookId,
          title: note.title || 'Untitled Note',
          tags: note.tags || [],
          favorite: note.favorite || false,
          shared: note.shared || false,
          archived: note.archived || false,
          publicLink: Boolean(note.publicLink),
          permission: note.permission || 'editor',
          contentType: note.contentType || 'markdown',
          order: note.order || 0,
        };
        if (userNoteIds.has(note.id)) {
          return tx.note.update({ where: { id: note.id }, data });
        } else {
          return tx.note.create({ data: { id: note.id, ...data } });
        }
      }));

      await Promise.all(tasks.filter((t: any) => t.noteId && validNoteIds.has(t.noteId)).map((task: any) => {
        const data = {
          noteId: task.noteId,
          title: task.title || null,
          label: task.label || null,
          description: task.description || null,
          dueDate: task.dueDate ? new Date(task.dueDate) : null,
          status: task.status || null,
          priority: task.priority || null,
        };
        if (userTaskIds.has(task.id)) {
          return tx.task.update({ where: { id: task.id }, data });
        } else {
          return tx.task.create({ data: { id: task.id, ...data } });
        }
      }));
    });

    return NextResponse.json(body);
  } catch (error) {
    console.error('Error in PATCH /api/workspace/notes:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { WorkspaceRepository } from '@/src/server/infrastructure/db/mongodb/repositories/workspace.repo';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { seedNotesState } from '@/src/client/screens/dashboard/notes/mock/notes.seed';

export async function GET() {
  try {
    const user = await getUser();
    if (!user || !user.id) return new NextResponse('Unauthorized', { status: 401 });

    const state = await WorkspaceRepository.getNotesState(user.id);
    if (!state) {
      return NextResponse.json(seedNotesState);
    }
    return NextResponse.json(state);
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
    await WorkspaceRepository.saveNotesState(user.id, body);
    
    return NextResponse.json(body);
  } catch (error) {
    console.error('Error in PATCH /api/workspace/notes:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

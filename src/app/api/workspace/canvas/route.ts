import { NextResponse } from 'next/server';
import { WorkspaceRepository } from '@/src/server/infrastructure/db/mongodb/repositories/workspace.repo';
import { getUser } from '@/src/server/infrastructure/auth/getUser';

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user || !user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canvasData = await req.json();
    const canvasId = typeof canvasData?.id === 'string' ? canvasData.id.trim() : '';

    if (!canvasData || typeof canvasData !== 'object' || !canvasId) {
      return NextResponse.json({ error: 'Invalid canvas data' }, { status: 400 });
    }
    
    await WorkspaceRepository.saveCanvas(user.id, {
      ...canvasData,
      id: canvasId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Workspace Canvas Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

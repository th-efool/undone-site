import { NextResponse } from 'next/server';
import { WorkspaceRepository } from '@/src/server/infrastructure/db/mongodb/repositories/workspace.repo';
import { getUser } from '@/src/server/infrastructure/auth/getUser';

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user || !user.id) return new NextResponse('Unauthorized', { status: 401 });

    const canvasData = await req.json(); // Data from Excalidraw
    
    await WorkspaceRepository.saveCanvas(user.id, canvasData);

    return NextResponse.json({ success: true });
  } catch (error) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}

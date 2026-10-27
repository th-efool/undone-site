import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthUser, clearVaultCookie } from '../vault';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await resolveAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const response = NextResponse.json({ connected: false });
  clearVaultCookie(response);
  return response;
}

import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthUser, clearGitHubAppConnection, clearVaultCookie } from '../vault';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await resolveAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await clearGitHubAppConnection(user.id);
  } catch {
    return NextResponse.json({ error: 'Could not disconnect GitHub. Try again.' }, { status: 503 });
  }

  const response = NextResponse.json({ connected: false });
  clearVaultCookie(response);
  return response;
}

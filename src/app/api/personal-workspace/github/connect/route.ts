import { NextRequest, NextResponse } from 'next/server';
import {
  GitHubGitDataClient,
  GitHubApiError,
} from '@/src/server/infrastructure/github/personal-workspace';
import { resolveAuthUser, setVaultCookie } from '../vault';

interface ConnectRequestBody {
  token?: string;
  repoFullName?: string;
  allowPublic?: boolean;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await resolveAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ConnectRequestBody;
  try {
    body = (await req.json()) as ConnectRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const repoFullName = body.repoFullName?.trim();
  if (!repoFullName) {
    return NextResponse.json({ error: 'repoFullName is required' }, { status: 400 });
  }

  const parts = repoFullName.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return NextResponse.json(
      { error: 'Invalid repoFullName. Expected format "owner/repo"' },
      { status: 400 }
    );
  }

  let token = body.token?.trim();
  if (
    !token &&
    (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
    process.env.GITHUB_TEST_TOKEN
  ) {
    token = process.env.GITHUB_TEST_TOKEN;
  }

  if (!token) {
    return NextResponse.json({ error: 'GitHub token is required' }, { status: 400 });
  }

  try {
    const client = new GitHubGitDataClient({
      token,
      repoFullName,
    });

    const repoInfo = await client.verifyRepository();

    if (!repoInfo.isPrivate && !body.allowPublic) {
      return NextResponse.json(
        {
          error: 'Public repositories not allowed without explicit confirmation',
          code: 'PUBLIC_REPO_VIOLATION',
        },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
      connected: true,
      repoFullName: repoInfo.fullName,
      defaultBranch: repoInfo.defaultBranch,
      isPrivate: repoInfo.isPrivate,
    });

    await setVaultCookie(response, user.id, {
      token,
      repoFullName: repoInfo.fullName,
      defaultBranch: repoInfo.defaultBranch,
      isPrivate: repoInfo.isPrivate,
    });

    return response;
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return NextResponse.json(
        { error: err.message, status: err.status },
        { status: err.status >= 400 && err.status < 600 ? err.status : 400 }
      );
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to connect repository' },
      { status: 400 }
    );
  }
}

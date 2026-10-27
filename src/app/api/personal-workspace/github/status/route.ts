import { NextRequest, NextResponse } from 'next/server';
import {
  GitHubGitDataClient,
  GitHubApiError,
} from '@/src/server/infrastructure/github/personal-workspace';
import { resolveAuthUser, resolveCredentials } from '../vault';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await resolveAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const credentials = await resolveCredentials(req, user.id);
  if (!credentials) {
    return NextResponse.json({ connected: false });
  }

  try {
    const client = new GitHubGitDataClient({
      token: credentials.token,
      repoFullName: credentials.repoFullName,
    });
    const repoInfo = await client.verifyRepository();

    const responseData: Record<string, unknown> = {
      connected: true,
      repoFullName: repoInfo.fullName,
      defaultBranch: repoInfo.defaultBranch,
      isPrivate: repoInfo.isPrivate,
    };
    if (credentials.installationId) {
      responseData.installationId = credentials.installationId;
      responseData.manageUrl = `https://github.com/settings/installations/${credentials.installationId}`;
    }
    return NextResponse.json(responseData);
  } catch (err) {
    if (err instanceof GitHubApiError && (err.status === 401 || err.status === 404)) {
      return NextResponse.json({
        connected: false,
        error: err.message,
      });
    }

    // Temporary network error or rate limit: return cached info
    const cachedData: Record<string, unknown> = {
      connected: true,
      repoFullName: credentials.repoFullName,
      defaultBranch: credentials.defaultBranch,
      isPrivate: credentials.isPrivate,
    };
    if (credentials.installationId) {
      cachedData.installationId = credentials.installationId;
      cachedData.manageUrl = `https://github.com/settings/installations/${credentials.installationId}`;
    }
    return NextResponse.json(cachedData);
  }
}

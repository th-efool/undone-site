CREATE TABLE IF NOT EXISTS "personal_workspace_github_connections" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "installationId" TEXT NOT NULL,
  "authorizedGitHubUserId" TEXT NOT NULL,
  "authorizedGitHubUserLogin" TEXT NOT NULL,
  "githubAccountId" TEXT NOT NULL,
  "githubAccountLogin" TEXT NOT NULL,
  "repoFullName" TEXT NOT NULL,
  "defaultBranch" TEXT NOT NULL DEFAULT 'main',
  "isPrivate" BOOLEAN NOT NULL DEFAULT TRUE,
  "disconnectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "personal_workspace_github_connections_installationId_idx"
  ON "personal_workspace_github_connections"("installationId");



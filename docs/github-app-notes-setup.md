# GitHub App setup required for Undone notes

Configure the GitHub App that serves personal workspace sync as follows:

1. Set the App **OAuth callback URL** to `https://<production-host>/api/personal-workspace/github/app/oauth/callback`.
2. Set the App **Setup URL** to `https://<production-host>/api/personal-workspace/github/app/callback`.
3. Enable **Redirect on update** so an existing installation returns to Undone after repository access is updated.
4. Leave **Request user authorization (OAuth) during installation** disabled. Undone performs user authorization first so it can verify the exact regular GitHub account and reuse installations that already exist.
5. Configure `GITHUB_APP_ID`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, and `GITHUB_APP_PRIVATE_KEY_BASE64` in the server environment. Set `GITHUB_APP_OAUTH_REDIRECT_URI` only if the default callback URL derived from forwarded host/protocol differs from the registered callback URL.
6. Apply `prisma/personal-workspace-github-connection.sql` to PostgreSQL before deploying the code; run `npx prisma generate` as part of the build/deploy process.

The OAuth callback URL and installation Setup URL are separate GitHub App settings. The setup URL plus Redirect on update are required for the **new installation or repository access update** return. For an already-installed account with repository access, the OAuth callback detects and reconnects the installation directly without opening the installation screen.

GitHub's documentation: [Setup URL and Redirect on update](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/about-the-setup-url), [GitHub App installation endpoints](https://docs.github.com/en/rest/apps/installations).

// src/server/infrastructure/auth/auth.edge.ts
// Edge-safe NextAuth config — NO Prisma, NO Node-only imports.
// Used ONLY by middleware.ts which runs on Vercel Edge Runtime.
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Slack from 'next-auth/providers/slack';
import { configureRequestOriginAuth } from './auth.environment';

configureRequestOriginAuth();

export const { auth } = NextAuth({
  basePath: '/api/auth',
  trustHost: true,
  secret: (() => {
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (secret) return secret;
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
      throw new Error('[auth] Production auth secret (AUTH_SECRET or NEXTAUTH_SECRET) is required.');
    }
    return 'sidequest-hq-dev-secret-key-32-chars-minimum-12345';
  })(),
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID || 'placeholder_github_id',
      clientSecret: process.env.AUTH_GITHUB_SECRET || 'placeholder_github_secret',
    }),
    Slack({
      clientId: process.env.AUTH_SLACK_ID || 'placeholder_slack_id',
      clientSecret: process.env.AUTH_SLACK_SECRET || 'placeholder_slack_secret',
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth',
  },
});

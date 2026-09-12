// src/server/infrastructure/auth/auth.edge.ts
// Edge-safe NextAuth config — NO Prisma, NO Node-only imports.
// Used ONLY by middleware.ts which runs on Vercel Edge Runtime.
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Slack from 'next-auth/providers/slack';

export const { auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
    Slack({
      clientId: process.env.AUTH_SLACK_ID!,
      clientSecret: process.env.AUTH_SLACK_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth',
  },
});

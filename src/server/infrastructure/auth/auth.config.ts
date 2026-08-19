// src/server/infrastructure/auth/auth.config.ts
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import GitHub from 'next-auth/providers/github';
import Slack from 'next-auth/providers/slack';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
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
    strategy: 'database',  // Sessions stored in Postgres, not JWT cookies
  },
  callbacks: {
    async session({ session, user }) {
      // Attach the DB user id to the session object
      // This lets you do: const { userId } = await auth() in any server component
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth',  // Your existing auth page
  },
});

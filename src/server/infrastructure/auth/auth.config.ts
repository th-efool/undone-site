// src/server/infrastructure/auth/auth.config.ts
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import GitHub from 'next-auth/providers/github';
import Slack from 'next-auth/providers/slack';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { configureRequestOriginAuth } from './auth.environment';
import { getGuestAccount } from './guestAccount';

configureRequestOriginAuth();

export const { handlers, auth, signIn, signOut } = NextAuth({
  basePath: '/api/auth',
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'sidequest-hq-dev-secret-key-32-chars-minimum-12345',
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID || 'placeholder_github_id',
      clientSecret: process.env.AUTH_GITHUB_SECRET || 'placeholder_github_secret',
    }),
    Slack({
      clientId: process.env.AUTH_SLACK_ID || 'placeholder_slack_id',
      clientSecret: process.env.AUTH_SLACK_SECRET || 'placeholder_slack_secret',
    }),
    Credentials({
      name: 'Guest',
      credentials: {
        email: { label: "Email", type: "text" }
      },
      async authorize(credentials) {
        try { return await getGuestAccount(credentials?.email, prisma.user); }
        catch {
          console.warn('[auth] Guest sign-in could not resolve a database account.');
          return null;
        }
      }
    }),
  ],
  session: {
    strategy: 'jwt',  // Required for Credentials provider
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
        token.username = 'username' in user && typeof user.username === 'string' ? user.username : 'guest';
      }
      return token;
    },
    async session({ session, user, token }) {
      if (session.user) {
        if (user?.id) {
          session.user.id = user.id;
        } else if (token?.sub) {
          session.user.id = token.sub;
        }
        if (typeof token?.username === 'string') {
          (session.user as typeof session.user & { username?: string }).username = token.username;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth',  // Your existing auth page
  },
});

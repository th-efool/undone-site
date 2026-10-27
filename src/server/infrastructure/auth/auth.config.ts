// src/server/infrastructure/auth/auth.config.ts
import NextAuth from 'next-auth';
import { decode as defaultDecode } from 'next-auth/jwt';
import { PrismaAdapter } from '@auth/prisma-adapter';
import GitHub from 'next-auth/providers/github';
import Slack from 'next-auth/providers/slack';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { configureRequestOriginAuth } from './auth.environment';
import { getGuestAccount } from './guestAccount';
import { getCachedJwt, setCachedJwt } from './jwtCache';
import { verifyPassword } from './password';

configureRequestOriginAuth();

export const { handlers, auth, signIn, signOut } = NextAuth({
  basePath: '/api/auth',
  trustHost: true,
  secret:
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'sidequest-hq-dev-secret-key-32-chars-minimum-12345',
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
      name: 'Credentials',
      credentials: {
        email: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const creds = credentials as Record<string, unknown> | undefined;
          const emailInput = (creds?.email ?? creds?.identifier) as string | undefined;
          const passwordInput = creds?.password as string | undefined;

          if (emailInput === 'guest@undone.com' || emailInput === 'guest@sidequesthq.com') {
            return await getGuestAccount(emailInput, prisma.user);
          }
          if (typeof emailInput === 'string' && emailInput.trim()) {
            const clean = emailInput.trim().toLowerCase();
            const cleanHandle = clean.replace(/^@+/, '');
            const foundUser = await prisma.user.findFirst({
              where: {
                OR: [
                  { email: clean },
                  { username: { equals: cleanHandle, mode: 'insensitive' } },
                ],
              },
            });
            if (foundUser) {
              if (foundUser.passwordHash) {
                if (!passwordInput || !verifyPassword(passwordInput, foundUser.passwordHash)) {
                  return null;
                }
              } else {
                return null;
              }

              return {
                id: foundUser.id,
                name: foundUser.name,
                email: foundUser.email,
                image: foundUser.image,
                username: foundUser.username ?? undefined,
              };
            }
          }
          return null;
        } catch {
          console.warn('[auth] Credentials sign-in could not resolve a database account.');
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',  // Required for Credentials provider
  },
  jwt: {
    async decode(params) {
      if (!params.token) return null;
      const cached = getCachedJwt(params.token);
      if (cached) return cached;
      const decoded = await defaultDecode(params);
      if (decoded) {
        setCachedJwt(params.token, decoded);
      }
      return decoded;
    },
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

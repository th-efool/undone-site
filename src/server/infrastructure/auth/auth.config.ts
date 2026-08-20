// src/server/infrastructure/auth/auth.config.ts
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import GitHub from 'next-auth/providers/github';
import Slack from 'next-auth/providers/slack';
import Credentials from 'next-auth/providers/credentials';
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
    Credentials({
      name: 'Guest',
      credentials: {
        email: { label: "Email", type: "text" }
      },
      async authorize(credentials) {
        if (credentials?.email === 'guest@sidequesthq.com') {
          let user = await prisma.user.findUnique({
            where: { email: 'guest@sidequesthq.com' }
          });
          if (!user) {
            user = await prisma.user.create({
              data: {
                email: 'guest@sidequesthq.com',
                name: 'Guest Explorer',
                username: 'guest',
              }
            });
          }
          return user;
        }
        return null;
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
      }
      return token;
    },
    async session({ session, user, token }) {
      if (session.user) {
        if (user?.id) {
          session.user.id = user.id;
        } else if (token?.sub) {
          session.user.id = token.sub as string;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth',  // Your existing auth page
  },
});

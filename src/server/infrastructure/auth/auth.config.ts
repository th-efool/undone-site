// src/server/infrastructure/auth/auth.config.ts
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import GitHub from 'next-auth/providers/github';
import Slack from 'next-auth/providers/slack';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

export const { handlers, auth, signIn, signOut } = NextAuth({
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
        if (credentials?.email === 'guest@sidequesthq.com' || credentials?.email === 'guest@undone.com') {
          const guestEmail = credentials.email as string;
          try {
            let user = await prisma.user.findUnique({
              where: { email: guestEmail }
            });
            if (!user) {
              user = await prisma.user.create({
                data: {
                  email: guestEmail,
                  name: 'Guest Explorer',
                  username: 'guest',
                }
              });
            }
            return user;
          } catch (dbError) {
            console.warn('[auth] Database connection failed for guest signin, falling back to mock user:', dbError);
            return {
              id: 'guest-explorer-dev-id',
              name: 'Guest Explorer',
              email: guestEmail,
              username: 'guest',
            };
          }
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
        token.name = user.name;
        token.email = user.email;
        (token as any).username = (user as any).username || 'guest';
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
        if ((token as any)?.username) {
          (session.user as any).username = (token as any).username;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth',  // Your existing auth page
  },
});

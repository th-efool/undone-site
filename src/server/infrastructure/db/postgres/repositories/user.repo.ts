// src/server/infrastructure/db/postgres/repositories/user.repo.ts

import { prisma } from '../client';
import type { User } from '@/generated/prisma/client';

export const userRepo = {
  /** Find a user by their email address */
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  },

  /** Find a user by their unique ID */
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  /** Find a user by their username (case-insensitive) */
  async findByUsername(username: string): Promise<User | null> {
    const clean = username.trim().replace(/^@+/, '');
    if (!clean) return null;
    return prisma.user.findFirst({
      where: {
        username: {
          equals: clean,
          mode: 'insensitive',
        },
      },
    });
  },

  /** Create a new user */
  async create(data: {
    email: string;
    username?: string;
    name?: string;
    image?: string;
  }): Promise<User> {
    return prisma.user.create({ data });
  },

  /** Update a user's username */
  async updateUsername(id: string, username: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { username },
    });
  },

  /** Update a user's profile */
  async update(id: string, data: Partial<Pick<User, 'name' | 'image' | 'bio' | 'username'>>): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  },
};

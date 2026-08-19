// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/src/server/infrastructure/auth/auth.config';
export const { GET, POST } = handlers;
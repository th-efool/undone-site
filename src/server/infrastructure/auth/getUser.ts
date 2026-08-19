// src/server/infrastructure/auth/getUser.ts
// Returns the current user from the session, or null if not logged in

import { auth } from './auth.config';

export async function getUser() {
    const session = await auth();
    if (!session?.user?.id) return null;
    return session.user;
}
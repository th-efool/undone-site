// src/server/infrastructure/auth/requireUser.ts
// Throws if the user is not authenticated — use in protected API routes

import { getUser } from './getUser';

export async function requireUser() {
    const user = await getUser();
    if (!user) {
        throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    return user;
}
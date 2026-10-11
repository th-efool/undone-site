type GuestUser = { id: string; name: string | null; email: string | null; username: string | null };
type GuestStore = {
  findUnique(args: { where: { email: string } }): Promise<GuestUser | null>;
  upsert(args: { where: { email: string }; update: Record<string, never>; create: { email: string; name: string; username: string } }): Promise<GuestUser>;
};

/** Keep legacy guest identities, but never authenticate a user absent from SQL. */
export async function getGuestAccount(email: unknown, users: GuestStore): Promise<GuestUser | null> {
  if (email !== 'guest@undone.com' && email !== 'guest@sidequesthq.com') return null;
  const existing = await users.findUnique({ where: { email } });
  if (existing) return existing;
  return users.upsert({ where: { email }, update: {}, create: {
    email, name: 'Guest Explorer', username: email === 'guest@undone.com' ? 'guest-undone' : 'guest-sidequesthq',
  } });
}

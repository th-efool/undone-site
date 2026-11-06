export async function loadChatCatchup<T extends { id: string }>(
  fetchPage: (before?: string) => Promise<T[]>,
  oldestCachedId: string | undefined,
  isCurrent: () => boolean,
): Promise<T[] | null> {
  const messages = new Map<string, T>();
  const cursors = new Set<string>();
  let before: string | undefined;
  while (isCurrent()) {
    const page = await fetchPage(before);
    if (!isCurrent()) return null;
    for (const message of page) if (!messages.has(message.id)) messages.set(message.id, message);
    if (!oldestCachedId || page.some(m => m.id === oldestCachedId) || page.length < 50) {
      return [...messages.values()];
    }
    const next = page[0]?.id;
    if (!next || cursors.has(next)) throw new Error('Chat recovery cursor did not advance');
    cursors.add(next);
    before = next;
  }
  return null;
}

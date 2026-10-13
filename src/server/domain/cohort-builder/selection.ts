import type { InteractionRepository } from 'interaction-builder/runtime';

export interface SelectedLesson { id: string; version: number }

/** The message record, not model text or a client-supplied tool argument, owns selection. */
export async function selectedLessonForLatestTurn(repo: Pick<InteractionRepository, 'listMessages'>, ownerId: string, workspaceId: string, triggeringMessageId?: string | null): Promise<SelectedLesson | null> {
  let messages = await repo.listMessages({ workspaceId, ownerId, limit: triggeringMessageId ? 100 : 1 });
  let latest = triggeringMessageId ? messages.find(message => message.id === triggeringMessageId) : messages.at(-1);
  while (triggeringMessageId && !latest && messages.length === 100) {
    messages = await repo.listMessages({ workspaceId, ownerId, beforeSequence: messages[0].sequence, limit: 100 });
    latest = messages.find(message => message.id === triggeringMessageId);
  }
  if (triggeringMessageId && !latest) throw new Error('TRIGGERING_MESSAGE_NOT_FOUND');
  if (!latest || latest.role !== 'user') return null;
  const refs = (latest.parts as unknown[]).flatMap(part => {
    if (!part || typeof part !== 'object') return [];
    const value = part as { type?: unknown; entity?: { kind?: unknown; id?: unknown; version?: unknown } };
    if (value.type !== 'entity_ref' || value.entity?.kind !== 'lesson') return [];
    const { id, version } = value.entity;
    if (typeof id !== 'string' || !id || !Number.isSafeInteger(version) || (version as number) < 0) throw new Error('INVALID_SELECTED_LESSON');
    return [{ id, version: version as number }];
  });
  if (refs.length > 1) throw new Error('AMBIGUOUS_SELECTED_LESSON');
  return refs[0] ?? null;
}

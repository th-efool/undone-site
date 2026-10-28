import {
  NotebookRecord,
  NoteRecord,
  AssetRecord,
  ScheduleTaskRecord,
  OutboxMutation,
} from '@/src/shared/personal-workspace/contracts';

export function buildPublishCommitMessage(
  mutations: OutboxMutation[] | undefined,
  state: {
    notebooks: NotebookRecord[];
    notes: NoteRecord[];
    assets: AssetRecord[];
    schedules: ScheduleTaskRecord[];
  },
): string {
  if (!mutations || mutations.length === 0) {
    return 'undone(sync): batch publish';
  }

  const notebooksById = new Map(state.notebooks.map((nb) => [nb.id, nb]));
  const notesById = new Map(state.notes.map((n) => [n.id, n]));
  const schedulesById = new Map(state.schedules.map((s) => [s.id, s]));

  // Coalesce multiple mutations for the same entity within the batch
  const coalesced = new Map<string, OutboxMutation>();
  for (const m of mutations) {
    const key = `${m.entityType}:${m.entityId}`;
    const prev = coalesced.get(key);
    if (prev && prev.mutationType === 'create' && m.mutationType === 'update') {
      coalesced.set(key, { ...m, mutationType: 'create' });
    } else {
      coalesced.set(key, m);
    }
  }

  const shortActions: string[] = [];
  const bodyLines: string[] = [];
  let assetMutationCount = 0;

  for (const m of coalesced.values()) {
    const verb = m.mutationType === 'create' ? 'create' : m.mutationType === 'delete' ? 'delete' : 'update';
    const payloadObj = m.payload && typeof m.payload === 'object' ? (m.payload as Record<string, unknown>) : null;

    if (m.entityType === 'notebook') {
      const nb = notebooksById.get(m.entityId);
      const title = nb?.title || (typeof payloadObj?.title === 'string' ? payloadObj.title : m.entityId);
      shortActions.push(`${verb} notebook "${title}"`);
      bodyLines.push(`- [${verb}] notebook "${title}" (undone/notebooks/${m.entityId}.json)`);
    } else if (m.entityType === 'note') {
      const note = notesById.get(m.entityId);
      const title = note?.title || (typeof payloadObj?.title === 'string' ? payloadObj.title : m.entityId);
      const kind = note?.contentType || (typeof payloadObj?.contentType === 'string' ? payloadObj.contentType : 'note');
      const notebookId = note?.notebookId || (typeof payloadObj?.notebookId === 'string' ? payloadObj.notebookId : undefined);
      const nbTitle = notebookId ? notebooksById.get(notebookId)?.title : undefined;
      const inClause = nbTitle ? ` in "${nbTitle}"` : '';
      shortActions.push(`${verb} ${kind} "${title}"${inClause}`);
      bodyLines.push(`- [${verb}] ${kind} "${title}"${inClause} (undone/notes/${m.entityId}.json)`);
    } else if (m.entityType === 'schedule') {
      const sched = schedulesById.get(m.entityId);
      const title = sched?.title || (typeof payloadObj?.title === 'string' ? payloadObj.title : m.entityId);
      shortActions.push(`${verb} task "${title}"`);
      bodyLines.push(`- [${verb}] schedule task "${title}" (undone/schedules/tasks.json)`);
    } else if (m.entityType === 'asset') {
      assetMutationCount += 1;
      bodyLines.push(`- [${verb}] asset ${m.entityId}`);
    }
  }

  if (shortActions.length === 0 && assetMutationCount > 0) {
    shortActions.push(`sync ${assetMutationCount} media asset${assetMutationCount === 1 ? '' : 's'}`);
  } else if (assetMutationCount > 0) {
    shortActions.push(`+${assetMutationCount} asset${assetMutationCount === 1 ? '' : 's'}`);
  }

  const summary =
    shortActions.length <= 2
      ? shortActions.join(', ')
      : `${shortActions.slice(0, 2).join(', ')} (+${shortActions.length - 2} more)`;

  const subject = `undone(sync): ${summary || 'batch publish'}`;
  return bodyLines.length > 0 ? `${subject}\n\n${bodyLines.join('\n')}` : subject;
}

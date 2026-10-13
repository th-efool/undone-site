import { describe, expect, it } from 'vitest';
import { MemoryInteractionRepository } from '../memory.repository';
import { createInteractionHandlers, type DomainDefinition } from '../handlers';
import { dispatchInteraction } from '../http';
import { streamEvents } from '../sse';
import { cohortWorkspaceSchema, planCohortAction } from '@/src/shared/cohort-builder/contracts';

const domain: DomainDefinition = { id: 'cohort', version: 1, initialState: b => cohortWorkspaceSchema.parse(b), plan: planCohortAction };
const WS = '4f828a1c-3b09-42b7-8738-4e50257ad42f';
const boot = { schemaVersion: 1, title: 't', intent: 'i', audience: 'a', dailyMinutes: 10, lessons: [] };
const act = (rev: number, intent: string) => ({ actionId: crypto.randomUUID(), workspaceId: WS, expectedRevision: rev, entityVersions: [], action: { type: 'set_intent', intent } });

async function setup() {
  const h = createInteractionHandlers({ repo: new MemoryInteractionRepository(), domains: new Map([['cohort', domain]]) });
  await h.createWorkspace('u1', { workspaceId: WS, domainId: 'cohort', bootstrap: boot });
  await h.commitAction('u1', undefined, act(0, 'a'));
  await h.commitAction('u1', undefined, act(1, 'b'));
  return h;
}
const read = (r: Response) => r.text();

describe('SSE', () => {
  it('replays events after cursor with persisted-sequence ids, then closes at maxMs', async () => {
    const h = await setup();
    const text = await read(await streamEvents(h, 'u1', WS, 1, { pollMs: 20, maxMs: 120, heartbeatMs: 10 }));
    expect(text).toContain('id: 2\nevent: workspace.committed');
    expect(text).not.toContain('id: 1\n');
    expect(text).toContain(': hb');
  });
  it('delivers live commits made during the stream', async () => {
    const h = await setup();
    const res = await streamEvents(h, 'u1', WS, 2, { pollMs: 5, maxMs: 120 });
    setTimeout(() => { void h.commitAction('u1', undefined, act(2, 'c')); }, 20);
    expect(await read(res)).toContain('id: 3\n');
  });
  it('foreign owner gets 404 JSON, not a stream', async () => {
    const h = await setup();
    const res = await streamEvents(h, 'u2', WS, 0);
    expect(res.status).toBe(404);
  });
  it('dispatcher uses SSE on Accept and Last-Event-ID', async () => {
    const h = await setup();
    const req = new Request('http://x/e', { headers: { accept: 'text/event-stream', 'last-event-id': '2' } });
    const res = await dispatchInteraction(req, ['workspaces', WS, 'events'], async () => 'u1', h);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    res.body?.cancel();
  });
});

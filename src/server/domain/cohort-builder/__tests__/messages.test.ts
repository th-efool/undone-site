import { describe, expect, it } from 'vitest';
import { MemoryInteractionRepository, createInteractionHandlers, type DomainDefinition } from 'interaction-builder/runtime';
import { dispatchInteraction } from 'interaction-builder/adapters/http';
import { cohortWorkspaceSchema, planCohortAction } from '@/src/shared/cohort-builder/contracts';

const domain: DomainDefinition = { id: 'cohort', version: 1, initialState: b => cohortWorkspaceSchema.parse(b), plan: planCohortAction };
const WS = '4f828a1c-3b09-42b7-8738-4e50257ad42f';
const boot = { schemaVersion: 1, title: 't', intent: 'i', audience: 'a', dailyMinutes: 10, lessons: [] };
const text = (t: string) => ({ id: crypto.randomUUID(), parts: [{ type: 'text', text: t }] });

async function setup() {
  const h = createInteractionHandlers({ repo: new MemoryInteractionRepository(), domains: new Map([['cohort', domain]]) });
  await h.createWorkspace('u1', { workspaceId: WS, domainId: 'cohort', bootstrap: boot });
  return h;
}

describe('chat messages', () => {
  it('persists user message, advances sequence, emits message.accepted, shows in snapshot', async () => {
    const h = await setup();
    const r = await h.sendMessage('u1', WS, undefined, text('make it shorter'));
    expect(r.status).toBe(202);
    expect((r.body as any).cursor).toBe(1);
    const ev = (await h.getEvents('u1', WS, 0)).body as any;
    expect(ev.events[0].type).toBe('message.accepted');
    expect(ev.events[0].sequence).toBe(1);
    const ws = (await h.getWorkspace('u1', WS)).body as any;
    expect(ws.messages).toHaveLength(1);
    expect(ws.cursor).toBe(1);
    expect(ws.revision).toBe(0); // chat alone never changes canonical revision
  });
  it('sequence is shared with commits: msg, commit, msg → 1,2,3', async () => {
    const h = await setup();
    await h.sendMessage('u1', WS, undefined, text('a'));
    const c = await h.commitAction('u1', undefined, { actionId: crypto.randomUUID(), workspaceId: WS, expectedRevision: 0, entityVersions: [], action: { type: 'set_intent', intent: 'x' } });
    expect((c.body as any).cursor).toBe(2);
    const m = await h.sendMessage('u1', WS, undefined, text('b'));
    expect((m.body as any).cursor).toBe(3);
  });
  it('idempotent retry returns same message; mismatched payload 409', async () => {
    const h = await setup();
    const body = text('hi');
    const a = await h.sendMessage('u1', WS, 'k', body);
    const b = await h.sendMessage('u1', WS, 'k', body);
    expect((b.body as any).message.id).toBe((a.body as any).message.id);
    expect(((await h.getWorkspace('u1', WS)).body as any).messages).toHaveLength(1);
    expect((await h.sendMessage('u1', WS, 'k', text('different'))).status).toBe(409);
  });
  it('rejects server-only part types, empty text, foreign owner', async () => {
    const h = await setup();
    expect((await h.sendMessage('u1', WS, undefined, { id: crypto.randomUUID(), parts: [{ type: 'warning', text: 'x' }] })).status).toBe(400);
    expect((await h.sendMessage('u1', WS, undefined, text('   '))).status).toBe(400);
    expect((await h.sendMessage('u2', WS, undefined, text('hi'))).status).toBe(404);
  });
  it('paginates backwards and routes through dispatcher', async () => {
    const h = await setup();
    for (let i = 0; i < 3; i++) await h.sendMessage('u1', WS, undefined, text(`m${i}`));
    const o = async () => 'u1';
    const post = await dispatchInteraction(new Request('http://x/m', { method: 'POST', body: JSON.stringify(text('via http')), headers: { 'idempotency-key': 'z' } }), ['workspaces', WS, 'messages'], o, h);
    expect(post.status).toBe(202);
    const page = await (await dispatchInteraction(new Request('http://x/m?before=4'), ['workspaces', WS, 'messages'], o, h)).json();
    expect(page.messages.map((m: any) => m.sequence)).toEqual([1, 2, 3]);
  });
});

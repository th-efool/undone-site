import { describe, expect, it } from 'vitest';
import { MemoryInteractionRepository, createInteractionHandlers, type DomainDefinition } from 'interaction-builder/runtime';
import { dispatchInteraction } from 'interaction-builder/adapters/http';
import { cohortWorkspaceSchema, planCohortAction } from '@/src/shared/cohort-builder/contracts';

const domain: DomainDefinition = { id: 'cohort', version: 1, initialState: b => cohortWorkspaceSchema.parse(b), plan: planCohortAction };
const h = () => createInteractionHandlers({ repo: new MemoryInteractionRepository(), domains: new Map([['cohort', domain]]) });
const WS = '4f828a1c-3b09-42b7-8738-4e50257ad42f';
const boot = { schemaVersion: 1, title: 't', intent: 'i', audience: 'a', dailyMinutes: 10, lessons: [] };
const req = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request('http://x' + url, { method, body: body === undefined ? undefined : JSON.stringify(body), headers });
const owner = (id: string | null) => async () => id;

describe('dispatchInteraction', () => {
  it('401 without owner', async () => {
    expect((await dispatchInteraction(req('GET', '/w'), ['workspaces', WS], owner(null), h())).status).toBe(401);
  });
  it('full flow + path/body mismatch + bad json + after cursor', async () => {
    const handlers = h();
    const o = owner('u1');
    expect((await dispatchInteraction(req('POST', '/w', { workspaceId: WS, domainId: 'cohort', bootstrap: boot }), ['workspaces'], o, handlers)).status).toBe(201);
    const action = { actionId: crypto.randomUUID(), workspaceId: WS, expectedRevision: 0, entityVersions: [], action: { type: 'set_intent', intent: 'n' } };
    const ok = await dispatchInteraction(req('POST', '/a', action, { 'idempotency-key': 'k1' }), ['workspaces', WS, 'actions'], o, handlers);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('no-store');
    expect((await dispatchInteraction(req('POST', '/a', { ...action, workspaceId: crypto.randomUUID() }), ['workspaces', WS, 'actions'], o, handlers)).status).toBe(400);
    expect((await dispatchInteraction(new Request('http://x/a', { method: 'POST', body: '{bad' }), ['workspaces', WS, 'actions'], o, handlers)).status).toBe(400);
    const ev = await (await dispatchInteraction(req('GET', '/e?after=0'), ['workspaces', WS, 'events'], o, handlers)).json();
    expect(ev.events).toHaveLength(1);
    const none = await (await dispatchInteraction(req('GET', '/e?after=1'), ['workspaces', WS, 'events'], o, handlers)).json();
    expect(none.events).toHaveLength(0);
    expect((await dispatchInteraction(req('GET', '/w'), ['workspaces', WS], owner('u2'), handlers)).status).toBe(404);
  });
});

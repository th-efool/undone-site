import { describe, expect, it } from 'vitest';
import { MemoryInteractionRepository, createInteractionHandlers, type DomainDefinition } from 'interaction-builder/runtime';
import { cohortWorkspaceSchema, planCohortAction, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';

const cohort: DomainDefinition<CohortWorkspace> = {
  id: 'cohort', version: 1,
  initialState: b => cohortWorkspaceSchema.parse(b),
  plan: planCohortAction,
};
const boot: CohortWorkspace = { schemaVersion: 1, title: 't', intent: 'learn', audience: 'a', dailyMinutes: 20, lessons: [] };
const WS = '4f828a1c-3b09-42b7-8738-4e50257ad42f';
const mk = () => createInteractionHandlers({ repo: new MemoryInteractionRepository(), domains: new Map([['cohort', cohort]]) });
const env = (rev: number, action: unknown) => ({ actionId: crypto.randomUUID(), workspaceId: WS, expectedRevision: rev, entityVersions: [], action });

describe('interaction handlers', () => {
  it('create → get → action → events, owner isolated', async () => {
    const h = mk();
    expect((await h.createWorkspace('u1', { workspaceId: WS, domainId: 'cohort', bootstrap: boot })).status).toBe(201);
    expect((await h.getWorkspace('u2', WS)).status).toBe(404);
    const r = await h.commitAction('u1', 'r1', env(0, { type: 'set_intent', intent: 'new' }));
    expect(r.status).toBe(200);
    expect((r.body as any).revision).toBe(1);
    const ev = await h.getEvents('u1', WS, 0);
    expect((ev.body as any).events).toHaveLength(1);
  });
  it('maps stale to 409, bad domain/body to 400, unknown action to 400', async () => {
    const h = mk();
    await h.createWorkspace('u1', { workspaceId: WS, domainId: 'cohort', bootstrap: boot });
    expect((await h.commitAction('u1', undefined, env(5, { type: 'set_intent', intent: 'x' }))).status).toBe(409);
    expect((await h.createWorkspace('u1', { workspaceId: WS, domainId: 'nope', bootstrap: {} })).status).toBe(400);
    expect((await h.commitAction('u1', undefined, env(0, { type: 'bogus' }))).status).toBe(400);
  });
  it('idempotent replay returns same receipt', async () => {
    const h = mk();
    await h.createWorkspace('u1', { workspaceId: WS, domainId: 'cohort', bootstrap: boot });
    const e = env(0, { type: 'set_audience', audience: 'z' });
    const a = await h.commitAction('u1', 'k', e); const b = await h.commitAction('u1', 'k', e);
    expect((b.body as any).receipt.receiptId).toBe((a.body as any).receipt.receiptId);
  });
});

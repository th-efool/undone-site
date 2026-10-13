import { describe, expect, it } from 'vitest';
import { createInteractionStore, TransportError, type InteractionTransport } from '../store';

const WS = '4f828a1c-3b09-42b7-8738-4e50257ad42f';
type V = { intent: string };
const committed = (sequence: number, revision: number) => ({ protocolVersion: 1, eventId: crypto.randomUUID(), workspaceId: WS, sequence, type: 'workspace.committed', revision, payload: {} });
const tick = () => new Promise(r => setTimeout(r, 0));

function fake(init: { revision: number; cursor: number; v: V }) {
  let server = { ...init };
  let emit: (e: unknown) => void = () => undefined;
  let close: () => void = () => undefined;
  let opened: number[] = [];
  let commitImpl: (env: any) => Promise<any> = async env => { server = { revision: server.revision + 1, cursor: server.cursor + 1, v: { intent: env.action.intent } }; return { revision: server.revision, cursor: server.cursor, snapshot: server.v, receipt: { receiptId: 'r', summary: 'ok' } }; };
  const t: InteractionTransport<V> = {
    getWorkspace: async () => ({ workspaceId: WS, revision: server.revision, cursor: server.cursor, snapshot: server.v }),
    commit: env => commitImpl(env),
    openEvents: (cursor, onEvent, onClose) => { opened.push(cursor); emit = onEvent; close = onClose; return () => undefined; },
  };
  return { t, srv: () => server, setServer: (s: typeof server) => { server = s; }, emit: (e: unknown) => emit(e), end: () => close(), opened, setCommit: (f: typeof commitImpl) => { commitImpl = f; } };
}

describe('interaction store', () => {
  it('connect loads snapshot and opens stream at cursor', async () => {
    const f = fake({ revision: 3, cursor: 7, v: { intent: 'a' } });
    const s = createInteractionStore<V>({ workspaceId: WS, initialView: { intent: '' }, transport: f.t });
    await s.connect();
    expect(s.getState().view.intent).toBe('a');
    expect(s.getState().revision).toBe(3);
    expect(f.opened).toEqual([7]);
  });
  it('own action applies authoritative view; own SSE echo is ignored (no refetch)', async () => {
    const f = fake({ revision: 0, cursor: 0, v: { intent: 'a' } });
    const s = createInteractionStore<V>({ workspaceId: WS, initialView: { intent: '' }, transport: f.t });
    await s.connect();
    expect(await s.dispatchAction({ type: 'set_intent', intent: 'b' })).toBe(true);
    expect(s.getState().view.intent).toBe('b');
    f.emit(committed(1, 1));
    expect(s.getState().sequence).toBe(1);
    expect(s.getState().pending).toEqual({});
    expect(s.getState().lastReceipt?.summary).toBe('ok');
  });
  it('foreign commit (e.g. chat/other tab) triggers resnapshot so view updates', async () => {
    const f = fake({ revision: 0, cursor: 0, v: { intent: 'a' } });
    const s = createInteractionStore<V>({ workspaceId: WS, initialView: { intent: '' }, transport: f.t });
    await s.connect();
    f.setServer({ revision: 1, cursor: 1, v: { intent: 'from-chat' } });
    f.emit(committed(1, 1));
    await tick(); await tick();
    expect(s.getState().view.intent).toBe('from-chat');
    expect(s.getState().revision).toBe(1);
  });
  it('gap forces resnapshot then stream reopen; duplicate ignored', async () => {
    const f = fake({ revision: 0, cursor: 0, v: { intent: 'a' } });
    const s = createInteractionStore<V>({ workspaceId: WS, initialView: { intent: '' }, transport: f.t });
    await s.connect();
    f.setServer({ revision: 3, cursor: 3, v: { intent: 'later' } });
    f.emit(committed(3, 3)); // gap (expected 1)
    await tick(); await tick(); await tick();
    expect(s.getState().view.intent).toBe('later');
    expect(f.opened.length).toBe(2);
    const seq = s.getState().sequence;
    f.emit(committed(seq, 3));
    expect(s.getState().sequence).toBe(seq);
  });
  it('conflict marks failed, keeps error, resnapshots', async () => {
    const f = fake({ revision: 0, cursor: 0, v: { intent: 'a' } });
    const s = createInteractionStore<V>({ workspaceId: WS, initialView: { intent: '' }, transport: f.t });
    await s.connect();
    f.setCommit(async () => { f.setServer({ revision: 1, cursor: 1, v: { intent: 'other' } }); throw new TransportError(409, 'CONFLICT'); });
    expect(await s.dispatchAction({ type: 'set_intent', intent: 'x' })).toBe(false);
    await tick(); await tick();
    expect(s.getState().lastError?.code).toBe('CONFLICT');
    expect(s.getState().view.intent).toBe('other');
  });
  it('stream close reconnects from latest cursor', async () => {
    const f = fake({ revision: 0, cursor: 0, v: { intent: 'a' } });
    const s = createInteractionStore<V>({ workspaceId: WS, initialView: { intent: '' }, transport: f.t, reconnectDelayMs: 1 });
    await s.connect();
    f.end();
    expect(s.getState().connection).toBe('reconnecting');
    await new Promise(r => setTimeout(r, 15));
    expect(f.opened.length).toBe(2);
    s.disconnect();
  });
});

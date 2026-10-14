import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({ prisma: {} }));
import { createPostgresInteractionRepository } from '@/src/server/infrastructure/db/postgres/repositories/interaction.repo';
import { cohortWorkspaceSchema, planCohortAction } from '@/src/shared/cohort-builder/contracts';
import { claimTextJob } from '../text-jobs';
import { failCurrentTextJob } from '../text-job-failure';
import { runDurableTextJobTick } from '../durable-text-worker';
import { createInteractionStore, type InteractionTransport } from 'interaction-builder/client';
import { runAssistantTurn } from 'interaction-builder/runtime';
import { createAiSdkModelAdapter } from 'interaction-builder/adapters/ai';
import { MockLanguageModelV4 } from 'ai/test';
import { createCohortAiTools } from '../tools';
import { cohortDomain } from '../domain';
import { putTextArtifact } from '../text-artifacts';
import { sourcePdf } from './source-fixture';
import { createTextSourceProcessor } from '../text-source-processor';
import { acceptCurrentTextJob } from '../text-job-acceptance';

afterEach(() => vi.unstubAllEnvs());
const id = '7d4e49d0-bad0-4aba-a777-122326020001';
const ownerId = 'owner';
const migration = readFileSync(new URL('../../../../../prisma/interaction-s3-storage.sql', import.meta.url), 'utf8');

// A thin Prisma-shaped SQL bridge exercises the production commit method against PGlite.
async function fixture() {
  const db = new PGlite();
  await db.exec(`CREATE TABLE interaction_workspaces (id TEXT PRIMARY KEY, "ownerId" TEXT, "domainId" TEXT,
    "domainVersion" INT DEFAULT 1, snapshot JSONB, revision INT DEFAULT 0, sequence INT DEFAULT 0,
    "contextEpoch" INT DEFAULT 0, lifecycle TEXT DEFAULT 'active', "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE interaction_requests ("workspaceId" TEXT, "actorId" TEXT, operation TEXT, "requestId" TEXT,
    "payloadHash" TEXT, response JSONB, UNIQUE ("workspaceId", "actorId", operation, "requestId"));
    CREATE TABLE interaction_events (id TEXT, "workspaceId" TEXT, sequence INT, payload JSONB,
    "protocolVersion" INT, type TEXT, revision INT, UNIQUE ("workspaceId", sequence));
    CREATE TABLE interaction_messages (id TEXT PRIMARY KEY, "workspaceId" TEXT, role TEXT, parts JSONB,
    sequence INT, "runId" TEXT, "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
  await db.exec(migration);
  await db.query(`INSERT INTO interaction_workspaces (id, "ownerId", "domainId", snapshot) VALUES ($1,$2,'cohort',$3::jsonb)`,
    [id, ownerId, JSON.stringify(cohortWorkspaceSchema.parse({ schemaVersion: 1, title: 'Test', intent: 'Learn', audience: '', dailyMinutes: 20, lessons: [] }))]);
  const prisma = {
    interactionWorkspace: { findFirst: async ({ where }: any) => (await db.query(`SELECT * FROM interaction_workspaces WHERE id=$1 AND "ownerId"=$2`, [where.id, where.ownerId])).rows[0] },
    interactionMessage: { findMany: async ({ where, take }: any) => (await db.query(`SELECT * FROM interaction_messages
      WHERE "workspaceId"=$1 AND sequence<$2 ORDER BY sequence DESC LIMIT $3`, [where.workspaceId, where.sequence?.lt ?? 2147483647, take])).rows },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => db.transaction(async tx => work({
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => (await tx.query(strings.reduce((sql, part, index) => sql + (index ? `$${index}` : '') + part, ''), values)).rows,
    $queryRawUnsafe: async (sql: string, ...values: unknown[]) => (await tx.query(sql, values)).rows,
    interactionRequest: {
      findUnique: async ({ where }: any) => { const key = where.workspaceId_actorId_operation_requestId;
        return (await tx.query(`SELECT * FROM interaction_requests WHERE "workspaceId"=$1 AND "actorId"=$2 AND operation=$3 AND "requestId"=$4`,
          [key.workspaceId, key.actorId, key.operation, key.requestId])).rows[0] ?? null; },
      create: async ({ data }: any) => tx.query(`INSERT INTO interaction_requests VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
        [data.workspaceId, data.actorId, data.operation, data.requestId, data.payloadHash, JSON.stringify(data.response)]),
    },
    interactionWorkspace: { update: async ({ where, data }: any) => data.snapshot === undefined
      ? tx.query(`UPDATE interaction_workspaces SET sequence=$1 WHERE id=$2`, [data.sequence, where.id])
      : tx.query(`UPDATE interaction_workspaces
      SET snapshot=$1::jsonb, revision=$2, sequence=$3, "contextEpoch"="contextEpoch"+1 WHERE id=$4`,
      [JSON.stringify(data.snapshot), data.revision, data.sequence, where.id]) },
    interactionEvent: { create: async ({ data }: any) => tx.query(`INSERT INTO interaction_events (id, "workspaceId", sequence, payload, "protocolVersion", type, revision)
      VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)`, [data.id, data.workspaceId, data.sequence, JSON.stringify(data.payload), data.protocolVersion, data.type, data.revision]) },
    interactionMessage: { create: async ({ data }: any) => (await tx.query(`INSERT INTO interaction_messages
      (id,"workspaceId",role,parts,sequence,"runId") VALUES ($1,$2,$3,$4::jsonb,$5,$6) RETURNING *`,
      [data.id, data.workspaceId, data.role, JSON.stringify(data.parts), data.sequence, data.runId])).rows[0] },
  })) };
  const repo = createPostgresInteractionRepository(prisma as any);
  const input = { ownerId, workspaceId: id, expectedRevision: 0, requestId: 'request-a',
    envelope: { actionId: crypto.randomUUID(), workspaceId: id, expectedRevision: 0, entityVersions: [],
      action: { type: 'add_text_source', sourceId: 'source-a', label: 'Notes', text: 'Quorums overlap.' } }, plan: planCohortAction };
  const sql = { query: (s: string, p: unknown[]) => db.query<Record<string, unknown>>(s, p) };
  const port = { transaction: <T>(work: (tx: typeof sql) => Promise<T>) => db.transaction(tx => work({ query: (s, p) => tx.query<Record<string, unknown>>(s, p) })) };
  return { db, repo, input, sql, port };
}

describe('production canonical text repository integration', () => {
  it('rejects fabricated extraction and rolls acceptance back if canonical events fail',async()=>{
    vi.stubEnv('INTERACTION_TEXT_DRIVER','durable');vi.stubEnv('INTERACTION_WEB_ENABLED','1');
    const {db,repo,input,sql,port}=await fixture();
    try {
      await db.exec(readFileSync(new URL('../../../../../prisma/interaction-s4b-sources.sql',import.meta.url),'utf8'));
      await repo.commitAction({...input,envelope:{...input.envelope,action:{type:'add_web_source',sourceId:'web-source',label:'Web',url:'https://docs.example.org/quorum'}}});
      const now=()=>new Date('2030-01-01');
      const loadWorkspace=async()=> (await sql.query(`SELECT snapshot FROM interaction_workspaces WHERE id=$1`,[id])).rows[0].snapshot;
      expect((await runDurableTextJobTick({sql,transaction:port,workerId:'first',leaseMs:60000,now,loadWorkspace,
        webTransport:{resolve:async()=>[{address:'93.184.216.34',family:4}],open:async()=>({status:200,headers:{'content-type':'text/plain'},bytes:(async function*(){yield Buffer.from('Quorums overlap.');})(),close:()=>{}})}})).status).toBe('accepted');
      const job=(await claimTextJob(sql,'replacement',now(),60000))!;expect(job.stage).toBe('extraction');
      const bytes=await createTextSourceProcessor({sql,loadWorkspace})(job);
      const valid=JSON.parse(Buffer.from(bytes).toString());const bad=Buffer.from(JSON.stringify({...valid,text:'Fabricated claim',locations:[{start:0,end:16}]}));
      const forged=await putTextArtifact(sql,{workspaceId:id,sourceId:job.sourceId!,sourceVersion:job.sourceVersion!,kind:'extraction',inputFingerprint:job.dependencyFingerprint,bytes:bad});
      await expect(acceptCurrentTextJob(port,job,forged,now())).rejects.toThrow('FABRICATED_SOURCE_EXTRACTION');
      const artifact=await putTextArtifact(sql,{workspaceId:id,sourceId:job.sourceId!,sourceVersion:job.sourceVersion!,kind:'extraction',inputFingerprint:job.dependencyFingerprint,bytes});
      await db.exec(`ALTER TABLE interaction_events ADD CHECK (sequence < 0) NOT VALID`);
      await expect(acceptCurrentTextJob(port,job,artifact,now())).rejects.toThrow();
      expect((await sql.query(`SELECT status FROM cohort_text_jobs WHERE id=$1`,[job.id])).rows[0].status).toBe('running');
      expect(cohortWorkspaceSchema.parse(await loadWorkspace()).sources[0].extractionId).toBeUndefined();
    } finally {await db.close();}
  },30000);
  it('composes canonical PDF/web intake, retained extraction, assembly, scope reuse and events',async()=>{
    vi.stubEnv('INTERACTION_TEXT_DRIVER','durable');vi.stubEnv('INTERACTION_PDF_ENABLED','1');vi.stubEnv('INTERACTION_WEB_ENABLED','1');
    const {db,repo,input,sql,port}=await fixture();
    try {
      await db.exec(readFileSync(new URL('../../../../../prisma/interaction-s4b-sources.sql',import.meta.url),'utf8'));
      const upload=await putTextArtifact(sql,{workspaceId:id,kind:'source_input',inputFingerprint:'a'.repeat(64),bytes:sourcePdf(['Quorums overlap.','Majorities prevent conflict.'])});
      const read=async()=>{const row=(await sql.query(`SELECT snapshot,revision FROM interaction_workspaces WHERE id=$1`,[id])).rows[0];return {state:cohortWorkspaceSchema.parse(row.snapshot),revision:Number(row.revision)};};
      const commit=async(action:unknown,entityVersions:unknown[]=[])=>{const row=await read();return repo.commitAction({...input,requestId:crypto.randomUUID(),expectedRevision:row.revision,envelope:{...input.envelope,actionId:crypto.randomUUID(),expectedRevision:row.revision,entityVersions,action}});};
      await commit({type:'add_pdf_source',sourceId:'pdf-source',uploadId:upload.id,label:'PDF'});
      await commit({type:'add_web_source',sourceId:'web-source',url:'https://docs.example.org/quorums',label:'Web'});
      const open=vi.fn(async()=>({status:200,headers:{'content-type':'text/plain'},bytes:(async function*(){yield Buffer.from('Majority voting ensures quorum overlap.');})(),close:()=>{}}));
      const tick=()=>runDurableTextJobTick({sql,transaction:port,workerId:'composed',leaseMs:60000,now:()=>new Date('2030-01-01'),loadWorkspace:async()=> (await read()).state,
        webTransport:{resolve:async()=>[{address:'93.184.216.34',family:4}],open}});
      for(let i=0;i<11;i++) expect((await tick()).status).toBe('accepted');
      let row=await read();expect(row.state.processing.status).toBe('ready');expect(row.state.lessons.length).toBe(3);
      expect(row.state.sources[0].locations?.map(item=>item.page)).toEqual([1,2]);expect(row.state.sources[1].provenance?.finalUrl).toBe('https://docs.example.org/quorums');
      const webAnalysis=(await sql.query(`SELECT id FROM cohort_text_jobs WHERE "sourceId"='web-source' AND stage='analysis' AND status='accepted'`,[])).rows[0].id;
      await commit({type:'set_pdf_pages',sourceId:'pdf-source',pages:[2]},[{kind:'source',id:'pdf-source',version:row.state.sources[0].version}]);
      for(let i=0;i<6;i++) expect((await tick()).status).toBe('accepted');
      row=await read();expect(row.state.sources[0].text).toBe('Majorities prevent conflict.');expect(row.state.processing.status).toBe('ready');
      expect((await sql.query(`SELECT status FROM cohort_text_jobs WHERE id=$1`,[webAnalysis])).rows[0].status).toBe('accepted');
      expect(open).toHaveBeenCalledOnce();expect((await tick()).status).toBe('idle');
      const events=(await sql.query(`SELECT revision,sequence FROM interaction_events ORDER BY sequence`,[])).rows;
      expect(events.length).toBe(row.revision);expect(events.map(event=>event.sequence)).toEqual(Array.from({length:events.length},(_,i)=>i+1));
    } finally {await db.close();}
  },30000);
  it('commits source, DAG, receipt and event once through the authorized action path', async () => {
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
    const { db, repo, input } = await fixture();
    try {
      const first = await repo.commitAction(input);
      expect(await repo.commitAction(input)).toEqual(first);
      expect((await db.query(`SELECT * FROM cohort_text_jobs`)).rows).toHaveLength(5);
      expect((await db.query(`SELECT * FROM interaction_events`)).rows).toHaveLength(1);
      expect((await db.query(`SELECT * FROM interaction_requests`)).rows).toHaveLength(1);
      await expect(repo.commitAction({ ...input, requestId: 'foreign', ownerId: 'foreign' })).rejects.toThrow('WORKSPACE_NOT_FOUND');
    } finally { await db.close(); }
  }, 30_000);

  it('rolls snapshot, DAG and receipt back when event persistence fails', async () => {
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
    const { db, repo, input } = await fixture();
    try {
      await db.exec(`ALTER TABLE interaction_events ADD CHECK (sequence < 0)`);
      await expect(repo.commitAction(input)).rejects.toThrow();
      expect((await db.query(`SELECT * FROM cohort_text_jobs`)).rows).toHaveLength(0);
      expect((await db.query<{ revision: number }>(`SELECT revision FROM interaction_workspaces`)).rows[0].revision).toBe(0);
      expect((await db.query(`SELECT * FROM interaction_requests`)).rows).toHaveLength(0);
    } finally { await db.close(); }
  }, 30_000);

  it('persists failure status, targeted retry and cancellation through canonical receipts/events', async () => {
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
    const { db, repo, input, sql, port } = await fixture();
    try {
      await repo.commitAction(input);
      const now = new Date('2030-01-01T00:00:00.000Z');
      const job = (await claimTextJob(sql, 'worker', now, 60_000))!;
      expect(await failCurrentTextJob(port, job, 'PROCESSOR_FAILURE', now)).toBe(true);
      const failed = (await db.query<{ revision: number; snapshot: unknown }>(`SELECT revision, snapshot FROM interaction_workspaces`)).rows[0];
      expect(cohortWorkspaceSchema.parse(failed.snapshot).processing.jobs?.find(item => item.id === job.id)).toMatchObject({ status: 'failed', retryable: true });
      const retry = { ...input, expectedRevision: failed.revision, requestId: 'retry', envelope: { ...input.envelope,
        expectedRevision: failed.revision, action: { type: 'retry_text_job', jobId: job.id } } };
      const receipt = await repo.commitAction(retry);
      expect(await repo.commitAction(retry)).toEqual(receipt);
      expect((await sql.query(`SELECT "attempts", "status" FROM cohort_text_jobs WHERE id=$1`, [job.id])).rows[0]).toMatchObject({ attempts: 1, status: 'queued' });
      await repo.commitAction({ ...retry, expectedRevision: receipt.revision, requestId: 'cancel', envelope: { ...retry.envelope,
        expectedRevision: receipt.revision, action: { type: 'cancel_text_processing' } } });
      expect((await db.query(`SELECT * FROM cohort_text_jobs WHERE status='canceled'`)).rows).toHaveLength(5);
      expect((await db.query(`SELECT * FROM interaction_events`)).rows).toHaveLength(4);
    } finally { await db.close(); }
  }, 30_000);

  it('runs retained text, model refinement, canonical events and reload through the composed path', async () => {
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
    const { db, repo, sql, port } = await fixture();
    let listener: ((event: unknown) => void) | undefined;
    const transport: InteractionTransport<ReturnType<typeof cohortWorkspaceSchema.parse>> = {
      getWorkspace: async () => {
        const ws = (await db.query<{ snapshot: unknown; revision: number; sequence: number }>(`SELECT snapshot,revision,sequence FROM interaction_workspaces`)).rows[0];
        const messages = await repo.listMessages({ ownerId, workspaceId: id });
        return { workspaceId: id, revision: ws.revision, cursor: ws.sequence, snapshot: cohortWorkspaceSchema.parse(ws.snapshot),
          messages: messages.map(({ id, role, parts, sequence, runId }) => ({ id, role, parts, sequence, runId })) as any };
      },
      commit: async (envelope, requestId) => {
        const e = envelope as { expectedRevision: number };
        const result = await repo.commitAction({ ownerId, workspaceId: id, expectedRevision: e.expectedRevision, envelope, requestId, plan: planCohortAction });
        return { revision: result.revision, cursor: result.sequence, snapshot: result.state, receipt: result.receipt };
      },
      openEvents: (_cursor, onEvent) => { listener = onEvent; return () => { listener = undefined; }; },
    };
    const makeStore = () => createInteractionStore({ workspaceId: id, initialView: cohortWorkspaceSchema.parse({ schemaVersion: 1,
      title: '', intent: 'Learn', audience: '', dailyMinutes: 20, lessons: [] }), transport });
    let store = makeStore();
    const pump = async () => {
      const events = await sql.query(`SELECT * FROM interaction_events WHERE sequence>$1 ORDER BY sequence`, [store.getState().sequence]);
      for (const event of events.rows) listener?.({ protocolVersion: 1, eventId: event.id, workspaceId: id, sequence: event.sequence,
        type: event.type, ...(event.revision === null ? {} : { revision: event.revision }), payload: event.payload });
      const ws = await transport.getWorkspace();
      await vi.waitFor(() => expect(store.getState().revision).toBe(ws.revision));
      await vi.waitFor(() => expect(store.getState().view).toEqual(ws.snapshot));
    };
    const tick = () => runDurableTextJobTick({ sql, transaction: port, workerId: 'replacement', leaseMs: 60_000,
      now: () => new Date('2030-01-01T00:00:00.000Z'), loadWorkspace: async () => (await transport.getWorkspace()).snapshot });
    try {
      await store.connect();
      expect(await store.dispatchAction({ type: 'add_text_source', sourceId: 'source-a', label: 'Notes', text: 'Quorums overlap.' })).toBe(true);
      for (let i = 0; i < 5; i++) { expect((await tick()).status).toBe('accepted'); await pump(); }
      expect(store.getState().view.processing.status).toBe('ready');
      const lesson = store.getState().view.lessons[0];
      expect(store.getState().view.chunks[0].text).toBe('Quorums overlap.');
      await repo.appendMessage({ ownerId, workspaceId: id, id: crypto.randomUUID(), role: 'user', scheduleRun: false,
        parts: [{ type: 'text', text: 'Shorten this lesson objective.' }, { type: 'entity_ref', entity: { kind: 'lesson', id: lesson.id, version: lesson.version }, label: lesson.title }] });
      let generated = 0;
      const model = new MockLanguageModelV4({ doGenerate: async () => ({
        content: ++generated === 1 ? [{ type: 'tool-call', toolCallId: 'edit', toolName: 'edit_lesson',
          input: JSON.stringify({ lessonId: lesson.id, objective: 'Explain quorum overlap.' }) }] : [{ type: 'text', text: 'Objective shortened.' }],
        finishReason: { unified: generated === 1 ? 'tool-calls' : 'stop', raw: generated === 1 ? 'tool-calls' : 'stop' },
        usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 10, text: 10, reasoning: 0 } }, warnings: [],
      }) });
      await runAssistantTurn({ workspaceId: id, ownerId, repo, domain: cohortDomain, model: createAiSdkModelAdapter(model),
        createTools: deps => createCohortAiTools({ ...deps, selectedLesson: { id: lesson.id, version: lesson.version } }) });
      await pump();
      expect(store.getState().view.lessons[0]).toMatchObject({ objective: 'Explain quorum overlap.', manualOverride: true });
      expect(await store.dispatchAction({ type: 'set_lesson_pin', lessonId: lesson.id, pinned: true })).toBe(true);
      expect(await store.dispatchAction({ type: 'edit_text_source', sourceId: 'source-a', label: 'Revised', text: 'Quorums intersect.' })).toBe(true);
      for (let i = 0; i < 5; i++) { expect((await tick()).status).toBe('accepted'); await pump(); }
      expect(store.getState().view.lessons.find(item => item.id === lesson.id)).toMatchObject({ pinned: true, objective: 'Explain quorum overlap.', evidenceStatus: 'orphaned' });
      const saved = store.getState().view;
      store.disconnect(); store = makeStore(); await store.connect();
      expect(store.getState().view).toEqual(saved);
      expect(store.getState().messages).toHaveLength(2);
      expect((await tick()).status).toBe('idle');
    } finally { store.disconnect(); await db.close(); }
  }, 30_000);

  it('keeps successful source artifacts through partial failure and targeted retry', async () => {
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
    const { db, repo, input, sql, port } = await fixture();
    const read = async () => (await db.query<{ snapshot: unknown; revision: number }>(`SELECT snapshot,revision FROM interaction_workspaces`)).rows[0];
    let failOnce = true;
    const tick = () => runDurableTextJobTick({ sql, transaction: port, workerId: 'worker', leaseMs: 60_000,
      now: () => new Date('2030-01-01T00:00:00.000Z'), loadWorkspace: async () => {
        if (failOnce) { failOnce = false; throw new Error('SOURCE_TEMPORARILY_UNAVAILABLE'); }
        return (await read()).snapshot;
      } });
    try {
      await repo.commitAction(input);
      await repo.commitAction({ ...input, expectedRevision: 1, requestId: 'source-b', envelope: { ...input.envelope,
        expectedRevision: 1, action: { type: 'add_text_source', sourceId: 'source-b', label: 'B', text: 'Logs retain writes.' } } });
      expect((await tick()).status).toBe('failed');
      for (let i = 0; i < 4; i++) expect((await tick()).status).toBe('accepted');
      expect((await tick()).status).toBe('idle');
      const saved = (await sql.query(`SELECT "resultArtifactId" FROM cohort_text_jobs WHERE "sourceId"='source-b' ORDER BY stage`, [])).rows;
      const current = await read();
      const job = cohortWorkspaceSchema.parse(current.snapshot).processing.jobs!.find(item => item.status === 'failed')!;
      await repo.commitAction({ ...input, expectedRevision: current.revision, requestId: 'targeted-retry', envelope: { ...input.envelope,
        expectedRevision: current.revision, action: { type: 'retry_text_job', jobId: job.id } } });
      for (let i = 0; i < 5; i++) expect((await tick()).status).toBe('accepted');
      expect((await sql.query(`SELECT "resultArtifactId" FROM cohort_text_jobs WHERE "sourceId"='source-b' ORDER BY stage`, [])).rows).toEqual(saved);
      const final = cohortWorkspaceSchema.parse((await read()).snapshot);
      expect(final.processing.status).toBe('ready');
      expect(final.lessons).toHaveLength(2);
    } finally { await db.close(); }
  }, 30_000);
});

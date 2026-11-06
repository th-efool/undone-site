# Studyroom QA corrections — execution handoff

## A. Execution contract

**READY for local implementation.** Scope is QA01, QA02 and QA03 in `plans/studyroom/IdiotCheckInQualityAssessment.md`: permanent subscription denial, missed chat history beyond50 messages, and stale roster snapshots overwriting newer goals. This is a follow-up to the already-applied original27-finding handoff, not a replacement for its outstanding live/database/cost gates.

Root `D:/ThisPC/Documents/SideQuestHQ/undone-site`; PowerShell; Node24.14.1/npm; HEAD `258cd83e44038f646f0ce4677ed3e84d48e4c922`. Existing working tree contains the uncommitted original remediation, tests/schema/new helpers, guide/memory and assessment. Preserve all of it. Target preimages are the actual current files, not HEAD blobs; hashes below are authoritative. Installed Vitest4.1.11, Centrifuge5.x and TypeScript are reused. No dependency, schema, environment or generated-file change.

Sequence: S0 inspect/check → S1 exact payload → S2 automated gates → S3 live checks/report. A mismatched file blocks all edits; stop and report its path instead of adapting by guesswork. On resume, exact postimages are skipped; exact preimages are applied. Never reset existing work. This artifact provides proposed changes; application/deployment are separate execution actions. Live tests need independently authenticated local users, app/worker/Centrifugo; their missing infrastructure blocks live acceptance, not authoring/application of these six files.

## B. Requirements and acceptance map

| Requirement | Observable result | Implementation | Checks |
|---|---|---|---|
| QA01 | SDK permanent unsubscribe103 or unauthorized1 signals room revocation once; ordinary0 release does not. Registry refcounts still release normally. | S1 registry | V1 permanent/ordinary tests; V3 proxy denial |
| QA02 | Reconnect with121 total messages and cached1 fetches all missed rows through ID-cursor pagination; cancellation prevents old-room results, failed/nonadvancing pages surface an error. New live messages/revisions still merge. | S1 catchup helper/chat hook/community repository | V1 121-message/cancel/repeated-cursor tests; V2 existing chat; V3 quiet reconnect |
| QA03 | New roster events invalidate older GET snapshots and schedule one200ms coalesced fresh read, including goal publish/hide; no stale goal rollback. | S1 roster | V1 delayed-response publish/hide; V3 burst and quiet-room check |
| REG | Preserve privacy guards, personal state, generation fences, no extra idle polling, and original working-tree edits. | All | V2 regression/types/build; V3 actor/cost checks |

### Decisions already resolved

Use the installed SDK's `unsubscribed` context for permanent denial, not a fake `error` event. Installed `node_modules/centrifuge/build/index.js`, `_subscribeError` around1595 and `_refreshError` around1801, routes permanent errors to `_setUnsubscribed`; only transient errors emit `error`. Code1 is SDK unauthorized,103 permission denied,0 ordinary unsubscribe. Registry also retains its existing error103 compatibility path; a per-entry guard deduplicates notifications. Do not delete entries inside callbacks: normal consumer cleanup owns release/refcounts.

The real history endpoint is `/api/channels/[channelId]/messages`, re-exporting the community handler. It accepts `before` as **message ID**, returns chronological pages, and queries via `communityRepo.getChannelMessages`. It does not accept sequence as this cursor. Pagination uses the first/oldest returned ID. Repository ordering becomes createdAt DESC then id DESC for deterministic tied timestamps. This affects the existing shared history reader without changing its response shape.

Cold mount still loads latest50; reconnect/refresh walks backwards until the oldest cached sent message appears or history exhausts. Recovering to oldest cached ID refreshes edits/reactions across that cached interval as well as new messages. Each page is50; no arbitrary cap silently drops a long gap. Repeated cursor throws, request failure surfaces through existing hook error, and channel/run fences discard superseded pagination. Existing merge preserves live revisions/intents. Cache growth remains existing session behavior; this correction does not claim bounded total session memory or forward synchronization of arbitrarily old history never loaded.

Roster uses invalidation plus authoritative reload rather than optimistic goal mutation. Membership/governance/goal events increment requestVersion immediately and coalesce one200ms fetch; in-flight old snapshots cannot win. Idle polling intervals remain unchanged. This is a deliberate small latency tradeoff for ordered state and bounded burst requests.

## C. File-change manifest

| Path | Operation | Step |
|---|---|---|
| `src/client/realtime/subscription-registry.ts` | modify | S1 |
| `src/client/screens/dashboard/studyroom/hooks/useRoomChat.ts` | modify | S1 |
| `src/client/screens/dashboard/studyroom/hooks/useRoomRoster.ts` | modify | S1 |
| `src/server/infrastructure/db/postgres/repositories/community.repo.ts` | modify | S1 |
| `src/client/screens/dashboard/studyroom/hooks/loadChatCatchup.ts` | create | S1 |
| `src/client/screens/dashboard/studyroom/__tests__/qa-recovery.test.tsx` | create | S1 |

Every row is S1. New files must be absent or match exact postimages. No deletion/rename, lockfile, schema or generated output. All supporting code and tests are embedded once in D. After executing, update `MEMORY/study-rooms.md` with applied revision and actual QA checks; preserve its maintenance header. Do not mark previous27 findings closed from this follow-up.

## D. Ordered implementation steps

### S0 — Baseline and extraction

Repository-root PowerShell: inspect `git status --short`, `git rev-parse HEAD`, `node --version`. Existing dependencies must match the lockfile. Use installed Node24 and npm; no upgrade is needed. The supplied runner hashes normalized LF text, checks every target before applying, and uses exact replacement blocks in unified-diff form. Removed lines are exact originals, added lines exact replacements; new-file hunks contain full contents. Unexpected content blocks all changes.

```powershell
Set-Location 'D:/ThisPC/Documents/SideQuestHQ/undone-site'
$qaGuide = [IO.File]::ReadAllText((Join-Path (Get-Location) 'plans/studyroom/IdiotHandOffGuide-QA-Corrections.md'))
$qaRunner = [regex]::Match($qaGuide, '(?s)<!-- HANDOFF_RUNNER -->\r?\n```javascript\r?\n(.*?)\r?\n```')
if (-not $qaRunner.Success) { throw 'Missing runner' }
New-Item -ItemType Directory -Force .tmp | Out-Null
[IO.File]::WriteAllText((Join-Path (Get-Location) '.tmp/apply-studyroom-qa.cjs'), $qaRunner.Groups[1].Value)
node .tmp/apply-studyroom-qa.cjs --check
if ($LASTEXITCODE -ne 0) { throw 'Stop: QA preflight failed' }
```

Expected six preimages/postimages and successful pending patch check. No source mutation in check mode.

### S1 — Exact implementation payload

Prerequisite S0 passes. Targets C; apply all consumers/helper/test/repository changes together:

```powershell
node .tmp/apply-studyroom-qa.cjs --apply
if ($LASTEXITCODE -ne 0) { throw 'Stop: QA application failed' }
node .tmp/apply-studyroom-qa.cjs --check
if ($LASTEXITCODE -ne 0) { throw 'QA postimage verification failed' }
```

Postcondition six targets equal after hashes. The runner supports partial previous application by selecting only exact preimages; third-state files abort. Payload follows F to keep commands/requirements together.

### S2 — Automated verification

Run V1 then V2. Stop dependent rollout on failure; retain the error and changed-file list. No database migration is required by this follow-up. Do not rerun the older64-file apply runner after these changes: these files intentionally differ from its postimages. Its implementation is the prior layer, and this guide is the next layer.

### S3 — Live acceptance and report

Run V3; update memory with QA01–03 evidence and remaining original release gates. Deployment needs separate instruction. Missing local users/socket services are reported as blocked checks, never replaced with a mocked pass.

## E. Verification and failure handling

### V1 — Added focused regressions

Root PowerShell after applying:

```powershell
npx vitest run src/client/screens/dashboard/studyroom/__tests__/qa-recovery.test.tsx
if ($LASTEXITCODE -ne 0) { throw 'QA regressions failed' }
```

Expected8 passing tests: permanent103, unauthorized1, normal0 release,121-message pagination using actual ID cursor ordering, cancellation, repeated cursor, delayed goal publish, delayed goal hide. Registry tests model actual SDK event names; the live SDK/proxy integration is still V3. History tests exercise the production catchup helper; full mounted chat merge remains covered by existing hook regressions and live checks.

### V2 — Broader regressions and static/build

```powershell
npx vitest run studyroom --maxWorkers=4
if ($LASTEXITCODE -ne 0) { throw 'Studyroom regression failed' }
npx vitest run src/server/domain/messaging/__tests__ src/client/realtime
if ($LASTEXITCODE -ne 0) { throw 'Messaging/realtime regression failed' }
npx tsc --noEmit --pretty false
if ($LASTEXITCODE -ne 0) { throw 'Type check failed' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
```

Expected zero failures/type/build errors. The pre-existing opt-in PostgreSQL test remains skipped unless provisioned according to the original guide; its skip is not fixed by this follow-up. Specifically inspect shared community history pagination under equal timestamps and two consecutive ID cursors; no duplicates/skips. The repository tie-breaker must retain chronological API output.

### V3 — Real integration acceptance

With two independent local profiles A/B and real socket proxy:

1. Join B, then force permanent permission denial on subscribe and sub-refresh. Both must emit one revocation, clear B's protected stage and detach subscriptions. Normal navigation/release must not display access revoked. Rejoin a permitted room and verify normal new entry/refcount cleanup. Observe SDK `unsubscribed`, not only simulated error events.
2. B loads message1, disconnects; A sends2–121 and becomes quiet. Reconnect B: all121 appear once, including edited/reacted messages in the loaded interval. Delay a history page while publishing a newer message; it survives. Switch room during page2: no old-room rows/errors appear as new-room content. Fail page2 once: visible recovery error, manual refresh completes without duplicates. Exercise equal-createdAt fixture pagination through the shared endpoint.
3. Hold a roster GET carrying old goal; publish/hide goal, then release it. Old snapshot cannot appear. The debounced authoritative read shows final goal within5s on healthy local transport. Burst20 goal events inside200ms: one queued repair per debounce window, no increase in idle polling. Room change/unmount discards the old request.
4. Keep a modified raw socket after ban and publish protected state. This follow-up fixes notification handling, not server transport eviction. If it still receives data after authorization loss, retain the original transport release blocker and specify that separate server correction before release.

No monetary minimum, live row-lock correctness or raw-socket eviction is certified by these tests. They remain original release gates.

### Recovery

Before any later source edits, verify all six postimages, then `git apply --reverse --check .tmp/studyroom-qa.patch`; if successful, `git apply --reverse .tmp/studyroom-qa.patch`. This reverts only this follow-up, preserving original remediation and unrelated work. Stop on overlapping later edits; never reset/clean. No schema rollback needed. A failed patch preflight writes no application files. Unexpected test/build failure requires exact step/error and no deployment.

## F. Completion report contract

Report S0–S3 status, applied revision, six changed paths, exact test/type/build outcomes, V3 results and blocked original gates. Close QA01–03 only with corresponding regression/integration evidence; do not call mocked event tests proof of raw transport revocation. Update memory in the same execution change.

Author validation: proposed code was staged only under `.tmp/`;8 focused regressions passed. Exact patch application check and TypeScript overlay check were performed; final results are appended below. Existing source remains the preimage for this follow-up. No app/worker/production data mutation was performed while authoring. Full production build, shared endpoint/live proxy and authenticated browser checks remain executor work.

Final author validation:8 added regression tests pass; proposed-source TypeScript no-emit exits0. Final isolated proposed-source Studyroom suite:569 passed,0 failed,1 PostgreSQL test skipped (exit0). The embedded runner was checked and applied to a disposable baseline copy: all6 postimage hashes verified, then resume correctly reported6 already applied. Live checks remain pending.

## Embedded payload

<!-- HANDOFF_RUNNER -->
```javascript
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const root = process.cwd();
const guide = fs.readFileSync(path.join(root, 'plans/studyroom/IdiotHandOffGuide-QA-Corrections.md'), 'utf8');
const normalize = (s) => s.replace(/\r\n/g, '\n');
const hash = (s) => crypto.createHash('sha256').update(normalize(s)).digest('hex');
function block(marker, language) {
  const start = '<!-- ' + marker + ' -->\n```' + language + '\n';
  const text = normalize(guide);
  const at = text.indexOf(start);
  if (at < 0) throw Error('Missing payload ' + marker);
  const end = text.indexOf('\n```\n', at + start.length);
  if (end < 0) throw Error('Unclosed payload ' + marker);
  return text.slice(at + start.length, end);
}
const manifest = JSON.parse(block('HANDOFF_MANIFEST', 'json'));
const patch = block('HANDOFF_PATCH', 'diff') + '\n';
const pending = new Set();
const mismatches = [];
for (const entry of manifest) {
  const absolute = path.resolve(root, entry.path);
  if (!absolute.startsWith(root + path.sep)) throw Error('Out-of-root target');
  const actual = fs.existsSync(absolute) ? hash(fs.readFileSync(absolute, 'utf8')) : null;
  if (actual === entry.after) continue;
  if (actual === entry.before) pending.add(entry.path);
  else mismatches.push(entry.path);
}
if (mismatches.length) throw Error('Divergent targets; stop: ' + mismatches.join(', '));
const sections = patch.split(/(?=^diff --git )/m).filter(Boolean);
if (sections.length !== manifest.length) throw Error('Patch/manifest count mismatch');
const pendingPatch = sections.filter((s) => {
  const file = s.match(/^\+\+\+ b\/(.+)$/m)?.[1];
  if (!manifest.some((entry) => entry.path === file)) throw Error('Unknown patch target');
  return pending.has(file);
}).join('');
fs.mkdirSync('.tmp', { recursive: true });
fs.writeFileSync('.tmp/studyroom-qa.patch', patch);
fs.writeFileSync('.tmp/studyroom-qa-pending.patch', pendingPatch);
function git(args) {
  const result = cp.spawnSync('git', args, { encoding: 'utf8', stdio: 'inherit' });
  if (result.status !== 0) throw Error('Git failed: ' + args.join(' '));
}
if (pending.size) git(['apply', '--check', '.tmp/studyroom-qa-pending.patch']);
const mode = process.argv[2];
if (!['--check', '--apply'].includes(mode)) throw Error('Use --check or --apply');
if (mode === '--apply' && pending.size) {
  git(['apply', '.tmp/studyroom-qa-pending.patch']);
  for (const entry of manifest) {
    if (!fs.existsSync(entry.path) || hash(fs.readFileSync(entry.path, 'utf8')) !== entry.after) {
      throw Error('Postimage mismatch: ' + entry.path);
    }
  }
}
console.log(mode === '--apply' ? 'All postimages verified' : `Preflight passed: ${pending.size} pending, ${manifest.length - pending.size} already applied`);
```

<!-- HANDOFF_MANIFEST -->
```json
[
  {
    "path": "src/client/realtime/subscription-registry.ts",
    "operation": "modify",
    "before": "4759c70959fdeaca5c550628ecf17af45844d8f7e1fc40b316bce3b99ecdc67f",
    "after": "1ce73eed28dd383c782c047fbd22210a7a526dc370e237f4603ab47bf28225ac"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/hooks/useRoomChat.ts",
    "operation": "modify",
    "before": "9c9caf8b680ac5d65f1caad0f24e95a7f7874aa5b143bb9432af37e6fb3e0bf5",
    "after": "7174d6cd3a0bea2f12f5122e1944233a2113c93d47839197179e2fb723e7f866"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/hooks/useRoomRoster.ts",
    "operation": "modify",
    "before": "36939a1458b0526356c53d9049583d34eed86c3e32d26d3010dd74da67af16e3",
    "after": "89df7a67b99a1046d94b160f33e53965edb868d0260eecc900c5114eb106107e"
  },
  {
    "path": "src/server/infrastructure/db/postgres/repositories/community.repo.ts",
    "operation": "modify",
    "before": "e2fb522e4b81ecadc495d65ff3559803a1f25a3ea4b3a7960832e04680ff70dc",
    "after": "56b3c4adf2298a5f1ed4b0ff25f6fa603dd63ca322df261de7e9a3dae51d7eb0"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/hooks/loadChatCatchup.ts",
    "operation": "create",
    "before": null,
    "after": "781d1b9d802f37ff7bcc8b45778b01c52216844dedc93a6b03ef37a5a95f0327"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/__tests__/qa-recovery.test.tsx",
    "operation": "create",
    "before": null,
    "after": "769c269512d6fa67f634248210c22ed2e36ec27b4170fe738177ee37bdbceebd"
  }
]
```

<!-- HANDOFF_PATCH -->
```diff
diff --git a/src/client/realtime/subscription-registry.ts b/src/client/realtime/subscription-registry.ts
--- a/src/client/realtime/subscription-registry.ts
+++ b/src/client/realtime/subscription-registry.ts
@@ -111,18 +111,26 @@ export class SubscriptionRegistry {
       entry.status = 'subscribing';
     });
 
     sub.on('subscribed', (_ctx: SubscribedContext) => {
       entry.status = 'subscribed';
       if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('studyroom:resync',{detail:channel}));
     });
 
-    sub.on('unsubscribed', (_ctx: UnsubscribedContext) => {
+    let revoked = false;
+    const notifyRevoked = () => {
+      if (revoked) return;
+      revoked = true;
+      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('studyroom:revoked', { detail: channel }));
+      this.onRevocation?.(channel);
+    };
+    sub.on('unsubscribed', (ctx: UnsubscribedContext) => {
       entry.status = 'unsubscribed';
+      if (ctx.code === 103 || ctx.code === 1) notifyRevoked();
     });
 
     sub.on('publication', (ctx: PublicationContext) => {
       const payload = ctx.data;
       const info = { channel, offset: ctx.offset };
       for (const h of entry.handlers) {
         try {
           h(payload, info);
@@ -132,21 +140,17 @@ export class SubscriptionRegistry {
       }
     });
 
     sub.on('error', (ctx: SubscriptionErrorContext) => {
       entry.status = 'error';
       entry.lastError = ctx.error?.message || 'Subscription error';
 
       if (ctx.error?.code === 103) {
-        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('studyroom:revoked',{detail:channel}));
-        // Access revoked or expired
-        if (this.onRevocation) {
-          this.onRevocation(channel);
-        }
+        notifyRevoked();
       }
     });
   }
 
   public getStatus(channel: string): SubscriptionStatus {
     const entry = this.entries.get(channel);
     return entry ? entry.status : 'unsubscribed';
   }
diff --git a/src/client/screens/dashboard/studyroom/hooks/useRoomChat.ts b/src/client/screens/dashboard/studyroom/hooks/useRoomChat.ts
--- a/src/client/screens/dashboard/studyroom/hooks/useRoomChat.ts
+++ b/src/client/screens/dashboard/studyroom/hooks/useRoomChat.ts
@@ -1,12 +1,13 @@
 'use client';
 
 import { useState, useEffect, useCallback, useRef } from 'react';
 import { useSession } from 'next-auth/react';
+import { loadChatCatchup } from './loadChatCatchup';
 import { useRoomRefresh } from './useRoomRefresh';
 import { useRealtime } from '@/src/client/realtime';
 import {
   studyRoomRepository,
   type RoomChatMessageDTO,
 } from '@/src/client/repositories/studyRoomRepository';
 
 export interface OptimisticChatMessage extends RoomChatMessageDTO {
@@ -44,16 +45,19 @@ export function useRoomChat({
 }: UseRoomChatOptions): UseRoomChatResult {
   const { data: session } = useSession();
   const realtime = useSafeRealtime();
   const subscribe = realtime?.status === 'connected' ? realtime.subscribe : undefined;
   const [messages, setMessages] = useState<OptimisticChatMessage[]>([]);
   const [isLoading, setIsLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
 
+  const messagesRef = useRef(messages);
+  useEffect(() => { messagesRef.current = messages; }, [messages]);
+  const historyRun = useRef(0);
   const channelRef = useRef(channelId);
   useEffect(() => { channelRef.current=channelId; setMessages([]); }, [channelId]);
   const isMountedRef = useRef(true);
 
   const currentUserId = session?.user?.id;
   const currentUserName = session?.user?.name || 'You';
   const currentUserImage = session?.user?.image || null;
 
@@ -61,17 +65,25 @@ export function useRoomChat({
   const fetchHistory = useCallback(async () => {
     if (!channelId || !enabled) {
       setMessages([]);
       return;
     }
 
     setIsLoading(true);
     try {
-      const history = await studyRoomRepository.getChannelMessages(channelId, 50);
+      const run = ++historyRun.current;
+      const cached = messagesRef.current.filter(m => m.channelId === channelId && m.deliveryStatus === 'sent');
+      const oldest = [...cached].sort((a,b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0]?.id;
+      const history = await loadChatCatchup(
+        before => studyRoomRepository.getChannelMessages(channelId, 50, before),
+        oldest,
+        () => isMountedRef.current && channelRef.current === channelId && historyRun.current === run,
+      );
+      if (!history) return;
       if (isMountedRef.current && channelRef.current === channelId) {
         setMessages((prev) => {
           const merged = new Map<string, OptimisticChatMessage>();
           for (const message of history) merged.set(message.id,{...message, deliveryStatus:'sent'});
           const intents = new Set(history.map(m=>m.clientRequestId).filter(Boolean));
           for (const m of prev) {
             if (m.channelId !== channelId || (m.deliveryStatus !== 'sent' && m.clientRequestId && intents.has(m.clientRequestId))) continue;
             const stored = merged.get(m.id);
@@ -97,16 +109,17 @@ export function useRoomChat({
     let ignore = false;
     void Promise.resolve().then(async () => {
       if (ignore || !isMountedRef.current) return;
       await fetchHistory();
     });
 
     return () => {
       ignore = true;
+      historyRun.current++;
       isMountedRef.current = false;
     };
   }, [fetchHistory]);
 
   useRoomRefresh(enabled ? `roomchat:${channelId}:g${streamGeneration}` : undefined, fetchHistory);
 
   // 2. Realtime subscription to roomchat stream
   useEffect(() => {
diff --git a/src/client/screens/dashboard/studyroom/hooks/useRoomRoster.ts b/src/client/screens/dashboard/studyroom/hooks/useRoomRoster.ts
--- a/src/client/screens/dashboard/studyroom/hooks/useRoomRoster.ts
+++ b/src/client/screens/dashboard/studyroom/hooks/useRoomRoster.ts
@@ -91,16 +91,17 @@ export function useRoomRoster({
 
     const onFocus = () => {
       void fetchRoster();
     };
     window.addEventListener('focus', onFocus);
 
     return () => {
       ignore = true;
+      requestVersion.current++;
       isMountedRef.current = false;
       clearInterval(interval);
       window.removeEventListener('focus', onFocus);
     };
   }, [enabled, roomId, fetchRoster, subscribe]);
 
   useRoomRefresh(enabled ? `room:${roomId}:g${streamGeneration}` : undefined, fetchRoster);
 
@@ -111,29 +112,25 @@ export function useRoomRoster({
     const roomChannel = `room:${roomId}:g${streamGeneration}`;
     let timer: ReturnType<typeof setTimeout> | undefined;
     const unsubscribe = subscribe(roomChannel, (data: unknown) => {
       const envelope = data as {
         type?: string;
         payload?: { userId?: string; publicGoal?: string | null };
       };
       if (
+        envelope?.type === 'room.participant.updated' ||
         envelope?.type === 'room.governance.changed' ||
         envelope?.type === 'room.roster.changed' ||
         envelope?.type === 'room.participant.joined' ||
         envelope?.type === 'room.participant.left'
       ) {
+        requestVersion.current++;
         if (!timer) timer = setTimeout(() => { timer = undefined; void fetchRoster(); },200);
-      } else if (envelope?.type === 'room.participant.updated' && envelope.payload?.userId) {
-        const { userId, publicGoal } = envelope.payload;
-        setRoster((prev) =>
-          prev.map((m) =>
-            m.userId === userId ? { ...m, publicGoal: publicGoal ?? null } : m
-          )
-        );
+
       }
     });
 
     return () => {
       clearTimeout(timer);
       unsubscribe();
     };
   }, [enabled, roomId, streamGeneration, subscribe, fetchRoster]);
diff --git a/src/server/infrastructure/db/postgres/repositories/community.repo.ts b/src/server/infrastructure/db/postgres/repositories/community.repo.ts
--- a/src/server/infrastructure/db/postgres/repositories/community.repo.ts
+++ b/src/server/infrastructure/db/postgres/repositories/community.repo.ts
@@ -106,17 +106,17 @@ export const communityRepo = {
   },
 
   getChannelMessages: async (channelId: string, limit = 50, beforeCursor?: string) => {
     const take = Math.min(100, Math.max(1, limit));
     return prisma.message.findMany({
       where: { channelId },
       take,
       ...(beforeCursor ? { skip: 1, cursor: { id: beforeCursor } } : {}),
-      orderBy: { createdAt: 'desc' },
+      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
       include: {
         author: {
           select: { id: true, name: true, image: true, username: true },
         },
         reactions: {
           select: { emoji: true, userId: true },
         },
       },
diff --git a/src/client/screens/dashboard/studyroom/hooks/loadChatCatchup.ts b/src/client/screens/dashboard/studyroom/hooks/loadChatCatchup.ts
new file mode 100644
--- /dev/null
+++ b/src/client/screens/dashboard/studyroom/hooks/loadChatCatchup.ts
@@ -0,0 +1,22 @@
+export async function loadChatCatchup<T extends { id: string }>(
+  fetchPage: (before?: string) => Promise<T[]>,
+  oldestCachedId: string | undefined,
+  isCurrent: () => boolean,
+): Promise<T[] | null> {
+  const messages = new Map<string, T>();
+  const cursors = new Set<string>();
+  let before: string | undefined;
+  while (isCurrent()) {
+    const page = await fetchPage(before);
+    if (!isCurrent()) return null;
+    for (const message of page) if (!messages.has(message.id)) messages.set(message.id, message);
+    if (!oldestCachedId || page.some(m => m.id === oldestCachedId) || page.length < 50) {
+      return [...messages.values()];
+    }
+    const next = page[0]?.id;
+    if (!next || cursors.has(next)) throw new Error('Chat recovery cursor did not advance');
+    cursors.add(next);
+    before = next;
+  }
+  return null;
+}
diff --git a/src/client/screens/dashboard/studyroom/__tests__/qa-recovery.test.tsx b/src/client/screens/dashboard/studyroom/__tests__/qa-recovery.test.tsx
new file mode 100644
--- /dev/null
+++ b/src/client/screens/dashboard/studyroom/__tests__/qa-recovery.test.tsx
@@ -0,0 +1,76 @@
+/** @vitest-environment jsdom */
+import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import { EventEmitter } from 'node:events';
+import type { Centrifuge } from 'centrifuge';
+import { SubscriptionRegistry } from '../../../../realtime/subscription-registry';
+import { loadChatCatchup } from '../hooks/loadChatCatchup';
+import { useRoomRoster } from '../hooks/useRoomRoster';
+
+const realtime = vi.hoisted(() => ({ handler: undefined as undefined | ((data: unknown) => void) }));
+const subscribe = vi.hoisted(() => vi.fn((_channel: string, handler: (data: unknown) => void) => {
+  realtime.handler = handler;
+  return () => {};
+}));
+vi.mock('@/src/client/realtime', () => ({ useRealtime: () => ({ status: 'connected', subscribe }) }));
+afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
+
+describe('Studyroom QA recovery regressions', () => {
+  it.each([103, 1])('notifies once for permanent unsubscribe code %s', code => {
+    const sub = Object.assign(new EventEmitter(), { subscribe: vi.fn(), unsubscribe: vi.fn() });
+    const client = { newSubscription: () => sub, removeSubscription: vi.fn() };
+    const revoked = vi.fn();
+    const registry = new SubscriptionRegistry({ onRevocation: revoked });
+    registry.setClient(client as unknown as Centrifuge);
+    const release = registry.acquire('room:r:g1');
+    sub.emit('unsubscribed', { code, reason: 'permission denied' });
+    sub.emit('unsubscribed', { code, reason: 'permission denied' });
+    expect(revoked).toHaveBeenCalledExactlyOnceWith('room:r:g1');
+    release();
+    expect(registry.size()).toBe(0);
+  });
+  it('does not classify ordinary unsubscribe as revocation', () => {
+    const sub = Object.assign(new EventEmitter(), { subscribe: vi.fn(), unsubscribe: vi.fn() });
+    const revoked = vi.fn();
+    const registry = new SubscriptionRegistry({ onRevocation: revoked });
+    registry.setClient({ newSubscription: () => sub, removeSubscription: vi.fn() } as unknown as Centrifuge);
+    const release = registry.acquire('room:r:g1');
+    sub.emit('unsubscribed', { code: 0, reason: 'unsubscribe called' });
+    expect(revoked).not.toHaveBeenCalled();
+    release();
+  });
+  it('recovers 120 missed messages using chronological pages and ID cursor', async () => {
+    const all = Array.from({ length: 121 }, (_, i) => ({ id: String(i + 1) }));
+    const fetchPage = vi.fn(async (before?: string) => {
+      const end = before ? all.findIndex(m => m.id === before) : all.length;
+      return all.slice(Math.max(0, end - 50), end);
+    });
+    const recovered = await loadChatCatchup(fetchPage, '1', () => true);
+    expect(new Set(recovered?.map(m => m.id)).size).toBe(121);
+    expect(fetchPage.mock.calls).toEqual([[undefined], ['72'], ['22']]);
+  });
+  it('cancels pagination after channel departure', async () => {
+    let current = true;
+    const result = await loadChatCatchup(async () => { current = false; return [{ id: 'old' }]; }, '1', () => current);
+    expect(result).toBeNull();
+  });
+  it('fails visibly on a repeated full-page cursor', async () => {
+    const page = Array.from({ length: 50 }, (_, i) => ({ id: String(i + 2) }));
+    await expect(loadChatCatchup(async () => page, '1', () => true)).rejects.toThrow('cursor did not advance');
+  });
+  it.each(['new goal', null])('does not overwrite goal event with stale HTTP: %s', async goal => {
+    let resolveOld!: (response: Response) => void;
+    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { resolveOld = resolve; }))
+      .mockResolvedValue({ ok: true, json: async () => [{ userId: 'u', publicGoal: goal }] });
+    vi.stubGlobal('fetch', fetcher);
+    const { result } = renderHook(() => useRoomRoster({ roomId: 'r' }));
+    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
+    await act(async () => {
+      realtime.handler?.({ type: 'room.participant.updated', payload: { userId: 'u', publicGoal: goal } });
+      resolveOld({ ok: true, json: async () => [{ userId: 'u', publicGoal: 'old' }] } as Response);
+    });
+    expect(result.current.roster).toEqual([]);
+    await waitFor(() => expect(result.current.roster[0]?.publicGoal).toBe(goal));
+    expect(fetcher).toHaveBeenCalledTimes(2);
+  });
+});
```

End of complete handoff.


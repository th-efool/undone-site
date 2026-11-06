# Studyroom remediation quality assessment — 2026-11-06

## 1. Verdict and assessed scope

**Acceptance unmet. Two high and one medium confirmed findings remain.** The handoff is mechanically executable and the applied implementation passes the focused test suite, but subscription revocation and chat recovery still fail required cases. Do not close all 27 original findings or release on the strength of the green suite.

Scope: the prior investigation, single-file remediation guide, embedded 64-file payload, applied working-tree implementation, and memory's execution claims. Baseline HEAD/master is `95b635f76e2916f5ab8fccd6e85afdee6549d447`; original investigation baseline is `3aab416214abc6f9b31163fc9945012d191bd34a`. At assessment start the 64 targets were already applied as uncommitted changes, together with guide/memory edits and an additional messaging test adjustment. Preserve this work. The earlier handoff authoring and subsequent execution are separate activities.

Standards: all H01–H14/M01–M13 requirements in the guide, its recovery/authorization invariants, repository memory rules and the requested quality-assessment skill. This assessment makes no production security, minimum cost, accessibility or flawless-behavior certification. Node is v24.14.1; installed Vitest and Centrifuge code were used. No application fixes or database mutations were performed during review.

Coverage limits: targeted source review follows the changed realtime/recovery, admission, role, roster, chat, persistence and worker boundaries. All payload targets were mechanically checked and the focused suite rerun. This is not a line-by-line correctness proof of every line in all 64 files. Actual PostgreSQL races/migration, two authenticated browsers, rendered/mobile accessibility, production build and monetary cost were not independently exercised in this assessment. Their exact outstanding gates remain in section 5. Memory's prior build/messaging claims are recorded claims, not new passes from this reviewer.

## 2. Requirement and component coverage

Disposition: “source mechanism present” means inspected implementation supports the intended mechanism, not end-to-end acceptance. No original requirement is declared release-closed here.

| Requirements | Components and flow reviewed | Disposition |
|---|---|---|
| H01 | Provider readiness → stable subscribe → registry; provider tests | Focused suite passes; live cold/warm/reconnect unverified |
| H02,H03,H05 | Catalog validation → scope; bootstrap eligibility/admitted projection; sprint/environment access guard | Source mechanisms present; full adversarial HTTP matrix pending |
| H04,M01 | Create intent → user lock/quota → transactional provisioning; partial audit uniqueness SQL | Payload complete; real DB/index/legacy-data checks pending |
| H06,M13 | Owner management independent of stage admission; modal fresh mount/reset | Focused suite passes; actual lifecycle/create UI pending |
| H07,H14 | Postjoin bootstrap → governance event → capabilities; runtime subscription denial | Finding QA01; two-browser promotion/transfer pending |
| H08,H09 | Live-access helper, stored ID/slug resolver, control callers | Source mechanisms present; direct HTTP after ban/expiry pending |
| H10,H11,M02 | User/room lock order; locked revisions/transfer guards; generation leave | Unit suite passes with doubles; real interleavings pending |
| H12,M10 | Registry resync → room/chat hooks → history/snapshot merge | Finding QA02; final quiet-room recovery incomplete |
| H13 | Live lease at chat/search/interaction/control; conditional renewal; scheduled cleanup | Source mechanisms present; raw socket revocation unresolved, QA01 applies |
| M03,M04 | Durable publicGoal/outbox; environment null/revision/error handling | DB persistence and two-instance checks pending; QA03 affects goal convergence |
| M05,M06 | Roster role projection, policy trusted ADMIN, role menu and bans flow | Source mechanisms present; actor matrix/UI pending |
| M07,M11 | Query availability/cursor/recent audit; legacy public DTO/seed normalization | Focused tests pass; actual legacy migration/catalog dataset pending |
| M08,M09 | 120s roster fallback/200ms debounce; worker 30s bounded cleanup | Timer/query design inspected; actual seat-hour cost and competing workers pending |

The manifest in `IdiotHandOffGuide.md` section C is the exhaustive 64-path target inventory. Check C2 verified every target's postimage, including new helpers/tests/schema/SQL, with zero pending targets. No target was silently omitted from that mechanical check. Runtime disposition of all targets is inherited from the component rows above; generated Prisma output is checked through generation claims and tests, not reviewed line by line. The additional `src/server/domain/messaging/__tests__/phase7-persistent-room-chat.test.ts` change lies outside the payload and needs its normal messaging regression gate.

Six-category accounting:

- Pending integration: SQL is present but application to the live schema is unverified; real database/browser/cost gates remain incomplete. The guide explicitly acknowledges these gaps.
- Symptom-only fixes: QA01 detects the wrong event boundary; QA02 detects bounded-history reload presented as recovery; QA03 detects stale snapshot overwrite despite request fencing.
- Bugs/regressions: all three findings below have reachable source paths; QA02 has an extracted-production-algorithm reproduction.
- Quality standards: correctness is assessed; rendered UI, focus/keyboard/mobile states and performance remain unverified rather than inferred from source.
- Dead code: no deletion recommendation. Searches/inspection show current stage uses orchestration; older lifecycle hook and historical helpers require a separate complete dynamic/framework reference audit before removal. No newly confirmed dead artifact.
- Duplication/overengineering: global DOM resync events are a shared cross-hook boundary, not automatically a defect. Their duplicated consumers require recovery tests. No broad rewrite justified; narrow fixes below suffice. Repeated control/role code was traced where relevant, without assuming similar code is unused.

## 3. Prioritized findings

### QA01 — High — Permanent socket denial bypasses revocation handling

Categories: B,C. Requirements H07,H13,H14. Attribution: pre-existing event mismatch retained in the new remediation; the added DOM revocation signal inherits it.

Locations: `src/client/realtime/subscription-registry.ts:119` handles `unsubscribed` by setting status only; `:135` handles `error`, with revocation restricted to error code103 at `:139`. Installed `node_modules/centrifuge/build/index.js:1595` `_subscribeError` sends permanent errors to `_setUnsubscribed`; `:1801` `_refreshError` does likewise. Only transient errors emit `error`. `_failUnauthorized` also terminates using the unsubscribed path.

Trigger: already-admitted room loses authorization and subscribe/sub-refresh returns permanent103. Expected: registry signals revocation, orchestration clears/denies and protected consumers detach. Actual: installed SDK emits `unsubscribed`, which never calls onRevocation or emits `studyroom:revoked`; the new error103 branch is not reached through that SDK path. Provider onRevocation only logs/updates channels and cannot repair a notification never delivered. Global connected status need not become unauthorized for a channel-level denial.

Evidence: C3 inspected both branches in installed SDK and registry, and the orchestration listener. This is a static event-contract proof, not a live socket exposure measurement. Severity high because loss of room authorization fails to drive the required state transition; it does not prove indefinite server data access.

Minimal correction: classify permanent denial on the actual `unsubscribed` context, signal revocation exactly once, avoid treating ordinary user unsubscribe as denial, and reconcile registry entry/reacquisition lifecycle. Test permanent initial denial, refresh denial and normal release using the installed SDK semantics, then an actual proxy-backed browser. Do not merely emit a fake error103 in the test.

### QA02 — High — Chat reconnect leaves a permanent gap beyond 50 messages

Categories: A,B,C. Requirements H12,M10. Attribution: bounded fetch existed before; the new merge/resync design does not eliminate it.

Locations: `src/client/screens/dashboard/studyroom/hooks/useRoomChat.ts:69` requests only latest50; `:72` merges that response with existing rows; `:109` reconnect resync invokes the same fetch. `src/client/repositories/studyRoomRepository.ts:389` supports a before cursor but this caller supplies none. A merge cannot reconstruct rows absent from both inputs.

Trigger: B has message sequence1; B disconnects; A sends sequences2–121; A goes quiet; B reconnects. Expected: recover missed history or explicitly expose a usable pagination/gap affordance. Actual: cached1 plus latest72–121 gives51 rows;2–71 never arrive and no loop requests them. A later quiet reconnect repeats the same response. This violates the guide's missed-final-state recovery promise independently of room-event snapshot repair.

Evidence C4 executes the merge body extracted from current production source, transpiled with installed TypeScript targetESNext: recovered51, expected121, missing70. It is a deterministic algorithm check, not a mounted React/browser test. C3 inspected repository cursor support and reconnect caller to rule out hidden pagination. The existing green suite does not cover this interval.

Minimal correction: carry last confirmed message sequence and paginate durable catch-up through the missing interval, merging by ID/revision/intention with cancellation/channel fences; or provide an explicit usable bounded-history contract and UI, which would require changing the current recovery acceptance requirement. Close with delayed-history/live-message tests and >120 missed-message quiet reconnect against real persistence. Preserve deletion/reaction revisions during catch-up.

### QA03 — Medium — In-flight roster snapshot overwrites a newer public-goal event

Categories: B,C. Requirements M03,M08 and peer convergence. Attribution: pre-existing race retained despite new request-version guard and longer fallback.

Locations: `src/client/screens/dashboard/studyroom/hooks/useRoomRoster.ts:48` increments requestVersion for HTTP requests; `:54` checks only that request version; `:65` replaces roster; `:125` handles participant.updated by applying goal directly without invalidating an older request.

Trigger: roster GET captures old goal; newer goal publish/hide event arrives and updates roster; delayed GET returns last. Expected: newer event survives. Actual: requestVersion is unchanged by the publication, so stale members replace newer goal. With a healthy connection, the next scheduled repair may be120 seconds away, beyond guide's5-second convergence target.

Evidence C3: complete fetch/effect/publication handlers inspected. This is a static event-order proof; no upstream snapshot revision watermark prevents it. Durable DB storage fixes cross-instance truth but does not order client snapshot and publication arrivals.

Minimal correction: fence in-flight snapshots against newer event epochs and queue one authoritative reload, or merge versioned per-member state using snapshot/event revisions. Avoid permanently discarding all fetches during churn. Close with a delayed GET after goal publish and goal hide, no subsequent events, asserting the new value remains and bounded request counts.

## 4. Checks and evidence

- **C1 passed:** repository-root `npx vitest run studyroom --maxWorkers=4 --reporter=json --outputFile=.tmp/studyroom-review-results.json` (console captured in `.tmp/studyroom-review-tests.log`), exit0:561 passed,0 failed,1 skipped. The skip is the real PostgreSQL gate. This independently corroborates focused-suite memory claim but not DB correctness.
- **C2 passed:** `node .tmp/studyroom-guide-runner.cjs --check`, root, read-only source check plus temporary extracted files: `0 pending,64 already applied`. Confirms all embedded target postimages match this working tree. It does not establish semantics or deployed state.
- **C3 source inspections:** actual git status/HEAD, memory and guide contract; provider/registry, orchestration admission/revocation, roster/chat hooks, policy eligibility/capabilities/role precedence, management bootstrap/quota, governance controller/transfer transaction checks, worker cleanup, repository history and search live-access callers; installed Centrifuge permanent-error dispatch. Paths/lines for findings are current-working-tree lines, not diff offsets. Searches followed callers and failure paths; generated/vendor source used only to resolve the event contract.
- **C4 reproduced:** `node .tmp/repro-studyroom-review.cjs`, root, extracts production chat merge into installed TypeScript transpiler; exit0 final output `recovered:51,expected:121,missing:70`. Initial harness attempts failed on TypeScript syntax/default downlevel iteration and were corrected to ESNext before recording this result. Those harness errors were not application failures.
- **Not rerun here:** full messaging tests, tsc, build. Memory says prior executor passed112 messaging tests, no type errors and Next production build. Those results remain attributed to that executor, not C1. No claim that skipped/unavailable checks passed.

Temporary artifacts are regenerable under `.tmp/`; only this report is the assessment deliverable. No source fixes, test configuration changes, database commands or external messages were made for this review.

## 5. Unverified risks and blocked investigation

| Gap | Why unresolved | Next check / affected IDs |
|---|---|---|
| Database migration actually applied | Generated client/schema file does not prove publicGoal column or partial index exists in running DB | Disposable clone SQL twice, index/predicate/count assertions; then authorized deployment verification. M01,M03,M11 |
| Capacity/revision/transfer/switch races | Unit delegates mock row locks; opt-in test skipped | Guide V2 plus V5 with independent PostgreSQL sessions. H04,H10,H11,M01,M02,M09 |
| Existing raw socket receives after ban | Client unsubscribe cannot revoke a modified client; proxy refresh is periodic | Guide V6.6, publish immediately after commit, observe raw socket. H08,H13,H14. If exposure persists, concrete server transport revocation code is still required; guide currently leaves it conditional |
| Authenticated UI and two-instance convergence | No independent profiles/live transport exercised here | Guide V4/V6, include QA01–03 triggers; H01,H05–H07,H12,H14,M03–M06,M10,M12,M13 |
| Privacy matrix and historical catalog | Source guards/fixtures do not establish all deployed projections and cache data | Direct endpoints as anonymous/outsider/banned/expired/closed, legacy fixtures; H02,H03,H08,H09,M07,M11 |
| Rendered/mobile/accessibility | No browser render, keyboard/focus or viewport exercise | V4 desktop/mobile roles, modals, bans, errors, management states |
| Monetary/performance minimum | No provider bill/rates/approved budget or observed workload | V7 equal-workload seat-hour measurements. Timer arithmetic alone is not a billing result; M08,M09 |
| Remaining broad integration verification | This review reran focused suite only | Independently run messaging, tsc/build after corrections; retain exact commands/results |

These are explicit coverage dispositions, not confirmed new vulnerabilities. The source mechanisms supporting other original findings remain promising but not accepted end to end.

## 6. Correction order and completion criteria

1. Correct QA01 at SDK event boundary and test ordinary unsubscribe versus permanent denial. In parallel specify server-side transport revocation if raw socket test demonstrates continued protected delivery.
2. Correct QA02 with actual paginated catch-up and QA03 with snapshot/event ordering. Keep personal-state boundaries and coalescing intact. Update embedded guide payload/checksums when code changes, otherwise its resume guard becomes stale.
3. Rerun focused and messaging suites, typecheck and build; then execute disposable schema/index and real-concurrency gates. A generated client alone cannot close storage work.
4. Run the authenticated actor/lifecycle/recovery matrix on the final revision, followed by measured equal-workload costs and budget decision. Update memory with actual evidence per finding.

Completion requires all three QA findings resolved with the specified regressions and all applicable original27 acceptance gates either passed or explicitly left incomplete. The previous handoff has substantial executable detail; its READY-for-implementation label must not be read as accepted multi-user behavior. This report intentionally applies no fixes under the audit-only skill boundary.

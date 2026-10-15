# S6 Security and Authority Gate Ledger

## 1. Overview & Verification Status
This ledger records the verified enforcement state of security and authority boundaries for the canonical cohort builder (`undone-site` and `packages/interaction-builder`) following the execution of S6 Checkpoint 1.

| Axis | Boundary | Enforcement Mechanism | Adversarial Test Coverage | Status |
| --- | --- | --- | --- | --- |
| **1. Ownership & Tenant Isolation** | Host session → workspace / jobs / artifacts | Strict owner check in `interaction.runtime.ts`, `handlers.ts`, `release-service.ts`, `sources/route.ts`. Returns 404/403 without data leakage. | `security-enforcement.test.ts` (Axis 1): Foreign owner blocked from reading/modifying workspace, streaming events (404), or releasing (403). Foreign artifact attachment rejected (`ARTIFACT_NOT_FOUND`). | **ENFORCED & VERIFIED** |
| **2. Origin / CSRF Protection** | Cookie-authenticated mutation routes | Enforced `request.headers.get('origin') === new URL(request.url).origin` returning 403 `INVALID_ORIGIN` across `/api/interaction/v1/workspaces`, `/api/cohort-builder/intake`, `/api/cohort-builder/.../pdf`, and `/api/cohort-builder/.../release`. | `security-enforcement.test.ts` (Axis 2): Cross-origin POST rejected with 403 `INVALID_ORIGIN`. | **ENFORCED & VERIFIED** |
| **3. Request & Payload Bounds** | HTTP payloads, pagination, context limits | Enforced byte ceilings: `MAX_BODY = 256KB` on interaction actions; `850KB` on intake stream; `2MB` on PDF upload; `MAX_RELEASE_BODY = 64KB` on release route. Message pagination capped at 200 items. | `security-enforcement.test.ts` (Axis 3): Oversized body rejected with 413 `INPUT_TOO_LARGE` / `INVALID_ACTION`. | **ENFORCED & VERIFIED** |
| **4. Tool Capabilities & Actions** | Model → tool execution | Registered tools validated via strict Zod schemas (`cohortActionSchema`, `z.strictObject`). Unregistered capabilities or injected properties rejected before side effects. | `security-enforcement.test.ts` (Axis 4): Forged action types and property injections rejected in `planCohortAction` (T14). | **ENFORCED & VERIFIED** |
| **5. Release & Stale Approvals** | Approval → publication state | Readiness validation, downgrade protection (`CANNOT_DOWNGRADE_PUBLIC_COHORT`), and revision CAS check (`expectedRevision` in `releaseWorkspace` and `release/route.ts`). Mismatch throws 409 `STALE_WORKSPACE`. | `security-enforcement.test.ts` (Axis 5): Release with stale revision rejected with 409 `STALE_WORKSPACE` (T21). Release with matching revision succeeds atomically. | **ENFORCED & VERIFIED** |
| **6. Link & Source Rendering** | Untrusted content → UI rendering | React text nodes escape by default (zero `dangerouslySetInnerHTML` in user content). URL sanitization via `sanitizeHref` utility. | `security-enforcement.test.ts` (Axis 6): Neutralizes `javascript:`, `data:`, `vbscript:`, protocol-relative `//` escapes, backslashes `/\`, control characters. Preserves clean relative and HTTPS links. | **ENFORCED & VERIFIED** |
| **7. SSE Authorization** | Reconnection & session revocation | `streamEvents` verifies workspace ownership before stream opening, bounds stream lifetime to 25s, and checks ownership/status on every poll (terminates stream on 401/404/403). Re-authenticates on reconnect. | Verified via `sse.test.ts` and `streamEvents` contract tests. | **ENFORCED & VERIFIED** |
| **8. Import Boundaries & Secrets** | Browser vs Server | Server-only modules marked with `server-only`. `packages/interaction-builder` uses strict subpath exports (`/react`, `/core`, `/client`, `/runtime`, `/adapters/*`). Zero secret leakage into client bundles. | Verified via `node scripts/verify-packed-consumer.mjs` and `npm run verify:vercel` (both exit 0). | **ENFORCED & VERIFIED** |
| **9. Network & Parser Security** | Outbound requests & parsing | `web-fetch.ts` employs strict `BlockList` blocking private IPv4/IPv6, loopback, and cloud metadata (`169.254.169.254`). Socket remote address checked against resolved address (DNS rebinding defense). PDF signature check (`%PDF-`). | `security-enforcement.test.ts` (Axis 9): Metadata IP, localhost, private subnets, non-HTTPS URLs rejected (T15/T16). | **ENFORCED & VERIFIED** |

---

## 2. Dependency Gate Ledger
- **S4 Live YouTube Caption Acquisition**: **OPEN**
  - Google Data API v3 `captions.download` requires OAuth credentials from the video owner.
  - Public captions without video ownership are not supported by the official API.
  - Deterministic developer fixture (`INTERACTION_YOUTUBE_FIXTURE=1`) remains active for safe local development and test execution without paid calls or external account creation.
- **S4 GitHub Source Acquisition**: **VERIFIED**
  - Public repository tree and blob acquisition works with unauthenticated limits (60 req/hr) and rate-limit backoff.
- **S5 Learner Delivery**: **VERIFIED**
  - Atomically released into relational cohort records; progress persisted in isolated MongoDB; public promotion and downgrade protection verified.
- **S6A Rollout Preparation**: **VERIFIED**
  - Additive migration rehearsals, diagnostics CLI, fail-closed configuration profiles complete.

---

## 3. Automated Verification Evidence
1. `npx vitest run src/server/domain/cohort-builder/__tests__/security-enforcement.test.ts`: **20/20 PASSED**
2. `npx vitest run src/server/domain/cohort-builder/`: **39 test files / 245 tests PASSED**
3. `npx vitest run packages/interaction-builder/__tests__/`: **23 test files / 82 tests PASSED**
4. `npx vitest run src/client/screens/cohortBuilder/`: **9 test files / 109 tests PASSED**
5. `npm run interaction:worker:check`: **PASSED (exit 0)**
6. `node scripts/verify-packed-consumer.mjs`: **6/6 stages PASSED (exit 0)**
7. `npx tsc --noEmit --pretty false`: **PASSED (exit 0, 0 errors)**
8. `node scripts/verify-vercel.mjs`: **Full Vercel Pre-Verification PASSED in 82.2s (exit 0)**

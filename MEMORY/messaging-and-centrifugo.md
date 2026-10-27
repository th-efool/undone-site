# Messaging and Centrifugo Subsystem

Terse, path-first operational guide to the durable messaging backend, outbox dispatcher, Centrifugo v6 real-time distribution, rate limiting, and observability.

## 1. Authoritative Architecture & Boundaries

- **PostgreSQL**: Authoritative source of truth for messages, channels, conversations, participants, receipts, reactions, rate limits, attachments, and focus sessions.
- **Centrifugo OSS v6.10.0**: Ephemeral WebSocket pub/sub broker. Broadcasts committed events; never stores authoritative data.
- **Outbox Pattern**: All state mutations commit an event atomically to `messaging_outbox`. The background dispatcher claims events (`SKIP LOCKED`), dispatches to Centrifugo via HMAC-signed proxy or HTTP broadcast, and marks dispatched.
- **Access Generation Barriers**: When membership changes (leave, kick, ban), `accessGeneration` increments in DB. Centrifugo channel subscriptions are formatted `scope:id:g{generation}`. Channels with mismatched generation tokens are rejected immediately on subscription/refresh.
- **Fail Closed**: Missing production secrets, unauthenticated callers, public viewers, or deleted/banned members fail closed with 401/403.

## 2. Key Paths & Source Files

### Domain & Services (`src/server/domain/messaging/`)
- `contracts.ts`: Canonical types, error classes (`MessagingForbiddenError`, `MessagingNotFoundError`, `MessagingConflictError`, `MessagingRateLimitError`), channel naming helpers.
- `message.service.ts`: Send message, idempotent retry with `clientRequestId`, monotonic sequence numbering, content sanitization (4k char limit, null byte stripping).
- `conversation.service.ts`: DMs and Group conversation creation, participants, roles, invitations, access generation advancement.
- `interaction.service.ts`: Replies, reactions, edits, tombstones/deletions, read watermarks, deliveries.
- `rate-limiter.service.ts`: Atomic PostgreSQL sliding-window rate limiting with category budgets and RFC-standard headers.
- `metrics.service.ts`: System health classification (`healthy`, `degraded`, `critical`), dead-letter counts, oldest delivery age, Prometheus metrics export.
- `sanitizer.ts`: Message content length clamping, control character removal, safe URL scheme validation.
- `logger.ts`: Structured JSON logging with automatic token, JWT, API key, and password redaction.
- `outbox-dispatcher.ts`: Supervised outbox claiming, fencing tokens, exponential retry backoff, dead-letter threshold.

### Internal & Realtime Routes (`src/app/api/`)
- `src/app/api/internal/messaging/health/route.ts`: Private subsystem health check (gated by `x-internal-secret`).
- `src/app/api/internal/messaging/metrics/route.ts`: Prometheus scrape endpoint.
- `src/app/api/centrifugo/subscribe/route.ts`: Centrifugo subscription proxy handler (verifies session, enrollment, access generation).
- `src/app/api/centrifugo/publish/route.ts`: Centrifugo publish proxy handler.
- `src/app/api/centrifugo/token/route.ts`: Client connection JWT token issuer.
- `src/app/api/community/channels/[channelId]/messages/route.ts`: Authenticated cohort community message send/list.

### SQL Schemas (`prisma/`)
- `prisma/messaging-phase2-durability.sql`: Core messaging, conversations, outbox, deliveries.
- `prisma/messaging-phase6-conversations.sql`: DMs, groups, participants.
- `prisma/messaging-phase7-interactions.sql`: Reactions, read watermarks, edits.
- `prisma/messaging-phase8-studyrooms.sql`: Room leases, participant fencing.
- `prisma/messaging-phase9-attachments.sql`: Upload scanning, private attachments.
- `prisma/messaging-phase10-sprints.sql`: Shared sprints, room revisions, search indices.
- `prisma/messaging-phase11-hardening.sql`: Rate limit buckets table and indexes.

## 3. Verification & Test Commands

```bash
# Focused messaging test suite
npx vitest run src/server/domain/messaging/ src/app/api/internal/messaging/

# Individual suites
npx vitest run src/server/domain/messaging/__tests__/message-durability.test.ts
npx vitest run src/server/domain/messaging/__tests__/rate-limiter.test.ts
npx vitest run src/server/domain/messaging/__tests__/chaos-and-faults.test.ts
npx vitest run src/server/domain/messaging/__tests__/security-and-abuse.test.ts
npx vitest run src/app/api/internal/messaging/__tests__/health-and-metrics-routes.test.ts
npx vitest run src/server/domain/messaging/__tests__/load-harness.test.ts
npx vitest run src/server/domain/messaging/__tests__/readiness-probe.test.ts

# Readiness probe
npm run messaging:readiness

# Load benchmark execution
npm run messaging:load -- --tier=65 --seconds=2
npm run messaging:load -- --tier=650 --seconds=2 --burst --worker-kill
```

## 4. Measured Capacity Limits & SLOs
- Capacity report: `docs/messaging-capacity-and-cost-report.md`
- Single Node Centrifugo (1 vCPU / 2GB): up to ~1,500 active conns.
- Multi-node scale-out: requires Valkey / Redis shared engine.
- SLOs passed: Message acceptance p95 ≤ 750ms (0.13ms observed), transit p95 ≤ 1000ms (31ms observed), 0 lost messages (LOAD-01), 0 duplicates.

## 5. Operational Release Package & Runbooks
- Operational handoff & 12 mandatory runbooks: `docs/messaging-operational-release-package.md`
- Full test ID matrix verified: AUTH-01 through LOAD-01 (43 acceptance test targets).
- Implementing lead completion checklist: all 22 checklist items passed.

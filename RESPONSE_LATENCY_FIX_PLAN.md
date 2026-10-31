# Response latency incident — 2026-10-31

## Phase 1: evidence
Workspace a28def11-32c0-437d-ab31-83079b2393ea failed after provider overload. Message accepted 13:53:13.790, running 13:53:19.243, set_intent committed 13:53:51.570, failed 13:54:05.274 (database event clock). Model call failed after three SDK attempts. This is not the previous presentation bug. Production server logger is disabled unless public debug flags are supplied. Opportunistic dispatch discards its after() promise.

## Phase 2: scoped plan
1. Give the reusable AI adapter optional retry/deadline/output/provider policies, keeping other callers compatible. Interactive host uses zero SDK retries and bounded duration. Propagate worker cancellation.
2. Stop forcing metadata mutations for every opening topic. Preserve tools for explicit edits. Keep replies concise and useful.
3. Enable production SERVER logging with private configurable level, leaving browser debug opt-in; add correlated model/worker durations without prompts.
4. Return worker promise to after(); log dispatch failures. Preserve durable queue, transaction fences, budget accounting.
5. Test adapter policy and existing domain/dispatch contracts, build/typecheck; benchmark real model and production landing flow. No claim of a few-second successful reply until measured; provider outage cannot be hidden as success.

## Phases 3–4
Record results below as work progresses. Deploy tested code through the configured GitHub repository and verify production from the homepage. Keep source/model failures explicit; do not fabricate replies.

Local verification: adapter/runner/prompt/dispatch tests 15 passed; logger/prompt/dispatch 7 passed (overlapping suites, not 22 unique tests). Typecheck and production build passed. Live provider tests: existing 3.1 model 8.46s; selected 3.5 model 4.60s short prompt and 5.24s full application prompt/tools, one step. 2.5 models unavailable to this account; 3.8 timed out at 12s. Chat-only model override preserves heavy processing model settings. Production baseline guest test workspace 266e6944-0f47-499d-a66a-287cd7acb4c4 completed in 37.88s (server run clock), with reply persisted; navigation took 6.57s. Production after-change tests pending deployment.

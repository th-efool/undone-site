---
name: checkpoint-auto-resume
description: Continue authorized multi-checkpoint work through scheduled follow-ups after interruptions, with durable handoff notes and bounded retries. Use when the user requests automatic continuation rather than manually asking to resume.
---

# Checkpoint auto-resume

Keep substantial authorized work moving across interrupted sessions without requiring the user to repeatedly say “continue.” A scheduled follow-up is a recovery mechanism, not a guarantee of uninterrupted execution or extra usage capacity.

## Establish the continuation

- Confirm the actual objective, authorized phase boundaries and stop condition from the conversation. An instruction to continue does not authorize later gated phases, unrelated work, spending, deployment or messaging.
- Break work into small dependent checkpoints. Before implementation, record the current checkpoint plan in the project's existing ledger; create a new planning file only when needed and authorized.
- If the user requested scheduled continuation, inspect existing automations before creating one. Reuse a matching task rather than creating duplicate hourly runs.
- In Codex, use the automation tool with a heartbeat attached to the current thread (`destination: "thread"`). Use the requested interval; when none is specified, an hourly follow-up is a reasonable default. Do not invent cron workarounds.
- Put the objective, workspace, ledger path, next checkpoint, validation requirements and stopping conditions in the human-readable prompt. Exclude secrets. Preserve notification preferences in the automation configuration.

## Execute each checkpoint

1. Read the ledger and current Git status/diff. Inspect relevant implementation before assuming proposed paths still exist. Preserve pre-existing changes.
2. Resume the earliest incomplete dependency. Reconcile partial edits, tests, commits and deployment state before repeating actions.
3. Implement a bounded slice, validate its actual behavior and inspect the diff. Distinguish fixture tests, live checks and unverified claims.
4. Commit and push meaningful slices only when the user authorized those operations. Record the commit and validation evidence.
5. Update the ledger before moving on. Continue without asking for permission already granted; honor explicit phase stop gates.

## Leave a durable handoff

Update notes at each completed milestone, not only when a usage warning appears: exhaustion can interrupt without warning. Keep the handoff compact:

```text
Objective / authorized scope:
Completed checkpoints + commits:
Current checkpoint / partial changes:
Validation passed / failed / not run:
Blockers and concrete evidence:
Next exact action and dependencies:
Automation ID / interval / retirement condition:
```

Include commands or artifact paths needed to resume, but never credentials. Record whether external mutations actually succeeded so another run does not duplicate them. Notes must distinguish “planned,” “implemented,” “validated” and “deployed.”

## Recover without spinning

- Scheduled runs remain subject to account limits, app availability and tool permissions. Never promise they bypass caps or restart immediately when quota resets.
- If another run is active, do not launch duplicate work or race its mutations. Re-read the latest checkpoint when execution becomes available.
- For repeated quota failures, missing credentials or unreachable services, record the blocker and stop dependent work. Continue independent work where useful. Do not repeatedly spend paid calls or retry unchanged failures.
- Stay quiet when unchanged or non-actionable. Notify for meaningful completed checkpoints, material failures or required user action.
- Once the objective is verified complete, retire the automation through the supported update/delete operation. If the user pauses or cancels, update it accordingly. Do not leave a completed task waking forever.

## This repository

The current cohort visual-repair ledger is `plans/cohort-creation-end-to-end-repair-plan.md`; comparisons live under `plans/before-after/`. These are examples of durable project state, not permission to expand another task into cohort work. This file is saved under `docs/` as requested; saving it here alone does not install it into Codex's automatic skill discovery.

# Fix video quest structure, complete playback coverage, overlap, and durations

Status: inspection complete; implementation proposed, not executed.

## Required result

Different source videos remain separate video lessons. One source video must appear once, with its original title and ordered parts underneath:

```text
There's never been a better time to go into math: …
  Part 1   [start–end] [actual duration]
  Part 2   [start–end] [actual duration]
  Part 3   [start–end] [actual duration]
  …
  End
```

`End` marks the actual end of the video, not another empty chunk. No repeated parent video rows for individual observations, no Part 0, no repeated source title beside every part, no omitted playback seconds, and no fabricated 3-minute durations.

The existing code expresses a 60-second minimum target and 15-second successive playback overlap. Preserve these as the implementation baseline. A genuinely short video can have one short part; merge tiny trailing remainders into the preceding part when practical.

## Inspection findings

The screenshot shows repeated source titles, one chunk per lesson, Part 0, 0:00–0:04 followed by 0:11–0:20, and identical 3m labels. It establishes a displayed coverage gap; it does not establish that the underlying video file lost frames.

1. **Assembly makes chunks into separate lessons.** `src/server/domain/cohort-builder/text-pipeline.ts`, `computeTextStage`, maps `state.chunks` directly into generated lessons with titles derived from observation text. Its acceptance path requires lesson count to equal chunk count. `text-assembly-processor.ts` repeats that count requirement. Delivery faithfully publishes each resulting lesson. This is a structural problem upstream of the UI.
2. **Text coverage is not video timeline coverage.** `text-pipeline.ts`, `splitSource`, currently groups timed locations toward 60 seconds and validates retained text characters. It does not require coverage from video time zero to the source duration. Its 24 KiB evidence bound can also produce smaller units. `src/server/domain/cohort-creation/material-observation.ts` explicitly permits and records unobserved temporal gaps. Observation intervals are evidence anchors, not a complete playback partition.
3. **Overlap is not guaranteed by the current helper.** `src/shared/cohort-builder/cohort-metadata.ts`, `deriveChunkVideoInterval`, extends a raw end by 15 seconds, clamped to the final observation end. It does not inspect the next chunk's start. A gap greater than 15 seconds still leaves missing playback; a smaller gap reduces the actual overlap. Leading/trailing video content outside observations is also excluded.
4. **Another chunking path changes duration without changing playback anchors.** `src/server/domain/cohort-creation/chunking.ts`, `groundChunkBoundaries`, calculates a minimum duration and backward overlap but leaves `sourceRefs` unchanged. Its existing minimum/overlap test checks duration numbers only. This cannot prove playable interval coverage or real overlap. Verify whether this path serves the affected cohort before changing its behavior, but align any active video path with the same contract.
5. **Part 0 is a direct indexing leak.** `src/shared/cohort-builder/delivery.ts` stores zero-based chunk order; `LessonRow.tsx` renders `Part {chunk.order}`. `delivery.adapter.ts` also assigns the source label as every chunk's title, explaining the repeated title within parts.
6. **Duration behavior differs between the screenshot and current local code.** Current `delivery.ts` calculates video lesson duration from chunk intervals; its 180-second floor is now limited to non-video lessons. Summing overlapping intervals still inflates a grouped video's duration. `delivery.adapter.ts` persists the duration and labels every chunk as `reading_estimate`, even for video. `cohortStore.ts` contains 3-minute chunk fallbacks. These are verified problems/candidates, but the exact origin of the screenshot's 3m requires checking the affected persisted payload and deployed revision.
7. **Fallbacks can hide missing timing.** `src/server/infrastructure/db/postgres/mappers/cohortMapper.ts` synthesizes five-minute chunks for missing chunk arrays and substitutes zero timestamps. Player/feed paths also need inspection during implementation so missing timing does not become apparently valid playback.

Scope of evidence: local source and supplied screenshot inspected. No production database, deployed revision, or actual retained artifact for this cohort was inspected. Current local 60-second grouping and duration logic mean it would be incorrect to attribute every screenshot symptom to today's code without that comparison. `directives/process_video.md` and `execution/inspect_videos.py` concern local media encoding/inspection, not this curriculum projection.

## Implementation sequence

### 1. Capture a reproducible affected-cohort fixture

- Resolve the exact cohort/workspace from the supplied page and authorized application data. Read its saved sources, source duration/provenance, observation locations, chunks, generated lessons, delivery payload, and deployed code/version.
- Compare saved output with current deterministic projection. Identify stale artifacts, publication snapshots, and mapper fallbacks separately.
- Retain a sanitized regression fixture for the observed 0:00–0:04 / 0:11–0:20 gap, repeated lessons, and 3m labels. Keep transient inspection output in `.tmp/`; never copy secrets into fixtures.

### 2. Define a source-level playback plan

- Introduce one shared, deterministic playback planner using the ordered parts and verified full video duration. Keep immutable text/evidence offsets separate from playable time ranges.
- Partition the full timeline into contiguous core intervals covering exactly `[0, videoDuration]`. Use meaningful boundaries near the existing 60-second target; merge tiny adjacent fragments/remainders. Internal byte-bounded evidence units must not force tiny learner-facing parts.
- Add 15 seconds of context across each successive boundary, clamped to the video end. Validate actual interval intersection, not a claimed overlap field. Consolidate boundary cases where a tiny final interval cannot satisfy the normal rule.
- Example for a 180-second source: playback parts `0:00–1:15`, `1:00–2:15`, `2:00–3:00`. This covers the full video and has 15 seconds of real overlap at each boundary.
- Explicitly include leading, internal, and trailing regions with no observations in playback. Do not invent a transcript or claim those regions were analyzed. Preserve observation limitations independently. If complete semantic analysis is required, missing observations require reacquisition/review, not fabricated summaries.
- If duration/timing cannot be verified, surface that limitation and block acceptance as a complete timed video. Do not substitute 0, 1 second, or 180 seconds as known duration.

### 3. Generate one video lesson containing all its parts

- Update `text-pipeline.ts` assembly and `text-assembly-processor.ts` validation together: group video chunks by canonical source identity/version in source order, and generate one stable lesson per video source with the original video title.
- Keep different videos separate even when their titles match. Preserve non-video behavior unless required by a shared invariant.
- Replace `lessons.length === chunks.length` checks with complete, ordered, exactly-once evidence membership checks appropriate to grouped lessons.
- Update `text-assembly-acceptance.ts`, `lesson-projection.ts`, preview, and delivery to use identical grouping. Handle pinned/manual lessons explicitly so old generated rows cannot survive beside the new grouped row or erase intentional edits.

### 4. Carry truthful timing and labels through delivery

- Extend shared contracts as needed for playback/core ranges, timing availability/provenance, and part identity. Use the shared playback plan in builder preview, delivery, persisted chunks, questline, and player/feed.
- In `delivery.ts`, set the full-video parent duration to verified source duration. Set each part duration to its actual playable end minus start. Do not sum overlapping parts to obtain unique source duration; keep any replay-inclusive study estimate separately named.
- In `delivery.adapter.ts`, retain accurate timing provenance, part metadata, and identifiers instead of labeling videos as reading estimates or duplicating the parent title.
- In `cohortMapper.ts`, `cohortStore.ts`, and the connected player/feed adapters, remove fabricated timing fallback behavior for these video records. Format short durations in seconds and longer durations as minutes plus seconds.
- In `LessonRow.tsx`, render one parent row, child labels Part 1 through Part N, and an end marker. Keep internal ordering zero-based; convert only at the display boundary. All jump links must resolve to the same stored playable starts/ends.
- Update lesson/quest counts, completion totals, season summaries, and navigation to reflect grouped video lessons with independently tracked parts.

### 5. Repair existing output safely

- Version the changed chunking/assembly/delivery algorithms and publication hash inputs. Preserve acquisition identities and reusable retained source artifacts; do not bump the global algorithm version indiscriminately or rerun paid observation by default.
- Implement a dry-run repair that reports old/new lesson counts, part ranges, coverage gaps, overlap, durations, and ID mappings for the affected cohort.
- Rebuild from retained evidence and verified duration. Replace stale generated lessons rather than appending another set. Handle manual edits and existing learner progress through explicit mappings; do not mark newly included content complete merely because old fragments were complete.
- Materialize through existing transactional/idempotent release paths. Preserve rollback data and avoid creating a duplicate learner cohort when the user expects the existing cohort repaired. Confirm the publication identity/update strategy before applying repair.
- This planning task performs no regeneration, paid provider calls, production writes, or deployment.

### 6. Regression checks and acceptance

- One video with many observations produces exactly one parent lesson and sequential Part 1…N. Two distinct videos produce exactly two parents, including when titles match.
- Playback interval union equals the complete verified video timeline: first start 0; last end full duration; no internal gap, including 0:04–0:11. All bounds are valid and monotonic.
- Successive intervals have real 15-second overlap under the normal rule. Short-source/end cases are explicitly tested and consolidated as needed.
- Ordinary non-final parts meet the 60-second baseline without merely inflating a duration field. Test sparse observations, byte-limit splits, Unicode evidence, leading/trailing gaps, and tiny remainders.
- Exact retained evidence and checksums remain intact. Added playback context never masquerades as observed text. Missing metadata produces an explicit incomplete state.
- Parent duration equals the full source duration; part duration equals actual interval length. No blanket 3m label, no overlap double-counting, no Part 0, and no repeated parent title in child rows.
- Exercise the complete projection → persistence → mapper → questline/player path; verify links, part transitions, progress, counts, and restart/idempotent repair behavior.
- Expand existing focused tests in `text-pipeline.test.ts`, `text-assembly-acceptance.test.ts`, `text-assembly-processor.test.ts`, `cohort-metadata.test.ts`, `delivery.test.ts`, `cohortMapper.test.ts`, and the applicable creation chunking tests. Add a focused LessonRow regression and run type checking after implementation.
- Inspect the repaired cohort visually at desktop and mobile widths. Verify the actual saved/reloaded output, not just a mock.
- Update `MEMORY/cohort-builder-processing.md` with the new grouping/playback contract after implementation; leave the unrelated media-encoding directive unchanged.

## Completion condition

The affected existing cohort displays each distinct video once, with correctly numbered substantial parts, complete start-to-end playback, real successive overlap, truthful durations, working navigation, and preserved/mapped learner state. Passing unit tests alone is insufficient; the persisted cohort must meet these conditions after reload.

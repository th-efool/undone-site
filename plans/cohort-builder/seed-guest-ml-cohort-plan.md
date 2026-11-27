# Seed Guest ML Cohort Plan

## Goal
Create a real, published public Machine Learning cohort built from the 3 user-supplied YouTube lectures/videos (`DATnpGoGhM8`, `E0Hmnixke2g`, `aircAruvnKk`), populate Postgres and MongoDB records so `/api/feed`, `/play`, `/home`, `/explore`, and `/cohort/[id]` render complete content, and subscribe `guest@undone.com` (`guest-undone`) to it.

## Steps
1. Create an idempotent seeding script `scripts/db/seed-guest-ml-cohort.ts`:
   - Fetch verified YouTube metadata (`YoutubeMetadataReader`) for all 3 videos.
   - Extract real description chapters for `E0Hmnixke2g` and `aircAruvnKk`, and observe `DATnpGoGhM8` using `VercelMaterialObservation` (Gemini video observation with safe metadata fallback if needed).
   - Score chunks and full lessons using `VectorScoringService` (12D pedagogical vectors + linearity metadata) with deterministic fallback.
   - Upsert the `Cohort` (creator `user_alpha@undone.com`), `CohortSource` rows, `Season`, `Lesson` rows with `chunks` JSON, `Community`, `Channel` rows (`general`, `resources`), and `CohortMember` rows (`user_alpha` as `CREATOR`, `guest@undone.com` as `EXPLORER`) in PostgreSQL.
   - Upsert `CohortTranscript`, `Chunk`, and `UserCohortConfig` (for `guest@undone.com`, active, unpaused, unhidden, rank 1) in MongoDB.
2. Execute `scripts/db/seed-guest-ml-cohort.ts`.
3. Verify end-to-end by calling `loadAuthorizedFeedCatalog`, `generateFeed`, `loadHomeForUser`, and checking Postgres + MongoDB counts for `guest@undone.com`.

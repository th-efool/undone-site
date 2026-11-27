# Upfront YouTube Embeddability Validation Plan

## Goal
Reject non-embeddable YouTube videos (`status.embeddable === false`) at validation/metadata time across all server and client intake paths—before transcript extraction, chunking, AI observation, or cohort submission—so users see a clear replacement error instead of hitting YouTube Error 150 in `/play`.

## Validation Gates
1. **Metadata & Playlist API (`GET /api/import/youtube/metadata`)**:
   - Single video: fetch `part=snippet,status`; return HTTP `422` (`code: 'YOUTUBE_NOT_EMBEDDABLE'`) and cache it when `status.embeddable === false`.
   - Playlist: batch-check `videos?part=status` for up to 100 items, filter out `embeddable === false` videos, report `skippedUnembeddableCount`, and return `422` if none are embeddable.
2. **YouTube Search API (`GET /api/import/youtube/search`)**:
   - Batch-check `videos?part=status` for returned video IDs and filter out `embeddable === false` videos before caching/returning.
3. **Server Readers & Observation (`YoutubeMetadataReader`, `LiveVideoObservationProvider`, `youtube-import.service.ts`)**:
   - Reject `status.embeddable === false` during metadata read, prior to `beforeCall` / Gemini model invocation or chunking.
4. **Client UI (`useComposerAttachments`, `LearningPromptBar`, `ChatPane`, `MaterialStageView`, `DiscoveryStageView`)**:
   - Surface the `422` error message immediately on the attachment/form and block submission (`hasError`) until the user removes or replaces the non-embeddable video.

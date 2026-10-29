# Composer & Client-Device Source Extraction Architecture

## Authoritative Contracts & Modules

- `src/shared/cohort-builder/hash.ts`: Pure isomorphic SHA-256 implementation producing identical hexadecimal output to Node's `crypto.createHash('sha256')`. Zero dependencies, synchronous, WebWorker/browser/serverless safe.
- `src/shared/cohort-builder/source-kind.ts`: Canonical `detectSourceKind(urlOrText)` mapping inputs to `'youtube' | 'github' | 'notion' | 'pdf' | 'web'`.
- `src/shared/cohort-builder/client-pipeline.ts`: Authoritative deterministic pure pipeline: `MAX_UNIT_BYTES`, `MIN_VIDEO_CHUNK_MS`, `byteLengthUtf8`, `sourceFingerprint`, `splitSource`, `validateCoverage`, `validateChunk`, `buildGeneratedLessons`, `validateGeneratedLessonCoverage`, and `runDeterministicPipeline`. Re-exported by server domain text pipeline.
- `src/client/lib/sourceExtractors/`:
  - `pdfClientExtractor.ts`: Page 1 thumbnail rendered to `<canvas>`, text extracted with character spans via bundled worker `pdfjs-dist/build/pdf.worker.min.mjs`. Scanned/empty PDFs raise an honest error rather than fabricating text.
  - `youtubeClientExtractor.ts`: Fetches `/api/import/youtube/transcript?videoId=...` for real captions grouped into ~90s windows. Falls back to factual metadata and chapters (`estimatedIntervals: true`, honest limitation note).
  - `githubClientExtractor.ts`: Fetches up to 25 repository files via GitHub REST API with `pLimit(6)` concurrency.
  - `webClientExtractor.ts`: Server proxies HTML with `<script>`, `<style>`, `<noscript>`, `<svg>` stripped; client native `DOMParser` extracts clean article text.
- `src/client/components/global/Composer/`:
  - `useComposerAttachments.ts`: Attachment state manager with URL deduplication, playlist fan-out (up to 100 videos using returned batch metadata), and a 3MB UTF-8 total text budget (`MAX_TOTAL_TEXT_BYTES`).
  - `LinkRows.tsx`: Multi-row link input.
  - `AttachmentTray.tsx`: File cards displaying Page 1 PDF previews, extracting spinners, and remove buttons without retaining raw `File` byte buffers in state.
  - `SourceIcon.tsx`: Lean vector brand icon primitive.
- `src/client/screens/cohortBuilder/`:
  - `CohortInteractionScreen.tsx`: Single persistent component tree using `data-layout="centered" | "split"`. Keeps `<ChatPane />` mounted during `chat` ↔ `recommendations` transitions, preserving user drafts and scroll state.
  - `ChatPane.tsx`: AI chat pane styled via parent `data-layout` without `!important`.

## Critical Invariants

1. **Client-Device Execution First**: Extraction of user files (PDF, web DOM, GitHub files) executes on the user's browser, preventing CPU-intensive processing or binary uploads in Vercel Serverless Lambdas.
2. **Payload Size Boundaries**: Client enforces 3MB total text budget across all attachments; server intake route accepts up to 3.5MB stream before throwing 413 `INPUT_TOO_LARGE`. `saveIntakeDraft` catches `QuotaExceededError` and retries storing without `sources` to guarantee reliability.
3. **Draft Retention**: LearningPromptBar drafts are persisted synchronously on debounce and `beforeunload`. Keyboard shortcut `Shift+Enter` submits in `plan` mode. Submit buttons are gated while extraction is in flight (`isExtracting`).
4. **Tool Parity & Context Excerpt Budget**: `ALWAYS_TOOLS` (`start_search`, `set_intent`) are exposed in all active interactive journey stages. Prompt excerpt budget is stage-aware: 2,000 chars per source during early exploration/materials; 240 chars once lessons and chunks are generated.

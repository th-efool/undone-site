# Planning unexpectedly opens publication preview

## Confirmed incident

Workspace: `9ccf27b6-a889-4deb-a499-dd672425244a`. Read production events and current snapshot, without modifying the user's workspace.

The initial VC question received a conversational outline. The follow-up `okay so how do i start` produced four committed `add_lesson` actions in run `34db6922-2eea-4511-bbf9-8a36175d2a83`. No explicit review navigation action appears in the event history. Current journey is `review`, branch null, `processingStarted: false`; processing is idle, jobs empty, fingerprint null.

## Confirmed code defects

1. `src/shared/cohort-builder/contracts.ts`, `add_lesson`: adding a lesson in chat changes `journey.step` to review and can mark processing ready. Content mutation therefore implicitly navigates and claims readiness. The regression test in `__tests__/contracts.test.ts` explicitly expects this faulty behavior, explaining why passing tests did not catch it.
2. `src/shared/cohort-builder/cohort-metadata.ts`, `deriveCohortTitle`: an intent longer than six words falls through to the first source label before falling back to the intent. An unrelated `YouTube Video` attachment can become the cohort title.
3. `deriveCohortDescription` advertises source labels as supporting the learning goal without a relevance decision. Merely attaching a source is treated as evidence of topic alignment.
4. `context.ts` instructs proactive curriculum creation. The ambiguous follow-up was interpreted as acceptance of the previous outline. Regardless of that interpretation, adding draft lessons must not open publication preview.

## Implementation sequence

1. Trace the existing explicit curriculum/review controls and publication guards before changing navigation. Preserve a reachable, deliberate preview path for both manually authored and source-generated curricula. Do not simply delete the automatic transition and strand manual drafts in chat.
2. Make `add_lesson` a content-only operation: preserve journey step and processing status. Add an explicit user-facing review action for manual drafts using the existing action framework; keep generated-source readiness checks intact. Preview and publish must remain distinct operations.
3. Keep planning UI available with saved draft lessons. Display those lessons as a draft curriculum, without publication controls or fabricated processing completion. Inspect legacy workspaces already moved to review: offer a reversible return-to-planning control, not a bulk database rewrite.
4. Treat “how do I start?” as guidance unless the conversational context clearly authorizes creation. Never infer preview/publish authorization from it. Prompt clarification complements deterministic navigation rules; it cannot replace them.
5. Prefer explicit user-authored metadata, then the learning intent for planning drafts. Do not let the six-word threshold redirect ownership of the topic to an attachment. Describe attached sources neutrally until actually processed and assessed; do not claim relevance from filenames/titles alone. Preserve source-only workflows.

## Required regression matrix

- Exact two-turn VC example with three unrelated YouTube attachments: stays in planning, no publish panel, VC topic retained.
- Same conversation without attachments; with relevant attachments; with mixed sources.
- Explicit “add those four lessons”: lessons saved, planning preserved, processing status unchanged.
- Explicit review control for manual drafts reaches preview; returning to planning preserves edits.
- Generated-source review remains blocked until required accepted processing artifacts exist; failed/queued jobs cannot become ready via manual lesson insertion.
- Long intent, generic YouTube label, custom title, source-only intake: metadata precedence verified separately.
- Reload and live SSE updates produce the same stage; mobile and desktop preserve the active conversation.
- Publication still requires its existing validation and explicit user action.

## Homepage Plan attachments — additional required behavior

User clarification: links and files supplied with a homepage Plan message are saved references for possible later cohort creation. They can enhance planning through metadata only. They must remain visibly associated with that submitted message, above its text bubble (the marked area in the screenshot). Attachment submission does not authorize extraction, curriculum generation, processing, preview, or publication.

### Verified current behavior and failure points

- `src/client/components/global/Composer/useComposerAttachments.ts`: `addLink` invokes `extractSingleLink`; YouTube metadata is followed by `extractYoutubeClient`, GitHub by file extraction, and web URLs by article extraction. `addFiles` immediately extracts PDFs or reads full text. This happens before submission, not just inside the cohort worker.
- `src/shared/cohort-builder/intake.ts#initialCohort`: retains `sources` with `processingStarted: false` and idle processing for Plan. Preserve this existing deferred pipeline behavior; do not introduce another queue service.
- `src/server/infrastructure/db/postgres/cohort-intake.ts#acceptCohortIntake`: the first user message contains only `{type:'text', text:body.prompt}`. Sources live in the workspace but have no message association. This is why the submitted links disappear from the visible conversation.
- `src/server/domain/cohort-builder/context.ts`: planning includes up to 2,000 characters per source plus retained chunk evidence. Stage-based excerpt shortening is not a metadata-only boundary.
- `src/client/screens/cohortBuilder/ChatPane.tsx`: generic `entity_ref` rendering assumes every reference is a lesson, including its label and click target. Simply adding source references without changing this renderer would create broken attachment chips.
- `restoreSources` in the composer ignores sources with empty text. Metadata-only queued links would disappear on draft restoration unless this is updated.

### Exact implementation boundaries

1. **Separate attaching from processing.** Make the homepage attachment collector retain identity, canonical URL or durable file reference, source kind and bounded display metadata. Fetch YouTube title/channel/duration/thumbnail or webpage title/domain where supported; never fetch transcripts, repository file contents, or article bodies for a Plan reply. Metadata failure retains the URL with a neutral fallback label and a retryable status. Sending must not wait on optional metadata enrichment. Do not fabricate a content checksum, extraction provenance or `ready` extraction state for metadata.
2. **Cover mode switching.** Homepage mode selection currently happens after users may have attached sources. Collect references before mode selection; invoke the existing extraction path only at the authorized creation/processing boundary. Switching to Plan must not leak already extracted content into the model context. Do not regress non-Plan source processing.
3. **Reuse canonical source storage.** For URL references, retain existing `CohortSource.input`, empty `text`, null checksum and queued state. Respect the current input schemas: YouTube transcript mode requires a real track; use the supported video-observation descriptor when a track is not selected, never invent one. Preserve canonical URLs, stable IDs, deduplication, ownership, and intake retry identity. Add only bounded optional metadata fields genuinely absent from the schema, if needed; do not duplicate the entire sources collection in a new queue table.
4. **Files must survive navigation/reload.** Persist uploaded bytes through an owned durable upload reference before claiming the file is saved for later. The current browser `File` object and thumbnail blob URL are not durable storage. Inspect/reuse `src/server/infrastructure/db/postgres/cohort-pdf-upload.ts` and existing upload ownership contracts; its workspace-bound route cannot simply be called before intake. Implement the smallest compatible intake/upload sequence and show pending/error states until retention succeeds. Audit text-file retention separately: do not silently discard it or falsely claim that metadata alone preserves file content. Binary retention is allowed; its contents must not enter the planning prompt. Never remove the draft on a failed upload.
5. **Persist message association in the same acceptance transaction.** Reuse the existing `entity_ref` message part with `entity.kind: 'source'`, stable source ID/version, and submitted label, alongside the text part. Attach only the sources submitted with that specific message. Do not reconstruct historical attachments from every source currently in the workspace. Preserve label fallback after removal, without relinking to another source. Check message-part limits against intake attachment limits (100 sources plus text can exceed the existing 100-part contract); reconcile limits explicitly rather than silently truncating attachments. Keep lesson-selection references working.
6. **Metadata-only model context is enforced in code.** Before deliberate cohort processing, serialize only a bounded allowlist: label, source kind, canonical public URL/domain, title, channel/author if available, duration, filename/type/size. No transcript, source text, chunk text, extracted PDF text, repository contents or embedded metadata masquerading as document content. Bound descriptions if retained. Apply this rule to legacy workspaces with extracted content too, not just new attachments. Ensure message-to-model serialization resolves source references to metadata only. Treat metadata as untrusted descriptions, not instructions or proof of relevance. Unrelated sources must not overwrite the user's topic.
7. **No implicit activation by the assistant.** Remove the prompt instruction to immediately call `begin_material_processing` merely because URLs were supplied. Audit `createCohortAiTools`, action admission and source reconciliation so initial Plan messages cannot activate acquisition/processing via a tool. Entering a material-selection page prepopulates retained references; processing starts only with the deliberate creation action. Enforce authorization in the existing server action/tool boundary, not only in prompt wording. Ordinary “how do I start?” must leave references pending.
8. **Render attachments above each user text bubble.** In `ChatPane.tsx`, partition that message's source references from text/lesson references. Render a small right-aligned strip immediately above its bubble: source icon, readable truncated title/filename, optional thumbnail and pending/failed indication where relevant. Use one compact horizontal scroll row on narrow screens, with keyboard-accessible link/detail targets and accessible full labels; prevent page-wide overflow. Reuse `SourceIcon` and existing visual primitives. The editable composer tray's remove controls must not accidentally mutate submitted historical messages. Clicking a submitted attachment must not open curriculum preview or start processing. Removed sources retain a non-clickable historical label.
9. **Handoff to creation.** At the materials step, preload the same saved source IDs once, show what is available or failed, and allow removal before processing. No re-pasting links or re-uploading successfully retained files; no duplicate acquisition jobs on retry or double-click. Do not label retained references as processed or relevant before actual processing.
10. **Restoration and backward compatibility.** Update draft save/restore and source-to-composer conversions to support empty-text references. For older conversations without message references, do not invent which message contained which source. A workspace-level retained-materials indicator is an honest fallback. New messages must have exact associations. Guest/auth redirects and quota failures must not silently lose attachments.

### Required additional tests and production acceptance

- Plan with three YouTube URLs: metadata requests allowed; transcript/extraction endpoints and processing job scheduling are not called. First reply receives metadata, not transcripts.
- Use a unique sentinel in retained source text and chunk text; assert it is absent from both system context and serialized model messages while planning, including a legacy extracted workspace. Metadata title remains available.
- Intake transaction persists text plus source references; retry creates neither duplicate sources nor duplicate messages. Reject malformed/cross-owner upload references.
- Metadata timeout/failure does not block the text reply or drop the link; delayed metadata does not change intake identity or duplicate the attachment.
- Restore queued empty-text links after refresh, auth redirect, retry and Plan toggling. Successfully retained files remain accessible after browser navigation; failed uploads remain visibly retryable.
- Two user turns with different attachments show each set only above its own bubble. Lesson refs keep their existing behavior. Historical chips remain intelligible after source removal.
- Mobile and desktop visual checks: chips above message, keyboard accessible, no page overflow, long names and many attachments handled, no stray processing/publication navigation.
- “How do I start?” keeps sources pending; deliberate creation prepopulates materials once; deliberate processing schedules the canonical source jobs once. Failed or irrelevant references do not get promoted to verified evidence.
- Exercise maximum attachments against message-part and request-size limits; no hidden truncation.
- Repeat the actual VC + unrelated YouTube scenario from the homepage on undone.one; measure time to visible reply and verify network requests, saved associations and later material handoff. A quick reply alone is not acceptance.

### Scope and completion reporting

This is one coordinated repair with the navigation/metadata fixes above. Preserve existing creation, upload, lesson selection and publication features. No new runtime dependency, parallel attachment database or second processing queue is justified. Report implementation, local tests and production verification separately; do not mark these requirements complete because this plan was updated.

Diagnosis confirmed. This document is a repair plan, not a claim that the incident is fixed. No production workspace was edited. Earlier latency work remains separate: final homepage-visible timing verification must still be completed after deployment of the canonical SSE event fix.

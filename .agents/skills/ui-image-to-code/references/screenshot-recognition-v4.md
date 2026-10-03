# Screenshot to UI and UI Document V4

Use this workflow when a screenshot must become reviewed, editable UI structure before Codex generates or updates production code.

## Product contract

The feature is **Screenshot to UI**, not OCR and not a screenshot-backed page:

> screenshot → visual analysis → candidate layers → evidence fusion → human review → UI Document V4 draft → Codex source generation → browser comparison.

The uploaded bitmap is editor-only evidence under `.ui-studio/references/`. Never inject it into production DOM, slice it into fake components, or claim that detected rectangles equal 95% fidelity.

The bundled deterministic analyzer detects boundaries, separators, connected edge regions, likely containers, text-line candidates, images, controls, and colors. It can merge bounded OCR JSON, infer Flex/Grid/repeated groups, and calibrate a matching same-origin production page through stable `data-ui-id` nodes. It does not bundle a language OCR engine or guarantee semantic understanding without evidence.

## Six-step workflow

1. **Screenshot**
   - Offer `Choose screenshot` as the single primary action and `Use project reference` as a secondary action.
   - Validate PNG/JPG/WebP, 12MB limit, dimensions, blur/compression, browser chrome, watermarks, and viewport mismatch.
   - Persist a visible intake-quality report before analysis. When bounded OCR becomes available, conservatively reject known operating-system overlays such as Windows activation text and URL-like address-bar text near the top edge; record the rejected count and reason instead of generating editable text layers from contamination.
   - Explain beside the action: analysis does not modify production code; only a confirmed draft creates a new project revision.
2. **Analysis**
   - Expose only `Quick analysis` and `Precise analysis (recommended)`.
   - Quick uses pixel structure and basic regions. Precise runs pixel structure and layout/repetition, detects available OCR/DOM adapters, and reports what can be fused.
   - Never apply DOM calibration merely because dimensions match. Matching dimensions only make the adapter available. Choosing `Use project reference` is the explicit same-origin provenance confirmation, so Precise analysis may fuse its DOM, text, and layout evidence automatically; an arbitrary upload must still require manual confirmation.
   - Show real progress and adapter states. Precise analysis first attempts the browser's bounded OCR adapter, then the loopback bridge falls back to Windows Media OCR on Windows or an existing Tesseract CLI on supported systems. The bridge uses a short-lived local PNG and deletes it after recognition; it must not upload screenshots to a remote OCR service. If all adapters are unavailable or unsuccessful, say why and offer OCR JSON in Advanced options as a fallback. Never require consumers to understand OCR JSON for the default path, auto-download large models, or claim an adapter ran when it did not.
3. **Fusion**
   - Preserve provenance for Pixel, OCR, DOM, Layout, and Human evidence.
   - Never treat single pixel evidence as semantic proof. DOM is exact only for the same rendered page and viewport.
   - Fuse matching evidence into the existing stable candidate instead of replacing the pixel candidate list or creating parallel copies. Exact DOM evidence may correct the matched candidate's type, source mapping, content, and bounds; unmatched DOM/OCR evidence becomes a new candidate with a valid inferred parent.
   - Deduplicate only highly overlapping, type-compatible candidates. Keep the stronger evidence identity, redirect children from the removed duplicate, and record matched, added, and deduplicated counts.
4. **Review**
   - Use three mutually exclusive states: `accepted`, `review`, and `excluded`.
   - Auto-triage as `accepted` only a page boundary, an exact matching DOM node, or a candidate with confidence at least `0.92` and at least two independent evidence sources. This is a machine proposal, not Human approval: it must keep `humanConfirmed: false` until the user explicitly accepts that candidate.
   - Put other candidates in review; auto-exclude only clearly weak non-page candidates below `0.45`, plus tiny edge fragments classified as noise when they have Pixel evidence only. Exact DOM, OCR, or Human evidence always overrides the pixel-noise hint.
   - After explicit same-origin DOM fusion, a long thin Pixel-only border fragment may be marked `absorbed-edge` only when one exact DOM edge—or a union of collinear exact DOM edges—covers at least 72% of the fragment's long axis within a 12px source-space tolerance. Persist the matched target IDs, orientation, overlap, and distance. Thinness alone is never exclusion evidence, internal dividers without a matching DOM edge remain in review, and Human-confirmed candidates are immutable to this rule.
   - Default the evidence canvas to selected, hovered, top-level, and review candidates. “Show all outlines” and “Show labels” are explicit toggles.
   - Diagnose high same-parent overlap into probable duplicate, text overlap, different semantic types, or weak single-source overlap. Show both candidate names, overlap ratio, reason, Human protection, and a conservative recommendation. Provide `Locate other`, `Merge`, `Keep both`, and `Exclude weaker`; persist explicit resolutions. Never auto-merge, and never auto-exclude a Human-confirmed candidate.
5. **Generate**
   - Rename the outcome action to `Generate editable layers`.
   - Disable generation until the review queue is empty, every accepted node has explicit `humanConfirmed` evidence, and the user explicitly confirms the final review summary. A batch reliability action may classify candidates but must never mint Human evidence.
   - Save accepted nodes only. Unresolved review items do not enter `nodes[]` or the 95% gate; never provide a hidden code path that bypasses this gate.
   - Show a preflight summary: accepted regions/text/icons/controls, unresolved candidates, missing OCR content, missing parents/layout, overlap conflicts, and repeated groups. Separate blockers from warnings; when only warnings remain, make the confirmation label state exactly how many warnings the user is accepting.
   - Audit the generated accepted-only parent graph before enabling generation. Resolve through excluded intermediate containers to the nearest accepted ancestor; block missing parents, cycles, probable duplicates, and weak-evidence conflicts. Missing text and intentional/different-type overlap remain explicit warnings until the user confirms them.
   - Write a new UI Document V4 revision and semantic `analysis.generate-editable-layers` operation. Do not overwrite production source.
6. **Validate**
   - Offer `Continue editing structure` and `Open comparison`.
   - Codex translates the reviewed document into real source, then the browser gate evaluates structure, geometry, typography, assets, effects, responsive behavior, interactions, accessibility, code quality, and editability.

## Three-surface review layout

Each surface has one job:

- **Left:** mutually exclusive review queue, state/type filters, and safe batch actions (`Smart triage`, `Accept reliable`, `Exclude weak`, `Check conflicts`). `Smart triage` preserves Human decisions, classifies only reliable multi-source evidence as accepted proposals, excludes only weak/noise Pixel-only fragments, and leaves all ambiguous candidates in review. It never sets `humanConfirmed`. Never expose `Accept all`.
- **Center:** source screenshot and evidence overlays only. Keep the image readable; avoid hundreds of permanent labels.
- **Right:** current candidate name, type, recognized text, parent, layout role, bounds, evidence chips, and actions.

Right-side corrections must include accept, review, exclude, merge overlap, split candidate, set parent, reclassify as text/icon/control, mark repeated component, undo, and a contextual conflict card that explains the other candidate and the safe next action.

## Evidence and status model

Store:

- `source.references[]`: stable ID, name, constrained same-origin PNG path, dimensions, timestamp.
- `nodes[]`: accepted page/section/frame/text/icon/image/control/divider nodes only.
- `evidence.runs[]`: analyzer version, reference ID, candidate/accepted/review/excluded counts, metrics, timestamp.
- `evidence.items[nodeId]`: confidence, all evidence sources, observed bounds, classification, optional source node ID, OCR confidence, layout hint, and human confirmation.
- `tokens.color`: sampled colors namespaced by reference ID.
- `manualQueue[]`: a safety record for legacy/imported accepted nodes still requiring an explicit later decision. New generation is blocked before such nodes can be written, so a normal successful run writes no unconfirmed accepted nodes.
- `operations[]` and `operations.jsonl`: semantic `analysis.generate-editable-layers` event.

Keep candidate IDs stable inside one run. Use new reference and run IDs for audit, but derive generated node IDs from a stable screenshot `sourceKey` plus semantic/candidate identity. Regenerating the same screenshot must replace/update those generated IDs idempotently instead of appending timestamp-derived duplicate layers.

## Semantic adapters

- **DOM calibration:** read visible `[data-ui-id]` nodes from a same-origin iframe, preserve atomic text/icon/menu separation, bounds, layout, and source mapping. Matching dimensions are necessary but not sufficient. `Use project reference` counts as explicit provenance confirmation and the bundled canonical reference must also pass a pixel-fingerprint comparison before automatic reuse; an arbitrary same-size upload must not inherit project identity. Refuse calibration when dimensions materially differ or canonical identity cannot be established.
- **OCR:** automatically attempt an available bounded browser/local adapter during Precise analysis. The bundled local cascade supports Windows Media OCR and an already-installed Tesseract CLI without network upload, then accepts bounded fallback results from direct arrays plus common PaddleOCR and Google Vision shapes. Match by overlap; create a text layer only with defensible text and bounds. Windows Media OCR has no per-word confidence, so its default 0.90 evidence remains reviewable unless another independent source confirms it. OCR below 92% is not automatically accepted. Persist adapter, language, filtered contamination, and unavailable/failure reasons in run metrics.
- **OCR line structure:** coalesce only close horizontal word fragments that share a baseline. Keep titles, subtitles, and stacked labels as separate layers. One OCR line may consume at most one pixel text candidate in a fusion pass; additional lines become independent text candidates instead of overwriting earlier content. Persist raw-block, coalesced-line, matched, and created counts.
- **Layout/repetition:** infer Flex row/column, Grid tracks, gaps, parents, and repeated-component hints. Keep confidence and provenance because inference is not observation.
- **Parent and repetition repair:** assign a candidate to the smallest geometrically valid containing frame when its previous parent is missing, contradictory, or only a broader page container. Never silently replace an explicit Human or exact DOM parent. Infer repeated siblings from parent, semantic type, shape similarity, and row/column alignment; include repeated frames and controls, not only leaf text/icon nodes.
- **Human:** an explicit correction or acceptance adds Human evidence and must be undoable.

Human merge/split operations must preserve graph integrity. Merge redirects every child of the removed candidate to the retained stable identity and combines evidence/text in visual reading order. Split uses deterministic candidate-derived IDs, prefers the largest real child-content gap, redistributes children spatially, and leaves both results in review. Neither operation may use timestamps as layer identity.

## Saving and Codex handoff

The bridge must bind to loopback, use constrained reference paths, require the expected revision, verify PNG signature/dimensions, cap uploads, validate the full V4 document, replace atomically, and append the operation log.

After generation, Codex runs `sync:status` and `sync:changes`, reviews the evidence revision, generates or updates real components, runs the production checks, and records `sync:source-updated`. A recognition revision is not production DOM until Codex materializes it as source.

## Verification

Run:

```text
npm run studio:check
npm run studio:check-canvas
npm run studio:check-document
npm run studio:check-analysis
npm run studio:check-fidelity
npm run studio:check-sync
```

In a real browser verify:

1. Screenshot to UI changes left, center, and right together.
2. Source coordinates survive analysis downscaling.
3. Accepted/review/excluded counts are mutually exclusive and total the candidate count.
4. A 73% pixel-only candidate enters review, not accepted.
5. Selection synchronizes across queue, canvas, and inspector.
6. Rename, type, text, parent, accept/exclude, merge/split, repeat, and undo work.
7. Default overlay remains readable; show-all and labels are optional.
8. Generate stays disabled while review items remain or any accepted node lacks `humanConfirmed`, requires an explicit final-review confirmation, and writes only Human-confirmed accepted nodes, the reference, V4 evidence, revision, and semantic operation.
9. Returning to Structure preserves the canvas-core contract and the real DOM tree.
10. An explicit project reference with a matching canonical pixel fingerprint auto-fuses compatible DOM/text/layout evidence during Precise analysis, while an arbitrary same-size upload does not.
11. Pixel-only micro-fragments are marked as noise and may be safely excluded; DOM/OCR/Human evidence prevents noise exclusion.
12. DOM calibration, OCR import, smart triage, and layout inference visibly report provenance and failure recovery.
13. Pixel-only border projections that duplicate exact DOM edges are reported as explainable `absorbed-edge` exclusions; real unmatched dividers and Human-confirmed lines remain reviewable.
14. Screenshot intake reports dimensions, viewport compatibility, sharpness, compression risk, and likely browser/system contamination; rejected overlay OCR text never enters generated layers.

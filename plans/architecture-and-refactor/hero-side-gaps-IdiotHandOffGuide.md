# Hero outer side gaps — IdiotHandOffGuide

## A. Execution contract

**READY.** Authoring date: 7 November 2026, Asia/Calcutta. The user requested investigation and this guide only. Do not apply edits, commit, push or deploy based on this authoring request. A later implementation request authorizes local edits; deployment requires its own applicable authorization.

Root: `D:\ThisPC\Documents\SideQuestHQ\undone-site`. PowerShell; branch `master`; baseline `df9a0a0c4d641194481c0d733976b861c4c99dd1`. Working tree was clean before this guide. Node 24.14.1 and npm 11.11.0 were observed earlier in this same session; package.json requires Node >=24 <25. Next 16.2.11, React 19.2.4. Preserve any subsequent unrelated changes. No dependency, environment, image asset, lockfile or JSX changes are required.

Sequence: verify baseline and exact anchors; apply S1–S3 in order; run V1–V3; report actual results. All shell commands use the repository root. Each replacement must match exactly once. Normalize CRLF/LF for matching, without reformatting unrelated CSS. If the original is absent but the complete replacement is already present at its intended selector, verify and skip that step. Otherwise stop dependent work and report the file and mismatch. Unknown failures require the failing command and exact error, not an improvised redesign.

### Investigation findings

The provided screenshot shows a straight empty strip outside each collage, under the full-width navigation. The corresponding source is `Hero.tsx` → `.mainHeroSection`, which contains CollageLeft, CollageRight, bottom parchment layers and the central interface. The landing route/layout introduce no extra centered wrapper around this section.

**Two independent causes in Hero.module.css:**

1. `.mainHeroSection` has `width:100%`, `max-width:1760px`, `margin:0 auto`, and `overflow:clip`. At a 1920 CSS-pixel viewport, its rectangle is x=80 through x=1840. Artwork is positioned/clipped inside that box, so it cannot paint in the outer 80px strips. At 2560px the box starts at x=400. This is a containing-block constraint, not missing or undersized images.
2. `.collageLeft` and `.collageRight` add `max(0px, calc((100vw - 2160px) / 2))` to their respective edge offsets. Above 2160px this creates an additional inset even if the section cap is removed. At 2560px the deployed left collage begins at x=600 (400px container margin plus 200px inset); at 3440px it begins at x=1480.

The attached image is 1600px wide, but its original browser CSS viewport and zoom are unknown. A direct 1600 CSS-pixel browser test does not have this container gutter. A 1920-wide rendering reduced to 1600 image pixels yields about 66.7px margins, consistent with the attachment. That explanation is an inference, not a claim about the user's actual zoom setting. Browser zoom changes effective CSS width and can cross the 1760px threshold.

**Chosen fix:** make the decoration-containing section fill the available width and anchor the base collages at its edges. Keep the existing max-width on the central interface, the header's independent 1920px cap, all scale breakpoints, negative offsets on 821–1539px layouts, clipping, isolation and stacking order. Do not stretch artwork, change fonts, add viewport JS, use 100vw for the section, or remove overflow clipping. Natural blank space between edge artwork and the bounded center on ultrawide screens is intentional; the defect is the blank gutter outside the artwork.

### Measured production geometry and browser-only experiment

Read-only live page: https://www.undone.one/. Original source corresponds to the measured CSS rules. A fresh isolated Chromium browser loaded production and used temporary CSS overrides equivalent to S1–S3. Requests under /videos/ were blocked to avoid unrelated media downloads; no production source or saved project file was changed.

| CSS viewport width | Original section left | Original left collage | Proposed section / left collage |
|---|---:|---:|---:|
| 1600 | 0 | 0 | 0 / 0 |
| 1760 | 0 | 0 | 0 / 0 |
| 1761 | 0.5 | 0.5 | 0 / 0 |
| 1879 | 59.5 | 59.5 | 0 / 0 |
| 1920 | 80 | 80 | 0 / 0 |
| 2160 | 200 | 200 | 0 / 0 |
| 2161 | 200.5 | 201 | 0 / 0 |
| 2560 | 400 | 600 | 0 / 0 |
| 3440 | 840 | 1480 | 0 / 0 |

The central interface's left/right/width stayed identical before/after at all 19 measured sizes. No horizontal document overflow occurred after the override. Before/after 1920px screenshots and the patched 2560px screenshot were visually inspected: artwork reaches the outer boundaries and the central content remains bounded. Local scratch results under .tmp/hero-gap are non-deliverable evidence; this guide does not depend on retaining them.

## B. Requirements and acceptance map

| ID | Observable outcome | Steps | Checks |
|---|---|---|---|
| R1 | No cap-created outer gutters above 1760px; hero section spans available viewport width | S1 | V1,V2,V3 |
| R2 | Collages remain anchored to outer edges above 2160px | S2,S3 | V2,V3 |
| R3 | Centered text/composer widths, scale breakpoints, mobile positioning and clipping remain intact | S1–S3 | V1,V2,V3 |
| R4 | No horizontal page scrolling or new interception of central controls; light/dark layouts remain usable | S1–S3 | V2,V3 |

No production completion is claimed. The proposal is fully specified; post-implementation integration and browser acceptance remain pending.

## C. File-change manifest

| Path | Operation | Step |
|---|---|---|
| src/client/screens/landing/Hero/Hero.module.css | Modify exactly three declarations | S1,S2,S3 |

No created/deleted runtime files, scripts, tests, assets, migrations, packages or generated outputs. This is a small layout correction, so use the browser geometry/interaction checks below instead of introducing tests that merely assert CSS strings. The existing memory already documents hero clipping/stacking; those boundaries do not change.

## D. Ordered implementation steps

Before editing, run:

```powershell
git status --short
git rev-parse HEAD
```

Expected observed baseline is above, or a later revision with all anchors intact. Preserve other work. All three edits target `src/client/screens/landing/Hero/Hero.module.css`.

### S1 — Remove the decoration section width cap

Prerequisite: baseline checked. Replace exactly one block:

```css
.mainHeroSection {
  flex: 1;
  width: 100%;
  max-width: 1760px;
```

With:

```css
.mainHeroSection {
  flex: 1;
  width: 100%;
  max-width: none;
```

Postcondition: the section retains width:100% and all existing flex, centering, clipping and stacking rules, with no width cap.

### S2 — Anchor the left collage to the section edge

Prerequisite: S1 applied or verified. Replace exactly one block:

```css
  left: max(0px, calc((100vw - 2160px) / 2));
```

With:

```css
  left: 0;
```

Postcondition: the base .collageLeft rule uses left:0. Later negative-offset media rules remain unchanged.

### S3 — Anchor the right collage to the section edge

Prerequisite: S2 applied or verified. Replace exactly one block:

```css
  right: max(0px, calc((100vw - 2160px) / 2));
```

With:

```css
  right: 0;
```

Postcondition: the base .collageRight rule uses right:0. Later negative-offset media rules remain unchanged.

## E. Verification and failure handling

### V1 — Diff and build (R1,R3)

PowerShell, repository root:

```powershell
git diff --check
git diff -- src/client/screens/landing/Hero/Hero.module.css
npm run build
```

Expected: clean whitespace check, only the three specified declaration substitutions in this CSS file, successful existing production build. Existing dependencies, root .env and package submodules are prerequisites; no new secret is needed. The build runs existing package prebuild steps and Prisma generation. If a pre-existing environment or build failure prevents completion, record it separately and keep build validation outstanding. Do not change unrelated configuration or claim that syntax parsing alone proves a production build.

Run `npm run dev:bare` for local browser checks, or `npm run start` after a successful production build. Use the URL/port actually printed by the server. Stop only the server process you started after checking. No deployment is necessary to validate locally.

### V2 — Responsive geometry (R1–R4)

Open the local landing page with DevTools responsive sizing. Test these width×height pairs, using CSS pixels:

390×844, 820×1180, 821×900, 1200×800, 1201×800, 1366×768, 1380×900, 1539×900, 1540×900, 1600×755, 1760×900, 1761×900, 1879×900, 1880×900, 1920×1080, 2160×1000, 2161×1000, 2560×1080, 3440×1440.

At each size, scroll to page top and run this complete console check:

```javascript
(() => {
  const one = (selector) => {
    const nodes = document.querySelectorAll(selector);
    if (nodes.length !== 1) throw new Error('Expected one ' + selector + ', found ' + nodes.length);
    return nodes[0];
  };
  const left = one('[data-editable-id="collageLeft"]');
  const right = one('[data-editable-id="collageRight"]');
  const section = left.parentElement;
  if (right.parentElement !== section) throw new Error('Collage parents differ');
  const center = section.querySelector('[class*="centralInterface"]');
  if (!center) throw new Error('Central interface missing');
  const s = section.getBoundingClientRect();
  const c = center.getBoundingClientRect();
  const root = document.documentElement;
  const width = root.clientWidth;
  const near = (a, b) => Math.abs(a - b) <= 1;
  const checks = {
    sectionFillsViewport: near(s.left, 0) && near(s.right, width),
    noHorizontalScroll: root.scrollWidth <= width + 1,
    centerRemainsCentered: near((c.left + c.right) / 2, width / 2),
    clippingPreserved: getComputedStyle(section).overflow === 'clip',
    isolationPreserved: getComputedStyle(section).isolation === 'isolate',
  };
  if (innerWidth >= 1540) {
    checks.leftAnchored = near(left.getBoundingClientRect().left, s.left);
    checks.rightAnchored = near(right.getBoundingClientRect().right, s.right);
  }
  if (innerWidth >= 1880) checks.centerWidthPreserved = near(c.width, 1120);
  console.table(checks);
  if (Object.values(checks).some(value => !value)) throw new Error('Hero geometry regression');
  return { result: 'PASS', cssViewport: [innerWidth, innerHeight], sectionWidth: s.width, centerWidth: c.width };
})();
```

Expected: PASS at every size. Wide section/edge boundaries are within 1 CSS pixel of the available viewport edges. At widths >=1880 the center remains 1120px wide. Below 1540, the existing negative collage offsets intentionally remain and should not be replaced with zero. The document must have no new horizontal overflow. Record measured CSS viewport and screenshot, not only device model or screenshot dimensions.

If the check fails because expected nodes are absent, inspect whether the correct route/build loaded; do not loosen selectors to hide missing markup. If source rules differ from the baseline, stop and reconcile that mismatch before changing the plan. A larger header or unrelated pre-existing mobile problem is not proof that these three declarations failed, but record any reproducible acceptance blocker.

### V3 — Visual and interaction regression (R1–R4)

On the local patched page:

1. At 1920×1080, compare to the investigation: the continuous 80px outer strips are gone; collages and bottom parchment can paint to both viewport edges. The center/composer size remains unchanged. At 2560×1080 and 3440×1440, check both outer edges; removing only S1 would not satisfy this check.
2. Repeat 1920×1080 and 390×844 using the actual theme-toggle button. Both light and dark modes must retain geometry. Do not edit data-theme in source as a workaround. Natural torn/transparent image borders are expected; no full-height rectangular outside gutter should be introduced by section clipping.
3. At desktop and mobile widths, focus the prompt, type and clear a harmless sample without submitting, open/close Add link and template controls, click category pills, and confirm carousel cards can move beneath the collages without covering the prompt controls. Check the navigation links remain reachable. Do not submit a journey, upload files or sign in as part of layout testing.
4. Repeat wide desktop at browser zoom 80%, 100%, 125% and 150%. Record window.innerWidth: layout responds to CSS width, not physical screenshot width. No horizontal page scrolling, outer clipping gutters or inaccessible central controls are allowed.
5. Check Chromium and a second engine (Safari/WebKit or Firefox), particularly overflow:clip. Browser-only Chromium override results are not cross-engine certification.

After a separately authorized release, repeat the 1920px and ultrawide checks on https://www.undone.one/ using the newly deployed commit. A stale deployment must not be mistaken for failed source edits.

Recovery: restore only these three original declarations if the implementation introduces a regression, preserving any unrelated edits. No history rewrite, reset --hard, asset resizing or global stylesheet change is needed. Report the failed size/theme/browser and measured rectangles.

## F. Completion report contract

Report applied S1–S3, exact changed files, V1 build result, V2 viewport results, V3 theme/interaction/zoom/engine coverage, and skipped checks with their reasons. Completion requires the applied patch and required acceptance checks; clearly distinguish local completion from production verification. Do not claim deployed success from a local style override.

### Author validation actually performed

- Inspected repository CSS memory, hero source/components, route/layout and live production geometry.
- Reproduced the width cap and secondary ultrawide offset; tested the equivalent browser-only fix at all 19 sizes listed above.
- Verified the central rectangle was unchanged at every size and no horizontal overflow was introduced.
- Visually inspected before/after at 1920px and after at 2560px.
- Validated all three exact source anchors and parsed the resulting proposed CSS successfully with installed PostCSS and Lightning CSS (CSS Modules enabled).
- No runtime source edits, commit, push, deployment, full application build, dark-mode interaction suite or second-browser checks were performed for this task. Only this handoff and ignored investigation intermediates were written.

### Implementation result — 7 November 2026

S1–S3 were applied exactly: the decoration section no longer has the 1760px cap and both base collage offsets are zero. CSS parsing succeeded with PostCSS and Lightning CSS, the 19-viewport Chromium geometry experiment remained passing, `git diff --check` passed, and `HeaderNav.test.tsx` passed (2 tests). The full Hero component suite has four pre-existing failures in unrelated CentralInterface auth/error-flow tests; its assertions concern redirect/error handling and no Hero CSS layout assertion failed. `npm run build` progressed through both package builds, Prisma generation, workflow compilation, and Next's production compile start, but this session did not receive a completion result, so a full-build pass is not claimed. Commit/push is authorized separately by the user and remains outside this handoff's original execution contract.

# Landing section 2 investor film — IdiotHandOffGuide

## A. Execution contract

**READY for remaining implementation. The user subsequently authorized moving the investor film from LFS to normal Git. S0 is the local migration plan; its actual result is recorded at the end. S1–S5 remain proposed and unapplied. Production completion requires a new deployment. Investigation: 7 November 2026, Asia/Calcutta.

Root: `D:\ThisPC\Documents\SideQuestHQ\undone-site`. Shell: PowerShell. Branch: `master`. Baseline: `64cab32e8ad51c6dd1068e028c6c89faa711884f`. Initial working tree was clean. Preserve this guide and any subsequent unrelated edits. Node observed: 24.14.1; npm: 11.11.0; Next: 16.2.11; hls.js package range: ^1.7.3. No new dependency, lockfile edit, transcoding or Git history rewrite is required. Execution/directives directories are absent; existing tooling uses `scripts/*.mjs`.

Sequence: check baseline and inputs; apply S0–S5 in order; run V1–V5; report actual results. All commands below run at the repository root unless stated otherwise. For each replace-block edit require exactly one match after preceding edits. If a target differs, stop its dependent steps and report the path and mismatch. On rerun, recognize exact replacement content as already applied and verify its postcondition; never duplicate imports. New files must be absent or match the supplied payload exactly. Report unfamiliar errors with step ID and full error; do not silently bypass validation.

The original request was investigation and a handoff; the follow-up authorizes the local normal-Git migration (S0), not deployment or the remaining player/build changes. Do not infer authorization to push, change Vercel settings or deploy from this document. Finish the local implementation and checks before requesting any still-required external authorization. Existing root .env supplies ordinary app build prerequisites; do not copy or print secrets. No new secret or NEXT_PUBLIC variable is needed for film playback.

### Evidence and diagnosis

- `https://undone.one` redirects to `https://www.undone.one/`. The deployed section requests `/videos/hls/explainer.m3u8`, which is a valid playlist referencing 21 TS segments. This IS wired to the investor film assets.
- Every deployed segment is a Git LFS pointer (132 bytes each except segment_020.ts at 133). First segment body: `version https://git-lfs.github.com/spec/v1`, SHA-256 `ed0c5852915fb195831f2b7f259d9d768977c8ec1634e9d684695ab1196eff8b`, declared real size 5,643,572. HTTP 200/206 and video/mp2t do not prove playable bytes.
- MP4 fallback also serves a 133-byte pointer declaring SHA-256 `b43ce5ad650562b93fc2b2032bfc8c1c633446f371b6d7a41c09f51f92ece15c` and size 90,503,148. Both hashes match the real local files. The problem is deployment materialization, not a wrong film filename.
- Browser console: fatal HLS `fragParsingError`, “Failed to find demuxer by probing fragment data”. Native MP4 then reports MediaError code 4, `DEMUXER_ERROR_COULD_NOT_OPEN`.
- Local ffprobe: MP4 H.264 1920×1080 plus AAC, 62.416667 seconds. Segment 000: same codecs/resolution, 4.023222 seconds. Full local HLS decode with ffmpeg completed with exit 0 and no decode errors.
- Controlled browser experiment: unchanged deployed JavaScript, only HLS HTTP responses substituted with local files. Scrolling into section immediately played; currentTime 1.022642, duration 62.416667, readyState 4, paused false, muted true, no media error. This strongly isolates the observed failure to asset delivery. It is not a production repair.
- A separate forced MP4 fallback experiment was interrupted by the browser closing; fallback playback is NOT claimed verified. Safari/mobile, post-change build and production deployment remain executor checks.
- `.gitattributes` tracks MP4 and these TS files via LFS; commit `070b80a8` introduced explainer LFS tracking. The prior `plans/feed-and-home/video-explainer-remediation.md` focuses on player state and overlays. Its old starting-state claims no longer match current source, and it does not address pointer payloads.
- Headers show Vercel behind Cloudflare and a one-day browser cache plus stale-while-revalidate. Deployment alone may leave previously cached URLs misleading. The precise live Vercel LFS toggle value and original deployment mechanism were not inspected; do not claim the toggle was observed disabled.

### Chosen repair

Store the MP4 and all 21 HLS chunks as ordinary Git binary blobs using path-specific attribute overrides. Retain existing paths and bytes; do not rewrite history. The remaining proposed hardening fails builds if original bytes are missing or wrong and generates a versioned public copy before Next builds. Use a single source module for the four consumers so stale public environment overrides cannot silently choose the old URLs. Existing optional component source props remain. No player state-machine rewrite is included: real HLS bytes already play with deployed code. Build output is about 183 MB of additional static media because originals are retained for compatibility; this is an intentional bounded tradeoff, not a new CDN integration.

The chosen repair does not require enabling Vercel LFS. The film is 90,503,148 bytes, below GitHub’s 100 MiB per-file limit; the largest segment is 10,649,260 bytes. See [GitHub file limits](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github). [Git LFS pointer specification](https://github.com/git-lfs/git-lfs/blob/main/docs/spec.md) explains the version/oid/size payload observed. Read-only documentation checked during authoring.

## B. Requirements and acceptance map

| ID | Observable requirement | Steps | Verification |
|---|---|---|---|
| R1 | Section 2 plays the actual investor film through HLS | S1–S5 | V1,V3,V4,V5 |
| R2 | MP4 fallback contains the same real film and plays when HLS fails | S1–S5 | V1,V4,V5 |
| R3 | Missing, LFS-pointer or corrupt assets stop dev/build before publishing | S1,S2 | V1,V2,V3 |
| R4 | All segments have fresh release URLs; player and structured metadata agree | S1–S3 | V3,V4,V5 |
| R5 | Preserve mute, manual pause, scrolling and existing section UI | S3 | V5 |
| R6 | Future executor can identify media ownership and repeat verification | S4 | V1–V5 |

No requirement is declared completed solely by this document. Production acceptance is outstanding until S5 and V4/V5 pass on the public domain.

## C. File-change manifest

| Path | Operation | Step |
|---|---|---|
| .gitattributes | path-specific normal-Git binary overrides | S0 |
| public/videos/undone-investor-film.mp4 and public/videos/hls/segment_000.ts through segment_020.ts | replace index LFS pointers with actual bytes, paths unchanged | S0 |
| scripts/prepare-explainer-assets.mjs | create validation/generation and deployed-byte verifier | S1 |
| scripts/prepare-explainer-assets.test.mjs | create Node tests | S1 |
| next.config.ts | invoke validation/generation before dev/build, including direct Next CLI builds | S2 |
| .gitignore | ignore generated version directory | S2 |
| src/shared/landing/explainer-media.ts | create canonical URLs | S3 |
| src/client/screens/landing/VideoExplainer/VideoExplainer.tsx | replace default sources | S3 |
| src/client/screens/landing/VideoExplainer/hooks/useHlsVideo.ts | replace default sources | S3 |
| src/client/screens/landing/VideoExplainer/components/VideoPlayer.tsx | replace default fallback | S3 |
| src/app/(landing)/page.tsx | use canonical MP4 in VideoObject | S3 |
| MEMORY/landing-investor-film.md | S0 storage record created; replace after hardening | S0/S4 |
| MEMORY/README.md | add index link | S4 |
| public/videos/investor-film-b43ce5ad-v1/film.mp4, hls/explainer.m3u8, hls/segment_000.ts through segment_020.ts | generate, ignored, included in Next static build | S1/S2 |
| Vercel project undone: new deployment | release, authorization required; no film LFS setting needed | S5 |

No original asset deletion, package changes or lockfile changes. The original investigation authored only this guide. The follow-up S0 migration also changes attributes, stages the 22 real binary blobs and records their ownership in MEMORY.

## D. Ordered implementation steps

### S0 — Move the film to normal Git (follow-up authorization)

Before changing attributes, verify the local MP4 and every segment against the SHA-256 and size in its existing HEAD LFS pointer. Stop if any differ. Existing local files are already hydrated. Do not remove LFS objects or rewrite old commits.

In .gitattributes replace exactly this line:

```text
public/videos/hls/*.ts filter=lfs diff=lfs merge=lfs -text
```

with:

```text
# Landing investor film ships as ordinary Git binary blobs, not LFS pointers.
public/videos/undone-investor-film.mp4 -filter -diff -merge -text
public/videos/hls/*.ts -filter -diff -merge -text
```

The exact MP4 override follows the general *.mp4 LFS rule and therefore takes precedence. Keep other LFS rules intact.

PowerShell, repository root:

```powershell
git add -- .gitattributes
git add --renormalize -- public/videos/undone-investor-film.mp4 public/videos/hls
git check-attr filter diff merge text -- public/videos/undone-investor-film.mp4 public/videos/hls/segment_000.ts
git cat-file -s :public/videos/undone-investor-film.mp4
git cat-file -s :public/videos/hls/segment_000.ts
git diff --cached --stat
```

Expected: all four attributes unset; staged blob sizes 90503148 and 5643572 respectively. Verify all 22 staged blob hashes and sizes against the original pointer declarations, not only these examples. The playlist remains a normal text file. This intentionally stages the binary conversion; only changing attributes leaves pointers in the next commit and is insufficient. No commit/push is performed by the migration itself.

Postcondition: the Git index holds the actual 22 media files; original working file bytes unchanged. A commit of these staged changes is required before a Git deployment can use the repair.

### S1 — Validate and prepare real media

Prerequisites: Node 24, originals present. Check `git status --short` and `git rev-parse HEAD`. After S0, a fresh checkout of the migrated commit must contain normal binary files without Git LFS hydration. If still on the old pre-migration commit and originals are pointers, obtain the original objects with `git lfs pull --include="public/videos/undone-investor-film.mp4,public/videos/hls/*.ts" --exclude=""` before S0, using existing repository credentials. If source bytes remain unavailable, stop and report the exact missing asset. Never download the broken production assets to repair originals.

Create `scripts/prepare-explainer-assets.mjs` with these complete contents:

```javascript
import { readFile, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERSION = 'investor-film-b43ce5ad-v1';
export const ASSETS = [
  [
    "undone-investor-film.mp4",
    90503148,
    "b43ce5ad650562b93fc2b2032bfc8c1c633446f371b6d7a41c09f51f92ece15c"
  ],
  [
    "hls/segment_000.ts",
    5643572,
    "ed0c5852915fb195831f2b7f259d9d768977c8ec1634e9d684695ab1196eff8b"
  ],
  [
    "hls/segment_001.ts",
    2828836,
    "ec0e6d1fe7e467b5a0108edfa2ed52d68ded4d6a4f4a210eb6960f09ab4fbdf4"
  ],
  [
    "hls/segment_002.ts",
    7204160,
    "03aad83c8419143ddacb3710134e594e07b7d7e88ef1a311d89d13be86452254"
  ],
  [
    "hls/segment_003.ts",
    3980712,
    "7e4648b11b382a4488a02dd989ecb725796050bb6138ab187ba648b690692cdb"
  ],
  [
    "hls/segment_004.ts",
    6302512,
    "3b929fa8c52d77126e863f3e273dcdb479711340d370580a5cdd7db7cf844197"
  ],
  [
    "hls/segment_005.ts",
    2172528,
    "258bee34ac44ca034ae8dead51fe2550a86747d76bc42481542f15833a26b547"
  ],
  [
    "hls/segment_006.ts",
    4603932,
    "597245af7951749b92c9b2ee2eae6a894c3960824d35c21a9847d8ab5a234fd5"
  ],
  [
    "hls/segment_007.ts",
    2392864,
    "eae154653cb2bfc044f1833ed29a2d79bfd5ffe03bf48973f4360000dca1d3f3"
  ],
  [
    "hls/segment_008.ts",
    3796096,
    "708bdcf03405acdada15aec257ccf2ef1aba6e5ab2edd0742888c790679aab82"
  ],
  [
    "hls/segment_009.ts",
    1738248,
    "e2cc2f5d67e97f962f6d59babe787b07e10fa5a37a836c828e3c9e8c492fed86"
  ],
  [
    "hls/segment_010.ts",
    3957024,
    "12d15835938137b6e66508b378c4f8bc30e631c920bae739873a837add257e6e"
  ],
  [
    "hls/segment_011.ts",
    1884324,
    "51a028edad14deef232bb5c1f852b1d8a1e5c1f5b638f2f82428d0af2815e150"
  ],
  [
    "hls/segment_012.ts",
    4372128,
    "aede81705f7e1c630c2344c1d4b4c06ea39bf4c16770baf8df2393422f872534"
  ],
  [
    "hls/segment_013.ts",
    3168364,
    "91307aee16a92332fcf1b5c1d69cc55ecc88a85a20a4a564eacdb31ae5aeee7f"
  ],
  [
    "hls/segment_014.ts",
    5775360,
    "5ad1022c03a40dfa677cd0255c7c7e209f642994fd240c293f337355ddc03481"
  ],
  [
    "hls/segment_015.ts",
    2145456,
    "f1dfe85409fe5b99290c34ad5887f644fe7f2867e217ac0dff5db6e8a56f57dc"
  ],
  [
    "hls/segment_016.ts",
    3925064,
    "9bd80bec3586c3de082159798ae8c17f8499c1e0ae5728ed3b65fcbe406fda80"
  ],
  [
    "hls/segment_017.ts",
    2115752,
    "e468e7ad3fe4c77ee7b8dfcc46c1467e15ec295cdab28c52d34c18852ec452a1"
  ],
  [
    "hls/segment_018.ts",
    5481892,
    "ce34fdba89d014b11fea04e1081dd168b9f54b76ab6479ed5d5eefa4cb58141c"
  ],
  [
    "hls/segment_019.ts",
    8773208,
    "457004683fbbb20b2c8853a5bb631a5e883d04af595400f3fe18e9778d0ab288"
  ],
  [
    "hls/segment_020.ts",
    10649260,
    "094b9604d719b5456a7a40bdd61b6659159d8d4f80aff3e209dc18643d6f1400"
  ]
];
const PLAYLIST_SHA256 = 'c8eb47269e7d11232c268110df6a7c7a306abc4fbdf74fa29ad35b95859b64c2';
const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = (data) => createHash('sha256').update(data).digest('hex');

export function validateAsset(data, record) {
  const [name, size, sha256] = record;
  if (data.subarray(0, 80).toString('utf8').startsWith('version https://git-lfs.github.com/spec/v1')) {
    throw new Error(name + ': Git LFS pointer, not media. Check out the normal-Git media migration before building.');
  }
  if (data.length !== size || hash(data) !== sha256) {
    throw new Error(name + ': media size/SHA-256 mismatch; do not publish this build.');
  }
}

export function validatePlaylist(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  if (hash(normalized) !== PLAYLIST_SHA256) throw new Error('Explainer playlist checksum mismatch');
  return normalized;
}

export async function checkSources(root = defaultRoot) {
  const base = path.join(root, 'public/videos');
  const playlist = validatePlaylist(await readFile(path.join(base, 'hls/explainer.m3u8'), 'utf8'));
  for (const record of ASSETS) validateAsset(await readFile(path.join(base, record[0])), record);
  return playlist;
}

export async function prepareExplainerAssets(root = defaultRoot) {
  // Validate everything before creating any output. Never download from the public site.
  const playlist = await checkSources(root);
  const base = path.join(root, 'public/videos');
  const output = path.join(base, VERSION);
  await mkdir(path.join(output, 'hls'), { recursive: true });
  for (const record of ASSETS) {
    const name = record[0] === 'undone-investor-film.mp4' ? 'film.mp4' : record[0];
    await copyFile(path.join(base, record[0]), path.join(output, name));
    validateAsset(await readFile(path.join(output, name)), record);
  }
  await writeFile(path.join(output, 'hls/explainer.m3u8'), playlist);
  console.log('[explainer-assets] Verified and prepared 22 media files plus playlist: ' + VERSION);
}

export async function verifyDeployment(origin) {
  const base = new URL('/videos/' + VERSION + '/', origin);
  async function download(name, type) {
    const response = await fetch(new URL(name, base), { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(name + ': HTTP ' + response.status);
    if (!(response.headers.get('content-type') || '').toLowerCase().includes(type)) {
      throw new Error(name + ': unexpected Content-Type ' + response.headers.get('content-type'));
    }
    return Buffer.from(await response.arrayBuffer());
  }
  validatePlaylist((await download('hls/explainer.m3u8', 'mpegurl')).toString('utf8'));
  for (const record of ASSETS) {
    const name = record[0] === 'undone-investor-film.mp4' ? 'film.mp4' : record[0];
    validateAsset(await download(name, name.endsWith('.mp4') ? 'video/mp4' : 'video/mp2t'), record);
    console.log('[explainer-assets] Remote checksum OK: ' + name);
  }
  const range = await fetch(new URL('film.mp4', base), {
    headers: { Range: 'bytes=0-255' }, signal: AbortSignal.timeout(30000),
  });
  if (range.status !== 206 || range.headers.get('content-range') !== 'bytes 0-255/90503148' ||
      (await range.arrayBuffer()).byteLength !== 256) throw new Error('MP4 byte-range verification failed');
  console.log('[explainer-assets] Remote film, playlist, all 21 segments and MP4 ranges passed');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, origin] = process.argv.slice(2);
  try {
    if (mode === '--check-source') {
      await checkSources();
      console.log('[explainer-assets] Source checksums passed');
    } else if (mode === '--verify-url' && origin) {
      await verifyDeployment(origin);
    } else if (!mode) {
      await prepareExplainerAssets();
    } else throw new Error('Usage: node scripts/prepare-explainer-assets.mjs [--check-source | --verify-url URL]');
  } catch (error) {
    console.error('[explainer-assets] ' + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  }
}
```

Create `scripts/prepare-explainer-assets.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateAsset, checkSources, prepareExplainerAssets, VERSION } from './prepare-explainer-assets.mjs';

test('rejects LFS pointer contents even under a video filename', () => {
  assert.throws(() => validateAsset(Buffer.from('version https://git-lfs.github.com/spec/v1\n'),
    ['film.mp4', 90503148, 'unused']), /Git LFS pointer/);
});
test('rejects corrupt same-length contents', () => {
  const good = Buffer.from('known media bytes');
  const record = ['fixture.ts', good.length, createHash('sha256').update(good).digest('hex')];
  assert.doesNotThrow(() => validateAsset(good, record));
  const bad = Buffer.from(good); bad[0] ^= 1;
  assert.throws(() => validateAsset(bad, record), /SHA-256 mismatch/);
});
test('missing source fails before generating a public directory', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'undone-film-'));
  try {
    await assert.rejects(prepareExplainerAssets(root), /ENOENT/);
    await assert.rejects(access(path.join(root, 'public/videos', VERSION)), /ENOENT/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('the repository has the complete original film and all 21 chunks', async () => {
  await checkSources(process.cwd());
});
```

Run `node --test scripts/prepare-explainer-assets.test.mjs`, then `node scripts/prepare-explainer-assets.mjs`. Both must exit 0. The second prints the 22-media-files-plus-playlist message and creates the manifest's version directory. Postcondition: exact checksums match the original investor film and all 21 chunks. No transcode, guessed codec or missing external asset.

### S2 — Make validation unavoidable during Next dev/build

Prerequisite: S1. Apply the next.config and .gitignore block edits below. Generation runs for dev and production-build phases, not next start; a running production server must consume the output of a successful build. Do not run Next against concurrent writes to originals.

Target: `next.config.ts`. Replace exactly one original block:

```text
import path from 'path';
```

With:

```text
import path from 'path';
import { prepareExplainerAssets } from './scripts/prepare-explainer-assets.mjs';
```

Target: `next.config.ts`. Replace exactly one original block:

```text
export default async function configure(phase: string, context: { defaultConfig: NextConfig }) {
```

With:

```text
export default async function configure(phase: string, context: { defaultConfig: NextConfig }) {
  if (phase === 'phase-development-server' || phase === 'phase-production-build') {
    await prepareExplainerAssets();
  }
```

Target: `.gitignore`. Replace exactly one original block:

```text
# scratch and generated
```

With:

```text
# scratch and generated
/public/videos/investor-film-b43ce5ad-v1/
```

Postcondition: every Next dev/build config evaluation prepares verified files before returning config; source failure throws and stops build. Ignore rules prevent committing duplicates, not generating them in deployment. Do not add the source originals to .vercelignore.

### S3 — Route every landing-film consumer to the versioned assets

Prerequisite: S1/S2. Create `src/shared/landing/explainer-media.ts` (create parent directory if missing):

```typescript
// Release-specific paths: change VERSION and integrity records together when replacing the film.
export const EXPLAINER_HLS_SRC = '/videos/investor-film-b43ce5ad-v1/hls/explainer.m3u8';
export const EXPLAINER_MP4_SRC = '/videos/investor-film-b43ce5ad-v1/film.mp4';
```

Remove only the old explainer environment fallback expressions using these exact edits. This deliberately retires NEXT_PUBLIC_EXPLAINER_VIDEO_HLS_URL and NEXT_PUBLIC_EXPLAINER_VIDEO_MP4_URL for this film. Unrelated environment values are untouched; no dashboard env edit is necessary.

Target: `src/client/screens/landing/VideoExplainer/VideoExplainer.tsx`. Replace exactly one original block:

```text
import styles from './VideoExplainer.module.css';
```

With:

```text
import styles from './VideoExplainer.module.css';
import { EXPLAINER_HLS_SRC, EXPLAINER_MP4_SRC } from '@/src/shared/landing/explainer-media';
```

Target: `src/client/screens/landing/VideoExplainer/VideoExplainer.tsx`. Replace exactly one original block:

```text
const DEFAULT_HLS_SRC = process.env.NEXT_PUBLIC_EXPLAINER_VIDEO_HLS_URL || '/videos/hls/explainer.m3u8';
const DEFAULT_FALLBACK_SRC = process.env.NEXT_PUBLIC_EXPLAINER_VIDEO_MP4_URL || '/videos/undone-investor-film.mp4';
```

With:

```text
const DEFAULT_HLS_SRC = EXPLAINER_HLS_SRC;
const DEFAULT_FALLBACK_SRC = EXPLAINER_MP4_SRC;
```

Target: `src/client/screens/landing/VideoExplainer/hooks/useHlsVideo.ts`. Replace exactly one original block:

```text
import type Hls from 'hls.js';
```

With:

```text
import type Hls from 'hls.js';
import { EXPLAINER_HLS_SRC, EXPLAINER_MP4_SRC } from '@/src/shared/landing/explainer-media';
```

Target: `src/client/screens/landing/VideoExplainer/hooks/useHlsVideo.ts`. Replace exactly one original block:

```text
  hlsSrc = process.env.NEXT_PUBLIC_EXPLAINER_VIDEO_HLS_URL || '/videos/hls/explainer.m3u8',
  fallbackSrc = process.env.NEXT_PUBLIC_EXPLAINER_VIDEO_MP4_URL || '/videos/undone-investor-film.mp4',
```

With:

```text
  hlsSrc = EXPLAINER_HLS_SRC,
  fallbackSrc = EXPLAINER_MP4_SRC,
```

Target: `src/client/screens/landing/VideoExplainer/components/VideoPlayer.tsx`. Replace exactly one original block:

```text
import styles from '../VideoExplainer.module.css';
```

With:

```text
import styles from '../VideoExplainer.module.css';
import { EXPLAINER_MP4_SRC } from '@/src/shared/landing/explainer-media';
```

Target: `src/client/screens/landing/VideoExplainer/components/VideoPlayer.tsx`. Replace exactly one original block:

```text
  fallbackSrc = process.env.NEXT_PUBLIC_EXPLAINER_VIDEO_MP4_URL || '/videos/undone-investor-film.mp4',
```

With:

```text
  fallbackSrc = EXPLAINER_MP4_SRC,
```

Target: `src/app/(landing)/page.tsx`. Replace exactly one original block:

```text
import { Hero } from '@/src/client/screens/landing';
```

With:

```text
import { Hero } from '@/src/client/screens/landing';
import { EXPLAINER_MP4_SRC } from '@/src/shared/landing/explainer-media';
```

Target: `src/app/(landing)/page.tsx`. Replace exactly one original block:

```text
        contentUrl: process.env.NEXT_PUBLIC_EXPLAINER_VIDEO_MP4_URL || `${siteUrl}/videos/undone-investor-film.mp4`,
```

With:

```text
        contentUrl: `${siteUrl}${EXPLAINER_MP4_SRC}`,
```

Postcondition: all default player paths and VideoObject contentUrl reference the same generated release. HLS playlist keeps relative segment names, so every segment also uses the new directory. Optional source props still work for isolated tests.

### S4 — Record ownership

Prerequisite: S1–S3. Replace the entire existing `MEMORY/landing-investor-film.md`. Require its normalized current contents to equal this S0 baseline first:

```markdown
# Landing investor film storage

- `.gitattributes`: exact `public/videos/undone-investor-film.mp4` and `public/videos/hls/*.ts` overrides disable filter/diff/merge/text; these assets belong to normal Git, not LFS. Other LFS rules remain.
- `public/videos/undone-investor-film.mp4`: 90,503,148 bytes; H.264/AAC, 62.416667 seconds. `public/videos/hls/explainer.m3u8` references 21 matching segments.
- `src/client/screens/landing/VideoExplainer/`: existing player still uses original URLs. Source files and playback logic are unchanged by the storage migration.
- Migration verification: all 22 staged blob sizes and SHA-256 hashes match their original LFS declarations. Commit/deploy is required to publish the actual bytes; old history retains LFS pointers.
- `plans/architecture-and-refactor/landing-investor-film-IdiotHandOffGuide.md`: S0 storage conversion applied locally; S1–S5 build guard, versioned output and release verification remain proposed, not implemented.
```

Complete replacement contents:

```markdown
# Landing investor film delivery

- Entry: `src/app/(landing)/page.tsx` → `src/client/screens/landing/VideoExplainer/VideoExplainer.tsx` → `hooks/useHlsVideo.ts`.
- Source URLs: `src/shared/landing/explainer-media.ts`; release-specific HLS plus MP4. Legacy NEXT_PUBLIC_EXPLAINER_VIDEO_* overrides intentionally no longer control the landing film.
- Originals: `public/videos/undone-investor-film.mp4`, `public/videos/hls/explainer.m3u8`, `public/videos/hls/segment_000.ts` through `segment_020.ts`; ordinary Git binary blobs through path-specific .gitattributes overrides.
- Build contract: `next.config.ts` calls `scripts/prepare-explainer-assets.mjs` before dev/build. It rejects missing, pointer or checksum-mismatched sources, then copies verified media into ignored `public/videos/investor-film-b43ce5ad-v1/`.
- No Vercel LFS setting is required for these normal-Git film files. Commit and deploy the staged migration; validate deployment bytes and actual playback before reporting fixed.
- Checks: `node --test scripts/prepare-explainer-assets.test.mjs`; `node scripts/prepare-explainer-assets.mjs --verify-url https://www.undone.one`.
- Incident evidence/handoff: `plans/architecture-and-refactor/landing-investor-film-IdiotHandOffGuide.md`.
```

Target: `MEMORY/README.md`. Replace exactly one original block:

```text
# Repository operational index
```

With:

```text
# Repository operational index

- [landing-investor-film.md](landing-investor-film.md): landing video source assets, Git LFS delivery, build integrity gate, and production verification.
```

Postcondition: memory links to the canonical source, build gate and checks.

### S5 — Correct the release pipeline and deploy only after local checks

Prerequisite: V1–V3 pass and external authorization exists. Project identified by local .vercel/project.json: `undone`, project ID `prj_ozx8Oa5c6jIIm9ckCfGxp0MBCBG8`. Verify the selected project's Domains include undone.one/www.undone.one before changing anything.

1. Verify the new commit contains the full normal-Git blobs from S0. Do not toggle Vercel Git LFS for this repair; the film no longer depends on it. Check the exact deployed commit rather than assuming the local staged changes have been published.
2. In Settings → Build and Deployment, verify Node 24.x and the normal Next build command (repository npm run build or framework default). Keep existing install command. Do not bypass next.config.ts or serve stale .vercel/output.
3. After authorized commit/push of this change, select the exact new commit in Deployments. The repository ignoreCommand skips non-master Git refs; do not mistake an ignored feature-branch build for a passed preview. Use the approved master release path; do not disable branch safeguards silently. Redeploy that commit without reusing the existing build cache. A redeploy of the old commit does not include this repair.
4. Logs must include `[explainer-assets] Verified and prepared 22 media files plus playlist`; deployment must become Ready. If a pointer error appears, verify S0 was committed with its actual binary blobs and that the deployment uses that commit. Never weaken checks or replace hashes with hashes of pointer text.
5. Run V4/V5 on the new deployment URL and the public domain. The new path avoids cached old media; if public HTML still requests /videos/hls or the old MP4, verify its deployment/commit and refresh or invalidate the stale landing HTML through the existing approved cache workflow. Do not overwrite this version path with different media later.

Postcondition: public production serves and plays real media, not merely a green build. No source/provider setting was changed by the guide author.

## E. Verification and failure handling

### V1 — Integrity and negative cases (R1,R2,R3,R6)

PowerShell, root:

```powershell
node --test scripts/prepare-explainer-assets.test.mjs
node scripts/prepare-explainer-assets.mjs --check-source
node scripts/prepare-explainer-assets.mjs
```

Expected: four tests pass, source check passes, generation passes. Tests cover pointer rejection, same-length corruption, missing source leaving no generated directory, and every real source checksum. If failure: preserve exact error; verify the migrated commit and S0 for missing/pointer originals; do not bypass hash mismatch. The test's temporary deletion is restricted to its own mkdtemp directory.

### V2 — Prove the actual configuration gate fails closed (R3)

First V1 must pass. Run the following reversible test; it restores the exact original file even when Next fails. Stop dev servers before running.

```powershell
$filmPath = Join-Path (Get-Location) 'public/videos/hls/segment_000.ts'
$filmBytes = [IO.File]::ReadAllBytes($filmPath)
try {
  [IO.File]::WriteAllText($filmPath, "version https://git-lfs.github.com/spec/v1" + [Environment]::NewLine)
  node --import ./scripts/register-root-environment.mjs ./node_modules/next/dist/bin/next build
  if ($LASTEXITCODE -eq 0) { throw 'FAIL: Next accepted an LFS pointer' }
} finally {
  [IO.File]::WriteAllBytes($filmPath, $filmBytes)
}
node scripts/prepare-explainer-assets.mjs --check-source
```

Pass only if Next specifically fails with `segment_000.ts: Git LFS pointer, not media`, before a successful build, and restored source check passes. An unrelated Next error is inconclusive. In a process crash before finally, restore that one file from the validated migrated index with `git restore --worktree -- public/videos/hls/segment_000.ts` only after checking no user edits were present; verify its expected hash from S1.

### V3 — Integration (R1,R3,R4,R6)

PowerShell, root:

```powershell
npx tsc --noEmit --incremental false
npm run verify:vercel
rg -n 'NEXT_PUBLIC_EXPLAINER_VIDEO|/videos/hls/explainer.m3u8|/videos/undone-investor-film.mp4' src/client/screens/landing/VideoExplainer 'src/app/(landing)/page.tsx'
```

Type check and verify:vercel must pass. That script checks submodules, builds packages, generates Prisma, type-checks and invokes Next production build. Existing app env/dependencies are prerequisites. Final rg must have no matches (exit 1 is expected). Do not report pre-existing failures as passes; report exact failure and whether this change is involved. Run `npm run dev:bare` for local browser testing after generated sources pass, and stop it afterward. No dependency changes mean no new lockfile churn.

### V4 — Deployment bytes, all segments, fallback range (R1,R2,R4,R6)

After S5, PowerShell root:

```powershell
node scripts/prepare-explainer-assets.mjs --verify-url https://www.undone.one
```

Also execute the same command replacing the URL with the exact new Vercel deployment URL copied from its deployment page. If deployment protection prevents this fetch, run it in an authorized environment; a login HTML response is not a pass. This downloads about 183 MB per origin to verify SHA-256, not only HTTP status. Expected all 22 media checks plus playlist pass, appropriate MIME types, MP4 206 bytes 0-255/90503148. Failure reports exact asset; missing generated output points to skipped preparation or wrong deployment, checksum mismatch points to bad delivery/cache. A network timeout remains a failed/incomplete check, not a reason to weaken integrity.

### V5 — Real browser acceptance, mandatory after deployment (R1,R2,R4,R5)

Use a fresh browser context with cache disabled and no authoring-session request overrides. Test Chromium desktop, a mobile viewport, and actual Safari/iOS native playback (mobile emulation alone does not validate native HLS). Open https://undone.one; verify redirect and section 2.

1. Scroll to the middle of the video section. Network must request /videos/investor-film-b43ce5ad-v1/hls/explainer.m3u8 and real TS bytes. currentTime must advance across at least two samples two seconds apart, readyState >= 2, videoWidth 1920, duration approximately 62.416667, no media error. Confirm muted initial playback, visible film frames, not a poster.
2. Use the sound control, hear audio; pause by clicking the video; move slightly inside the section and confirm manual pause remains; resume; leave the section and confirm pause. Re-enter and verify playback can resume. Confirm replay works after reaching the end. Record any failure rather than assuming the asset repair fixes all unrelated controls.
3. Force HLS manifest failure using browser request blocking for the versioned *.m3u8 URL, reload with cache disabled, then click Play after fallback loads. Expect the versioned film.mp4 as currentSrc, time advances, audio works, no MediaError. Repeat by blocking segment_000.ts instead of manifest. A second manual Play is acceptable for the existing fallback implementation; do not require seamless recovery the current code does not promise. Remove blocking afterward.
4. Directly open the versioned MP4 in the browser, play and seek near 45 seconds; verify byte ranges and advancing video. On Safari/iOS repeat normal page playback and forced HLS failure; do not claim native coverage from Chromium.
5. Verify VideoObject contentUrl ends in /videos/investor-film-b43ce5ad-v1/film.mp4. No unintended section layout, navigation, poster or unrelated media changes.

If forced fallback or manual controls still fail with correct media bytes, report that as a separate reproduced blocker with browser, console error and currentSrc. Do not claim R2/R5 completed or improvise a new state-machine rewrite under this asset-delivery handoff.

### Recovery and future changes

All originals remain untouched. Roll back only this handoff's source/config changes if needed, preserving unrelated edits; no reset --hard or force-push. A previous deployment is already known broken, so reverting to it is not a successful playback repair. Do not change unrelated repository or provider LFS settings. Generated output can be regenerated with S1; do not delete source originals or revert their normal-Git attribute overrides. Future film updates require a new version directory and verified checksum records/constants together.

## F. Completion report contract

Report applied S IDs, changed files, exact deployed commit/URL, V1–V5 results and browser matrix. Separate checks actually run from proposed or skipped checks; include blockers such as Vercel access, app build env, absent source media or missing Safari testing. Completion requires all requirements and production checks to pass; “build succeeded” alone is insufficient.

### Author validation status

Completed: read-only production manifest/all-21-segment/MP4 inspection, local hashes and codec probes, full local HLS decode, controlled successful HLS browser substitution, exact source-anchor validation. Author audit also passed: all four supplied Node tests executed from ignored scratch files; the supplied generator created and re-verified all 22 media files plus playlist in an isolated scratch fixture; all 12 replacement anchors matched uniquely in sequence; the five changed TypeScript files passed syntax transpilation; both supplied JavaScript files passed node --check; Markdown code fences are balanced. These checks do not substitute for application type-checking or deployed playback. Not performed: actual project implementation, full app build after changes, production configuration/deployment, completed fallback playback test, Safari/mobile acceptance.

### Follow-up S0 execution result — 7 November 2026

Applied the authorized normal-Git migration. Attributes and 22 actual binary blobs are staged; every staged blob matches its original LFS SHA-256 and size (183,414,440 bytes total). `git lfs ls-files` still lists the old HEAD pointers until this migration is committed; staged blob hashes and attributes are the authoritative verification of the pending conversion. Working and staged diff checks passed. Storage memory was added. No commit, push, deployment, player change or S1–S5 hardening was performed. Existing production remains unverified after this local migration.

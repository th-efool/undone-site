import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  computeReferenceHashes,
  assertReferenceIntegrity,
  validateCaptureOutputPath,
} from './reference-guard.mjs';

const outputDir = resolve('plans/before-after');
mkdirSync(outputDir, { recursive: true });

// Assert baseline references exist and take snapshot of their hashes
const refHashesBefore = computeReferenceHashes();
if (refHashesBefore.size === 0) {
  throw new Error('NO_CANONICAL_REFERENCES_FOUND: plans/before-after/reference is empty');
}

// Load playwright-core from runtime
const { chromium } = await import(
  pathToFileURL(resolve('.tmp/s3-postgres-runtime/node_modules/playwright-core/index.mjs')).href
);

console.log('Starting visual preview server on port 4175...');
const server = spawn(process.execPath, ['scripts/creation-visual/server.mjs'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

server.stderr.on('data', (d) => {
  const msg = d.toString();
  if (!msg.includes('Re-optimizing dependencies')) console.error('[server]', msg.trim());
});

// Wait for server to be responsive
let serverReady = false;
for (let i = 0; i < 60; i++) {
  try {
    const res = await fetch('http://127.0.0.1:4175/');
    if (res.ok) {
      serverReady = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

if (!serverReady) {
  server.kill();
  throw new Error('PREVIEW_SERVER_FAILED_TO_START');
}
console.log('Preview server ready on http://127.0.0.1:4175/');

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});

const screens = [
  {
    number: 2,
    name: 'Recommendations',
    url: 'http://127.0.0.1:4175/?app=builder&screen=recommendations',
    desktopWidth: 1585,
    desktopHeight: 992,
    checkpoint: 4.1,
    status: 'Component preview: mounted canonical recommendations presentation (fixture state)',
  },
  {
    number: 3,
    name: 'Starting Point',
    url: 'http://127.0.0.1:4175/?app=builder&screen=starting_point',
    desktopWidth: 1585,
    desktopHeight: 992,
    checkpoint: 4.2,
    status: 'Component preview: mounted canonical starting point presentation (fixture state)',
  },
  {
    number: 4,
    name: 'Material Input',
    url: 'http://127.0.0.1:4175/?app=builder&screen=material_input',
    desktopWidth: 1585,
    desktopHeight: 992,
    checkpoint: 4.3,
    status: 'Component preview: mounted canonical material input presentation (fixture state)',
  },
  {
    number: 5,
    name: 'Understanding',
    url: 'http://127.0.0.1:4175/?app=builder&screen=understanding',
    desktopWidth: 1585,
    desktopHeight: 992,
    checkpoint: 4.4,
    status: 'Component preview: mounted canonical understanding presentation (fixture state)',
  },
  {
    number: 6,
    name: 'Chunking',
    url: 'http://127.0.0.1:4175/?app=builder&screen=chunking',
    desktopWidth: 1586,
    desktopHeight: 992,
    checkpoint: 4.5,
    status: 'Component preview: mounted canonical chunking presentation (fixture state)',
  },
  {
    number: 7,
    name: 'Analyzing',
    url: 'http://127.0.0.1:4175/?app=builder&screen=analysis',
    desktopWidth: 1586,
    desktopHeight: 992,
    checkpoint: 4.6,
    status: 'Component preview: mounted canonical analysis presentation (fixture state)',
  },
  {
    number: 8,
    name: 'Ready',
    url: 'http://127.0.0.1:4175/?app=builder&screen=ready',
    desktopWidth: 1585,
    desktopHeight: 992,
    checkpoint: 5.1,
    status: 'Component preview: mounted canonical ready presentation (fixture state)',
  },
  {
    number: 9,
    name: 'Review',
    url: 'http://127.0.0.1:4175/?app=builder&screen=review',
    desktopWidth: 1585,
    desktopHeight: 992,
    checkpoint: 5.2,
    status: 'Component preview: mounted canonical review presentation (fixture state)',
  },
  {
    number: 10,
    name: 'Publication Success',
    url: 'http://127.0.0.1:4175/?app=builder&screen=published',
    desktopWidth: 1585,
    desktopHeight: 992,
    checkpoint: 5.3,
    status: 'Component preview: mounted canonical publication success presentation (fixture state)',
  },
];

let headCommit = 'unknown';
try {
  headCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {}

const capturedAt = new Date().toISOString();

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  for (const scr of screens) {
    console.log(`Capturing Screen ${scr.number}: ${scr.name}...`);

    // 1. Desktop reference size
    await page.setViewportSize({ width: scr.desktopWidth, height: scr.desktopHeight });
    await page.goto(scr.url, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.images].map(img => img.decode().catch(() => {}))));
    await page.waitForTimeout(600);

    const commitDir = resolve(outputDir, 'captures', headCommit);
    mkdirSync(commitDir, { recursive: true });

    // 1. Desktop reference size (commit-scoped ONLY - never overwriting canonical references)
    const commitDesktopPath = validateCaptureOutputPath(resolve(commitDir, `after-${scr.number}.png`), headCommit);
    const commitDesktopFullPath = validateCaptureOutputPath(resolve(commitDir, `after-${scr.number}-full.png`), headCommit);
    await page.screenshot({ path: commitDesktopPath, fullPage: false });
    await page.screenshot({ path: commitDesktopFullPath, fullPage: true });
    console.log(`-> Saved commit-scoped desktop: ${commitDesktopPath}`);

    // 2. Mobile (390 x 844) (commit-scoped ONLY)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    const commitMobilePath = validateCaptureOutputPath(resolve(commitDir, `mobile-${scr.number}.png`), headCommit);
    await page.screenshot({ path: commitMobilePath, fullPage: true });
    console.log(`-> Saved commit-scoped mobile: ${commitMobilePath}`);
  }

  // Update manifest.json
  const manifestPath = resolve(outputDir, 'manifest.json');
  let manifest = { baseline: '33660b2', referenceDir: 'reference', screens: [] };
  if (readFileSync(manifestPath, 'utf8')) {
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      manifest.referenceDir = 'reference';
    } catch {}
  }

  const manifestMap = new Map(manifest.screens.map(s => [s.number, s]));
  for (const scr of screens) {
    const existing = manifestMap.get(scr.number) || {};
    manifestMap.set(scr.number, {
      ...existing,
      number: scr.number,
      name: scr.name,
      width: scr.desktopWidth,
      height: scr.desktopHeight,
      checkpoint: scr.checkpoint,
      status: scr.status,
      currentCommit: headCommit,
      capturedAt,
      uncommittedCode: false,
      mobileStale: false,
      captureViewport: { width: scr.desktopWidth, height: scr.desktopHeight },
      captureRaster: { width: scr.desktopWidth, height: scr.desktopHeight },
      commitScoped: {
        dir: `captures/${headCommit}`,
        desktop: `captures/${headCommit}/after-${scr.number}.png`,
        desktopFull: `captures/${headCommit}/after-${scr.number}-full.png`,
        mobile: `captures/${headCommit}/mobile-${scr.number}.png`,
      },
      fixture: `Component preview harness (scripts/creation-visual/server.mjs); fixture state, not end-to-end authenticated worker`,
    });
  }

  manifest.screens = Array.from(manifestMap.values()).sort((a, b) => a.number - b.number);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Updated manifest: ${manifestPath}`);

  // 3. Post-capture assertion: verify zero mutations to canonical references
  assertReferenceIntegrity(refHashesBefore);
  console.log('✓ Canonical reference integrity verified. Zero reference mutations detected.');

} finally {
  await browser.close();
  server.kill();
}

console.log('All screen captures completed successfully.');

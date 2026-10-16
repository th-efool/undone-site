import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
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
    number: 4,
    name: 'Material Input',
    url: 'http://127.0.0.1:4175/?app=builder&screen=material_input',
    desktopWidth: 1585,
    desktopHeight: 992,
  },
];

let headCommit = 'unknown';
try {
  headCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {}

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  for (const scr of screens) {
    console.log(`Capturing Screen ${scr.number}: ${scr.name}...`);

    // 1. Desktop reference size (1585 x 992)
    await page.setViewportSize({ width: scr.desktopWidth, height: scr.desktopHeight });
    await page.goto(scr.url, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.images].map(img => img.decode().catch(() => {}))));
    await page.waitForTimeout(600);

    const commitDir = resolve(outputDir, 'captures', headCommit);
    mkdirSync(commitDir, { recursive: true });

    const commitDesktopPath = validateCaptureOutputPath(resolve(commitDir, `after-${scr.number}.png`), headCommit);
    const commitDesktopFullPath = validateCaptureOutputPath(resolve(commitDir, `after-${scr.number}-full.png`), headCommit);
    await page.screenshot({ path: commitDesktopPath, fullPage: false });
    await page.screenshot({ path: commitDesktopFullPath, fullPage: true });
    console.log(`-> Saved commit-scoped desktop: ${commitDesktopPath}`);

    // 2. Mobile (390 x 844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    const commitMobilePath = validateCaptureOutputPath(resolve(commitDir, `mobile-${scr.number}.png`), headCommit);
    await page.screenshot({ path: commitMobilePath, fullPage: true });
    console.log(`-> Saved commit-scoped mobile: ${commitMobilePath}`);
  }

  assertReferenceIntegrity(refHashesBefore);
  console.log('✓ Canonical reference integrity verified. Zero reference mutations detected.');
} finally {
  await browser.close();
  server.kill();
}

console.log('Screen capture for Checkpoint 3 completed successfully.');

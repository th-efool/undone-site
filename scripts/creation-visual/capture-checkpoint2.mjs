import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const outputDir = resolve('plans/before-after');
mkdirSync(outputDir, { recursive: true });

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
  },
  {
    number: 3,
    name: 'Starting Point',
    url: 'http://127.0.0.1:4175/?app=builder&screen=starting_point',
    desktopWidth: 1585,
    desktopHeight: 992,
  },
];

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

    const desktopPath = resolve(outputDir, `after-${scr.number}.png`);
    const desktopFullPath = resolve(outputDir, `after-${scr.number}-full.png`);
    await page.screenshot({ path: desktopPath, fullPage: false });
    await page.screenshot({ path: desktopFullPath, fullPage: true });
    console.log(`-> Saved desktop: ${desktopPath}`);

    // 2. Mobile (390 x 844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    const mobilePath = resolve(outputDir, `mobile-${scr.number}.png`);
    await page.screenshot({ path: mobilePath, fullPage: true });
    console.log(`-> Saved mobile: ${mobilePath}`);
  }
} finally {
  await browser.close();
  server.kill();
}

console.log('Screen capture for Checkpoint 2 completed successfully.');

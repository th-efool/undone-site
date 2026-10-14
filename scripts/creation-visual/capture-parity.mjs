import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const outputDir = resolve('.tmp/visual-parity-gallery');
mkdirSync(outputDir, { recursive: true });

// Load playwright-core from isolated runtime
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

const targets = [
  // 1. Intake / Source Selection
  {
    id: 'intake-source',
    title: 'Intake and Source Selection',
    legacyUrl: 'http://127.0.0.1:4175/?app=legacy&screen=3',
    builderUrl: 'http://127.0.0.1:4175/?app=builder&screen=intake',
  },
  {
    id: 'source-workspace',
    title: 'Source Input and Inventory',
    legacyUrl: 'http://127.0.0.1:4175/?app=legacy&screen=4',
    builderUrl: 'http://127.0.0.1:4175/?app=builder&screen=source-selection',
  },

  // 2. Processing (Understanding & Chunking)
  {
    id: 'processing-chunking',
    title: 'Processing Progress and Stepper',
    legacyUrl: 'http://127.0.0.1:4175/?app=legacy&screen=6',
    builderUrl: 'http://127.0.0.1:4175/?app=builder&screen=processing',
  },

  // 3. Curriculum and Expanded Evidence
  {
    id: 'curriculum-evidence',
    title: 'Curriculum Outline and Grounded Evidence',
    legacyUrl: 'http://127.0.0.1:4175/?app=legacy&screen=9',
    builderUrl: 'http://127.0.0.1:4175/?app=builder&screen=curriculum',
  },

  // 4. Review and Finalization
  {
    id: 'review-delivery',
    title: 'Review and Learner Delivery',
    legacyUrl: 'http://127.0.0.1:4175/?app=legacy&screen=8',
    builderUrl: 'http://127.0.0.1:4175/?app=builder&screen=review',
  },

  // 5. Named Draft Journey Reference
  {
    id: 'named-draft-journey',
    title: 'Named Draft (68b92a9b-7104-466f-a7b4-0cb900b0a783) Journey Reference',
    legacyUrl: 'http://127.0.0.1:4175/?app=legacy&screen=2&draft=named',
    builderUrl: 'http://127.0.0.1:4175/?app=builder&screen=intake',
  },
];

const viewports = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const themes = ['light', 'dark'];

const manifest = [];

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (err) => {
    console.error(`[pageerror at ${page.url()}]:`, err.message);
  });

  for (const target of targets) {
    for (const vp of viewports) {
      for (const th of themes) {
        await page.setViewportSize({ width: vp.width, height: vp.height });

        // Capture Legacy
        const legacyFilename = `legacy-${target.id}-${vp.name}-${th}.png`;
        const legacyPath = resolve(outputDir, legacyFilename);
        const legacyTargetUrl = `${target.legacyUrl}&theme=${th}`;

        await page.goto(legacyTargetUrl, { waitUntil: 'domcontentloaded' });
        await page.evaluate((theme) => {
          localStorage.setItem('undone_theme', theme);
          document.documentElement.setAttribute('data-theme', theme);
        }, th);
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode().catch(() => {}))));
        await page.waitForTimeout(300);

        const legacyAlerts = await page.$$eval('[role="alert"]', (els) =>
          els.map((e) => e.textContent?.trim()).filter(Boolean)
        );
        if (legacyAlerts.length > 0) {
          console.warn(`[alerts on legacy ${target.id} ${vp.name} ${th}]:`, legacyAlerts);
        }

        await page.screenshot({ path: legacyPath, fullPage: false });

        if (target.id === 'curriculum-evidence') {
          await page.evaluate(() => {
            const main = document.querySelector('main');
            if (main) main.scrollTop = 350;
          });
          await page.waitForTimeout(200);
          await page.screenshot({ path: resolve(outputDir, `legacy-curriculum-expanded-${vp.name}-${th}.png`), fullPage: false });
        }

        // Capture Builder
        const builderFilename = `builder-${target.id}-${vp.name}-${th}.png`;
        const builderPath = resolve(outputDir, builderFilename);
        const builderTargetUrl = `${target.builderUrl}&theme=${th}`;

        await page.goto(builderTargetUrl, { waitUntil: 'domcontentloaded' });
        await page.evaluate((theme) => {
          localStorage.setItem('undone_theme', theme);
          document.documentElement.setAttribute('data-theme', theme);
        }, th);
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode().catch(() => {}))));
        await page.waitForTimeout(300);
        await page.screenshot({ path: builderPath, fullPage: false });

        if (target.id === 'curriculum-evidence') {
          await page.evaluate(() => {
            const drawer = document.querySelector('details');
            if (drawer) drawer.open = true;
            const lesson = document.getElementById('lesson-lesson-0');
            if (lesson) lesson.scrollIntoView({ behavior: 'auto', block: 'start' });
          });
          await page.waitForTimeout(200);
          await page.screenshot({ path: resolve(outputDir, `builder-curriculum-expanded-${vp.name}-${th}.png`), fullPage: false });
        }

        if (target.id === 'review-delivery') {
          await page.evaluate(() => {
            const release = document.querySelector('section[aria-label="Release cohort"]') || document.querySelector('[class*="releasePanel"]');
            if (release) release.scrollIntoView({ behavior: 'auto', block: 'start' });
            else {
              const right = document.querySelector('[class*="rightPane"]') || document.querySelector('[class*="canvasContent"]');
              if (right) right.scrollTop = right.scrollHeight;
            }
          });
          await page.waitForTimeout(200);
          await page.screenshot({ path: resolve(outputDir, `builder-review-panel-${vp.name}-${th}.png`), fullPage: false });
        }

        manifest.push({
          targetId: target.id,
          targetTitle: target.title,
          viewport: vp.name,
          width: vp.width,
          height: vp.height,
          theme: th,
          legacyFile: legacyFilename,
          builderFile: builderFilename,
        });

        console.log(`[captured] ${target.id} | ${vp.name} | ${th}`);
      }
    }
  }

  writeFileSync(resolve(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nSuccessfully captured ${manifest.length} pairs (${manifest.length * 2} screenshots total).`);
} catch (err) {
  console.error('Capture failed:', err);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}

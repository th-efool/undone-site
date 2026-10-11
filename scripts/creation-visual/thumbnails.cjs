/* eslint-disable @typescript-eslint/no-require-imports -- Playwright skill executor. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const target = 'http://127.0.0.1:4175';
(async () => {
  const browser = await chromium.launch({ headless: false });
  try {
    const page = await browser.newPage({ viewport: { width: 1586, height: 992 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/cohort-creation/drafts/*/chunks', async route => route.fulfill({ json: await page.evaluate(() => window.__creationVisualFixtures.chunkPreview) }));
    for (const version of ['repair-before', 'after']) {
      await page.goto(`${target}/?screen=6&source=youtube&version=${version}`);
      await page.getByText('What makes a distributed system?', { exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      const thumbs = page.locator('img[src*="i.ytimg.com"]');
      if (version === 'after') {
        assert.equal(await thumbs.count(), 4, 'One source and three chunk thumbnails');
        await thumbs.first().scrollIntoViewIfNeeded();
        await page.waitForFunction(() => [...document.images].filter(image => image.src.includes('i.ytimg.com')).every(image => image.complete));
        const boxes = await thumbs.evaluateAll(images => images.map(image => ({ width: image.parentElement.getBoundingClientRect().width,
          height: image.parentElement.getBoundingClientRect().height, loaded: image.naturalWidth > 0 })));
        for (const box of boxes) {
          assert.ok(Math.abs(box.width / box.height - 16 / 9) < 0.04, `Landscape ratio: ${JSON.stringify(box)}`);
          assert.ok(box.loaded, 'Public thumbnail loaded');
        }
        console.log(JSON.stringify({ desktopThumbnails: boxes }));
      } else assert.equal(await thumbs.count(), 0);
      await page.screenshot({ path: `plans/before-after/chunking-video-${version}.png`, fullPage: true });
    }
    for (const width of [820, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow at ${width}`);
      const box = await page.locator('img[src*="i.ytimg.com"]').first().locator('..').boundingBox();
      assert.ok(Math.abs(box.width / box.height - 16 / 9) < 0.04);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'plans/before-after/chunking-video-mobile.png', fullPage: true });
    assert.deepEqual(errors, []);
    fs.writeFileSync('plans/before-after/chunking-video.html', `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Chunking video thumbnail repair</title><style>body{font:16px system-ui;margin:24px;background:#faf7f0}main{display:grid;grid-template-columns:1fr 1fr;gap:24px}img{width:100%;height:auto}figure{margin:0}figcaption{padding:12px 0}@media(max-width:800px){main{grid-template-columns:1fr}}</style><h1>Chunking: video thumbnail repair</h1><p>Same explicit YouTube fixture, before at 1b64f1d and current rendering. Source metadata, progress and chunks are mocked; thumbnail bytes are public YouTube artwork, not video frame captures or live extraction. Desktop 1586×992, responsive checks 820/390/320. <a href="index.html">All screens</a></p><main><figure><figcaption>BEFORE — tall numbered tiles</figcaption><a href="chunking-video-repair-before.png"><img src="chunking-video-repair-before.png" alt="Chunking before thumbnail repair"></a></figure><figure><figcaption>AFTER — actual landscape video thumbnails</figcaption><a href="chunking-video-after.png"><img src="chunking-video-after.png" alt="Chunking after thumbnail repair"></a></figure></main><p><a href="chunking-video-mobile.png">Current mobile capture</a></p></html>`);
    console.log('Thumbnail comparison, loaded artwork, landscape proportions and 3 responsive widths passed.');
  } finally { await browser.close(); }
})();

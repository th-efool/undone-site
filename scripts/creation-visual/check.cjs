/* eslint-disable @typescript-eslint/no-require-imports -- Run through the Playwright skill executor. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const target = 'http://127.0.0.1:4175';
(async () => {
  const browser = await chromium.launch({ headless: false }); const failures = []; let checks = 0;
  try {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      await context.addInitScript(value => localStorage.setItem('undone_theme', value), theme);
      const page = await context.newPage(); page.on('pageerror', error => failures.push(error.message));
      for (const endpoint of ['understanding', 'chunks', 'analysis', 'review']) {
        const key = { understanding: 'conceptPreview', chunks: 'chunkPreview', analysis: 'analysisPreview', review: 'reviewResponse' }[endpoint];
        await page.route(`**/api/cohort-creation/drafts/*/${endpoint}`, async route => route.fulfill({ json: await page.evaluate(name => window.__creationVisualFixtures[name], key) }));
      }
      for (let number = 2; number <= 10; number++) {
        await page.goto(`${target}/?screen=${number}`); await page.locator('main').waitFor();
        if (number === 9) await page.getByRole('heading', { name: 'Foundations', exact: true }).waitFor();
        if (number === 10) await page.getByRole('dialog').waitFor();
        for (const width of [1584, 1100, 820, 390, 320]) {
          await page.setViewportSize({ width, height: 844 });
          const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
          if (overflow.scroll > overflow.width) failures.push(`${theme} screen ${number} at ${width}: overflow ${overflow.scroll}`);
          if (number === 10) {
            const box = await page.getByRole('dialog').boundingBox();
            if (box.x < 0 || box.y < 0 || box.x + box.width > width) failures.push(`Dialog outside ${width}px viewport`);
          }
          checks++;
        }
        const unnamed = await page.locator('button:visible').evaluateAll(buttons => buttons.filter(button => !button.textContent.trim() && !button.getAttribute('aria-label') && !button.getAttribute('aria-labelledby')).length);
        if (unnamed) failures.push(`Screen ${number}: ${unnamed} unnamed buttons`);
      }
      await context.close();
    }
    fs.mkdirSync('.tmp/creation-visual', { recursive: true });
    fs.writeFileSync('.tmp/creation-visual/matrix.json', JSON.stringify({ checks, failures }, null, 2));
    if (failures.length) throw Error(failures.join('\n'));
    console.log(`${checks} screen/theme/viewport checks passed; no page errors, horizontal overflow or unnamed visible buttons. Reduced motion enabled.`);
  } finally { await browser.close(); }
})();

/* eslint-disable @typescript-eslint/no-require-imports -- Run through the Playwright skill executor. */
const { chromium } = require('playwright');
const target = 'http://127.0.0.1:4175/?screen=2&journey=1';
(async () => {
  const browser = await chromium.launch({ headless: false });
  try {
    const page = await browser.newPage({ viewport: { width: 1585, height: 992 } });
    const errors = []; const commands = []; let state; let conflict = true;
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
    await page.route('**/api/cohort-creation/drafts/*/connectors', route => route.fulfill({ json: { connections: [] } }));
    await page.route('**/api/cohort-creation/drafts/*/events*', async route => {
      state = await page.evaluate(value => window.__creationJourney.complete(value), state);
      await route.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ schemaVersion: 1, draftId: state.draftId, jobId: null, job: null,
        inputRevision: state.inputRevision, sequence: state.revision, kind: 'snapshot', snapshot: state, createdAt: new Date().toISOString() }) + '\n' });
    });
    for (const [endpoint, key] of [['understanding', 'conceptPreview'], ['chunks', 'chunkPreview'], ['analysis', 'analysisPreview'], ['review', 'reviewResponse']]) {
      await page.route(`**/api/cohort-creation/drafts/*/${endpoint}`, async route => route.fulfill({ json: await page.evaluate(({ key, state }) => key === 'reviewResponse' ? window.__creationJourney.review(state) : { ...window.__creationVisualFixtures[key], revision: state.revision }, { key, state }) }));
    }
    await page.route(/\/api\/cohort-creation\/drafts\/[^/]+$/, async route => {
      if (!state) state = await page.evaluate(() => window.__creationJourney.seed());
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON(); commands.push(body.command.type);
        if (body.baseRevision !== state.revision || body.command.type === 'edit_review' && conflict) {
          conflict = false; state = { ...state, revision: state.revision + 1 };
          await route.fulfill({ status: 409, json: { current: state } }); return;
        }
        state = await page.evaluate(({ state, command }) => window.__creationJourney.command(state, command), { state, command: body.command });
      }
      await route.fulfill({ json: state });
    });
    await page.goto(target); await page.getByRole('button', { name: 'Create my own cohort', exact: true }).click();
    await page.getByRole('button', { name: 'Find material for me', exact: true }).click(); await page.getByRole('heading', { name: 'Find learning material', exact: true }).waitFor();
    await page.getByRole('button', { name: 'I just have a goal', exact: true }).click(); await page.getByRole('heading', { name: 'Find sources for your goal', exact: true }).waitFor();
    await page.getByRole('button', { name: 'I already have material', exact: true }).click();
    await page.getByRole('button', { name: 'Paste a link', exact: true }).click(); await page.getByLabel('Public article or YouTube URL').fill('https://example.com/retained-material');
    await page.getByRole('button', { name: 'Save and acquire material', exact: true }).click();
    await page.getByRole('button', { name: 'Understand selected material', exact: true }).click();
    await page.getByRole('button', { name: 'Chunk selected material', exact: true }).click();
    await page.getByRole('button', { name: 'Analyze grounded chunks', exact: true }).click();
    await page.getByRole('button', { name: 'Build curriculum', exact: true }).click();
    await page.getByRole('heading', { name: 'All set.', exact: true }).waitFor(); await page.reload(); await page.getByRole('heading', { name: 'All set.', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Review cohort', exact: true }).click(); await page.getByRole('heading', { name: 'Foundations', exact: true }).waitFor();
    await page.locator('summary').filter({ hasText: 'Edit cohort details' }).click(); await page.getByLabel('Cohort title', { exact: true }).fill('User-edited cohort title');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click(); await page.getByText(/Draft changed in another request/).waitFor();
    if (await page.getByLabel('Cohort title', { exact: true }).inputValue() !== 'User-edited cohort title') throw Error('Conflict discarded user edits');
    await page.reload(); // Persisted state reload clears the failed server-confirmation flag, as in the production recovery path.
    await page.locator('summary').filter({ hasText: 'Edit cohort details' }).click(); await page.getByLabel('Cohort title', { exact: true }).fill('User-edited cohort title');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await page.getByRole('button', { name: 'Publish publicly', exact: true }).last().click(); await page.getByRole('dialog', { name: 'Your cohort is live!', exact: true }).waitFor();
    if (state.review.title !== 'User-edited cohort title' || !state.publication.receipt) throw Error('Saved edits or committed receipt missing');
    const receipt = JSON.stringify(state.publication.receipt);
    await page.reload(); await page.getByRole('dialog', { name: 'Your cohort is live!', exact: true }).waitFor();
    if (JSON.stringify(state.publication.receipt) !== receipt || commands.filter(command => command === 'finalize_creation').length !== 1) throw Error('Reload duplicated publication');
    if (errors.length) throw Error(errors.join('\n'));
    console.log('Real client hook + mocked API/NDJSON journey passed: three branch choices, retained material, four processing transitions, Ready reload, review conflict/edit preservation, publication receipt and completion reload.');
    console.log('Commands: ' + commands.join(' → '));
  } finally { await browser.close(); }
})();

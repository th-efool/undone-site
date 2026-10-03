#!/usr/bin/env node
/** Capture a safe live project-menu snapshot through an isolated Playwright browser. */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

function fail(message) {
  process.stderr.write(`project-menu browser scan: ${message}\n`);
  process.exitCode = 1;
}

function parseArgs(argv) {
  const result = { timeout: 8000, browser: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--url') result.url = argv[++index];
    else if (arg === '--browser') result.browser = argv[++index];
    else if (arg === '--timeout-ms') result.timeout = Number(argv[++index]);
    else throw new Error(`unsupported argument: ${arg}`);
  }
  if (!result.url) throw new Error('--url is required');
  const parsed = new URL(result.url);
  if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
    throw new Error('source-aware scan only accepts a loopback URL');
  }
  return result;
}

function browserCandidates(explicit) {
  return [
    explicit,
    process.env.UI_SCAN_BROWSER,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
}

function findBrowser(explicit) {
  const found = browserCandidates(explicit).find((candidate) => existsSync(candidate));
  if (!found) throw new Error('no Chromium, Chrome, or Edge executable found; pass --browser');
  return found;
}

const DISCOVER = String.raw`(() => {
  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const visible = (element) => {
    if (!element) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  };
  const escape = (value) => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const preferred = [...document.querySelectorAll('[data-ui-project-menu] a, [data-ui-project-menu] button, [data-ui-project-menu] [data-view-target], [data-ui-project-menu] [data-ui-action]')];
  const fallback = [...document.querySelectorAll('nav a[href], aside a[href], [role="navigation"] a[href], nav [data-view-target], aside [data-view-target], [role="navigation"] [data-view-target], [data-ui-scan-safe="true"]')];
  const candidates = preferred.length ? preferred : fallback;
  const seen = new Set();
  const items = [];
  for (const element of candidates) {
    const stableId = clean(element.dataset.uiMenuId || element.dataset.uiId);
    const label = clean(element.getAttribute('aria-label') || element.innerText || element.textContent || element.title);
    const href = element instanceof HTMLAnchorElement ? element.href : '';
    const target = clean(element.dataset.viewTarget || element.dataset.uiTarget || element.getAttribute('aria-controls'));
    const action = clean(element.dataset.uiAction || element.dataset.action);
    if (!stableId || !label || (!href && !target && !action)) continue;
    const id = stableId.startsWith('project-menu.') ? stableId : 'project-menu.' + stableId;
    if (seen.has(id)) continue;
    seen.add(id);
    const explicitParent = clean(element.dataset.uiMenuParent);
    const parentElement = element.parentElement?.closest('[data-ui-menu-id], [data-ui-id^="project-menu."]');
    const parentRaw = explicitParent || clean(parentElement?.dataset.uiMenuId || parentElement?.dataset.uiId);
    const parentId = parentRaw ? (parentRaw.startsWith('project-menu.') ? parentRaw : 'project-menu.' + parentRaw) : null;
    const selector = '[data-ui-id="' + escape(stableId) + '"]';
    const current = element.getAttribute('aria-current') === 'page' || element.dataset.current === 'true' || element.classList.contains('active');
    items.push({
      id,
      label,
      parentId,
      selector,
      target,
      action,
      href,
      current,
      preferred: Boolean(element.closest('[data-ui-project-menu]')),
      initiallyVisible: visible(element),
    });
  }
  return {
    url: location.href,
    language: document.documentElement.lang || navigator.language || 'und',
    title: document.title,
    menus: items,
  };
})()`;

function activationExpression(item) {
  return String.raw`(async () => {
    const selector = ${JSON.stringify(item.selector)};
    const target = ${JSON.stringify(item.target)};
    const href = ${JSON.stringify(item.href)};
    const element = document.querySelector(selector);
    if (element) element.click();
    else if (href) location.href = href;
    else return { bound: false, error: 'trigger missing' };
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const isVisible = (node) => {
      if (!node) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const rootFor = () => {
      const escaped = CSS.escape(target || '');
      const candidates = [
        target ? document.querySelector('[data-view="' + escaped + '"][data-ui-id]') : null,
        target ? document.querySelector('[data-ui-page="' + escaped + '"][data-ui-id]') : null,
        target ? document.querySelector('[data-ui-id="page.' + escaped + '"]') : null,
        ...document.querySelectorAll('[data-ui-page][data-ui-id], [data-view][data-ui-id], main[data-ui-id]'),
      ];
      return candidates.find(isVisible) || null;
    };
    let previous = '';
    let stable = 0;
    let root = null;
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      root = rootFor();
      const fingerprint = root ? [root.dataset.uiId, root.querySelectorAll('[data-ui-id]').length, root.textContent.length].join('|') : '';
      stable = fingerprint && fingerprint === previous ? stable + 1 : 0;
      previous = fingerprint;
      if (stable >= 2) break;
      await sleep(120);
    }
    root = rootFor();
    if (!root) return { bound: false, error: 'destination root missing' };
    const descendants = [...root.querySelectorAll('[data-ui-id]')];
    const ids = new Set([root.dataset.uiId, ...descendants.map((node) => node.dataset.uiId)].filter(Boolean));
    return {
      bound: true,
      rootId: root.dataset.uiId,
      layerCount: ids.size,
      destinationId: target || root.dataset.view || root.dataset.uiPage || root.dataset.uiId,
      settledUrl: location.href,
    };
  })()`;
}

async function loadPlaywright() {
  const roots = [
    process.env.UI_SCAN_PLAYWRIGHT,
    join(process.cwd(), 'node_modules', 'playwright', 'index.mjs'),
    join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright', 'index.mjs'),
  ].filter(Boolean);
  for (const candidate of roots) {
    if (!existsSync(candidate)) continue;
    try {
      return await import(pathToFileURL(candidate).href);
    } catch (error) {
      process.stderr.write(`project-menu browser scan: cannot load ${candidate}: ${error.message}\n`);
    }
  }
  throw new Error('Playwright is unavailable; use Codex bundled runtime or install playwright in the project');
}

async function scanWithPlaywright(args, browserPath) {
  const playwright = await loadPlaywright();
  const browser = await playwright.chromium.launch({ executablePath: browserPath, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: args.timeout });
    await page.waitForTimeout(250);
    const discovered = await page.evaluate(DISCOVER);
    if (!discovered?.menus?.length) throw new Error('no stable project menu was discovered');
    const measured = [];
    for (const item of discovered.menus) {
      await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: args.timeout });
      await page.waitForTimeout(120);
      const result = await page.evaluate(activationExpression(item));
      measured.push({ ...item, ...result });
    }
    const currentBound = measured.filter((item) => item.current && item.bound);
    if (currentBound.length !== 1) {
      const firstBound = measured.findIndex((entry) => entry.bound);
      measured.forEach((item, index) => { item.current = index === firstBound; });
    }
    return { ...discovered, browser: browserPath, menus: measured };
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const browser = findBrowser(args.browser);
  const playwrightResult = await scanWithPlaywright(args, browser);
  process.stdout.write(JSON.stringify(playwrightResult));
}

try {
  await main();
} catch (error) {
  fail(error?.stack || String(error));
}

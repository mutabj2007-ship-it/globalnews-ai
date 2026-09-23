// Test-only response fixture: never imported by product code or admitted to a store.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.DATAFED_TEST_URL || 'http://127.0.0.1:3187';
const output = process.env.DATAFED_REVIEW_DIR;
if (!output) throw new Error('DATAFED_REVIEW_DIR required');
await mkdir(output, { recursive: true });
const body = {
  publishable: true,
  slot: { kind: 'OBSERVATION', observation: { value: 15.9, unit: 'PERCENT', periodId: '2026-08' } },
  seriesLabel: 'Rwanda headline CPI, year on year', geographyLabel: 'All Rwanda',
  provenance: { institution: 'National Institute of Statistics of Rwanda', jurisdiction: 'RW',
    referencePeriod: '2026-08', publicationDateStated: '2026-09-10', sourceLanguage: 'en',
    contentAddress: 'a'.repeat(64), retrievedAt: '2026-09-20T00:00:00Z', licence: 'CC BY 4.0',
    parserId: 'nisr.cpi.pdf', parserVersion: '1.0.0', extractorId: 'UI-TEST-FIXTURE', extractorVersion: '1',
    basePeriod: 'Feb 2014=100', sourceUrl: 'https://statistics.gov.rw/test-fixture.pdf' },
};
const api = createServer((req, res) => {
  if (req.url !== '/economy/observations/rw-nisr-cpi') { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
});
await new Promise((resolve, reject) => { api.once('error', reject); api.listen(4000, resolve); });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const results = [];
try {
  for (const locale of ['en', 'pl']) for (const width of [375, 390, 430, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addCookies([{ name: 'globalnews-ai-language', value: locale, url: base }]);
    const page = await context.newPage();
    const errors = [], forbidden = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('request', r => {
      const url = new URL(r.url());
      if (url.origin !== base || (['fetch', 'xhr'].includes(r.resourceType()) && !url.pathname.startsWith('/_next/static/webpack/'))) forbidden.push(r.url());
    });
    const compact = width < 1000;
    await page.goto(`${base}/economy-visual-preview${compact ? '/compact' : ''}`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-econ="retained-summary"]').count(), 0);
    const frame = page.locator(`[data-econ="${compact ? 'economy-compact' : 'economy-screen'}"]`);
    await frame.waitFor();
    assert.equal(await frame.getAttribute('data-observation-mode'), 'OBSERVED');
    assert.match(await frame.innerText(), /15[.,]9/);
    await page.waitForTimeout(650);
    const collisions = await page.evaluate(() => {
      const launcher = document.querySelector('[data-ask="launcher"]');
      const box = el => { const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; };
      const a = box(launcher);
      const overlaps = b => Math.max(0, Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)) * Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
      const targets = [...document.querySelectorAll('[data-econ="compact-state-header"], [data-econ="compact-indicator-cell"], [data-econ="compact-tab-bar"] button')];
      return { launcher:a, anchor:launcher.dataset.askAnchor, targets:targets.map(el=>({selector:el.getAttribute('data-econ') || 'compact-tab-bar button',text:el.textContent,box:box(el),intersectionArea:overlaps(box(el))})) };
    });
    if (process.env.DATAFED_COLLISION_PHASE !== 'before') assert.equal(collisions.targets.filter(x=>x.intersectionArea>0).length,0,JSON.stringify(collisions));
    const selectors = compact
      ? ['compact-state-header', 'compact-indicator-rail', 'compact-attention', 'compact-tab-bar']
      : ['state-header', 'substrate', 'policy-lane'];
    // Record the accepted frame's region geometry for review; no baseline thresholds are altered.
    const regions = {};
    for (const key of selectors) {
      const region = frame.locator(`[data-econ="${key}"]`);
      assert.equal(await region.count(), 1, key);
      regions[key] = await region.boundingBox();
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await page.screenshot({ path: `${output}/plan-b-economy-UI-FIXTURE-${locale}-${width}.png`, fullPage: true });
    assert.match(await frame.innerText(), locale === 'pl' ? /trend nieustalony/i : /trend not established/i);
    if (compact) {
      await page.locator('[data-econ="compact-indicator-cell"]').first().click();
      await page.locator('[data-econ="retained-source-details"]').waitFor();
      assert.equal(await page.locator('[data-econ="economy-sheet"]').getAttribute('data-detent'), 'HALF');
    } else {
      await page.locator('[data-econ="observed-provenance-line"]').click();
      await page.locator('[data-econ="retained-source-details"]').waitFor();
      assert.equal(await page.locator('[data-econ="desktop-drawer-shell"]').count(), 1);
      assert.match(await page.locator('[data-econ="retained-source-details"]').innerText(), /National Institute of Statistics/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    }
    if (compact && process.env.DATAFED_COLLISION_PHASE !== 'before') {
      await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-ask="launcher"]')).visibility === 'hidden');
    }
    const source = page.locator('[data-econ="retained-source-details"] a');
    assert.equal(await source.getAttribute('href'), body.provenance.sourceUrl);
    assert.equal(await source.getAttribute('lang'), 'en');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await page.screenshot({ path: `${output}/plan-b-evidence-UI-FIXTURE-${locale}-${width}.png`, fullPage: true });
    if (compact) {
      await page.keyboard.press('Escape');
      await page.locator('[data-econ="compact-indicator-cell"]').nth(2).click();
      assert.equal(await page.locator('[data-econ="retained-source-details"]').count(), 0);
      await page.keyboard.press('Escape');
      await page.locator('[data-ask="launcher"]').waitFor({ state: 'visible' });
      await page.locator('[data-ask="launcher"]').click();
      assert.equal(await page.locator('[data-ask="launcher"]').getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(forbidden, []);
    results.push({ locale, width, collisions, regions, input: 'UI fixture only; no DB verification', restoredFrame: true, overflow: 0, errors, forbidden });
    await context.close();
  }
  await writeFile(`${output}/plan-b-economy-browser.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); await new Promise(resolve => api.close(resolve)); }

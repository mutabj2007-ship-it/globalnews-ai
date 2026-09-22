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
  for (const locale of ['en', 'pl']) for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addCookies([{ name: 'globalnews-ai-language', value: locale, url: base }]);
    const page = await context.newPage();
    const errors = [], forbidden = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('request', r => { const url = new URL(r.url()); if (url.origin !== base || (['fetch', 'xhr'].includes(r.resourceType()) && !url.pathname.startsWith('/_next/static/webpack/'))) forbidden.push(r.url()); });
    const suffix = width < 1000 ? '/compact' : '';
    await page.goto(`${base}/imihigo${suffix}`, { waitUntil: 'networkidle' });
    const rows = page.locator('[data-del="subject"]');
    const initial = await rows.allTextContents();
    assert.equal(initial.length, 28);
    await page.getByRole('searchbox').fill('ngoma');
    assert.equal(await rows.count(), 1);
    assert.match(await rows.innerText(), /77.2/);
    await page.getByRole('searchbox').fill('no-such-entity');
    assert.equal(await rows.count(), 0);
    await page.getByRole('searchbox').fill('');
    await page.getByRole('combobox').selectOption('district');
    assert.equal(await rows.count(), 27);
    await page.getByRole('combobox').selectOption('city-of-kigali');
    assert.equal(await rows.count(), 1);
    assert.match(await rows.innerText(), /59.3%/);
    await page.getByRole('combobox').selectOption('all');
    assert.deepEqual(await rows.allTextContents(), initial);
    await rows.first().locator('summary').click();
    assert.match(await rows.first().locator('a').getAttribute('href'), /#page=9$/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await page.goto(`${base}/economy-visual-preview${suffix}`, { waitUntil: 'networkidle' });
    const summary = page.locator('[data-econ="retained-summary"]');
    await summary.waitFor();
    assert.equal(await summary.locator('[data-econ="retained-value"]').innerText(), locale === 'pl' ? '15,9%' : '15.9%');
    assert.match(await summary.innerText(), locale === 'pl' ? /trend nieustalony/ : /trend not established/);
    assert.equal(await summary.locator('svg,canvas').count(), 0);
    assert.equal(await summary.locator('a[target="_blank"]').getAttribute('href'), body.provenance.sourceUrl);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    const firstView = await summary.locator('[data-econ="retained-value"]').boundingBox();
    assert.ok(firstView.y + firstView.height < 900);
    await page.screenshot({ path: `${output}/economy-UI-FIXTURE-${locale}-${width}.png`, fullPage: true });
    await summary.locator('a[href="#economy-evidence"]').click();
    await page.waitForFunction(() => document.querySelector('#economy-evidence').getBoundingClientRect().top < innerHeight);
    assert.deepEqual(errors, []);
    assert.deepEqual(forbidden, []);
    results.push({ locale, width, imihigoRecords: 28, searchAndFilters: 'passed', lexicalOrderPreserved: true, economyInput: 'TEST FIXTURE, not a retained database verification', overflow: 0, errors, forbidden });
    await context.close();
  }
  await writeFile(`${output}/datafed-browser-validation.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); await new Promise(resolve => api.close(resolve)); }

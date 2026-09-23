import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.IMIHIGO_TEST_URL || 'http://127.0.0.1:3187';
const output = process.env.IMIHIGO_REVIEW_DIR;
if (!output) throw new Error('IMIHIGO_REVIEW_DIR required');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const results = [];
try {
  for (const locale of ['en', 'pl']) {
    for (const width of [320, 375, 390, 430, 768, 1440]) {
      const compact = width < 1000;
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addCookies([{ name: 'globalnews-ai-language', value: locale, url: base }]);
      const page = await context.newPage();
      const errors = [], forbidden = [], requests = [];
      page.on('pageerror', error => errors.push(String(error)));
      page.on('request', request => {
        requests.push(request.url());
        const url = new URL(request.url());
        if (url.origin !== base || url.pathname.startsWith('/api') || ['fetch','xhr'].includes(request.resourceType())) forbidden.push(request.url());
      });
      const response = await page.goto(base + (compact ? '/imihigo/compact' : '/imihigo'), { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await page.locator('[data-del="subject"]').count(), 28);
      const headings = await page.locator('[data-del="region"] h2').allTextContents();
      assert.equal(headings.length, 4);
      assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/);
      const treatments = () => page.locator('[data-del="subject"]').evaluateAll(rows => rows.map(row => {
        const s = getComputedStyle(row);
        return JSON.stringify(['fontWeight','fontSize','color','backgroundColor','borderBottomWidth','padding','textIndent','opacity'].map(key => s[key]));
      }));
      assert.equal(new Set(await treatments()).size, 1);
      await page.locator('[data-del="subject"]').first().evaluate(row => row.style.fontWeight = '700');
      assert.equal(new Set(await treatments()).size, 2, 'RC-4 mutation must be caught');
      await page.locator('[data-del="subject"]').first().evaluate(row => row.style.removeProperty('font-weight'));
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.equal(await overflow(), 0);
      await page.screenshot({ path: `${output}/imihigo-${locale}-${width}.png`, fullPage: true });
      await page.locator('details').evaluateAll(nodes => nodes.forEach(node => node.open = true));
      assert.equal(await overflow(), 0, 'Expanded provenance must fit phone width');
      assert.deepEqual(errors, []);
      assert.deepEqual(forbidden, []);
      results.push({ locale, width, compact, rows: 28, headings, requests: requests.length, acquisitionRequests: forbidden.length, pageErrors: errors.length, overflow: 0, expandedEvidenceOverflow: 0, rc4MutationDetected: true });
      await context.close();
    }
  }
  // Recovered archive preview also remains provider-free.
  const page = await browser.newPage();
  await page.goto(base + '/delivery-visual-preview/compact', { waitUntil: 'networkidle' });
  assert.equal(await page.locator('[data-del="region"]').count(), 4);
  assert.equal(await page.locator('[data-del="subject"]').count(), 3);
  await writeFile(`${output}/browser-validation.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }

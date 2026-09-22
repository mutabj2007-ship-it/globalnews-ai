// Verification only: accepted frames are restored; no evidence service or provider is started.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = process.argv[2];
if (!output) throw new Error('Pass review output directory');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const results = [];
  try {
    for (const domain of ['election', 'politics']) for (const locale of ['en', 'pl']) for (const phone of [false, true]) {
      const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
      await context.addCookies([{ name: 'globalnews-ai-language', value: locale, url: 'http://localhost:3128' }]);
      const page = await context.newPage(), errors = [], external = [], reads = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', r => {
        if (!r.url().startsWith('http://localhost:3128')) external.push(r.url());
        if (/evidence\/ke|politics\/observations/.test(r.url())) reads.push(r.url());
      });
      await page.goto('http://localhost:3128/' + domain + '-visual-preview' + (phone ? '/compact' : ''), { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.equal(overflow, 0);
      assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/);
      assert.equal(await page.locator('[data-evidence]').count(), 0);
      const name = domain + '-' + locale + '-' + (phone ? 'phone' : 'desktop');
      let geometry;
      if (domain === 'election') {
        const regions = await page.locator('[data-eln="region"] h2').allTextContents();
        assert.equal(regions.length, 4);
        const treatments = await page.locator('[data-eln="contestant"]').evaluateAll(rows => rows.map(row => {
          const s = getComputedStyle(row);
          return [s.color, s.fontWeight, s.fontSize, s.backgroundColor, s.borderBottomWidth, s.padding].join('|');
        }));
        assert.equal(new Set(treatments).size, 1);
        const body = await page.locator('body').innerText();
        assert.ok(!body.includes('Waweru') && !body.includes('35,440'));
        geometry = { regions, equalRowTreatments: true };
      } else {
        assert.equal(await page.locator('[data-pol="subject-slot"]').count(), 3);
        assert.equal(await page.locator('[data-pol="locale-fallback"]').count(), locale === 'pl' ? 1 : 0);
        if (phone) {
          const chrome = page.locator('[data-pol="compact-chrome"]');
          assert.equal(await chrome.getAttribute('data-pol-chrome-max'), '82');
          geometry = { chromeChildren: await chrome.locator(':scope > div').evaluateAll(rows => rows.map(r => r.getBoundingClientRect().height)) };
          assert.deepEqual(geometry.chromeChildren, [52, 30]);
        } else {
          assert.equal(await page.locator('[data-pol="zone-header"]').count(), 1);
          assert.equal(await page.locator('[data-pol="zone-context"]').count(), 1);
          geometry = { columns: await page.locator('[data-pol="body"]').evaluate(r => getComputedStyle(r).gridTemplateColumns) };
          const columns = geometry.columns.split(' ').map(parseFloat);
          assert.equal(columns[0], 320);
          assert.equal(columns[2], 360);
        }
      }
      await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
      if (domain === 'politics') {
        await page.locator('[data-pol="open-provenance"]').click();
        const panel = page.locator(phone ? '[data-pol="compact-sheet"]' : '[data-pol="drawer"]');
        await panel.waitFor();
        assert.equal(await panel.count(), 1);
        await page.screenshot({ path: path.join(output, name + '-provenance.png'), fullPage: true });
        await page.locator(phone ? '[data-pol="sheet-close"]' : '[data-pol="drawer-close"]').click();
        assert.equal(await panel.count(), 0);
      }
      assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(reads, []);
      results.push({ name, overflow, geometry, errors, external, reads, passed: true });
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'browser-validation.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

// Local acceptance only. First-party retained service; no runtime provider graph.
// Next must run separately with SERVER_INTERNAL_API_URL=http://127.0.0.1:4128.
const http = require('node:http');
require('ts-node').register({ project: require('node:path').resolve('backend/tsconfig.json'), transpileOnly: true });
require('reflect-metadata');
const { ElectionReadService } = require('../backend/src/modules/election/election-read.service');
const reader = new ElectionReadService();
let mode = 'off';
const requests = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:4128');
  requests.push({ path: url.pathname, mode });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (mode === 'unavailable') { res.writeHead(503); return res.end('{}'); }
  if (url.pathname !== '/election/evidence/ke') { res.writeHead(404); return res.end('{}'); }
  const saved = process.env.ELECTION_EVIDENCE_READ_ENABLED;
  try {
    process.env.ELECTION_EVIDENCE_READ_ENABLED = mode === 'evidence' ? 'true' : 'false';
    res.end(JSON.stringify(reader.read(url.searchParams.get('locale') === 'pl' ? 'pl' : 'en')));
  } finally {
    if (saved === undefined) delete process.env.ELECTION_EVIDENCE_READ_ENABLED;
    else process.env.ELECTION_EVIDENCE_READ_ENABLED = saved;
  }
});
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = process.argv[2];
if (!output) throw new Error('Pass review output directory');
fs.mkdirSync(output, { recursive: true });
(async () => {
  await new Promise(resolve => server.listen(4128, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const results = [];
  try {
    for (const domain of ['election', 'politics']) for (const state of domain === 'election' ? ['off', 'evidence', 'unavailable'] : ['off']) for (const locale of ['en', 'pl']) for (const phone of [false, true]) {
      mode = state;
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
      const name = domain + '-' + state + '-' + locale + '-' + (phone ? 'phone' : 'desktop');
      let geometry;
      if (domain === 'election') {
        const regions = await page.locator('[data-eln="region"] h2').allTextContents();
        assert.equal(regions.length, 4);
        const body = await page.locator('body').innerText();
        assert.ok(!body.includes('Placeholder contestant'));
        assert.equal(await page.locator('[data-eln="chip"]').count(), 0);
        assert.equal(await page.locator('[data-eln="contestant"]').count(), state === 'evidence' ? 1 : 0);
        assert.equal(await page.locator('[data-eln-treatment="VALUE"]').count(), 0);
        if (state === 'evidence') {
          for (const value of ['Waweru Sammy Douglas Kamau', 'Democracy for the Citizens Party', '35,440', 'Ol Kalou', 'Nyandarua', locale === 'pl' ? 'OFICJALNE OGŁOSZENIE' : 'OFFICIAL DECLARATION']) assert.ok(body.includes(value), value);
          assert.ok(!body.includes('FINAL_CERTIFIED'));
          await page.locator('[data-eln="contestant"] summary').click();
          const expanded = await page.locator('body').innerText();
          for (const value of ['IEBC', '2026-07-21', '2026-09-22T16:25:32.269Z', 'ke-ol-kalou-mna-2026-07-16', 'Gazette Notice 11216']) assert.ok(expanded.includes(value), value);
          assert.equal(await page.locator('[data-eln="contestant"] a').getAttribute('href'), 'https://www.iebc.or.ke/uploads/resources/hlYWqNRqs2.pdf');
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
          await page.screenshot({ path: path.join(output, name + '-source.png'), fullPage: true });
          await page.locator('[data-eln="contestant"] summary').click();
        } else {
          assert.ok(!body.includes('Waweru') && !body.includes('35,440'));
          assert.ok(body.includes(state === 'off' ? (locale === 'pl' ? 'wyłączony' : 'reader is disabled') : (locale === 'pl' ? 'Nie udało się' : 'could not be checked')));
        }
        geometry = { regions, rowCount: state === 'evidence' ? 1 : 0 };
      } else {
        assert.equal(await page.locator('[data-pol="subject-slot"]').count(), 3);
        assert.ok((await page.locator('body').innerText()).includes(locale === 'pl' ? 'Nie oznacza to, że nic' : 'No governed evidence is retained'));
        assert.equal(await page.locator('[data-pol="locale-fallback"]').count(), 0);
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
    fs.writeFileSync(path.join(output, 'browser-validation.json'), JSON.stringify({ results, requests }, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });

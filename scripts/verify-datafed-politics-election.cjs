// Local acceptance harness: actual retained services only. Never boots the runtime provider graph.
// Start Next separately with SERVER_INTERNAL_API_URL=http://127.0.0.1:4128 and port 3128.
// The gate is overridden and restored only in this disposable test process.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
require('ts-node').register({
  project: path.resolve('backend/tsconfig.json'),
  transpileOnly: true,
});
require('reflect-metadata');
const { ElectionReadService } = require('../backend/src/modules/election/election-read.service');
const { PoliticsReadService } = require('../backend/src/modules/politics/politics.module');
const { chromium } = require('playwright');
const output = process.argv[2];
if (!output) throw new Error('Pass an acceptance output directory');
fs.mkdirSync(output, { recursive: true });
let mode = 'off';
const requests = [];
const election = new ElectionReadService();
const politics = new PoliticsReadService();
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:4128');
  requests.push(url.pathname);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (mode === 'unavailable') {
    res.writeHead(503);
    return res.end('{}');
  }
  if (url.pathname === '/election/evidence/ke') {
    const saved = process.env.ELECTION_EVIDENCE_READ_ENABLED;
    try {
      process.env.ELECTION_EVIDENCE_READ_ENABLED = mode === 'evidence' ? 'true' : 'false';
      res.end(JSON.stringify(election.read(url.searchParams.get('locale') === 'pl' ? 'pl' : 'en')));
    } finally {
      if (saved === undefined) delete process.env.ELECTION_EVIDENCE_READ_ENABLED;
      else process.env.ELECTION_EVIDENCE_READ_ENABLED = saved;
    }
  } else if (url.pathname === '/politics/observations')
    res.end(JSON.stringify(politics.read(undefined, 100)));
  else {
    res.writeHead(404);
    res.end('{}');
  }
});
(async () => {
  await new Promise((resolve) => server.listen(4128, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const results = [];
  try {
    for (const domain of ['election', 'politics'])
      for (const state of domain === 'election'
        ? ['off', 'evidence', 'unavailable']
        : ['off', 'unavailable'])
        for (const locale of ['en', 'pl'])
          for (const phone of [false, true]) {
            mode = state;
            const context = await browser.newContext({
              viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
            });
            await context.addCookies([
              { name: 'globalnews-ai-language', value: locale, url: 'http://localhost:3128' },
            ]);
            const page = await context.newPage();
            const errors = [],
              external = [];
            page.on('pageerror', (e) => errors.push(e.message));
            page.on('request', (r) => {
              if (!r.url().startsWith('http://localhost:3128')) external.push(r.url());
            });
            await page.goto(
              'http://localhost:3128/' + domain + '-visual-preview' + (phone ? '/compact' : ''),
              { waitUntil: 'networkidle' },
            );
            await page.locator('[data-evidence="' + domain + '"]').waitFor();
            const text = await page.locator('[data-evidence="' + domain + '"]').innerText();
            const overflow = await page.evaluate(
              () => document.documentElement.scrollWidth - innerWidth,
            );
            assert.equal(overflow, 0);
            assert.deepEqual(errors, []);
            assert.deepEqual(external, []);
            assert.equal(await page.locator('[data-eln="contestant"]').count(), 0);
            assert.match(
              await page.locator('meta[name="robots"]').getAttribute('content'),
              /noindex/,
            );
            if (domain === 'election' && state === 'evidence') {
              assert.equal(
                await page.locator('article[data-evidence-state="OFFICIAL_DECLARATION"]').count(),
                1,
              );
              for (const value of [
                'Ol Kalou',
                'Nyandarua',
                'ke-ol-kalou-mna-2026-07-16',
                'IEBC',
                '2026-07-21',
                '2026-09-22T16:25:32.269Z',
                '35,440',
                'Waweru Sammy Douglas Kamau',
                'Gazette Notice 11216',
              ])
                assert.ok(text.includes(value), value);
              assert.ok(
                text.includes(locale === 'pl' ? 'całym kraju' : 'not national election coverage'),
              );
              assert.equal(
                await page.locator('article a').getAttribute('href'),
                'https://www.iebc.or.ke/uploads/resources/hlYWqNRqs2.pdf',
              );
              await page.locator('article summary').click();
              assert.ok(
                (await page.locator('article').innerText()).includes(
                  '0ef85b938fe3867becaaff9fddeaf052ee6bbe32e391965a69d53e56224ebec4',
                ),
              );
            } else if (domain === 'election') {
              assert.ok(!text.includes('Waweru'));
              assert.ok(
                text.includes(
                  state === 'off'
                    ? locale === 'pl'
                      ? 'wyłączony'
                      : 'reader is off'
                    : locale === 'pl'
                      ? 'niedostępny'
                      : 'unavailable',
                ),
              );
            } else {
              assert.equal(await page.locator('article').count(), 0);
            if (locale === 'pl') { assert.ok(text.includes('Proces legislacyjny')); assert.ok(!text.includes('Legislative subject')); }
              assert.ok(
                text.includes(locale === 'pl' ? 'nie oznacza, że nic' : 'does not mean nothing'),
              );
              assert.equal(
                await page.locator('[data-politics-state]').getAttribute('data-politics-state'),
                state === 'off' ? 'NOT_ASSESSED' : 'UNAVAILABLE',
              );
            }
            const name = domain + '-' + state + '-' + locale + '-' + (phone ? 'phone' : 'desktop');
            await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
            results.push({ name, overflow, errors, external, passed: true });
            await context.close();
          }
    fs.writeFileSync(
      path.join(output, 'browser-validation.json'),
      JSON.stringify({ results, requests }, null, 2),
    );
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});

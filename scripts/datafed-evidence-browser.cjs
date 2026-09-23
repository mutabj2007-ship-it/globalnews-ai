/* Local-only acceptance harness. Requires Playwright (or NODE_PATH to its installation).
 * Usage: node scripts/datafed-evidence-browser.cjs <output-directory>
 * Starts a loopback contract stub and Next dev; never starts the application backend.
 */
const { chromium } = require('playwright');
const { createServer } = require('node:http');
const { spawn } = require('node:child_process');
const { mkdirSync, writeFileSync, createWriteStream } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(root, 'coverage/datafed-browser'));
mkdirSync(out, { recursive: true });
let mode = 'closed';
const requests = [];
const stub = createServer((req, res) => {
  requests.push(req.url);
  res.setHeader('content-type', 'application/json');
  if (req.url === '/humanitarian/observations') {
    if (mode === 'failure') {
      res.statusCode = 503;
      return res.end('{}');
    }
    return res.end(
      JSON.stringify(
        mode === 'forged'
          ? {
              kind: 'OBSERVATIONS',
              absence: 'NOT_ASSESSED',
              observations: [{ name: 'SECRET PERSON', sourceUrl: 'https://private.invalid' }],
            }
          : { kind: 'UNAVAILABLE', absence: 'NOT_ASSESSED', observations: [] },
      ),
    );
  }
  res.statusCode = 401;
  res.end('{}');
});
(async () => {
  await new Promise((resolve) => stub.listen(4387, '127.0.0.1', resolve));
  const log = createWriteStream(path.join(out, 'next.log'));
  const next = spawn(
    process.execPath,
    [
      path.join(root, 'node_modules/next/dist/bin/next'),
      'dev',
      '--hostname',
      '127.0.0.1',
      '--port',
      '3387',
    ],
    {
      cwd: path.join(root, 'frontend'),
      windowsHide: true,
      env: {
        ...process.env,
        SERVER_INTERNAL_API_URL: 'http://127.0.0.1:4387',
        NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4387',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  next.stdout.pipe(log);
  next.stderr.pipe(log);
  let browser;
  const results = [];
  try {
    for (let i = 0; i < 90; i++) {
      try {
        const r = await fetch('http://127.0.0.1:3387/security-visual-preview');
        if (r.ok) break;
      } catch {}
      if (i === 89) throw new Error('Next did not start');
      await new Promise((r) => setTimeout(r, 1000));
    }
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    for (const locale of ['en', 'pl'])
      for (const width of [1440, 390])
        for (const route of [
          '/humanitarian',
          '/humanitarian/compact',
          '/security-visual-preview',
          '/security-visual-preview/compact',
        ]) {
          const context = await browser.newContext({
            viewport: { width, height: width === 390 ? 844 : 1000 },
          });
          await context.addCookies([
            { name: 'globalnews-ai-language', value: locale, url: 'http://127.0.0.1:3387' },
          ]);
          const page = await context.newPage();
          const external = [];
          const errors = [];
          page.on('pageerror', (err) => errors.push(err.message));
          await context.route('**/*', (route) => {
            const host = new URL(route.request().url()).hostname;
            if (!['127.0.0.1', 'localhost'].includes(host)) {
              external.push(route.request().url());
              return route.abort();
            }
            return route.continue();
          });
          const start = requests.length;
          await page.goto('http://127.0.0.1:3387' + route, { waitUntil: 'networkidle' });
          const hum = route.startsWith('/humanitarian');
          const compact = route.endsWith('/compact');
          const surface = page.locator(
            hum
              ? compact
                ? '[data-hum="compact-screen"]'
                : '[data-hum="screen"]'
              : compact
                ? '[data-sec="compact-screen"]'
                : '[data-sec="screen"]',
          );
          assert.equal(await surface.count(), 1);
          assert.equal(
            await page.locator('[data-evidence-domain], details[data-evidence-framework]').count(),
            0,
          );
          const text = await surface.innerText();
          assert(
            text.includes(
              locale === 'pl'
                ? hum
                  ? 'zweryfikowane dowody'
                  : 'zatwierdzonego przeglądu'
                : hum
                  ? 'reviewed evidence'
                  : 'governed review',
            ),
          );
          assert(!/SECRET PERSON|private.invalid/.test(text));
          if (hum) {
            assert.equal(await surface.getAttribute('data-hum-read'), 'NOT_ASSESSED');
            for (const zone of compact
              ? ['compact-zone-a', 'compact-zone-b', 'compact-substrate', 'compact-dock']
              : ['zone-a', 'zone-b', 'zone-c', 'zone-d', 'zone-e'])
              assert(await page.locator(`[data-hum="${zone}"]`).isVisible(), zone);
          } else {
            assert(await page.locator('[data-sec-zone="A0"]').isVisible());
            assert(text.includes('This is not a statement that conditions are safe.'));
            assert(await page.locator('[data-sec-zone="C2"]').isVisible());
            assert.equal(await page.locator('[data-sec-selected="true"]').count(), 0);
          }
          if (locale === 'pl')
            assert(
              await page
                .locator(hum ? '[data-hum="locale-fallback"]' : '[data-sec="locale-fallback"]')
                .isVisible(),
            );
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          );
          const geometry = await surface.evaluate((el) =>
            [
              ...el.querySelectorAll(
                '[data-sec-region], [data-sec-zone="A0"], [data-hum="zone-a"], [data-hum="zone-b"], [data-hum="zone-c"], [data-hum="zone-d"], [data-hum="compact-zone-a"], [data-hum="compact-zone-b"]',
              ),
            ].map((e) => ({
              region:
                e.getAttribute('data-sec-region') ||
                e.getAttribute('data-sec-zone') ||
                e.getAttribute('data-hum'),
              x: e.getBoundingClientRect().x,
              y: e.getBoundingClientRect().y,
              width: e.getBoundingClientRect().width,
              height: e.getBoundingClientRect().height,
            })),
          );
          await page.screenshot({
            path: path.join(out, `${route.slice(1).replaceAll('/', '-')}-${locale}-${width}.png`),
            fullPage: true,
          });
          assert.equal(overflow, false, 'page overflow');
          if (!hum && compact) {
            for (const detent of ['PEEK', 'HALF', 'FULL', 'WORKSPACE']) {
              await page.locator(`[data-sec-detent-target="${detent}"]`).click();
              assert(await page.locator('[data-sec-zone="A0"]').isVisible());
              assert(await page.locator('[data-sec-zone="C2"]').isVisible());
            }
          }
          assert.deepEqual(external, []);
          assert.deepEqual(errors, []);
          const calls = requests.slice(start);
          assert(
            calls.every(
              (url) =>
                url === '/humanitarian/observations' ||
                url.startsWith('/users/') ||
                url.startsWith('/auth/'),
            ),
            JSON.stringify(calls),
          );
          if (route.includes('security'))
            assert(!calls.some((url) => url.includes('observations')));
          results.push({
            route,
            locale,
            width,
            overflow,
            acceptedRegions: 'PASS',
            geometry,
            externalRequests: external,
            pageErrors: errors,
            backendRequests: calls,
          });
          await context.close();
        }
    for (const failure of ['failure', 'forged'])
      for (const locale of ['en', 'pl']) {
        mode = failure;
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        await context.addCookies([
          { name: 'globalnews-ai-language', value: locale, url: 'http://127.0.0.1:3387' },
        ]);
        const page = await context.newPage();
        await page.goto('http://127.0.0.1:3387/humanitarian', { waitUntil: 'networkidle' });
        assert.equal(
          await page.locator('[data-hum="screen"]').getAttribute('data-hum-read'),
          'COVERAGE_GAP',
        );
        assert(!/SECRET PERSON|private.invalid/.test(await page.content()));
        await page.screenshot({
          path: path.join(out, `humanitarian-${failure}-${locale}-390.png`),
          fullPage: true,
        });
        results.push({
          failure,
          locale,
          width: 390,
          status: 'COVERAGE_GAP',
          noContentLeak: true,
        });
        await context.close();
      }
    writeFileSync(
      path.join(out, 'results.json'),
      JSON.stringify({ passed: results.length, results }, null, 2),
    );
    console.log(JSON.stringify({ passed: results.length, out }));
  } finally {
    await browser?.close();
    if (process.platform === 'win32') {
      await new Promise((resolve) => {
        const stop = spawn('taskkill', ['/pid', String(next.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        });
        stop.on('exit', resolve);
      });
    } else next.kill('SIGTERM');
    stub.close();
    log.end();
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
  stub.close();
});

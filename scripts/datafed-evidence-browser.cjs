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
          const surface = page.locator('[data-evidence-domain]');
          assert.equal(await surface.getAttribute('data-evidence-status'), 'GATE_CLOSED');
          const text = await surface.innerText();
          assert(
            text
              .toLowerCase()
              .includes(locale === 'pl' ? 'dowody i zakres pokrycia' : 'evidence & coverage'),
          );
          assert(!/NOT ASSESSED|SECRET PERSON|private.invalid/.test(text));
          assert.equal(
            await page.locator('details[data-evidence-framework]').getAttribute('open'),
            null,
          );
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          );
          if (overflow) {
            await page.screenshot({ path: path.join(out, 'overflow.png'), fullPage: true });
            console.log(
              await page.evaluate(() =>
                [...document.querySelectorAll('body *')]
                  .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
                  .slice(0, 12)
                  .map((e) => ({
                    tag: e.tagName,
                    cls: e.className,
                    text: e.textContent.slice(0, 100),
                    right: e.getBoundingClientRect().right,
                  })),
              ),
            );
          }
          assert.equal(overflow, false, `${route} ${locale} ${width} overflow`);
          await page.screenshot({
            path: path.join(out, `${route.slice(1).replaceAll('/', '-')}-${locale}-${width}.png`),
            fullPage: true,
          });
          // Native disclosure must work with a keyboard and keep the page inside its viewport.
          await page.locator('details[data-evidence-framework] > summary').focus();
          await page.keyboard.press('Enter');
          assert.equal(
            await page.locator('details[data-evidence-framework]').getAttribute('open'),
            '',
          );
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
            false,
          );
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
            keyboardDisclosure: 'PASS',
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
          await page.locator('[data-evidence-domain]').getAttribute('data-evidence-status'),
          'READ_UNAVAILABLE',
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
          status: 'READ_UNAVAILABLE',
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

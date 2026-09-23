// TEST ONLY: mocked retained responses never enter a production route or static asset.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'conflict-observation.fixture.json'), 'utf8'),
);
const out = process.env.CONFLICT_EVIDENCE_DIR;
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const results = [];
  try {
    for (const lang of ['en', 'pl'])
      for (const width of [1440, 390]) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          locale: lang === 'pl' ? 'pl-PL' : 'en-US',
        });
        await context.addCookies([
          { name: 'globalnews-ai-language', value: lang, url: 'http://127.0.0.1:3107' },
        ]);
        const page = await context.newPage();
        const calls = [],
          errors = [];
        let data = [];
        let responseStatus = 200;
        page.on('pageerror', (e) => errors.push(e.message));
        await page.route('**/conflict/observations?*', (route) => {
          calls.push(route.request().url());
          return route.fulfill({
            status: responseStatus,
            contentType: 'application/json',
            headers: { 'access-control-allow-origin': '*' },
            body: JSON.stringify(data),
          });
        });
        const forbidden = [];
        page.on('request', (r) => {
          if (/\/(analysis|news|ucdp|providers)\//.test(r.url())) forbidden.push(r.url());
        });
        await page.goto('http://127.0.0.1:3107/conflict', {
          waitUntil: 'networkidle',
          timeout: 120000,
        });
        if (width < 861) await page.locator('[data-gn="mobile-sheet-handle"]').click();
        await page.locator('[data-gn="conflict-evidence-status"]').waitFor();
        await page.waitForFunction(() =>
          document
            .querySelector('[data-gn="conflict-evidence-status"]')
            ?.textContent?.match(/no reviewed|brak zachowanych/),
        );
        assert.equal(await page.locator('[data-gn="conflict-rail"]').count(), 0);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
        await page
          .locator('[data-gn="map-canvas"][data-gn-ready="true"]')
          .waitFor({ timeout: 30000 });
        await page.screenshot({ path: path.join(out, lang + '-' + width + '-empty.png') });
        data = [fixture];
        await page.reload({ waitUntil: 'networkidle' });
        if (width < 861) await page.locator('[data-gn="mobile-sheet-handle"]').click();
        await page
          .getByRole('button', {
            name:
              lang === 'pl'
                ? 'Ostatnie obserwacje · chronologicznie'
                : 'Recent observations · chronological',
            exact: true,
          })
          .click();
        await page.getByRole('button', { name: /TEST-A/ }).click();
        await page.locator('[data-gn="conflict-rail"]').waitFor();
        assert.match(
          await page.locator('[data-gn="conflict-evidence"]').innerText(),
          /TEST ONLY citation/,
        );
        assert.equal(await page.locator('[data-gn="conflict-change"]').count(), 0);
        assert.equal(forbidden.length, 0);
        // Shared camera uses a 420ms ease; capture its settled frame, not the transition.
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(out, lang + '-' + width + '-selected.png') });
        await page
          .getByRole('link', {
            name: lang === 'pl' ? 'Otwórz pełną mapę' : 'Open full Map Intelligence',
            exact: true,
          })
          .click();
        await page.waitForURL('**/map?**');
        await page.locator('[data-gn="conflict-spatial-evidence"]').waitFor();
        assert.equal(await page.getByText('TEST ONLY group', { exact: true }).count(), 0);
        await page
          .getByRole('link', {
            name:
              lang === 'pl' ? 'Powrót do analizy konfliktów' : 'Return to Conflict Intelligence',
            exact: true,
          })
          .click();
        await page.waitForURL('**/conflict?**');
        await page.locator('[data-gn="conflict-rail"]').waitFor();
        if (width < 861)
          assert.equal(
            await page.locator('[data-gn="mobile-sheet"]').getAttribute('data-gn-stop'),
            'HALF',
          );
        assert.equal(forbidden.length, 0);
        responseStatus = 503;
        await page.goto('http://127.0.0.1:3107/conflict', {waitUntil: 'networkidle'});
        if (width < 861) await page.locator('[data-gn="mobile-sheet-handle"]').click();
        await page.getByRole('button', {name: lang === 'pl' ? 'Ponów' : 'Retry', exact: true}).waitFor();
        assert.equal(await page.locator('[data-gn="conflict-rail"]').count(), 0);
        assert.equal(forbidden.length, 0);
        results.push({
          lang,
          width,
          roundTrip: 'passed',
          retainedReads: calls.length,
          forbidden,
          errors,
          canvas: await page.locator('canvas').count(),
        });
        await context.close();
      }
    fs.writeFileSync(path.join(out, 'browser-results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    assert(results.every((r) => r.errors.length === 0));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

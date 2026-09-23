const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.ASK_TEST_URL || 'http://127.0.0.1:3217';
const out = process.env.ASK_EVIDENCE_DIR || path.resolve('frontend/.next/ask-evidence');
fs.mkdirSync(out, { recursive: true });
process.env.TS_NODE_PROJECT = path.resolve('frontend/tsconfig.jest.json');
require('ts-node/register/transpile-only');
require('tsconfig-paths/register');
const fixture = require('../frontend/src/components/analysis-frame/frameFixtures').fixture({
  articleCount: 6,
});
fixture.retrievalContext.comparisonCoverage = ['ISR', 'IRN', 'SAU'].map((iso3, i) => ({
  countryName: ['Israel', 'Iran', 'Saudi Arabia'][i],
  iso2: ['IL', 'IR', 'SA'][i],
  iso3,
  requested: true,
  liveRetrievalAttempted: true,
  usableLiveEvidenceCount: 0,
  usableRetainedEvidenceCount: 0,
  finalQualifyingEvidenceCount: 0,
  finalLiveEvidenceCount: 0,
  finalRetainedEvidenceCount: 0,
  providers: [],
  providerFailureKinds: [],
  retrievalState: 'NO_MATCHING_EVIDENCE',
  localSourceProvenance: 'NOT_ESTABLISHED',
  coverageGap: true,
  coverageGapReason: 'NO_QUALIFYING_EVIDENCE',
  liveArticleIds: [],
  retainedArticleIds: [],
}));
(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.ASK_BROWSER_CHANNEL || 'msedge',
  });
  const results = [];
  try {
    for (const locale of ['en', 'pl'])
      for (const viewport of [
        { width: 1440, height: 900 },
        { width: 390, height: 844 },
      ]) {
        const context = await browser.newContext({ viewport });
        await context.addCookies([{ name: 'globalnews-ai-language', value: locale, url: base }]);
        const page = await context.newPage();
        const calls = [];
        const errors = [];
        const acquisition = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.route('**/*', async (route) => {
          const request = route.request();
          const url = request.url();
          if (url.includes('/users/me'))
            return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
          if (url.includes('/analysis/news')) {
            if (request.method() === 'OPTIONS')
              return route.fulfill({
                status: 204,
                headers: {
                  'access-control-allow-origin': base,
                  'access-control-allow-credentials': 'true',
                  'access-control-allow-headers': 'content-type',
                },
              });
            calls.push(request.postDataJSON());
            await new Promise((r) => setTimeout(r, 250));
            return route.fulfill({
              status: 200,
              contentType: 'application/json',
              headers: {
                'access-control-allow-origin': base,
                'access-control-allow-credentials': 'true',
              },
              body: JSON.stringify(fixture),
            });
          }
          if (/\/(news|signals|map-intelligence|country-news)(\/|\?)/.test(url))
            acquisition.push(url);
          if (!url.startsWith(base) && !url.startsWith('data:') && !url.startsWith('blob:'))
            return route.abort();
          return route.continue();
        });
        const tag = `${locale}-${viewport.width}`;
        await page.goto(
          `${base}/ask?q=What%20changed%3F&storyTitle=Rwanda%20subject&countryCode=RWA&articleId=a1`,
          { waitUntil: 'networkidle', timeout: 120000 },
        );
        await page.locator('[data-ask="composer-input"]').waitFor();
        await page.waitForTimeout(700);
        assert.equal(calls.length, 0, 'opening with q must remain idle');
        assert.equal(
          await page.locator('[data-ask="launcher"]').count(),
          0,
          'dedicated dashboard owns the only composer',
        );
        assert.equal(await page.locator('[data-ask="composer-input"]').count(), 1);
        assert.equal(acquisition.length, 0, 'opening must not acquire provider evidence');
        assert.equal(
          await page.locator('[data-ask="composer-input"]').inputValue(),
          'What changed?',
        );
        await page.screenshot({ path: path.join(out, `${tag}-idle.png`) });
        await page.locator('[data-ask="composer-submit"]').click();
        await page.locator('[data-ask="turn"]').waitFor();
        assert.equal(calls.length, 1);
        assert.deepEqual(calls[0].storyContext, {
          title: 'Rwanda subject',
          articleId: 'a1',
          countryCode: 'RWA',
        });
        assert.equal(calls[0].requestedLanguage, locale);
        assert.equal(calls[0].query, 'What changed?');
        await page
          .locator('[data-ask="composer-input"]')
          .fill(locale === 'pl' ? 'Dlaczego?' : 'Why?');
        await page.locator('[data-ask="composer-submit"]').click();
        await page.waitForFunction(
          () => document.querySelectorAll('[data-ask="turn"]').length === 2,
        );
        assert.equal(calls.length, 2);
        assert.equal(calls[1].priorQuestion, 'What changed?');
        assert.deepEqual(calls[1].storyContext, calls[0].storyContext);
        assert.deepEqual(
          Object.keys(calls[1]).sort(),
          ['priorQuestion', 'query', 'requestedLanguage', 'storyContext'].sort(),
        );
        assert.equal(await page.locator('[data-ask="coverage-checked"]').count(), 2);
        const href = await page.locator('[data-ask="open-full"]').last().getAttribute('href');
        const handoff = new URL(href, base);
        assert.equal(handoff.pathname, '/search');
        assert.equal(handoff.searchParams.get('storyTitle'), 'Rwanda subject');
        assert.equal(handoff.searchParams.get('q'), calls[1].query);
        assert.equal(handoff.searchParams.get('articleId'), 'a1');
        const geometry = await page.evaluate(() => {
          const rect = (s) => {
            const r = document.querySelector(s).getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
          };
          const reader = document.querySelector('[data-ask="conversation"]');
          reader.scrollTop = reader.scrollHeight;
          return {
            composer: rect('[data-ask="composer-footer"]'),
            reader: rect('[data-ask="conversation"]'),
            scrollable: reader.scrollHeight > reader.clientHeight,
            overflow: document.querySelector('[data-ask="frame-screen"]').scrollWidth > innerWidth,
            globalOverflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        await page.screenshot({ path: path.join(out, `${tag}-geometry.png`) });
        if (geometry.overflow)
          console.log(
            await page.evaluate(() =>
              Array.from(document.querySelectorAll('*'))
                .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
                .slice(0, 12)
                .map((e) => ({
                  tag: e.tagName,
                  cls: e.className,
                  right: e.getBoundingClientRect().right,
                })),
            ),
          );
        assert.equal(geometry.overflow, false);
        assert.ok(geometry.composer.bottom <= viewport.height + 1, 'composer stays in viewport');
        assert.ok(
          geometry.reader.bottom <= geometry.composer.y + 1,
          'conversation cannot cover composer',
        );
        await page.screenshot({ path: path.join(out, `${tag}-conversation.png`) });
        if (viewport.width < 861) {
          await page
            .getByRole('button', { name: locale === 'pl' ? 'Źródła' : 'Sources', exact: true })
            .click();
          await page.screenshot({ path: path.join(out, `${tag}-sources.png`) });
          await page
            .getByRole('button', { name: locale === 'pl' ? 'Mapa' : 'Map', exact: true })
            .click();
          await page.screenshot({ path: path.join(out, `${tag}-map.png`) });
        }
        await page.goto(handoff.href, { waitUntil: 'networkidle', timeout: 120000 });
        await page.waitForFunction(() => document.body.innerText.includes('District health'));
        assert.equal(calls.length, 3, 'existing /search explicit-query auto-run remains');
        assert.deepEqual(calls[2].storyContext, calls[0].storyContext);
        await page.locator('[data-ask="launcher"]').click();
        await page.locator('[data-ask="dashboard-entry"]').waitFor();
        assert.equal(calls.length, 3, 'opening compact dock remains idle');
        const workspaceGlobalOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        for (const route of ['/map', '/', '/humanitarian']) {
          const navigation = await page.goto(`${base}${route}`, {
            waitUntil: 'networkidle',
            timeout: 120000,
          });
          assert.equal(navigation.status(), 200);
          await page.locator('[data-ask="launcher"]').waitFor();
          await page.locator('[data-ask="launcher"]').click();
          await page.locator('[data-ask="dashboard-entry"]').waitFor();
          assert.equal(calls.length, 3, `dock on ${route} must remain idle`);
        }
        // Real browser lifecycle: release an old answer only after current context is removed.
        await page.goto(`${base}/ask?storyTitle=Rwanda&countryCode=RWA`, {
          waitUntil: 'networkidle',
        });
        let release;
        let started;
        const held = new Promise((resolve) => {
          release = resolve;
        });
        const sent = new Promise((resolve) => {
          started = resolve;
        });
        let delivered;
        const delivery = new Promise((resolve) => {
          delivered = resolve;
        });
        await page.route('**/analysis/news', async (route) => {
          calls.push(route.request().postDataJSON());
          started();
          await held;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(fixture),
          });
          delivered();
        });
        await page.locator('[data-ask="composer-input"]').fill('Rwanda question');
        await page.locator('[data-ask="composer-submit"]').click();
        await sent;
        await page.locator('[data-ask="context"] button').click();
        assert.equal(await page.locator('[data-ask="pending"]').count(), 0);
        assert.equal(calls.length, 4, 'context changes cannot submit');
        release();
        await delivery;
        await page.waitForTimeout(150);
        assert.equal(
          await page.locator('[data-ask="turn"]').count(),
          0,
          'stale answer must not publish',
        );
        assert.equal(await page.locator('[data-ask="launcher"]').count(), 0);
        results.push({
          locale,
          globalDockRoutes: ['/search', '/map', '/', '/humanitarian'],
          staleAnswerSuppressed: true,
          viewport,
          calls,
          geometry,
          workspaceGlobalOverflow,
          acquisition,
          errors,
        });
        assert.deepEqual(errors, []);
        await context.close();
      }
  } finally {
    fs.writeFileSync(path.join(out, 'browser-results.json'), JSON.stringify(results, null, 2));
    await browser.close();
  }
  console.log(
    JSON.stringify({ passed: results.length, results: path.join(out, 'browser-results.json') }),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

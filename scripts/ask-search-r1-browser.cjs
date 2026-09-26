/*
 * ASK/SEARCH ENGINEERING R1 — browser request-count and composer evidence.
 *
 * Drives a locally served production build (`next start`) with Playwright and
 * COUNTS POST /analysis/news (fulfilled from the accepted frame fixture, so no
 * model is ever called). Also records Hero composer geometry: one-tap focus,
 * elastic growth, and whether neighbouring Home content reflows.
 *
 *   ASK_TEST_URL=http://127.0.0.1:3217 PLAYWRIGHT_MODULE=<path>/playwright \
 *     node scripts/ask-search-r1-browser.cjs
 *
 * Chromium cannot raise a real iOS software keyboard; keyboard-overlap claims
 * need a physical iPhone and are NOT made by this script.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.ASK_TEST_URL || 'http://127.0.0.1:3217';
const out = process.env.ASK_EVIDENCE_DIR || path.resolve('frontend/.next/ask-search-r1-evidence');
fs.mkdirSync(out, { recursive: true });
process.env.TS_NODE_PROJECT = path.resolve('frontend/tsconfig.jest.json');
require('ts-node/register/transpile-only');
require('tsconfig-paths/register');
const fixture = require('../frontend/src/components/analysis-frame/frameFixtures').fixture({ articleCount: 4 });

const VIEWPORTS = [
  { name: 'phone-360', width: 360, height: 780, isMobile: true, hasTouch: true },
  { name: 'phone-390', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'phone-430', width: 430, height: 932, isMobile: true, hasTouch: true },
  { name: 'tablet-820', width: 820, height: 1180, isMobile: true, hasTouch: true },
  { name: 'desktop-1440', width: 1440, height: 900, isMobile: false, hasTouch: false },
];
const LONG = 'What is happening across the Middle East right now, and how are regional governments, markets and humanitarian agencies responding? '.repeat(4).trim();

async function instrument(context) {
  const calls = [];
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    if (url.includes('/users/me')) return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    if (url.includes('/follows/')) return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    if (url.includes('/analysis/news')) {
      if (request.method() !== 'POST') return route.fulfill({ status: 204 });
      calls.push({ at: new URL(request.frame().url()).pathname, body: request.postDataJSON() });
      await new Promise((r) => setTimeout(r, 200));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) });
    }
    if (!url.startsWith(base) && !url.startsWith('data:') && !url.startsWith('blob:')) return route.abort();
    return route.continue();
  });
  return calls;
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.ASK_BROWSER_CHANNEL || 'msedge' });
  const report = [];
  try {
    for (const vp of VIEWPORTS) {
      for (const locale of vp.name === 'phone-390' ? ['en', 'pl'] : ['en']) {
        const tag = `${vp.name}-${locale}`;
        const row = { tag };
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          isMobile: vp.isMobile,
          hasTouch: vp.hasTouch,
        });
        await context.addCookies([{ name: 'globalnews-ai-language', value: locale, url: base }]);
        const calls = await instrument(context);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));

        /* 1 — opening Home */
        await page.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 120000 });
        await page.waitForTimeout(500);
        row.openHome = calls.length;

        /* 2 — Hero composer: one tap focuses, typing grows it, neighbours do not move */
        const hero = page.locator('form[role="search"] textarea[name="q"]').first();
        await hero.scrollIntoViewIfNeeded();
        const neighbour = page.locator('#whats-happening-now');
        const before = await neighbour.boundingBox();
        const heroBefore = await hero.boundingBox();
        if (vp.hasTouch) await hero.tap();
        else await hero.click();
        row.oneTapFocus = await hero.evaluate((el) => document.activeElement === el);
        await hero.fill(LONG);
        await page.waitForTimeout(250);
        const heroAfter = await hero.boundingBox();
        const after = await neighbour.boundingBox();
        row.heroHeight = [Math.round(heroBefore.height), Math.round(heroAfter.height)];
        row.neighbourReflowPx = Math.round(Math.abs(after.y - before.y));
        row.heroScrollbar = await hero.evaluate((el) => getComputedStyle(el).scrollbarWidth);
        row.afterTyping = calls.length;
        await page.screenshot({ path: path.join(out, `${tag}-1-hero-typed.png`) });

        /* 3 — submit stages in the dock, in place */
        await hero.press('Enter');
        const dockInput = page.locator('#ask-ai-question');
        await dockInput.waitFor({ state: 'visible' });
        row.dockDraftStaged = (await dockInput.inputValue()) === LONG;
        row.urlAfterStage = new URL(page.url()).pathname;
        row.afterStage = calls.length;
        await page.screenshot({ path: path.join(out, `${tag}-2-dock-staged.png`) });

        /* 4 — one explicit Send */
        await page.locator('[data-ask="form"] button[type="submit"]').click();
        await page.locator('[data-ask="panel"][data-ask-phase="answered"]').waitFor({ timeout: 30000 });
        row.afterFirstSend = calls.length;

        /* 5 — the second turn */
        await dockInput.click();
        row.secondTurnFocus = await dockInput.evaluate((el) => document.activeElement === el);
        await dockInput.fill(locale === 'pl' ? 'Dlaczego to ważne?' : 'Why does it matter?');
        await page.locator('[data-ask="form"] button[type="submit"]').click();
        await page.waitForFunction(() => document.querySelectorAll('[data-ask="history-turn"]').length === 1);
        await page.locator('[data-ask="panel"][data-ask-phase="answered"]').waitFor({ timeout: 30000 });
        row.afterSecondSend = calls.length;
        row.secondTurnPrior = calls[1] && calls[1].body.priorQuestion === LONG;
        row.secondTurnCarriesNoOutput = calls[1] && !JSON.stringify(calls[1].body).includes(fixture.analysis.summary.slice(0, 40));
        const composer = await page.locator('[data-ask="composer"]').boundingBox();
        row.composerVisible = composer.y + composer.height <= vp.height + 1;
        await page.screenshot({ path: path.join(out, `${tag}-3-second-turn.png`) });

        /* 6 — the accepted deeper-analysis transition runs exactly once */
        row.runFullLabel = (await page.locator('[data-ask="open-full"]').last().innerText()).trim();
        await page.locator('[data-ask="open-full"]').last().click();
        await page.waitForURL(/\/search\?/, { timeout: 60000 });
        await page.waitForTimeout(1500);
        row.afterOpenFull = calls.length;
        row.openFullRanOnSearch = calls[calls.length - 1] && calls[calls.length - 1].at === '/search';

        /* 6b — CTO RULING 1: a language switch after the completed run is not consent */
        const target = locale === 'pl' ? 'English' : 'Polski';
        await page.locator('[role="combobox"][aria-haspopup="listbox"]:visible').first().click();
        await page.locator('[role="option"]', { hasText: target }).first().click();
        await page.locator('[data-search="staged"]').waitFor({ timeout: 30000 });
        await page.waitForTimeout(800);
        row.afterLanguageSwitch = calls.length;
        await page.screenshot({ path: path.join(out, `${tag}-3b-language-switch-staged.png`) });
        await page.locator('[data-search="run-staged"]').click();
        await page.waitForTimeout(1500);
        row.afterRunInNewLanguage = calls.length;
        row.newLanguageRequested = calls[calls.length - 1] && calls[calls.length - 1].body.requestedLanguage;

        /* 7 — reload of that URL: no grant, staged, 0 more */
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(800);
        row.afterReload = calls.length;
        row.reloadStaged = (await page.locator('[data-search="staged"]').count()) === 1;

        /* 8 — back to Home */
        await page.goto(`${base}/`, { waitUntil: 'networkidle' });
        row.afterBackHome = calls.length;
        row.pageErrors = errors.length;
        await context.close();

        /* 9 — fresh tab: map / history / topic style arrival */
        const context2 = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
        await context2.addCookies([{ name: 'globalnews-ai-language', value: locale, url: base }]);
        const calls2 = await instrument(context2);
        const page2 = await context2.newPage();
        await page2.goto(`${base}/search?q=Poland%20revives%20tax%20proposal&articleId=gnews-1&countryCode=PL`, { waitUntil: 'networkidle' });
        await page2.waitForTimeout(800);
        row.searchArrivalWithQ = calls2.length;
        row.stagedCopy = await page2.locator('[data-search="staged"] p').innerText();
        await page2.screenshot({ path: path.join(out, `${tag}-4-search-staged.png`) });
        await page2.locator('[data-search="run-staged"]').click();
        await page2.waitForTimeout(1500);
        row.afterRun = calls2.length;

        /* 9b — PR #40 R2 F1, Codex sequence 1, on the SAME mounted client:
           header Search (client-side) to bare /search, then browser Back. */
        await page2.locator('a[href="/search"]:visible').first().click();
        await page2.waitForURL((url) => url.pathname === '/search' && !url.search, { timeout: 30000 });
        await page2.waitForTimeout(600);
        await page2.goBack();
        await page2.waitForURL(/\/search\?q=/, { timeout: 30000 });
        await page2.locator('[data-search="staged"]').waitFor({ timeout: 30000 });
        await page2.waitForTimeout(800);
        row.codex1BackToRunQuestion = calls2.length - row.afterRun;

        await page2.goto(`${base}/search`, { waitUntil: 'networkidle' });
        await page2.waitForTimeout(500);
        row.queryless = calls2.length - row.afterRun;
        await context2.close();

        /* 9c — PR #40 R2 F1, Codex sequence 2: a pending grant must not survive bare /search. */
        const context3 = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
        await context3.addCookies([{ name: 'globalnews-ai-language', value: locale, url: base }]);
        const calls3 = await instrument(context3);
        const page3 = await context3.newPage();
        const plantGrant = () =>
          page3.evaluate(() =>
            window.sessionStorage.setItem(
              'gna:analysis-compute-consent',
              JSON.stringify({ key: JSON.stringify(['Poland', '', '', '']), at: Date.now() }),
            ),
          );
        await page3.goto(`${base}/`, { waitUntil: 'networkidle' });
        await plantGrant();
        await page3.goto(`${base}/search?q=Poland`, { waitUntil: 'networkidle' });
        await page3.waitForTimeout(1200);
        row.codex2ControlGrantHonoured = calls3.length; // 1: a valid same-tab grant runs once
        await plantGrant();
        await page3.goto(`${base}/search`, { waitUntil: 'networkidle' });
        await page3.waitForTimeout(600);
        await page3.goto(`${base}/search?q=Poland`, { waitUntil: 'networkidle' });
        await page3.waitForTimeout(1200);
        row.codex2AfterBareSearch = calls3.length - row.codex2ControlGrantHonoured; // 0: revoked by bare /search
        row.codex2Staged = (await page3.locator('[data-search="staged"]').count()) === 1;
        await context3.close();

        report.push(row);
        console.log(JSON.stringify(row));

        assert.equal(row.openHome, 0);
        assert.equal(row.afterTyping, 0);
        assert.equal(row.afterStage, 0);
        assert.equal(row.urlAfterStage, '/');
        assert.equal(row.afterFirstSend, 1);
        assert.equal(row.afterSecondSend, 2);
        assert.equal(row.secondTurnPrior, true);
        assert.equal(row.afterOpenFull, 3);
        assert.equal(row.afterLanguageSwitch, 3);
        assert.equal(row.afterRunInNewLanguage, 4);
        assert.equal(row.newLanguageRequested, locale === 'pl' ? 'en' : 'pl');
        assert.equal(row.afterReload, 4);
        assert.equal(row.afterBackHome, 4);
        assert.equal(row.searchArrivalWithQ, 0);
        assert.equal(row.afterRun, 1);
        assert.equal(row.codex1BackToRunQuestion, 0);
        assert.equal(row.codex2ControlGrantHonoured, 1);
        assert.equal(row.codex2AfterBareSearch, 0);
        assert.equal(row.codex2Staged, true);
        assert.equal(row.queryless, 0);
      }
    }
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

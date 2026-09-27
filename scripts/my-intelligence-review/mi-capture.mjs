/**
 * MY INTELLIGENCE FRONTEND — REVIEW CAPTURE HARNESS.
 *
 * A review tool, not product code. It is not imported by the application and
 * not part of the build. Its only job is to drive the running frontend through
 * the states the Product Owner asked to inspect and photograph each one.
 *
 * It stubs the Home feed request because this container has no backend: without
 * a stub, Home renders "Couldn't load the latest updates." and the Home
 * bookmark delta cannot be photographed at all. The stub is a capture concern
 * and never reaches the application bundle.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'http://127.0.0.1:4320';
const OUT = '/home/claude/mishots';
mkdirSync(OUT, { recursive: true });

const D = {
  '360x800':  { w: 360,  h: 800,  mobile: true },
  '390x844':  { w: 390,  h: 844,  mobile: true },
  '430x932':  { w: 430,  h: 932,  mobile: true },
  '768x1024': { w: 768,  h: 1024, mobile: true },
  '1024x768': { w: 1024, h: 768,  mobile: false },
  '1440x900': { w: 1440, h: 900,  mobile: false },
  '1920x1080':{ w: 1920, h: 1080, mobile: false },
};

const FEED = {
  articles: Array.from({ length: 9 }, (_, i) => ({
    id: `stub-${i}`,
    title: [
      "Europe's gas storage reaches its winter target ahead of schedule",
      'Kenya and neighbours agree joint patrols on northern border corridor',
      'Japan opens consultation on new offshore wind auction rules',
      'Sejm committee advances grid-connection bill for renewables',
      'Nairobi commuter rail extension receives funding approval',
      'Brazil soybean exports reach a September record',
      'Baltic corridor rail freight volumes rise for a second quarter',
      'Regional grid operators publish winter adequacy outlook',
      'Port tariff review reopens after operator appeal',
    ][i],
    summary: 'Sample summary for design review. Not live reporting.',
    url: `https://example.com/sample/story-${i}`,
    sourceName: ['Northline Wire', 'Meridian Post', 'Baltic Ledger', 'Harbor Daily'][i % 4],
    publishedAt: new Date(Date.now() - (i + 1) * 3_600_000).toISOString(),
    firstSeenAt: new Date(Date.now() - (i + 1) * 1_800_000).toISOString(),
    category: ['energy', 'security', 'world', 'economy'][i % 4],
    sourcesCount: 3 + (i % 5),
    imageUrl: null,
    countryCode: ['POL', 'KEN', 'JPN', 'BRA'][i % 4],
  })),
  totalResults: 9,
  dataMode: 'mock',
  generatedAt: new Date().toISOString(),
  providers: [],
};

const SHOTS = [];
const mi = (d, lang, q, tag) => SHOTS.push({ d, lang, path: '/my-intelligence' + q, tag });

for (const d of Object.keys(D)) mi(d, 'en', '', '01_first_viewport');
for (const d of ['360x800', '390x844', '768x1024', '1024x768', '1440x900']) mi(d, 'pl', '', '16_first_viewport_PL');

for (const d of ['360x800', '390x844', '430x932', '768x1024', '1024x768', '1440x900']) {
  SHOTS.push({ d, lang: d === '360x800' || d === '430x932' ? 'pl' : 'en', path: '/my-intelligence', tag: '03_selection', act: 'select' });
}
for (const d of ['360x800', '390x844', '430x932']) {
  SHOTS.push({ d, lang: d === '360x800' ? 'pl' : 'en', path: '/my-intelligence', tag: '05_compute_keyboard', act: 'keyboard' });
}
for (const d of ['768x1024', '1440x900']) {
  SHOTS.push({ d, lang: d === '768x1024' ? 'pl' : 'en', path: '/my-intelligence', tag: '04_compute_confirm', act: 'confirm' });
}
for (const d of ['390x844', '1440x900']) {
  mi(d, 'en', '?state=first-visit', '08_new_since_first_visit');
  mi(d, 'en', '?state=empty', '07_empty_first_use');
  mi(d, 'en', '?state=degraded', '10_degraded');
  mi(d, 'en', '?state=error', '12_error');
  mi(d, 'en', '?state=signed-out', '13_signed_out');
}
for (const d of ['360x800', '390x844', '1440x900']) {
  SHOTS.push({ d, lang: 'en', path: '/', tag: '15_home_delta_bookmark', act: 'home' });
}
/* The account menu needs a real session. This container has no backend, so
   AccountControl correctly renders "Sign In" and the menu cannot be opened.
   The entry is in the code and typechecked; it is simply not photographable
   here, and that is recorded rather than staged. */

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: false,
  args: ['--headless=new', '--no-sandbox', '--hide-scrollbars'],
});

const results = [];

for (const s of SHOTS) {
  const dev = D[s.d];
  const ctx = await browser.newContext({
    viewport: { width: dev.w, height: dev.h },
    deviceScaleFactor: 1,
    isMobile: dev.mobile,
    hasTouch: dev.mobile,
    reducedMotion: 'reduce',
  });
  await ctx.addCookies([{ name: 'globalnews-ai-language', value: s.lang, url: BASE }]);
  await ctx.route('**/news/top-headlines**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FEED) }),
  );

  const page = await ctx.newPage();
  const aiPosts = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/(analysis|ask)\b/.test(r.url())) aiPosts.push(r.url());
  });

  await page.goto(BASE + s.path, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(600);

  try {
    if (s.act === 'select' || s.act === 'keyboard' || s.act === 'confirm') {
      /* Two Select controls exist — the phone eyebrow one and the tab-bar one
         from 768 up — and exactly one is on screen at any width. Press that one. */
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')].filter((b) =>
          /^(Select|Zaznacz)$/.test((b.textContent || '').trim()),
        );
        (btns.find((b) => b.getClientRects().length > 0) ?? btns[0])?.click();
      });
      await page.waitForTimeout(250);
      const boxes = page.getByRole('checkbox');
      const n = Math.min(3, await boxes.count());
      /* Scrolled into view BEFORE clicking. A forced click on a checkbox that
         is still under the sticky header lands on the header instead — at 360
         and 390 that is the logo, and the run silently navigates to Home. */
      for (let i = 0; i < n; i += 1) {
        const box = boxes.nth(i);
        await box.scrollIntoViewIfNeeded().catch(() => {});
        await box.click().catch(() => box.click({ force: true }).catch(() => {}));
      }
      await page.waitForTimeout(350);
    }
    if (s.act === 'keyboard') {
      /* Dispatched in the page rather than clicked through the viewport: at 360
         and 390 this pill sits beyond the rail's right edge, so the point a
         synthetic click needs is off-screen. The rail's own scrolling is
         verified separately; what this frame is for is the keyboard state.
         `[length-1]` because the desktop panel and the phone rail both render
         the six actions and the panel is display:none at these widths. */
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')].filter((b) =>
          /Ask about selected|Zapytaj o wybrane/.test(b.textContent || ''),
        );
        const target = btns[btns.length - 1];
        if (target) target.click();
      });
      await page.waitForTimeout(350);
      await page.locator('textarea').first().click().catch(() => {});
      await page.locator('textarea').first().type('Why does this matter for the corridor?').catch(() => {});
      await page.waitForTimeout(250);
    }
    if (s.act === 'confirm') {
      /* At >=1024 the visible copy is the desktop panel's (the rail is
         display:none); below it, the rail's. Press whichever is on screen. */
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')].filter((b) =>
          /Compare|Porównaj/.test(b.textContent || ''),
        );
        const visible = btns.find((b) => b.getClientRects().length > 0);
        (visible ?? btns[btns.length - 1])?.click();
      });
      await page.waitForTimeout(350);
    }
    if (s.act === 'home') {
      await page.evaluate(() => window.scrollTo(0, 900));
      await page.waitForTimeout(500);
    }
    if (s.act === 'account') {
      await page.locator('[aria-label="Account menu"], [aria-label="Menu konta"]').first().click({ force: true });
      await page.waitForTimeout(350);
    }
  } catch (e) {
    results.push({ file: `${s.d}_${s.tag}_${s.lang}.png`, note: `action failed: ${String(e).slice(0, 90)}` });
  }

  const file = `${OUT}/${s.d}_${s.tag}_${s.lang}.png`;
  await page.screenshot({ path: file });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  /*
    RULING 1 — MEASURED, NOT ASSUMED.

    Finds the floating Ask launcher and the frozen Select control, and reports
    the overlapping area of their boxes. Anything above zero is a collision.
  */
  const collision = await page.evaluate(() => {
    const launcher = document.querySelector('[data-ask="launcher"]');
    const select = [...document.querySelectorAll('button')].find((b) =>
      /^(Select|Zaznacz|Done|Gotowe)$/.test((b.textContent || '').trim()),
    );
    if (!launcher || !select) return { launcher: launcher !== null, overlapPx: 0 };
    const a = launcher.getBoundingClientRect();
    const b = select.getBoundingClientRect();
    const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return { launcher: true, overlapPx: Math.round(w * h) };
  });

  results.push({
    file: file.split('/').pop(),
    overflowPx: overflow,
    aiPosts: aiPosts.length,
    launcherPresent: collision.launcher,
    launcherSelectOverlapPx: collision.overlapPx,
  });
  await ctx.close();
}

await browser.close();
const bad = results.filter(
  (r) => (r.overflowPx ?? 0) > 0 || (r.aiPosts ?? 0) > 0 || (r.launcherSelectOverlapPx ?? 0) > 0 || r.note,
);
const miFrames = results.filter((r) => r.launcherPresent !== undefined && !r.file.includes('home_delta'));
console.log(
  'launcher present on a My Intelligence frame:',
  miFrames.some((r) => r.launcherPresent) ? 'YES (Ruling 1 NOT met)' : 'no — suppressed on every frame',
);
console.log(`captured ${results.filter((r) => r.overflowPx !== undefined).length} frames`);
console.log('overflow or AI-call or action failures:', bad.length === 0 ? 'NONE' : JSON.stringify(bad, null, 1));

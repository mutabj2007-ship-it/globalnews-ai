/**
 * C2 behaviour check — the chips and rail are asserted to WORK, not merely to
 * render. Also re-counts requests through every interaction, because the whole
 * point of the CSS-only filter is that pressing a chip cannot cause one.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3210';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const requests = [];
page.on('request', (r) => requests.push(r.url()));

await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(1500);

const visible = async () =>
  page.$$eval('[data-gn-story]', (els) =>
    els.filter((e) => e.offsetParent !== null || getComputedStyle(e).display !== 'none').length,
  );

const all = await visible();
console.log('stories visible with All:', all);

/* Press a category chip and confirm only that category survives. */
const before = requests.length;
await page.click('label[for="gn-cat-politics"]');
await page.waitForTimeout(300);
const afterPolitics = await visible();
const cats = await page.$$eval('[data-gn-story]', (els) =>
  els
    .filter((e) => getComputedStyle(e).display !== 'none')
    .map((e) => e.getAttribute('data-gn-cat')),
);
console.log('stories visible with Politics:', afterPolitics, '->', [...new Set(cats)].join(','));
console.log('requests caused by pressing a chip:', requests.length - before);

/* "View all" must restore everything. */
await page.click('label[for="gn-cat-all"]:last-of-type');
await page.waitForTimeout(300);
console.log('stories visible after View all:', await visible());

/* The rail must actually scroll horizontally. */
const rail = page.locator('ul[role="group"]');
const scrolled = await rail.evaluate((el) => {
  const start = el.scrollLeft;
  el.scrollLeft = 400;
  return { start, end: el.scrollLeft, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
});
console.log('rail scroll:', JSON.stringify(scrolled), 'overflows:', scrolled.scrollWidth > scrolled.clientWidth);

/* The radios must be reachable by keyboard. */
const focusable = await page.evaluate(() => {
  const r = document.getElementById('gn-cat-politics');
  r.focus();
  return document.activeElement?.id ?? null;
});
console.log('keyboard focus lands on:', focusable);

const metered = requests.filter((u) => /\/analysis|ask-v2|\/ai\b|openai|anthropic/.test(u));
console.log('metered AI requests across the whole interaction:', metered.length);

await browser.close();

import { chromium } from 'playwright';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MAP REQUEST-ECONOMY PROBE — A DRIVEN BROWSER, AND ZERO LIVE QUOTA
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `MAP-GNEWS-QUOTA-REGRESSION-1`, and now `MAP-WORLD-COUNTRY-RETRIEVAL-1`.
 *
 * ── WHY THE R2 VERSION MISSED THE `WORLD` DEFECT ─────────────────────────
 *
 * R2 drove hydration and camera state through the URL, and clicked exactly one
 * control: whatever `page.$('[data-gn-target="eastAfrica"]')` returned first.
 * **Two different controls carry that attribute** — the top-row breadcrumb jump
 * and the right-rail jump — so R2 was driving ONE of them, without knowing
 * which, and it never clicked `world`, `africa` or `europe` at all.
 *
 * A suite that drives one control cannot speak for a row of eight. This version
 * enumerates the top row explicitly, by its own `data-gn="breadcrumb-jump"`
 * scope, and drives every non-country transition in both directions.
 *
 * ── EVERY /news/* REQUEST IS FULFILLED LOCALLY. NOTHING REACHES A PROVIDER. ──
 *
 * The interception below answers every news and geo request from a fixture, so
 * this runs in CI forever at zero cost. THE ASSERTION IS ON REQUESTS OBSERVED,
 * not on responses rendered: what is being guarded is spend.
 */

const BASE = process.env.PROBE_BASE_URL ?? 'http://127.0.0.1:3990';

const COUNTRY_FIXTURE = {
  countryCode: 'RWA',
  countryName: 'Rwanda',
  articles: [],
  dataMode: 'cached',
  totalResults: 0,
};

const HEADLINES_FIXTURE = { articles: [], dataMode: 'cached', totalResults: 0 };

const TOP_ROW = (id) => `[data-gn="breadcrumb-jump"][data-gn-target="${id}"]`;

const results = [];

function record(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${name.padEnd(30)} ${detail}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();

const observed = [];

await context.route('**/news/**', async (route) => {
  observed.push(route.request().url());
  const url = route.request().url();
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(url.includes('/news/country/') ? COUNTRY_FIXTURE : HEADLINES_FIXTURE),
  });
});

await context.route('**/geo/**', async (route) => {
  observed.push(route.request().url());
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ places: [], items: [] }),
  });
});

const countryReqs = () => observed.filter((u) => u.includes('/news/country/'));
const reset = () => {
  observed.length = 0;
};

/*
  WAITING PROPERLY, BECAUSE MY FIRST VERSION DID NOT.

  A bare `page.$()` after a fixed 2.5s reported "control not found" for three
  transitions and an empty URL for the positive control. Both were the PROBE
  being impatient, not the product failing — the shell mounts a WebGL map and
  the URL is written by an effect, so neither is ready on a fixed timer.

  A probe that reports a timing artifact as a defect is worse than no probe.
*/
async function openMap(query = '') {
  await page.goto(`${BASE}/map${query}`, { waitUntil: 'domcontentloaded' });
  /* The shell is the thing under test, so wait for the shell, not a clock. */
  await page.waitForSelector('[data-gn="global-map-shell"]', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3500);
}

async function clickTopRow(id) {
  const el = await page.waitForSelector(TOP_ROW(id), { timeout: 15000 }).catch(() => null);
  if (el === null) return false;
  await el.click();
  /* Camera animation, selection effect and the single URL writer all settle. */
  await page.waitForTimeout(5000);
  return true;
}

/**
 * One non-country transition: go to `from`, clear the counter, click `to`.
 *
 * The assertion is deliberately BOTH halves — no request AND no country
 * semantic selection. A build that stopped retrieving but still wrote
 * `sel=country:NER` would have moved the defect rather than fixed it.
 */
async function transition(fromId, toId) {
  await openMap();

  if (fromId !== null) {
    const ok = await clickTopRow(fromId);
    if (!ok) {
      record(`${fromId} → ${toId}`, false, 'INCONCLUSIVE — control not found');
      return;
    }
  }

  reset();

  const ok = await clickTopRow(toId);
  if (!ok) {
    record(`${fromId ?? 'open'} → ${toId}`, false, 'INCONCLUSIVE — control not found');
    return;
  }

  const url = page.url();
  const reqs = countryReqs();
  const hasCountryParam = url.includes('country=');
  const hasCountrySel = /sel=country(%3A|:)/.test(url);
  const passed = reqs.length === 0 && !hasCountryParam && !hasCountrySel;

  record(
    `${fromId ?? 'open'} → ${toId}`,
    passed,
    `country reqs=${reqs.length}  url=${url.replace(BASE, '') || '/map'}`,
  );
}

console.log('\n=== A · NON-COUNTRY NAVIGATION, EVERY TOP-ROW TRANSITION ===\n');

await transition(null, 'world');
await transition('eastAfrica', 'world');
await transition('world', 'eastAfrica');
await transition('world', 'africa');
await transition('africa', 'world');
await transition('world', 'europe');
await transition('europe', 'world');

console.log('\n=== B · COUNTRY → WORLD MUST ALSO CLEAR ===\n');

for (const country of ['rwanda', 'kenya', 'poland']) {
  await transition(country, 'world');
}

console.log('\n=== C · HYDRATION AND PRESENTATION MUST BE PROVIDER-FREE ===\n');

for (const [label, query] of [
  ['hydration ?country=RWA', '?country=RWA'],
  ['hydration ?country=CAF', '?country=CAF'],
  ['hydration sel=region', '?sel=region%3Aeastern-africa'],
  ['camera-only', '?cam=2.0%2C10.0%2C1.5'],
  ['time window 7d', '?period=7D'],
  ['time window 30d', '?period=30D'],
  ['mode change', '?mode=SOURCES'],
]) {
  reset();
  await openMap(query);
  record(label, countryReqs().length === 0, `country reqs=${countryReqs().length}`);
}

console.log('\n=== D · CLICK-THROUGH — THE HAZARD ITSELF ===\n');

/*
  THE DECISIVE TEST, AND THE REASON THE HUD-ORIGIN CONTRACT EXISTS.

  R3.1 proved that a pointer event landing on the map beneath a HUD control
  selects whatever country is under that pixel: clicking the WORLD button's own
  centre, with the button made click-through, selected ALGERIA and bought its
  news. Niger, CAF and Algeria were one defect wearing three countries.

  This drives exactly that. It disables the control's pointer capture so the
  event reaches the map surface, then clicks the control's own coordinate. The
  guard must reject it — the event still BEGAN on chrome — while a genuine
  canvas click elsewhere must still select, which section E proves.
*/
async function clickThroughAt(id) {
  await openMap();

  /* Put the map over land, so the pixel beside the control is a real country. */
  await clickTopRow('eastAfrica');

  const el = await page.waitForSelector(TOP_ROW(id), { timeout: 15000 }).catch(() => null);
  const next = await page.$(TOP_ROW('africa'));
  if (el === null || next === null) return null;

  const a = await el.boundingBox();
  const b = await next.boundingBox();

  /*
    THE GAP, NOT A pointer-events HACK.

    My first version set pointer-events:none on the control, which REMOVES it
    from the composed path — so the event genuinely became a canvas click and
    the origin guard was right to allow it. That tested nothing.

    The real hazard is the reader missing a 52x26px chip by a few pixels. The
    gap between chips is 5px, and HUD_ISLAND left it pointer-transparent, so
    that near-miss reached the map and selected whatever country lay beneath —
    NER at 1680x1050, DZA and MLI at others.
  */
  const x = Math.round((a.x + a.width + b.x) / 2);
  const y = Math.round(a.y + a.height / 2);

  reset();
  await page.mouse.click(x, y);
  await page.waitForTimeout(5000);

  return { x, y, url: page.url(), reqs: countryReqs() };
}

for (const [w, h] of [[1780, 1210], [1920, 1080], [1680, 1050]]) {
  await page.setViewportSize({ width: w, height: h });

  const r = await clickThroughAt('world');

  if (r === null) {
    record(`HUD gap click ${w}x${h}`, false, 'INCONCLUSIVE — control not found');
  } else {
    const rejected =
      r.reqs.length === 0 &&
      !r.url.includes('country=') &&
      !/sel=country(%3A|:)/.test(r.url);

    record(
      `HUD gap click ${w}x${h}`,
      rejected,
      `at (${r.x},${r.y}) country reqs=${r.reqs.length}` +
        (r.reqs.length ? ' ' + r.reqs.map((u) => u.split('/news/country/')[1]).join(',') : ''),
    );
  }
}

await page.setViewportSize({ width: 1600, height: 1000 });

console.log('\n=== E · POSITIVE CONTROL — ONE EXPLICIT COUNTRY ===\n');

/*
  WITHOUT THIS every zero above passes vacuously on a build that simply never
  retrieves anything — a different defect, not a fix. One control only, as ruled.
*/
await openMap();
reset();

const rwandaOk = await clickTopRow('rwanda');

/* The URL is written by an effect; wait for it rather than for a clock. */
await page.waitForFunction(() => window.location.search.includes('country='), { timeout: 15000 }).catch(() => {});

if (!rwandaOk) {
  record('POSITIVE CONTROL rwanda', false, 'INCONCLUSIVE — control not found');
} else {
  const reqs = countryReqs();
  const url = page.url();
  const rwaOnly = reqs.length === 1 && reqs[0].includes('/news/country/RWA');

  record(
    'POSITIVE CONTROL rwanda',
    rwaOnly && url.includes('country=RWA'),
    `country reqs=${reqs.length} (${reqs.map((u) => u.split('/news/country/')[1]).join(',')})  url=${url.replace(BASE, '')}`,
  );
}

await browser.close();

const failed = results.filter((r) => !r.passed);

console.log('\n================================================================');
console.log(`  ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.log('  FAILED:');
  for (const f of failed) console.log(`    - ${f.name}  ${f.detail}`);
}
console.log('================================================================\n');

process.exit(failed.length === 0 ? 0 : 1);

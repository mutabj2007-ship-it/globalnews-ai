import { chromium } from 'playwright';

/*
  ════════════════════════════════════════════════════════════════════════════
  MAP-ZOOM-IN-CONTROL-1 — DOES THE ZOOM CONTROL ACTUALLY ZOOM?
  ════════════════════════════════════════════════════════════════════════════

  THE GAP THIS CLOSES IS IN MY OWN TESTING. Every earlier browser suite asserted
  that the zoom controls made NO NETWORK REQUEST, and a dead button satisfies
  that perfectly. R5's live run recorded `zoom + PASS` against a control that
  did nothing. A control test that never checks the control's effect is not a
  test of the control.

  So this asserts the EFFECT first — the zoom changed, the URL changed — and
  the quota properties second.

  Everything is stubbed in the browser: zero GNews quota.
*/

/* Same knob and same default as `map-request-economy-probe.mjs`, its sibling. */
const BASE = process.env.PROBE_BASE_URL ?? 'http://127.0.0.1:3990';

const FEED = {
  articles: [],
  totalResults: 0,
  providers: [],
  dataMode: 'cached',
  feedTier: 'live',
  providerDisplayName: 'Stored reporting',
  generatedAt: new Date().toISOString(),
};

const rows = [];
const say = (name, ok, detail = '') => {
  rows.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(34)} ${detail}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });

const seen = [];
await context.route('**/news/**', (r) => {
  seen.push(r.request().url());
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FEED) });
});
await context.route('**/geo/**', (r) => {
  seen.push(r.request().url());
  return r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ places: [], items: [] }),
  });
});

const countryReqs = () => seen.filter((u) => u.includes('/news/country/')).length;
const executingReqs = () =>
  seen.filter((u) => u.includes('/news/top-headlines') && !u.includes('/retained')).length;

const page = await context.newPage();
const crashes = [];
page.on('pageerror', (e) => crashes.push(String(e).slice(0, 160)));

/** The zoom in the URL — the value the product publishes. */
const urlZoom = () => {
  const cam = new URL(page.url()).searchParams.get('cam');
  return cam === null ? null : Number.parseFloat(cam.split('/')[0]);
};

/** The zoom the ENGINE is actually on, read from the live map instance. */
const engineZoom = async () =>
  page
    .evaluate(() => {
      const el = document.querySelector('[data-gn="map-canvas"], .maplibregl-map');
      const m = el?._gnMap ?? window.__gnMap ?? null;
      return m && typeof m.getZoom === 'function' ? m.getZoom() : null;
    })
    .catch(() => null);

/** The zoom the HUD shows the reader. */
const readoutZoom = async () =>
  page
    .$eval('[data-gn="map-readout"]', (n) => n.textContent ?? '')
    .catch(() => '');

const settle = async () => {
  await page.waitForSelector('[data-gn="global-map-shell"]', { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(4500);
};

const click = async (sel) => {
  const el = await page.$(sel);
  if (el === null) return 'missing';
  if (await el.isDisabled()) return 'disabled';
  await el.click();
  await page.waitForTimeout(3000);
  return 'clicked';
};

console.log('\n=== A · ZOOM AT THE WORLD CAMERA (the reported failure) ===\n');

await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
await settle();

/*
  SETTLE THE WORLD FRAMING FIRST.

  My first version read the URL before the initial framing had been committed,
  so `cam=` was absent and any later value looked like "the URL advanced". That
  masked the very defect under test. The baseline must be the SETTLED world
  camera — the one the reader is actually looking at when they press +.
*/
await page.waitForFunction(() => new URL(location.href).searchParams.has('cam'), { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2000);

const zoomOf = (r) => Number.parseFloat((r.match(/Z\s*([0-9.]+)/) ?? [])[1] ?? 'NaN');

/*
  THE BASELINE IS THE READOUT, NOT THE URL.

  `cam=` is only written once the camera has changed, so at a freshly opened
  world view it is ABSENT. My first version took the baseline from the URL, got
  `null`, and then reported "null -> 1.85" as a failure while the product was
  working correctly. The readout is what the reader is actually looking at and
  it exists from the first frame.
*/
const beforeReadout = zoomOf(await readoutZoom());
const beforeUrl = urlZoom() ?? beforeReadout;
console.log(`  settled world: urlZoom=${urlZoom()} readout=Z ${beforeReadout} (baseline ${beforeUrl})`);

const inState = await click('[data-gn="map-zoom-in"]');
const afterUrl = urlZoom();
const afterReadout = zoomOf(await readoutZoom());
console.log(`  after + #1   : urlZoom=${afterUrl} readout=Z ${afterReadout} (${inState})`);

const inState2 = await click('[data-gn="map-zoom-in"]');
const after2Url = urlZoom();
const after2Readout = zoomOf(await readoutZoom());
console.log(`  after + #2   : urlZoom=${after2Url} readout=Z ${after2Readout} (${inState2})`);

say(
  '+ raises the zoom at WORLD',
  inState === 'clicked' && Number.isFinite(afterUrl) && Number.isFinite(beforeUrl) && afterUrl > beforeUrl,
  `${beforeUrl} -> ${afterUrl}`,
);

say(
  '+ moves by a full ZOOM_STEP (0.75), not to the framing floor',
  Number.isFinite(afterUrl) && Number.isFinite(beforeUrl) && Math.abs(afterUrl - beforeUrl - 0.75) < 0.01,
  `delta=${Number.isFinite(afterUrl) && Number.isFinite(beforeUrl) ? (afterUrl - beforeUrl).toFixed(2) : 'n/a'} (expected 0.75)`,
);

say(
  'a SECOND + keeps rising, so the control is not pinned',
  Number.isFinite(after2Url) && Number.isFinite(afterUrl) && after2Url > afterUrl,
  `${afterUrl} -> ${after2Url}`,
);

const outState = await click('[data-gn="map-zoom-out"]');
const outUrl = urlZoom();
say(
  '- lowers the zoom from there',
  outState === 'clicked' && Number.isFinite(outUrl) && Number.isFinite(after2Url) && outUrl < after2Url,
  outState === 'disabled' ? 'INCONCLUSIVE — disabled' : `${after2Url} -> ${outUrl}`,
);

console.log('\n=== B · ZOOM AWAY FROM THE WORLD CENTRE (control discriminator) ===\n');

/*
  THE DISCRIMINATOR. If + works here but not at world, the handler, the HUD
  pointer isolation from R3.2 and the overlay stack are all exonerated — the
  fault is specific to the world-centred camera.
*/
await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
await settle();

const ea = await page.$('[data-gn="breadcrumb-jump"][data-gn-target="eastAfrica"]');
if (ea !== null) {
  await ea.click();
  await page.waitForTimeout(4500);
}

const eaBefore = urlZoom();
await click('[data-gn="map-zoom-in"]');
const eaAfterIn = urlZoom();
say('+ raises the zoom at EAST AFRICA', eaAfterIn !== null && eaBefore !== null && eaAfterIn > eaBefore, `${eaBefore} -> ${eaAfterIn}`);

await click('[data-gn="map-zoom-out"]');
const eaAfterOut = urlZoom();
say('- lowers the zoom at EAST AFRICA', eaAfterOut !== null && eaAfterIn !== null && eaAfterOut < eaAfterIn, `${eaAfterIn} -> ${eaAfterOut}`);

console.log('\n=== C · QUOTA AND SELECTION PROPERTIES ===\n');

const url = page.url();
say('no country selection', !url.includes('country=') && !/sel=country(%3A|:)/.test(url), `url=${url.replace(BASE, '')}`);
say('0 /news/country/*', countryReqs() === 0, `count=${countryReqs()}`);
say('0 executing top-headlines', executingReqs() === 0, `count=${executingReqs()}`);
say('no page errors', crashes.length === 0, crashes[0] ?? '');

await browser.close();

const bad = rows.filter((r) => !r.ok);
console.log('\n================================================');
console.log(`  ${rows.length - bad.length}/${rows.length} passed`);
for (const b of bad) console.log(`    FAIL ${b.name}  ${b.detail}`);
console.log('================================================\n');

process.exit(bad.length === 0 ? 0 : 1);

import { chromium } from 'playwright';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MAP REQUEST-ECONOMY PROBE — A DRIVEN BROWSER, AND ZERO LIVE QUOTA
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `MAP-GNEWS-QUOTA-REGRESSION-1`. This exists because the suite that was
 * supposed to prevent this defect — `checkpointB2RegionRetrieval.spec.ts`,
 * titled "the region path never reaches country retrieval" — is entirely
 * `readFileSync` plus string assertions. Every one of its claims was still true
 * on the day the deployed application retrieved CAF, SWZ and COD.
 *
 * A source-reading test can prove the code LOOKS right. It cannot observe a
 * click, an event order, a state value at a moment in time, or what the browser
 * actually puts on the wire. That gap cost real quota, so the replacement
 * drives a real browser and counts real requests.
 *
 * ── EVERY /news/* REQUEST IS FULFILLED LOCALLY. NOTHING REACHES A PROVIDER. ──
 *
 * The route interception below answers every news request from a fixture, so
 * this probe can run in CI forever at zero cost — which is the only way a quota
 * guard is safe to run repeatedly. `/geo/*` is stubbed for the same reason.
 *
 * THE ASSERTION IS ON REQUESTS OBSERVED, NOT ON RESPONSES RENDERED. What is
 * being guarded is spend, so what is counted is what left the browser.
 */

const BASE = process.env.PROBE_BASE_URL ?? 'http://127.0.0.1:3990';

/** Deliberately tiny: the probe asserts request COUNTS, never article content. */
const COUNTRY_FIXTURE = {
  countryCode: 'RWA',
  countryName: 'Rwanda',
  articles: [],
  dataMode: 'cached',
  totalResults: 0,
};

const HEADLINES_FIXTURE = { articles: [], dataMode: 'cached', totalResults: 0 };

async function withPage(run) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  /** Every request that left the browser, so nothing can be counted twice. */
  const observed = [];

  await context.route('**/news/**', async (route) => {
    const url = route.request().url();
    observed.push(url);

    const body = url.includes('/news/country/') ? COUNTRY_FIXTURE : HEADLINES_FIXTURE;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
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

  /* Anything else the page needs is allowed through to the local server. */
  try {
    return await run(page, {
      all: () => observed,
      countryRequests: () => observed.filter((u) => u.includes('/news/country/')),
      reset: () => {
        observed.length = 0;
      },
    });
  } finally {
    await browser.close();
  }
}

async function openMap(page, query = '') {
  await page.goto(`${BASE}/map${query}`, { waitUntil: 'domcontentloaded' });
  /* Let the mount effects and any restore settle before counting. */
  await page.waitForTimeout(2500);
}

const results = [];

function record(name, countryRequests, expectation, detail = '') {
  const passed = expectation(countryRequests);
  results.push({ name, count: countryRequests.length, passed, detail });
  const mark = passed ? 'PASS' : 'FAIL';
  console.log(
    `  ${mark}  ${name.padEnd(42)} /news/country requests = ${countryRequests.length}` +
      (detail ? `  ${detail}` : ''),
  );
}

const zero = (reqs) => reqs.length === 0;

await withPage(async (page, seen) => {
  console.log('\n=== A · NAVIGATION MUST BE PROVIDER-FREE ===\n');

  /* Cold open with no selection in the URL. */
  seen.reset();
  await openMap(page);
  record('open /map (no selection)', seen.countryRequests(), zero);

  /*
    THE REGRESSION ITSELF, AND THE REASON THIS FILE EXISTS.

    A URL naming a country used to make the mount effect retrieve it, with no
    user in the loop. Hydration now restores the selection and stops.
  */
  seen.reset();
  await openMap(page, '?country=RWA');
  record('hydration ?country=RWA', seen.countryRequests(), zero, '(was the quota leak)');

  seen.reset();
  await openMap(page, '?country=CAF');
  record('hydration ?country=CAF', seen.countryRequests(), zero, '(the collapse, re-spent)');

  /*
    EAST AFRICA — THE SEMANTIC SELECTION MUST SURVIVE AND MUST NOT RETRIEVE.
    Driven through the URL because the selector is a canvas-adjacent control;
    the assertion is about the retrieval decision either way.
  */
  seen.reset();
  await openMap(page, '?sel=region%3Aeastern-africa');
  const eastAfricaUrl = page.url();
  record('hydration sel=region:eastern-africa', seen.countryRequests(), zero);
  record(
    'East Africa keeps NO country in the URL',
    seen.countryRequests(),
    () => !eastAfricaUrl.includes('country='),
    `url=${eastAfricaUrl.replace(BASE, '')}`,
  );

  seen.reset();
  await openMap(page, '?sel=region%3Aeastern-africa&country=CAF');
  const collapsed = page.url();
  record(
    'region + stale country: country dropped',
    seen.countryRequests(),
    () => !collapsed.includes('country=CAF'),
    `url=${collapsed.replace(BASE, '')}`,
  );

  console.log('\n=== B · CAMERA AND PRESENTATION MUST BE PROVIDER-FREE ===\n');

  seen.reset();
  await openMap(page, '?cam=2.0%2C10.0%2C1.5');
  record('camera-only URL (pan/zoom equivalent)', seen.countryRequests(), zero);

  seen.reset();
  await openMap(page, '?period=7D');
  record('time window 7d', seen.countryRequests(), zero);

  seen.reset();
  await openMap(page, '?period=30D');
  record('time window 30d', seen.countryRequests(), zero);

  seen.reset();
  await openMap(page, '?mode=SOURCES');
  record('mode change (layer equivalent)', seen.countryRequests(), zero);

  console.log('\n=== C · POSITIVE CONTROL — THE SUITE MUST BE ABLE TO SEE A REQUEST ===\n');

  /*
    WITHOUT THIS EVERY ASSERTION ABOVE PASSES VACUOUSLY on a build that simply
    never retrieves anything — which would be a different defect, not a fix.

    An explicit country selection is driven by clicking the country's own fill
    on the map canvas. If the canvas is unavailable in this environment the
    control is reported as INCONCLUSIVE rather than silently passing.
  */
  seen.reset();
  await openMap(page);

  const canvas = await page.$('canvas');
  if (canvas === null) {
    results.push({
      name: 'POSITIVE CONTROL (explicit selection)',
      count: 0,
      passed: false,
      detail: 'INCONCLUSIVE — no map canvas in this environment',
    });
    console.log('  ????  POSITIVE CONTROL                       INCONCLUSIVE — no canvas');
  } else {
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + box.width * 0.52, box.y + box.height * 0.55);
    await page.waitForTimeout(2000);

    const reqs = seen.countryRequests();
    record(
      'POSITIVE CONTROL: explicit map click',
      reqs,
      (r) => r.length >= 1,
      'must be >= 1, else the probe is blind',
    );
  }
});

const failed = results.filter((r) => !r.passed);

console.log('\n================================================================');
console.log(`  ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.log('  FAILED:');
  for (const f of failed) console.log(`    - ${f.name} ${f.detail}`);
}
console.log('================================================================\n');

process.exit(failed.length === 0 ? 0 : 1);

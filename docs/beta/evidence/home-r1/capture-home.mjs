/**
 * Gate A Home evidence capture — BEFORE/AFTER, four approved widths, EN + PL.
 *
 * Read-only: navigates the built app and screenshots it. Also records every
 * network request so "ordinary Home browsing starts no metered AI" is measured
 * rather than asserted.
 *
 * Locale is sent as a Cookie HEADER, not via addCookies: the server renders
 * <html lang> from the cookie, and an IP host (127.0.0.1) rejects a domain
 * cookie, which silently left every capture in EN.
 *
 * Usage: node capture-home.mjs <outDir> <baseUrl> <label>
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [, , outDir, baseUrl, label] = process.argv;
if (!outDir || !baseUrl || !label) {
  console.error('usage: node capture-home.mjs <outDir> <baseUrl> <label>');
  process.exit(2);
}

/* The four widths BETA-DESIGN-AUTHORITY-R5.1.md §7.8 requires. */
const VIEWPORTS = [
  /* H6 · Issue #29 — every width the contract names, and each one the R4.1
     authority actually supplies a frame for. */
  { name: 'desktop-1920x1080', width: 1920, height: 1080 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'tablet-1024x768', width: 1024, height: 768 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'phone-430x932', width: 430, height: 932 },
  { name: 'phone-390x844', width: 390, height: 844 },
  { name: 'phone-360x800', width: 360, height: 800 },
];
const LOCALES = ['en', 'pl'];

/* Anything that would mean metered AI or a provider call started on browse. */
const METERED = /\/(analysis|ask-v2|ai)(\/|\?|$)|openai|anthropic/i;

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const report = [];

for (const locale of LOCALES) {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
      extraHTTPHeaders: { Cookie: `globalnews-ai-language=${locale}` },
    });

    const requests = [];
    context.on('request', (r) => requests.push({ method: r.method(), url: r.url() }));

    /* C-3 correction 2: a console "500" with no URL is unexplained evidence.
       Record the failing response itself so the endpoint is named, not guessed. */
    const failedResponses = [];
    context.on('response', (r) => {
      if (r.status() >= 400) {
        failedResponses.push({ url: r.url(), status: r.status(), type: r.request().resourceType() });
      }
    });
    const failedRequests = [];
    context.on('requestfailed', (r) => {
      failedRequests.push({ url: r.url(), failure: r.failure()?.errorText ?? null });
    });

    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });

    const response = await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 60000 });
    /* Settle deferred client work before the frame is judged. */
    await page.waitForTimeout(1200);

    const file = `${label}_${vp.name}_${locale}.png`;
    await page.screenshot({ path: join(outDir, file), fullPage: true });

    /* Measured facts about the rendered frame, not claims about it. The
       DOM/visible split matters: text present in the DOM but absent from
       innerText is text a reader cannot actually read. */
    const probe = await page.evaluate(() => {
      const dom = document.body.textContent || '';
      const visible = document.body.innerText || '';
      const has = (re) => ({ dom: re.test(dom), visible: re.test(visible) });
      return {
        title: document.title,
        htmlLang: document.documentElement.lang,
        hasModulesAnchor: Boolean(document.getElementById('intelligence-modules')),
        horizontalOverflow:
          document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        navHrefs: [...document.querySelectorAll('nav a')]
          .map((a) => a.getAttribute('href'))
          .filter(Boolean),
        /* All NINE registry modules, EN or PL title, DOM and visible. */
        moduleTitles: {
          security: has(/Security Intelligence|Analiza bezpieczeństwa/),
          'world-intelligence': has(/World Intelligence|Analiza świata/),
          'country-intelligence': has(/Country Intelligence|Analiza krajów/),
          politics: has(/Politics Intelligence|Analiza polityczna/),
          economy: has(/Economy Intelligence|Analiza gospodarcza/),
          conflict: has(/Conflict Intelligence|Analiza konfliktów/),
          market: has(/Market Intelligence|Analiza rynkowa/),
          humanitarian: has(/Humanitarian Intelligence|Analiza humanitarna/),
          energy: has(/Energy Intelligence|Analiza energetyczna/),
        },
        /* Every module's route line, so all nine cards are proven rendered. */
        moduleRoutes: {
          security: has(/\/security-visual-preview/),
          'world-intelligence': has(/No route|Brak trasy/),
          'country-intelligence': has(/\/map(?![a-z])/),
          politics: has(/\/politics-visual-preview/),
          economy: has(/\/economy-visual-preview/),
          conflict: has(/\/conflict/),
          market: has(/\/market/),
          humanitarian: has(/\/humanitarian/),
          energy: has(/\/energy/),
        },
        /* The approved category title colours, read off the rendered nodes. */
        titleColours: (() => {
          const out = {};
          for (const el of document.querySelectorAll('#intelligence-modules li a, #intelligence-modules li > div')) {
            const title = el.querySelector('span > span');
            if (!title) continue;
            out[(title.textContent || '').trim()] = getComputedStyle(title).color;
          }
          return out;
        })(),
        comingSoonBadge: has(/Coming soon|Wkrótce/),
        previewBadge: has(/Preview|Zapowiedź/),
        activeBadge: has(/\bActive\b|Aktywny/),
        /* Route lines and the summary line are R5.1 additions; absent = BEFORE. */
        routeLineShown: has(/\/security-visual-preview|\/economy-visual-preview/),
        summaryLine: has(/9 modules|9 modułów/),
      };
    });

    const metered = requests.filter((r) => METERED.test(r.url));

    report.push({
      label,
      locale,
      viewport: vp.name,
      status: response?.status() ?? null,
      screenshot: file,
      requestCount: requests.length,
      meteredRequests: metered,
      failedResponses,
      failedRequests,
      consoleErrors,
      ...probe,
    });

    console.log(
      `${label} ${vp.name} ${locale}  http=${response?.status()}  lang=${probe.htmlLang}  reqs=${requests.length}  metered=${metered.length}  overflow=${probe.horizontalOverflow}  mods=${Object.values(probe.moduleTitles).filter((m) => m.visible).length}/9  failed=${failedResponses.length}`,
    );

    await context.close();
  }
}

await browser.close();
writeFileSync(join(outDir, `${label}-report.json`), JSON.stringify(report, null, 2));

const meteredTotal = report.reduce((n, r) => n + r.meteredRequests.length, 0);
const overflow = report.filter((r) => r.horizontalOverflow).map((r) => `${r.viewport}/${r.locale}`);
const wrongLang = report.filter((r) => r.htmlLang !== r.locale).map((r) => `${r.viewport}/${r.locale}`);
console.log('\n--- summary ---');
console.log('captures:', report.length);
console.log('metered/AI requests during ordinary Home browsing:', meteredTotal);
console.log('horizontal overflow at:', overflow.length ? overflow.join(', ') : 'none');
console.log('locale mismatch at:', wrongLang.length ? wrongLang.join(', ') : 'none');

const allModulesVisible = report.every((r) => Object.values(r.moduleTitles).every((m) => m.visible));
console.log('all nine module titles visible in every frame:', allModulesVisible);

const byEndpoint = new Map();
for (const r of report) {
  for (const f of r.failedResponses) {
    const key = `${f.status} ${f.type} ${new URL(f.url).pathname}`;
    byEndpoint.set(key, (byEndpoint.get(key) ?? 0) + 1);
  }
}
console.log('failing responses by endpoint:');
if (byEndpoint.size === 0) console.log('  none');
for (const [k, n] of byEndpoint) console.log(`  ${n}x  ${k}`);

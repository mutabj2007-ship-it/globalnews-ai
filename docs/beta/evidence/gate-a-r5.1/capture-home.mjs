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
  { name: 'desktop-1440x900', width: 1440, height: 900 },
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
        moduleTitles: {
          security: has(/Security Intelligence|Analiza bezpieczeństwa/),
          world: has(/World Intelligence|Analiza świata/),
          country: has(/Country Intelligence|Analiza krajów/),
          energy: has(/Energy Intelligence|Analiza energetyczna/),
        },
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
      consoleErrors,
      ...probe,
    });

    console.log(
      `${label} ${vp.name} ${locale}  http=${response?.status()}  lang=${probe.htmlLang}  reqs=${requests.length}  metered=${metered.length}  overflow=${probe.horizontalOverflow}  modsVisible=${probe.moduleTitles.security.visible}`,
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

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const output = process.argv[2];
if (!output)
  throw new Error('Usage: node scripts/verify-election-preview.cjs REVIEW_OUTPUT_DIRECTORY');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const result = [];
  for (const locale of ['en', 'pl'])
    for (const compact of [false, true]) {
      const context = await browser.newContext({
        viewport: compact ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      });
      await context.addCookies([
        { name: 'globalnews-ai-language', value: locale, url: 'http://localhost:3128' },
      ]);
      const page = await context.newPage();
      const errors = [];
      const external = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('request', (r) => {
        if (!r.url().startsWith('http://localhost:3128')) external.push(r.url());
      });
      await page.goto(
        'http://localhost:3128/election-visual-preview' + (compact ? '/compact' : ''),
        { waitUntil: 'networkidle' },
      );
      const audit = await page.evaluate(() => ({
        title: document.querySelector('h1').textContent,
        regions: [...document.querySelectorAll('[data-eln="region"] h2')].map((e) => e.textContent),
        overflow: document.documentElement.scrollWidth - innerWidth,
        rows: [...document.querySelectorAll('[data-eln="contestant"]')].map((e) => {
          const s = getComputedStyle(e);
          return [s.color, s.fontWeight, s.backgroundColor, s.borderBottomWidth, s.padding].join(
            '|',
          );
        }),
        robots: document.querySelector('meta[name="robots"]').content,
      }));
      await page.screenshot({
        path: path.join(
          output,
          'election-' + (compact ? 'phone' : 'desktop') + '-' + locale + '.png',
        ),
        fullPage: true,
      });
      await page.reload({ waitUntil: 'networkidle' });
      result.push({ locale, compact, ...audit, errors, external });
      await context.close();
    }
  await browser.close();
  fs.writeFileSync(path.join(output, 'browser-validation.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (
    result.some(
      (r) =>
        r.overflow > 0 ||
        r.errors.length ||
        r.external.length ||
        r.regions.length !== 4 ||
        new Set(r.rows).size !== 1,
    )
  )
    process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

/**
 * C8 — phone audit at the three widths the contract names.
 *
 * Overflow alone is not a phone pass, so this also measures what actually goes
 * wrong on small screens: elements wider than the viewport, interactive targets
 * under 44px, text under 12px, and whether the fixed bottom bar can cover the
 * last section.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3210';
const WIDTHS = [
  { w: 430, h: 932 },
  { w: 390, h: 844 },
  { w: 360, h: 800 },
];

const browser = await chromium.launch();

for (const locale of ['en', 'pl']) {
  for (const { w, h } of WIDTHS) {
    const page = await browser.newPage({
      viewport: { width: w, height: h },
      extraHTTPHeaders: { Cookie: `globalnews-ai-language=${locale}` },
    });
    await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(2500);

    const report = await page.evaluate((viewportWidth) => {
      const docWidth = document.documentElement.scrollWidth;

      /* Anything painted wider than the viewport. Scroll containers are
         excluded: a rail is SUPPOSED to be wider than its box. */
      const tooWide = [];
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const r = el.getBoundingClientRect();
        if (r.width > viewportWidth + 1 && r.height > 0) {
          const scroller = el.closest('[role="group"], .overflow-x-auto');
          if (scroller === null || scroller === el) {
            tooWide.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 40)}`);
          }
        }
      }

      /* Tap targets below the 44px guideline. */
      const small = [];
      for (const el of Array.from(document.querySelectorAll('a, button, input, label[for]'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.height < 44) small.push(`${el.tagName.toLowerCase()}:${(el.textContent || '').trim().slice(0, 28)}|${Math.round(r.height)}`);
      }

      /* Body text below 12px is hard to read on a phone. */
      const tiny = new Set();
      for (const el of Array.from(document.querySelectorAll('p, span, li, a, h1, h2, h3'))) {
        if ((el.textContent || '').trim().length < 3) continue;
        const size = Number.parseFloat(getComputedStyle(el).fontSize);
        if (size > 0 && size < 12) tiny.add(`${Math.round(size * 10) / 10}px`);
      }

      const sections = Array.from(document.querySelectorAll('section[aria-labelledby], section[id]')).map(
        (s) => s.id || s.getAttribute('aria-labelledby'),
      );

      return {
        docWidth,
        overflow: docWidth > viewportWidth,
        tooWide: [...new Set(tooWide)].slice(0, 6),
        smallTargets: [...new Set(small)].slice(0, 6),
        tinyText: [...tiny],
        sections: sections.length,
        mainPadBottom: getComputedStyle(document.querySelector('main')).paddingBottom,
      };
    }, w);

    console.log(
      `${locale} ${w}x${h}  overflow=${report.overflow}  doc=${report.docWidth}  sections=${report.sections}  mainPb=${report.mainPadBottom}`,
    );
    if (report.tooWide.length) console.log('   wide:', report.tooWide.join(' | '));
    if (report.smallTargets.length) console.log('   small targets:', report.smallTargets.join(' | '));
    if (report.tinyText.length) console.log('   tiny text:', report.tinyText.join(' '));

    await page.close();
  }
}

await browser.close();

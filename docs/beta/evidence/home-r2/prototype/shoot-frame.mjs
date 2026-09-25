/**
 * C0 — capture the R5.1 prototype's device frame, whole.
 *
 * The harness renders a 360px control column plus the device frame inside a
 * scrolling, transformed pane. An element screenshot of the frame therefore
 * came back mostly blank: the pane clips it. So every ancestor of the frame is
 * un-clipped (overflow visible, no transform, auto height) before capture, and
 * the viewport is grown to the frame's full height so nothing is virtualised.
 *
 * Hash params drive state: dev/lang/auth/themeMode/data/fit. `fit=0` renders at
 * actual size.
 *
 * Usage: node shoot-frame.mjs <file> <outDir> <label> <dev> <hashExtra>
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , filePath, outDir, label, dev = '1440', extra = ''] = process.argv;
const W = Number(dev);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W + 380, height: 1200 }, deviceScaleFactor: 1 });

await page.goto(`${pathToFileURL(filePath).href}#dev=${dev}&fit=0${extra}`, {
  waitUntil: 'domcontentloaded', timeout: 60000,
});
await page.waitForTimeout(3500);

const info = await page.evaluate((w) => {
  const hits = Array.from(document.querySelectorAll('*'))
    .filter((el) => Math.abs(el.offsetWidth - w) < 2 && el.offsetHeight > 600)
    .sort((a, b) => b.offsetHeight - a.offsetHeight);
  if (hits.length === 0) return null;
  const frame = hits[0];
  frame.setAttribute('data-gn-frame', '1');
  /* Un-clip every ancestor so the whole frame is painted, not just the
     slice the harness pane shows. */
  for (let el = frame.parentElement; el && el !== document.documentElement; el = el.parentElement) {
    el.style.overflow = 'visible';
    el.style.maxHeight = 'none';
    el.style.height = 'auto';
    el.style.transform = 'none';
    el.style.contain = 'none';
  }
  document.documentElement.style.overflow = 'visible';
  document.body.style.overflow = 'visible';
  return { h: frame.scrollHeight, w: frame.offsetWidth };
}, W);

if (info === null) { console.log('NO FRAME MATCH'); await browser.close(); process.exit(1); }

/* Grow the viewport to the frame so lazy/virtualised content paints. */
await page.setViewportSize({ width: W + 380, height: Math.min(info.h + 100, 30000) });
await page.waitForTimeout(2500);

const file = `${label}.png`;
await page.locator('[data-gn-frame]').screenshot({ path: join(outDir, file) });
console.log(`${file}  ${info.w}x${info.h}`);

await browser.close();

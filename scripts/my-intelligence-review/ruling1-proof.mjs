/* Ruling 1 proof: the launcher is gone on /my-intelligence and intact elsewhere,
   and the dock still opens by intent on the suppressed route. */
import { chromium } from 'playwright';
const B = 'http://127.0.0.1:4320';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: false, args: ['--headless=new','--no-sandbox','--hide-scrollbars'] });
const rows = [];
for (const [w,h] of [[360,800],[390,844],[430,932],[768,1024],[1440,900]]) {
  for (const route of ['/my-intelligence','/']) {
    const ctx = await b.newContext({ viewport:{width:w,height:h}, isMobile:w<1024, hasTouch:w<1024 });
    const p = await ctx.newPage();
    await p.goto(B+route,{waitUntil:'networkidle'}).catch(()=>{});
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
      const l = document.querySelector('[data-ask="launcher"]');
      const s = [...document.querySelectorAll('button')].find(b=>/^(Select|Zaznacz|Done|Gotowe)$/.test((b.textContent||'').trim()));
      let overlap = 0;
      if (l && s) { const a=l.getBoundingClientRect(), c=s.getBoundingClientRect();
        overlap = Math.round(Math.max(0,Math.min(a.right,c.right)-Math.max(a.left,c.left)) * Math.max(0,Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top))); }
      return { launcher: l !== null, select: s !== undefined, overlap };
    });
    rows.push({ width:w, route, launcher:r.launcher, selectControl:r.select, overlapPx:r.overlap });
    // on the suppressed route, prove the dock still opens by intent
    if (route === '/my-intelligence') {
      const opened = await p.evaluate(async () => {
        window.dispatchEvent(new CustomEvent('globalnews:ask-open', { detail: { question: 'probe' } }));
        await new Promise((r) => setTimeout(r, 400));
        return document.querySelector('[data-ask="panel"]') !== null;
      });
      rows[rows.length-1].dockOpensByIntent = opened;
    }
    await ctx.close();
  }
}
await b.close();
console.log(JSON.stringify(rows, null, 1));

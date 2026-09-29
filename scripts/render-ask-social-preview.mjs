// STANDALONE PUBLIC BETA CONVERGENCE R1 — render the root Ask social preview (1200×630 PNG).
//
// Deterministic: a fixed HTML document built ONLY from the product's own mark
// (frontend/src/app/icon.svg), its wordmark ("GlobalNews" + cyan "AI", as the NavBar sets
// it), the D25 Ask idle copy ("ASK AI" / "What would you like to understand?") and D25
// design tokens. No stock image, no news scene, no claim beyond the product's own words.
//
// Usage: node scripts/render-ask-social-preview.mjs
// Output: frontend/public/og/ask-globalnewsai-1200x630.png
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'frontend', 'public', 'og', 'ask-globalnewsai-1200x630.png');
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const mark = readFileSync(join(ROOT, 'frontend', 'src', 'app', 'icon.svg'), 'utf8').replace(
  /<svg /,
  '<svg width="72" height="72" ',
);

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:1200px;height:630px;overflow:hidden}
  body{background:radial-gradient(120% 60% at 20% 0%,#04203d 0%,#010a19 60%);color:#e6eef6;
       font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;position:relative}
  .brand{position:absolute;left:88px;top:72px;display:flex;align-items:center;gap:18px}
  .word{font-weight:800;font-size:40px;letter-spacing:-.01em;color:#ffffff}
  .word b{color:#22d3ee;font-weight:800}
  .eyebrow{position:absolute;left:88px;top:250px;font:600 26px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
           letter-spacing:.1em;color:#5abff5}
  h1{position:absolute;left:88px;top:296px;margin:0;width:1020px;font-weight:800;font-size:76px;
     line-height:1.06;letter-spacing:-.025em;color:#ffffff}
  .rule{position:absolute;left:88px;right:88px;bottom:72px;height:1px;background:#0a2744}
</style></head><body>
  <div class="brand">${mark}<span class="word">GlobalNews <b>AI</b></span></div>
  <div class="eyebrow">ASK AI</div>
  <h1>What would you like to understand?</h1>
  <div class="rule"></div>
</body></html>`;

const profile = join(tmpdir(), `ask-og-${process.pid}`);
const port = 9200 + (process.pid % 500);
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
let seq = 0;
const pending = new Map();
for (let i = 0; i < 150 && !ws; i += 1) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    if (page) {
      ws = new WebSocket(page.webSocketDebuggerUrl);
      await new Promise((res) => ws.addEventListener('open', res));
      ws.addEventListener('message', (e) => {
        const m = JSON.parse(e.data);
        if (m.id && pending.has(m.id)) {
          pending.get(m.id)(m);
          pending.delete(m.id);
        }
      });
    }
  } catch {
    /* chrome still starting */
  }
  if (!ws) await sleep(200);
}
const send = (method, params = {}) => {
  const id = (seq += 1);
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) =>
    pending.set(id, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result))),
  );
};
await send('Emulation.setDeviceMetricsOverride', {
  width: 1200,
  height: 630,
  deviceScaleFactor: 1,
  mobile: false,
});
const { frameId } = await send('Page.getFrameTree').then((r) => ({
  frameId: r.frameTree.frame.id,
}));
await send('Page.setDocumentContent', { frameId, html });
await sleep(800);
const shot = await send('Page.captureScreenshot', {
  format: 'png',
  clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 },
});
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
chrome.kill();
await sleep(300);
rmSync(profile, { recursive: true, force: true });
console.log(`wrote ${OUT}`);

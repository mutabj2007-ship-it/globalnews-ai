/**
 * ════════════════════════════════════════════════════════════════════════════
 * ALPHA REPLAY — REAL CAPTURED FEED, FOR VISUAL VALIDATION ONLY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Serves `alpha-capture/alpha-home-feed.<lang>.json` — a verbatim, read-only
 * capture of the REAL Alpha Home feed — at the one path the frontend reads.
 * It replaces `feed-stub.mjs` for fidelity captures, because the Product Owner
 * requires final desktop validation against real Alpha content rather than
 * geometry-harness cards.
 *
 * It CHANGES NOTHING and INVENTS NOTHING. The JSON is exactly what Alpha
 * returned; this file only hands it back. No field is edited, added, reordered
 * or reworded, and the response is served with the capture's own `dataMode`,
 * `providers` and `generatedAt`.
 *
 * It cannot reach the product: it lives outside `frontend/src`, nothing imports
 * it, and it is used only by pointing `SERVER_INTERNAL_API_URL` at it for the
 * duration of a capture. The application is byte-identical with and without it,
 * and Alpha and production read the live feed exactly as before.
 *
 *     node scripts/home-visual/alpha-replay.mjs 4310
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] ?? 4310);
const load = (lang) =>
  readFileSync(join(HERE, 'alpha-capture', `alpha-home-feed.${lang}.json`), 'utf-8');

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  res.setHeader('content-type', 'application/json');
  res.setHeader('x-globalnews-source', 'alpha-capture-replay');
  if (url.pathname === '/news/top-headlines') {
    const lang = (url.searchParams.get('lang') ?? 'en').toLowerCase() === 'pl' ? 'pl' : 'en';
    res.end(load(lang));
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'replay serves /news/top-headlines only' }));
}).listen(PORT, () => console.log(`alpha replay on http://127.0.0.1:${PORT}`));

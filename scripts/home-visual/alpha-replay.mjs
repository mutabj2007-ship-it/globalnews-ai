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
 *
 * ── `--local-thumbs`: WHY IT EXISTS AND WHAT IT IS NOT ──────────────────
 *
 * OFF BY DEFAULT. Without it this file behaves exactly as described above.
 *
 * The capture's `imageUrl` fields are real publisher URLs (mb.com.ph,
 * the-star.co.ke, ...). This container's egress policy refuses those hosts —
 * every one returns 000, `connect_rejected` — so `next/image`, which fetches
 * the origin server-side, renders its empty-frame fallback. The product is
 * fine: `next.config` already allows `https://**`, and the same page in Alpha
 * shows the photographs. It is the CAPTURE ENVIRONMENT that cannot reach them.
 *
 * That matters here because the pass being validated is an IMAGE-LED card
 * design, and a comparison against empty frames cannot show whether the image
 * band's mass, proportion and tone match the prototype.
 *
 * So this flag swaps each `imageUrl` for a relative path under the frontend's
 * own `public/capture-thumb/`, which the capture script writes and deletes
 * around a run and which is never committed. Each file is an ABSTRACT GRADIENT —
 * not a photograph, not a picture of anything, carrying no subject, no place
 * and no event. It is a grey card of the right size and weight, and it exists
 * to make a geometry and tone comparison possible. Every capture produced with
 * it says so on its face. Nothing in the product changes; the flag lives in a
 * throwaway harness outside `frontend/`, and the shipped code never sees it.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] ?? 4310);
const LOCAL_THUMBS = process.argv.includes('--local-thumbs');

const raw = (lang) =>
  readFileSync(join(HERE, 'alpha-capture', `alpha-home-feed.${lang}.json`), 'utf-8');

const load = (lang) => {
  const text = raw(lang);
  if (!LOCAL_THUMBS) return text;
  const feed = JSON.parse(text);
  feed.articles = feed.articles.map((a, i) =>
    a.imageUrl === undefined || a.imageUrl === null
      ? a
      : { ...a, imageUrl: `/capture-thumb/${i % 6}.png` },
  );
  return JSON.stringify(feed);
};

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

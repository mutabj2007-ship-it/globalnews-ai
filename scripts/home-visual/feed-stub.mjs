/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOME VISUAL HARNESS — LOCAL FEED STUB  (CAPTURE TOOL, NEVER SHIPPED)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * DESKTOP FIDELITY CORRECTION R2 §6 asked for a captured REAL Alpha Home-feed
 * response to validate card density. **That capture could not be taken, and the
 * substitute below is deliberately not a stand-in for it.**
 *
 * WHAT WAS TRIED, AND WHAT REFUSED:
 *   cloud container  -> https://backend-production-bed5.up.railway.app   000
 *   user's device VM -> the same host, /news/top-headlines, /health, /   000
 * Both environments route egress through an allow-listing proxy that does not
 * carry that host, so no real Alpha response is obtainable from here. Reported
 * rather than worked around.
 *
 * ── WHAT THIS IS INSTEAD, AND WHAT IT IS NOT FOR ────────────────────────
 *
 * A GEOMETRY harness. It answers exactly one question — *does the desktop card
 * rail have the prototype's density and rhythm when records exist* — and it is
 * built so it can answer nothing else:
 *
 *   · every title reads `HARNESS RECORD n`, so no line of it could be mistaken
 *     for reporting in a screenshot;
 *   · every URL is `https://example.invalid/...`, the reserved TLD, so no link
 *     resolves anywhere;
 *   · every publisher is `VISUAL HARNESS`;
 *   · the fields are only those the card actually lays out — title, summary,
 *     category, publishedAt, sourcesCount — because the question is geometry.
 *
 * ── AND IT CANNOT REACH THE PRODUCT ─────────────────────────────────────
 *
 * It is a standalone HTTP server run beside the build. Nothing imports it, it
 * is outside `frontend/src`, it is never bundled, and it is reached only by
 * pointing `SERVER_INTERNAL_API_URL` at it for the duration of a capture. The
 * application is byte-identical with and without it. Production reads the live
 * feed exactly as before.
 *
 * Density against REAL content still has to be judged on Alpha. This does not
 * replace that, and no capture taken with it may be presented as one.
 *
 *     node scripts/home-visual/feed-stub.mjs 4310
 */
import { createServer } from 'node:http';

const PORT = Number(process.argv[2] ?? 4310);
const CATEGORIES = ['energy', 'security', 'economy', 'humanitarian', 'world', 'technology'];
const HARNESS_IMAGES = [
  'trending-trade-talks.jpg',
  'trending-ocean-current.jpg',
  'trending-ai-chip.jpg',
  'trending-retail-season.jpg',
  'featured-global-markets.jpg',
  'trending-sleep-health.jpg',
];
const REGIONS = ['EU', 'Middle East', 'Poland', 'East Africa', 'Asia', 'Americas'];

const articles = Array.from({ length: 24 }, (_, i) => ({
  id: `harness-${String(i + 1).padStart(3, '0')}`,
  title: `HARNESS RECORD ${i + 1} — card geometry only, not reporting`,
  summary:
    'Placeholder body used to measure line count, clamp behaviour and card height in the visual harness. It is not news and it is not from any provider.',
  url: `https://example.invalid/home-visual-harness/${i + 1}`,
  /*
    The card's image slot, filled with the PRODUCT'S OWN placeholder assets so
    the rail can be measured at its real height. These are files already in
    `public/images/`; nothing new is invented and no third-party image is
    fetched. The first run of this harness sent `imageUrl: null`, which is not
    the same as omitting it — `NewsArticle.imageUrl` is `?: string`, the card
    tests `=== undefined`, and `null` walked straight past that test into
    `SafeImage` and crashed the render. That is a real robustness gap on the
    product side if a provider ever sends an explicit null, and it is recorded
    in the package rather than quietly patched around here.
  */
  imageUrl: `http://127.0.0.1:3377/images/${HARNESS_IMAGES[i % HARNESS_IMAGES.length]}`,
  sourceId: 'visual-harness',
  sourceName: 'VISUAL HARNESS',
  category: CATEGORIES[i % CATEGORIES.length],
  region: REGIONS[i % REGIONS.length],
  sourcesCount: 3 + (i % 9),
  publishedAt: new Date(Date.now() - (i + 1) * 37 * 60 * 1000).toISOString(),
}));

createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('x-globalnews-harness', 'visual-geometry-only');
  if ((req.url ?? '').startsWith('/news/top-headlines')) {
    res.end(JSON.stringify({ articles, dataMode: 'HARNESS', totalResults: articles.length }));
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'harness serves /news/top-headlines only' }));
}).listen(PORT, () => console.log(`home visual harness on http://127.0.0.1:${PORT}`));

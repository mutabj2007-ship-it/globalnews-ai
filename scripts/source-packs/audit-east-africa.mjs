/** Offline source-pack audit only; never imported by the application. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const ROOT = fileURLToPath(new URL('../../backend/source-packs/east-africa-r1/', import.meta.url));
export const LIMITS = { timeoutMs: 12000, maxBytes: 524288, maxRedirects: 3, concurrency: 4, maxLogicalRequestsPerCandidate: 5, maxHttpRequestsPerCandidateIncludingRedirects: 20 };
const ua = 'GlobalNewsAI-SourceAudit/1.0';
const hash = (b) => createHash('sha256').update(b).digest('hex');
export function classify(status, body, truncated = false) {
  if (status === 404 || status === 410) return 'DEAD_ENDPOINT';
  if ([401, 403, 429].includes(status)) return 'ACCESS_BLOCKED';
  if (status < 200 || status >= 300) return 'HTTP_ERROR';
  if (/cf-chl-|challenge-platform|<title>Just a moment|<title>Access Denied|captcha-delivery/i.test(body)) return 'BOT_CHALLENGE';
  if (truncated) return 'TRUNCATED';
  if (/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<(?:rss|feed|rdf:RDF)\b/i.test(body)) return 'FEED_CANDIDATE';
  if (/<html\b|<!doctype html/i.test(body)) return 'HTML_PAGE';
  return 'OTHER_CONTENT';
}
export async function request(url) {
  const out = { requestedUrl: url, checkedAt: new Date().toISOString(), redirects: [] };
  const signal = AbortSignal.timeout(LIMITS.timeoutMs);
  try {
    let r;
    for (let n = 0; n <= LIMITS.maxRedirects; n++) {
      r = await fetch(url, { headers: { 'User-Agent': ua, Accept: 'text/html,application/rss+xml,application/atom+xml,text/plain;q=0.8' }, redirect: 'manual', signal });
      if (![301, 302, 303, 307, 308].includes(r.status)) break;
      const location = r.headers.get('location');
      await r.body?.cancel();
      if (!location) throw new Error('REDIRECT_WITHOUT_LOCATION');
      const next = new URL(location, url);
      out.redirects.push({ status: r.status, from: url, to: next.href });
      if (next.protocol !== 'https:') throw new Error('HTTPS_DOWNGRADE_REFUSED');
      const host = (u) => new URL(u).hostname.replace(/^www\./, '');
      if (host(next.href) !== host(url)) throw new Error('CROSS_HOST_REDIRECT_REVIEW');
      if (n === LIMITS.maxRedirects) throw new Error('REDIRECT_LIMIT');
      url = next.href;
    }
    out.finalUrl = url; out.httpStatus = r.status; out.contentType = r.headers.get('content-type');
    const reader = r.body?.getReader(); const chunks = []; let length = 0; let truncated = false;
    if (reader) while (true) {
      const { value, done } = await reader.read(); if (done) break;
      const remaining = LIMITS.maxBytes - length;
      chunks.push(value.subarray(0, remaining)); length += Math.min(remaining, value.length);
      if (value.length >= remaining) { truncated = true; await reader.cancel(); break; }
    }
    const bytes = Buffer.concat(chunks); const body = bytes.toString('utf8');
    Object.assign(out, { bytesRead: bytes.length, truncated, sha256: hash(bytes), outcome: classify(r.status, body, truncated) });
    return { evidence: out, body };
  } catch (err) {
    return { evidence: { ...out, finalUrl: url, outcome: 'INACCESSIBLE', error: String(err.cause?.code || err.message).slice(0, 200) }, body: '' };
  }
}
export function robotsBlocks(text, path) {
  // Conservative: any matching disallow blocks this audit, regardless of agent group.
  return text.split(/\r?\n/).some((line) => {
    const rule = line.match(/^\s*disallow\s*:\s*([^#\s]+)/i)?.[1];
    if (!rule) return false;
    const escaped = rule.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('^' + escaped).test(path);
  });
}
export function links(body, base, kind) {
  const tags = body.match(/<(?:a|link)\b[^>]*>/gi) || [];
  return tags.flatMap((tag) => {
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) return [];
    try {
      const u = new URL(href.replace(/&amp;/g, '&'), base);
      if (u.protocol !== 'https:' || u.hostname.replace(/^www\./, '') !== new URL(base).hostname.replace(/^www\./, '')) return [];
      if (kind === 'feed' ? /application\/(rss|atom)\+xml/i.test(tag) : /terms|copyright|conditions|useragreement|legal-notice/i.test(u.pathname)) return [u.href];
    } catch { /* invalid publisher link */ }
    return [];
  });
}
export async function audit(row) {
  const [country, key, name, category, homepage, explicit] = row.split('|');
  const id = `ea-r1:${country.toLowerCase()}:${key}`;
  const reviewPath = ROOT + 'reviews.json';
  if (fs.existsSync(reviewPath)) {
    const reviews = JSON.parse(fs.readFileSync(reviewPath, 'utf8').replace(/^\uFEFF/, ''));
    if (reviews.sources[id]?.rightsStatus === 'RESTRICTED') {
      const previous = JSON.parse(fs.readFileSync(ROOT + 'captures.json', 'utf8')).sources.find(s => s.id === id);
      if (!previous) throw new Error('Restricted source has no prior evidence; do not fetch');
      return { ...previous, refreshSkipped: 'KNOWN_RIGHTS_RESTRICTION' };
    }
  }
  const checks = []; let requests = 0;
  const run = async (url, purpose) => { requests++; const r = await request(url); checks.push({ purpose, ...r.evidence }); return r; };
  const robots = await run(new URL('/robots.txt', homepage).href, 'ROBOTS');
  checks[0].directives = robots.body.split(/\r?\n/).filter(line => /^\s*(user-agent|disallow|allow)\s*:/i.test(line)).slice(0, 100);
  const policyUnavailable = robots.evidence.outcome === 'INACCESSIBLE' || [401,403,429].includes(robots.evidence.httpStatus) || robots.evidence.httpStatus >= 500 || ['BOT_CHALLENGE', 'TRUNCATED', 'HTTP_ERROR'].includes(robots.evidence.outcome);
  const blocked = (url) => robotsBlocks(robots.body, new URL(url).pathname);
  const skip = (url, reason) => checks.push({ purpose: 'SKIPPED', requestedUrl: url, checkedAt: new Date().toISOString(), outcome: reason });
  let page = { body: '', evidence: {} };
  if (policyUnavailable) skip(homepage, 'ROBOTS_UNAVAILABLE');
  else if (blocked(homepage)) skip(homepage, 'ROBOTS_RESTRICTED');
  else page = await run(homepage, 'HOMEPAGE');
  const discoveredFeeds = links(page.body, homepage, 'feed');
  const explicitFeed = explicit && /feed|rss/i.test(explicit);
  const feedUrl = explicitFeed ? explicit : discoveredFeeds[0];
  let feed = null;
  if (feedUrl && !policyUnavailable && page.evidence.outcome !== 'BOT_CHALLENGE') {
    if (blocked(feedUrl)) skip(feedUrl, 'ROBOTS_RESTRICTED');
    else feed = await run(feedUrl, explicitFeed ? 'LEGACY_FEED_RECHECK' : 'ADVERTISED_FEED');
  }
  const policyUrl = (explicit && !explicitFeed) ? explicit : links(page.body, homepage, 'rights')[0];
  let policy = null;
  if (policyUrl && !policyUnavailable && page.evidence.outcome !== 'BOT_CHALLENGE') {
    if (blocked(policyUrl)) skip(policyUrl, 'ROBOTS_RESTRICTED');
    else policy = await run(policyUrl, 'IDENTITY_OR_RIGHTS');
  }
  const readable = (policy?.body || page.body).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const rightsSignal = readable.match(/.{0,50}(?:all rights reserved|tous droits r[eé]serv[eé]s|permission|reproduction|copyright|creative commons).{0,150}/i)?.[0] || null;
  const source = {
    id: `ea-r1:${country.toLowerCase()}:${key}`, country, name, category, homepage,
    publisherGroup: null, independence: category === 'LOCAL_NEWS' ? 'REVIEW_REQUIRED' : 'NOT_APPLICABLE',
    locality: ['erena', 'tamazuj'].includes(key) ? 'EXILE_OR_CROSS_BORDER' : category === 'LOCAL_NEWS' ? 'COUNTRY_FOCUSED_CANDIDATE' : 'INSTITUTIONAL',
    enabled: false, alphaEnabled: false, admission: 'HOLD', rights: { status: rightsSignal ? 'RESTRICTION_OR_NOTICE_OBSERVED' : 'UNRESOLVED', reuseApproved: false, evidenceUrl: policyUrl || homepage, signal: rightsSignal },
    discovery: explicitFeed ? 'Existing registry or previously rejected endpoint; rechecked, not assumed valid' : 'Homepage candidate; feed only followed when advertised',
    feedUrl: feedUrl || null, technicalStatus: feed?.evidence.outcome || page.evidence.outcome || 'NOT_FETCHED',
    requests, checks,
    sample: feed?.evidence.outcome === 'FEED_CANDIDATE' ? {
      kind: 'METADATA_ONLY_NOT_RAW_XML',
      itemCountObserved: (feed.body.match(/<(?:item|entry)\b/gi) || []).length,
      dates: [...feed.body.matchAll(/<(?:pubDate|updated|published)\b[^>]*>([^<]+)</gi)].slice(0, 3).map((m) => m[1]),
      itemUrls: [...feed.body.matchAll(/<link>\s*(?:<!\[CDATA\[)?(https?:\/\/[^<\]\s]+)/gi)].slice(1, 4).map((m) => m[1]),
    } : null,
  };
  // Rights notices are evidence, never interpreted as a reuse grant.
  return source;
}
export async function main() {
  const rows = fs.readFileSync(ROOT + 'candidates.txt', 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const results = new Array(rows.length); let next = 0;
  await Promise.all(Array.from({ length: LIMITS.concurrency }, async () => {
    while (next < rows.length) { const index = next++; results[index] = await audit(rows[index]); console.log(results[index].id, results[index].technicalStatus); }
  }));
  fs.writeFileSync(ROOT + 'captures.json', JSON.stringify({ auditVersion: 1, capturedAt: new Date().toISOString(), limits: LIMITS, userAgent: ua, sources: results }, null, 2) + '\n');
}
if (process.argv[1] && fs.existsSync(process.argv[1]) && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) { if (!process.argv.includes('--live')) throw new Error('Pass --live for bounded network audit; existing captures will be replaced.'); await main(); }

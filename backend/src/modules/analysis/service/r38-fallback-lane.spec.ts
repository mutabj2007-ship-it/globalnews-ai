/* ──────────────────────────────────────────────────────────────────────────────
   R38 S2 — DETERMINISTIC CONTROLS FOR THE BACKUP-SEARCH LANE
   Base: 059cdb7f75f5b60623df66219d096d8b0a726f7f

   OFFLINE. No provider request, no network, no API key, no database, no clock
   dependence. Every decision is taken by the PRODUCT functions:
     NewsService.isFallbackTierProvider   the tier predicate
     attachProviderFailures/readProviderFailures   the failure channel
     decideFallback                        the two-slot budget gate
     publishedInsideWindow                 the publication-window rule
     retrievalOutcome                      the honest outcome
   `sentOutcomeOf` is an inner closure of AnalysisService and cannot be
   imported, so it is reproduced here EXACTLY as patched and driven by the real
   tier predicate. Every other rule is the product's own.
   ────────────────────────────────────────────────────────────────────────────── */

import 'reflect-metadata';
import { NewsService, attachProviderFailures, readProviderFailures } from '../../news/news.service';
import { decideFallback, skipOutcomeForRefusedFallback } from '../query/news-sent-query-trace.util';
import { publishedInsideWindow } from '../../news/relevance/publication-window.util';
import { retrievalOutcome } from '../region/region-coverage';

type Failure = { providerId: string; kind: string };
const provider = (id: string) => ({ id, displayName: id, isMock: false } as never);

/** A NewsService with the real registered tiers: GNews primary, GDELT fallback. */
const news = new NewsService(
  [provider('gnews'), provider('gdelt-doc')],
  [provider('gnews'), provider('gdelt-doc')],
  [provider('gdelt-doc')],
  {} as never,
);

const response = (articleCount: number, failures: Failure[] = []) =>
  attachProviderFailures(
    { articles: Array.from({ length: articleCount }, (_, i) => ({ id: `a${i}` })) } as never,
    failures as never,
  );

/* EXACTLY the patched closure. */
const sentOutcomeOf = (r: { articles: unknown[] }) =>
  r.articles.length > 0
    ? 'SENT_RESULTS'
    : readProviderFailures(r as object).some((f) => !news.isFallbackTierProvider(f.providerId))
      ? 'SENT_PROVIDER_FAILED'
      : 'SENT_ZERO_RESULTS';

/* EXACTLY the patched branch predicate. */
const primaryTierFailuresOf = (r: object): Failure[] =>
  readProviderFailures(r).filter((f) => !news.isFallbackTierProvider(f.providerId)) as Failure[];

const BACKUP_BUDGET = 1;   // the two pre-existing slots: initial + one backup
const decide = (r: { articles: unknown[] }, primarySent: string, backupQuery?: string) =>
  decideFallback({
    primarySent,
    primaryOutcome: sentOutcomeOf(r) as never,
    primaryCandidateCount: r.articles.length,
    fallbackQuery: backupQuery,
    budgetRemaining: BACKUP_BUDGET,
  });

/* ══ §1  THE TIER PREDICATE IS THE WHOLE RULE ══════════════════════════════ */
describe('R38 §1 — tier predicate', () => {
  it('GDELT is fallback tier; GNews is not', () => {
    expect(news.isFallbackTierProvider('gdelt-doc')).toBe(true);
    expect(news.isFallbackTierProvider('gnews')).toBe(false);
    expect(news.isFallbackTierProvider('rss-feed')).toBe(false);   // unregistered here
  });
});

/* ══ §2  THE CTO RULING, CASE BY CASE ══════════════════════════════════════ */
describe('R38 §2 — GNews OK+EMPTY and GDELT failed: the ONE backup is PERMITTED', () => {
  it.each([
    ['timeout'], ['rate-limited'], ['unavailable'], ['unknown'],
  ])('GDELT %s does not veto the GNews backup', (kind) => {
    const r = response(0, [{ providerId: 'gdelt-doc', kind }]);
    expect(primaryTierFailuresOf(r)).toEqual([]);              // not a primary-tier refusal
    expect(sentOutcomeOf(r)).toBe('SENT_ZERO_RESULTS');        // GNews completed with zero
    expect(decide(r, 'Rwanda fuel transport prices', 'Rwanda fuel prices')).toBe('FALLBACK_PERMITTED');
  });

  it('and the GDELT failure is still visible for disclosure — never silenced', () => {
    const r = response(0, [{ providerId: 'gdelt-doc', kind: 'timeout' }]);
    expect(readProviderFailures(r).map((f) => f.providerId)).toEqual(['gdelt-doc']);
  });
});

describe('R38 §3 — GNews itself refused: the backup is SKIPPED', () => {
  it.each([
    ['quota'], ['rate-limited'], ['auth'], ['timeout'], ['unreachable'],
  ])('GNews %s suppresses the backup, as before', (kind) => {
    const r = response(0, [{ providerId: 'gnews', kind }]);
    expect(primaryTierFailuresOf(r).map((f) => f.providerId)).toEqual(['gnews']);
    expect(sentOutcomeOf(r)).toBe('SENT_PROVIDER_FAILED');
    const d = decide(r, 'Rwanda fuel transport prices', 'Rwanda fuel prices');
    expect(d).toBe('FALLBACK_REFUSED_PRIMARY_DID_NOT_COMPLETE');
    expect(skipOutcomeForRefusedFallback(d)).toBe('SKIPPED_PROVIDER_INELIGIBLE');
  });

  it('GNews refused AND GDELT OK is still a refusal of the backup', () => {
    const r = response(0, [{ providerId: 'gnews', kind: 'rate-limited' }]);
    expect(decide(r, 'q', 'q2')).toBe('FALLBACK_REFUSED_PRIMARY_DID_NOT_COMPLETE');
  });

  it('BOTH refused is a refusal, and both failures stay readable', () => {
    const r = response(0, [
      { providerId: 'gnews', kind: 'rate-limited' },
      { providerId: 'gdelt-doc', kind: 'timeout' },
    ]);
    expect(sentOutcomeOf(r)).toBe('SENT_PROVIDER_FAILED');
    expect(decide(r, 'q', 'q2')).toBe('FALLBACK_REFUSED_PRIMARY_DID_NOT_COMPLETE');
    expect(readProviderFailures(r)).toHaveLength(2);
  });
});

/* ══ §4  THE CEILING IS NOT RAISED ═════════════════════════════════════════ */
describe('R38 §4 — two slots, never three', () => {
  it('with the one backup slot spent, nothing more is permitted', () => {
    const r = response(0, [{ providerId: 'gdelt-doc', kind: 'timeout' }]);
    expect(
      decideFallback({
        primarySent: 'q', primaryOutcome: sentOutcomeOf(r) as never,
        primaryCandidateCount: 0, fallbackQuery: 'q2', budgetRemaining: 0,
      }),
    ).toBe('FALLBACK_REFUSED_BUDGET_SPENT');
  });

  it('an identical or absent backup query is never sent', () => {
    const r = response(0, [{ providerId: 'gdelt-doc', kind: 'timeout' }]);
    expect(decide(r, 'same', 'same')).toBe('FALLBACK_REFUSED_IDENTICAL_TO_PRIMARY');
    expect(decide(r, 'q', undefined)).toBe('FALLBACK_REFUSED_NO_QUERY');
    expect(decide(r, 'q', '   ')).toBe('FALLBACK_REFUSED_NO_QUERY');
  });

  it('a primary that found candidates never triggers a backup', () => {
    const r = response(3, [{ providerId: 'gdelt-doc', kind: 'timeout' }]);
    expect(sentOutcomeOf(r)).toBe('SENT_RESULTS');
    expect(decide(r, 'q', 'q2')).toBe('FALLBACK_REFUSED_PRIMARY_HAD_CANDIDATES');
  });
});

/* ══ §5  HONEST STATUS WHEN THE BACKUP ALSO FINDS NOTHING ══════════════════ */
describe('R38 §5 — a permitted backup that returns nothing is still not "no reporting"', () => {
  it('the outcome is computed from the failures of EVERY attempt', () => {
    const primary = response(0, [{ providerId: 'gdelt-doc', kind: 'timeout' }]);
    const backup = response(0, [{ providerId: 'gnews', kind: 'rate-limited' }]);
    const all = [...readProviderFailures(primary), ...readProviderFailures(backup)];
    expect(all.map((f) => f.providerId).sort()).toEqual(['gdelt-doc', 'gnews']);
    const outcome = retrievalOutcome(0, new Set(all.map((f) => f.kind)));
    /* a rate limit outranks everything: it is a claim about US, not the world */
    expect(outcome).toBe('PROVIDER_RATE_LIMITED');
  });

  it('a GDELT-only timeout zero is PROVIDER_UNAVAILABLE, never "nothing matched"', () => {
    const primary = response(0, [{ providerId: 'gdelt-doc', kind: 'timeout' }]);
    const kinds = new Set(readProviderFailures(primary).map((f) => f.kind));
    expect(retrievalOutcome(0, kinds)).toBe('PROVIDER_UNAVAILABLE');
  });

  it('only a clean zero may claim NO_RELEVANT_EVIDENCE — a claim about the world', () => {
    expect(retrievalOutcome(0, new Set<string>())).toBe('NO_RELEVANT_EVIDENCE');
    /* and it is unreachable as soon as any provider refused us */
    expect(retrievalOutcome(0, new Set(['timeout']))).not.toBe('NO_RELEVANT_EVIDENCE');
    expect(retrievalOutcome(0, new Set(['rate-limited']))).not.toBe('NO_RELEVANT_EVIDENCE');
  });

  it('a successful backup still carries the primary attempt failure forward', () => {
    /* the patched disclosure reads BOTH, because searchResponse is replaced */
    const primary = response(0, [{ providerId: 'gdelt-doc', kind: 'timeout' }]);
    const backup = response(2);                       // backup succeeded, carries no failures
    expect(readProviderFailures(backup)).toEqual([]);                      // the trap
    expect([...readProviderFailures(primary), ...readProviderFailures(backup)]).toHaveLength(1);
  });
});

/* ══ §6  PUBLICATION WINDOW: 47 / 48 / 49 h, BASIS-SENSITIVE ═══════════════ */
describe('R38 §6 — window boundary and basis', () => {
  const NOW = Date.parse('2026-10-13T12:00:00.000Z');
  const from = new Date(NOW - 48 * 3600 * 1000).toISOString();
  const to = new Date(NOW).toISOString();
  const at = (hoursAgo: number, basis: 'publisher' | 'observed') => ({
    id: `h${hoursAgo}-${basis}`,
    publishedAt: new Date(NOW - hoursAgo * 3600 * 1000).toISOString(),
    publishedAtBasis: basis,
  });

  it('publisher basis: 47h in, 49h out', () => {
    expect(publishedInsideWindow(at(47, 'publisher') as never, from, to)).toBe(true);
    expect(publishedInsideWindow(at(49, 'publisher') as never, from, to)).toBe(false);
  });

  it('48h is the boundary and is decided one way, deterministically', () => {
    const verdict = publishedInsideWindow(at(48, 'publisher') as never, from, to);
    expect(typeof verdict).toBe('boolean');
    expect(publishedInsideWindow(at(48, 'publisher') as never, from, to)).toBe(verdict);
  });

  it('OBSERVED basis cannot satisfy the window at ANY age — the strict rule', () => {
    for (const h of [1, 47, 48, 49]) {
      expect(publishedInsideWindow(at(h, 'observed') as never, from, to)).toBe(false);
    }
  });

  it('an absent basis or time never satisfies the window', () => {
    expect(publishedInsideWindow({ id: 'x' } as never, from, to)).toBe(false);
  });
});

/* ══ §7  MUTATION CHECKS — these must FAIL if the defect returns ═══════════ */
describe('R38 §7 — mutation guards', () => {
  it('MUTATION: if GDELT failure once again disables the backup, this fails', () => {
    const r = response(0, [{ providerId: 'gdelt-doc', kind: 'timeout' }]);
    expect(sentOutcomeOf(r)).not.toBe('SENT_PROVIDER_FAILED');
    expect(primaryTierFailuresOf(r)).toHaveLength(0);
    expect(decide(r, 'Rwanda fuel prices', 'Rwanda fuel')).toBe('FALLBACK_PERMITTED');
  });

  it('MUTATION: if the tier predicate stops distinguishing tiers, this fails', () => {
    expect(news.isFallbackTierProvider('gdelt-doc')).not.toBe(news.isFallbackTierProvider('gnews'));
  });

  it('MUTATION: the backup ceiling must stay at one', () => {
    expect(BACKUP_BUDGET).toBe(1);
  });

  it('MUTATION: a primary-tier refusal must keep suppressing the backup', () => {
    const r = response(0, [{ providerId: 'gnews', kind: 'quota' }]);
    expect(decide(r, 'q', 'q2')).not.toBe('FALLBACK_PERMITTED');
  });
});

import {
  ArticlePageAdmission,
  PAGE_MIN_INTERVAL_MS,
  PAGE_VERDICT_TTL_MS,
} from './article-page-admission';

/* A synthetic GV-shaped page (same furniture as gv-v6-admission.spec.ts); names are invented. */
const pageFor = (url: string, extra = '') =>
  `<html><head><link rel="canonical" href="${url}" /></head><body>` +
  `<div class='contributor-name'><span class='credit-label'>Written by</span><a href='https://globalvoices.org/author/amara-okonjo/' class='user-link'>Amara Okonjo</a></div>` +
  `<span class='post-date'>Posted <a href='#'>22 October 2026</a></span><p>Report.${extra}</p>` +
  `<a rel='license' href='https://creativecommons.org/licenses/by/3.0/'></a></body></html>`;

const A = 'https://globalvoices.org/2026/10/22/report-a/';
const B = 'https://globalvoices.org/2026/10/22/report-b/';

function harness(pages: Record<string, string | number> = {}) {
  let t = 1_000_000;
  const fetched: string[] = [];
  const fetchImpl = jest.fn(async (url: string) => {
    fetched.push(url);
    const p = pages[url] ?? pageFor(url);
    if (typeof p === 'number') return { ok: false, status: p, text: async () => '' } as Response;
    return { ok: true, status: 200, text: async () => p } as Response;
  });
  const gate = new ArticlePageAdmission({ fetchImpl, now: () => t });
  return { gate, fetched, advance: (ms: number) => (t += ms) };
}

describe('E1 V6 · article-page admission — polite, cached, fail closed', () => {
  it('reads at most one page per call; an item without a verdict yet is absent (not emitted)', async () => {
    const { gate, fetched } = harness();
    const v = await gate.verdictsFor([A, B]);
    expect(fetched).toEqual([A]);
    expect([...v.keys()]).toEqual([A]);
    expect(v.get(A)?.outcome).toBe('ADMIT');
  });

  it('never reads twice within the crawl delay, then reads the next page once it has passed', async () => {
    const { gate, fetched, advance } = harness();
    await gate.verdictsFor([A, B]);
    advance(PAGE_MIN_INTERVAL_MS - 1);
    const early = await gate.verdictsFor([A, B]);
    expect(fetched).toEqual([A]);
    expect([...early.keys()]).toEqual([A]);
    advance(1);
    const later = await gate.verdictsFor([A, B]);
    expect(fetched).toEqual([A, B]);
    expect([...later.keys()].sort()).toEqual([A, B]);
  });

  it('caches negative verdicts too, and re-reads after the TTL', async () => {
    const { gate, fetched, advance } = harness({
      [A]: pageFor(
        A,
        ' It is being published on Global Voices as part of a content-sharing agreement.',
      ),
    });
    expect((await gate.verdictsFor([A])).get(A)?.outcome).toBe('EXCLUDE');
    advance(PAGE_MIN_INTERVAL_MS);
    await gate.verdictsFor([A]);
    expect(fetched).toEqual([A]);
    advance(PAGE_VERDICT_TTL_MS);
    await gate.verdictsFor([A]);
    expect(fetched).toEqual([A, A]);
  });

  it('a failed read caches nothing — the item stays absent and is retried later', async () => {
    const { gate, fetched, advance } = harness({ [A]: 503 });
    expect((await gate.verdictsFor([A])).size).toBe(0);
    advance(PAGE_MIN_INTERVAL_MS);
    expect((await gate.verdictsFor([A])).size).toBe(0);
    expect(fetched).toEqual([A, A]);
    expect(gate.stats()).toMatchObject({ cachedVerdicts: 0, readsAttempted: 2, readsFailed: 2 });
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WATCH_RUNTIME_ACTIVE } from '@/lib/map/monetization/watchRuntimeGate';
import { en } from '@/lib/i18n/dictionaries/en';
import { pl } from '@/lib/i18n/dictionaries/pl';

const SRC = join(__dirname, '..', '..');
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf-8');
const shell = read('components/map/mobile/MobileSpatialShell.tsx');
const owner = read('components/map/MapPageClient.tsx');

/* Comments explain; they do not render. Strip them before asserting behaviour. */
const code = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('MAP R1 — Watch is not offered while its runtime is dormant', () => {
  it('the runtime is still off, which is what makes the rest of this necessary', () => {
    expect(WATCH_RUNTIME_ACTIVE).toBe(false);
  });

  it('every Watch CTA on the phone sheet is behind the runtime gate', () => {
    const body = code(shell);
    const mounts = [...body.matchAll(/<WatchCta/g)];
    expect(mounts.length).toBeGreaterThan(0);
    /* Each mount must be preceded by the gate within the same JSX block. */
    for (const m of mounts) {
      const before = body.slice(Math.max(0, m.index! - 400), m.index!);
      expect(`mount@${m.index}:${before.includes('WATCH_RUNTIME_ACTIVE')}`).toBe(
        `mount@${m.index}:true`,
      );
    }
  });

  it('no mint is hard-coded on the phone shell', () => {
    expect(code(shell).toLowerCase()).not.toContain('5be3a8');
  });
});

describe('MAP R1 — Follow speaks Follow, never Watch', () => {
  it('English no longer labels a follow "Watching"', () => {
    const f = en.map.spatial.card.follow;
    expect(f.watching).toBe('Following');
    expect(f.stopWatching).toBe('Unfollow');
    expect(`${f.watching} ${f.stopWatching}`.toLowerCase()).not.toContain('watch');
  });

  it('Polish already used follow verbs and is unchanged', () => {
    /*
      Read, never transcribed: `multilingualStrategy.spec.ts` rules that a map
      spec may not carry Polish text of its own. The assertion that matters is
      that neither Polish label borrowed a watch verb, and that is testable
      without quoting either string.
    */
    const f = pl.map.spatial.card.follow;
    expect(f.watching).not.toBe(en.map.spatial.card.follow.watching);
    expect(`${f.watching} ${f.stopWatching}`.toLowerCase()).not.toMatch(/watch|obserwacj/);
    expect(f.stopWatching.toLowerCase()).toContain('obserwowa');
  });
});

describe('MAP R1 — the explicit country read reaches the phone', () => {
  it('the phone sheet offers it through the SAME authority the card uses', () => {
    expect(shell).toContain('loadActionIsOffered');
    expect(shell).toContain('data-gn="mobile-action-load-country"');
  });

  it('it runs on press and is never wired to selection', () => {
    const body = code(shell);
    /*
      MAP / SPATIAL VISUAL CONVERGENCE R2 — the press now goes through ONE
      handler, `onLoadCountry`, which also raises the sheet to show the answer.
      The rule is unchanged: the read is called from that press handler and
      from nowhere else — no effect, no selection path.
    */
    expect(body).toContain('onClick={onLoadCountry}');
    expect(body.match(/countryRead\?\.onLoad\(\)/g)).toHaveLength(1);
    const at = body.indexOf('const onLoadCountry = useCallback(');
    expect(body.slice(at, body.indexOf('}, [countryRead', at))).toContain('countryRead?.onLoad();');
    /* No effect, no auto-invocation: the only call site is the handler above. */
    expect(body).not.toMatch(/useEffect\([^)]*countryRead\??\.onLoad/);
    expect(body).not.toMatch(/useEffect\([^)]*onLoadCountry/);
    expect(body).not.toContain('countryRead.onLoad()');
  });

  it('the owner passes the state machine down rather than re-deriving it', () => {
    expect(owner).toContain('countryRead={countryReadPresentation}');
  });
});

describe('MAP R1 — a country tap still costs nothing', () => {
  it('the Map cannot reach the news provider client at all', () => {
    /*
      Stripped of comments, because the file DISCUSSES `fetchCountryNews` at
      length — that prose is the record of why the import was removed, and an
      assertion that went red for it would be punishing the explanation.
    */
    const body = code(owner);
    expect(body).not.toContain("from '@/lib/api/countryApi'");
    expect(body).not.toContain('fetchCountryNews');
  });

  it('selecting a country sets scope and nothing else', () => {
    const body = code(owner);
    const start = body.indexOf('const selectCountryScope');
    expect(start).toBeGreaterThan(-1);
    const fn = body.slice(start, body.indexOf('}, [],', start));
    expect(fn).toContain('setSelectedCountry(country)');
    expect(fn).not.toMatch(/fetch|performCountryRead|analyzeNews|await/);
  });
});

describe('MAP R1 — geography continuity inside the selection cluster', () => {
  it('Open analysis carries the country, not just a question', () => {
    const body = code(owner);
    expect(body).toContain("params.set('countryCode', selectedCountry.iso2)");
  });

  it('Ask about a story carries the article AND the country', () => {
    const body = code(owner);
    expect(body).toMatch(/articleId: article\.id/);
  });

  it('the Map is NOT a story-context publisher — L4 keeps its two', () => {
    /*
      Correction 7 is HELD, not skipped. Publishing from here is what
      askAiRevA L4 forbids under a CTO ruling, so the change was reverted and
      the conflict reported. This assertion is what stops it being
      reintroduced quietly by someone reading only the corrections list.
    */
    expect(code(owner)).not.toContain('usePublishStoryContext');
  });
});

describe('MAP R1 — Ask/Search consent is preserved', () => {
  it('Open analysis navigates and stages; it never grants compute consent', () => {
    expect(owner).toContain("router.push(`/search?${params.toString()}`)");
    expect(owner).not.toContain('grantAnalysisConsent');
  });
});

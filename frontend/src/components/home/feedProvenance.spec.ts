import { readFileSync } from 'fs';
import { join } from 'path';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { resolveLiveStatus } from '@/lib/liveStatus';

/**
 * M66.13 — DATA-PROVENANCE INTEGRITY.
 *
 * THE DEFECT THIS LOCKS OUT. The homepage showed `DEMO MODE · SAMPLE CONTENT
 * ONLY` in the DATA STATUS row and, six centimetres away, a pulsing amber `LIVE`
 * over the same MockNewsProvider articles. Two surfaces made provenance claims
 * about one fetch; only one of them was wired to the provenance model. The feed
 * panel received articles but not dataMode, so its heading was a static label
 * and its live cue was gated on `hasArticles` — and sample content has articles.
 *
 * THE RULE, from shared/src/news.ts and reaffirmed by the M66.13 authorization:
 * mock/sample, cached and unavailable content must NEVER be presented as live
 * reporting. Genuine live signalling must survive.
 *
 * SCOPE NOTE (CTO decision D). This file governs PROVENANCE CLAIMS only — the
 * status heading and the pulsing status dot. The panel's amber sweep, amber rule
 * and row-scan animation are its motion identity, not a liveness assertion, and
 * they are asserted below to keep running in every state.
 */

const SRC = join(__dirname, '..', '..');

function read(relative: string): string {
  return readFileSync(join(SRC, relative), 'utf-8');
}

function stripComments(text: string): string {
  return text
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const panelSource = read('components/home/HeroLiveFeedPanel.tsx');
const panelCode = stripComments(panelSource);
const heroSource = read('components/home/Hero.tsx');
const heroCode = stripComments(heroSource);
const stripSource = read('components/home/LiveStatusStrip.tsx');
const liveStatusSource = read('lib/liveStatus.ts');

const UPDATED_AT = '2026-08-20T15:09:00.000Z';

describe('M66.13 — the feed panel derives liveness from the authoritative model', () => {
  it('receives statusKey as a prop and does not compute provenance itself', () => {
    expect(panelCode).toMatch(/statusKey: LiveStatusKey;/);
    expect(panelCode).toMatch(/statusKey,/);
    // It must not be handed the raw inputs and left to re-derive the answer.
    expect(panelCode).not.toMatch(/dataMode/);
    expect(panelCode).not.toMatch(/isLive[^F]/);
    expect(panelCode).not.toMatch(/resolveLiveStatus/);
  });

  it('Hero passes the value the shared resolver already returns', () => {
    expect(heroCode).toMatch(/const \{ isReallyLive, statusKey, badgeText, lastUpdated \} = resolveLiveStatus\(/);
    expect(heroCode).toMatch(/statusKey=\{statusKey\}/);
  });

  it('THE CORE RULE — the amber live cue is gated on live status, never on article count', () => {
    expect(panelCode).toMatch(/const isLiveFeed = statusKey === 'live';/);
    expect(panelCode).toMatch(/\{isLiveFeed && \(/);
    // `articles.length` measures how much came back, not where it came from.
    expect(panelCode).not.toMatch(/hasArticles && \(\s*<span[^>]*animate-cd-amber-dot/);
    expect(panelCode).not.toMatch(/articles\.length > 0 &&\s*<span[^>]*amber-dot/);
  });

  it('the status heading is state-resolved and covers every state the resolver can return', () => {
    for (const key of ['live', 'cached', 'mock', 'unavailable', 'reconnecting']) {
      expect(panelCode).toContain(`statusKey === '${key}'`);
    }
    expect(panelCode).toMatch(/const statusHeading =/);
    expect(panelCode).toMatch(/\{statusHeading\}/);
  });

  it('non-live states reuse the SAME vocabulary as the DATA STATUS row — one wording, not two', () => {
    expect(panelCode).toMatch(/getDictionary\(language\)\.liveStatusStrip/);
    for (const key of ['status.cached', 'status.mock', 'status.unavailable', 'status.unknown']) {
      expect(panelCode).toContain(key);
    }
    // And the live heading is still the released one, so the true state is unchanged.
    expect(panelCode).toMatch(/t\.feedPanelHeading/);
  });
});

describe('M66.13 — mock, cached and unavailable can never read as live', () => {
  const cases = [
    { isLive: true, dataMode: 'mock' as const, expected: 'mock' },
    { isLive: true, dataMode: 'cached' as const, expected: 'cached' },
    { isLive: true, dataMode: 'unavailable' as const, expected: 'unavailable' },
    { isLive: false, dataMode: null, expected: 'reconnecting' },
    { isLive: true, dataMode: null, expected: 'unknown' },
  ];

  it('every non-live state resolves to its own key and reports isReallyLive false', () => {
    for (const { isLive, dataMode, expected } of cases) {
      const result = resolveLiveStatus(isLive, dataMode, 'en', UPDATED_AT);
      // The object form makes a failure name the offending case instead of just
      // reporting a mismatched string.
      expect({ dataMode, statusKey: result.statusKey }).toEqual({ dataMode, statusKey: expected });
      expect({ dataMode, live: result.isReallyLive }).toEqual({ dataMode, live: false });
    }
  });

  it('genuine live state is preserved — the fix does not silence the real signal', () => {
    const result = resolveLiveStatus(true, 'live', 'en', UPDATED_AT);
    expect(result.statusKey).toBe('live');
    expect(result.isReallyLive).toBe(true);
  });

  it('every state the panel can be handed has a real, localized heading in both languages', () => {
    for (const language of ['en', 'pl'] as const) {
      const status = getDictionary(language).liveStatusStrip;
      const hero = getDictionary(language).hero;
      for (const value of [
        hero.feedPanelHeading,
        status.cached,
        status.mock,
        status.unavailable,
        status.reconnecting,
        status.unknown,
      ]) {
        expect(value.length).toBeGreaterThan(0);
      }
    }
    // Genuinely translated, not an English fallback sitting in the Polish file.
    expect(getDictionary('pl').liveStatusStrip.unavailable).not.toBe(
      getDictionary('en').liveStatusStrip.unavailable,
    );
  });
});

describe('M66.13 — exactly one provenance model', () => {
  it('resolveLiveStatus is the only place dataMode becomes a user-facing status', () => {
    // Both presentations call the shared resolver; neither re-implements it.
    expect(heroSource).toMatch(/resolveLiveStatus\(/);
    expect(stripSource).toMatch(/resolveLiveStatus\(/);
    expect(panelCode).not.toMatch(/dataMode === /);
    expect(stripComments(stripSource)).not.toMatch(/dataMode === 'live'/);
  });

  it('isReallyLive stays conjunctive, so a successful fetch of non-live data is never live', () => {
    expect(liveStatusSource).toMatch(/const isReallyLive = isLive && dataMode === 'live';/);
  });

  it('all four NewsDataMode members now map to their own state', () => {
    // `unavailable` used to collapse into `unknown`. shared/src/news.ts
    // distinguishes them: only `unavailable` guarantees no reporting exists.
    for (const key of ["'live'", "'cached'", "'mock'", "'unavailable'"]) {
      expect(liveStatusSource).toContain(`dataMode === ${key}`);
    }
    // Asserted member by member rather than as one formatted line, so a
    // prettier reflow of the union cannot fail a contract about its contents.
    const union = /export type LiveStatusKey =([\s\S]*?);/.exec(liveStatusSource)?.[1] ?? '';
    for (const member of ['live', 'cached', 'mock', 'unavailable', 'reconnecting', 'unknown']) {
      expect({ member, present: union.includes(`'${member}'`) }).toEqual({ member, present: true });
    }
  });

  it('no new fetch, route, API call or storage was introduced by the repair', () => {
    for (const code of [panelCode, heroCode]) {
      expect(code).not.toMatch(/\bfetch\(|axios|localStorage|sessionStorage/);
    }
  });
});

describe('M66.13 — CTO decision D: story movement survives the provenance fix', () => {
  it('the amber sweep, rule and row scan are untouched and run in every state', () => {
    // These are the panel's motion identity, not a liveness claim. They must NOT
    // have been removed merely to remove a false LIVE badge.
    expect(panelCode).toMatch(/animate-cd-feed-sweep/);
    expect(panelCode).toMatch(/shadow-cd-sweep-glow/);
    expect(panelCode).toMatch(/border-cd-edge-amber/);
    // The row scan is still a formula, per GN-CD-304 §V.
    expect(panelCode).toMatch(/2\.1/);
    // And none of them is gated on provenance.
    expect(panelCode).not.toMatch(/isLiveFeed && \(\s*<div[^>]*animate-cd-feed-sweep/);
  });

  it('the panel still renders in every state and never disappears', () => {
    expect(panelCode).toMatch(/hasArticles \? \(/);
    expect(panelCode).not.toMatch(/isLiveFeed \? \(\s*<ul/);
  });
});

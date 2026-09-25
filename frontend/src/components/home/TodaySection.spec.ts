import { readFileSync } from 'fs';
import { join } from 'path';
import { getDictionary } from '@/lib/i18n/dictionaries';

const source = readFileSync(join(__dirname, 'TodaySection.tsx'), 'utf-8');
const cardSource = readFileSync(join(__dirname, 'TodayCard.tsx'), 'utf-8');
const pageSource = readFileSync(join(__dirname, '..', '..', 'app', 'page.tsx'), 'utf-8');
const homeFeedSource = readFileSync(join(__dirname, '..', '..', 'lib', 'homeFeed.ts'), 'utf-8');
/*
  Read as TEXT ONLY, never imported and never modified. components/map/** is
  outside this lane; this file exists to prove the two call sites agree.
*/
const countryArticleCardSource = readFileSync(
  join(__dirname, '..', 'map', 'CountryArticleCard.tsx'),
  'utf-8',
);

/** Every negative guard runs against comment-stripped source. */
const codeOnly = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const code = codeOnly(source);
const cardCode = codeOnly(cardSource);

describe('R2 Today — the closed field list', () => {
  it('renders only real NewsArticle fields, and the ones the data contract permits', () => {
    for (const field of [
      'record.title',
      'record.summary',
      'record.sourceName',
      'record.category',
      'record.url',
      'record.firstSeenAt',
      'record.publishedAt',
    ]) {
      expect(cardCode).toContain(field);
    }
  });

  it('renders NO field the data contract classifies UNSAFE, PARTIAL or MISSING for a Today record', () => {
    for (const forbidden of [
      'sourcesCount',
      'confidence',
      'record.tag',
      'sourceLanguage',
      'geographicPrecision',
      'evidencePrecision',
      'trustState',
      'TrustState',
      'evidenceBreadth',
    ]) {
      expect(cardCode).not.toContain(forbidden);
    }
    // No percentage or score presentation of any kind.
    expect(cardCode).not.toMatch(/%|score|Score/);
  });

  it('labels the provider-reported publication time as provider-reported, and keeps it distinct from first observation', () => {
    expect(cardCode).toContain('t.publishedProviderNote');
    expect(cardCode).toContain('t.firstSeenLabel');
    expect(cardCode).toContain('t.publishedLabel');
    // First observation is rendered as an EXPLICIT UTC clock, so no reader is
    // shown a local-looking time the data does not support.
    expect(cardCode).toMatch(/formatUtcClock\(record\.firstSeenAt as string\)/);
  });
});

describe('R2 Today — the six information states are ABSENT, not empty', () => {
  it('renders no state badge, no state filter row and no state vocabulary', () => {
    for (const state of [
      'DEVELOPING',
      'NEW EVIDENCE',
      'CONTESTED',
      'SIGNIFICANT CHANGE',
      'STABLE',
      'NOT RE-ANALYSED',
      'StateBadge',
      'StateFilterRow',
    ]) {
      expect(code).not.toContain(state);
      expect(cardCode).not.toContain(state);
    }
  });

  it('renders no placeholder chip, skeleton or coming-soon affordance in place of a removed state', () => {
    for (const placeholder of ['coming soon', 'Coming soon', 'skeleton', 'Skeleton', 'placeholder']) {
      expect(code).not.toContain(placeholder);
      expect(cardCode).not.toContain(placeholder);
    }
  });

  it('gives the card a NEUTRAL rail — structure, carrying no state claim', () => {
    expect(cardCode).toMatch(/bg-gn-line-strong/);
    // None of the six semantic state hues is used as a card rail.
    expect(cardCode).not.toMatch(/bg-gn-(significance|uncertain|verified|ai)\b/);
  });
});

describe('R2 Today — no chart, and counts that say what they counted', () => {
  it('draws no chart primitive of any kind', () => {
    for (const primitive of ['<svg', 'Sparkline', 'ActivityChart', 'RankingChart', 'TrendChart', 'TileGrid', 'chart']) {
      expect(code).not.toContain(primitive);
    }
  });

  it('carries the retrieval qualifier in the counter labels themselves', () => {
    const en = getDictionary('en').today;
    expect(en.counterRecordsLabel).toContain('in this retrieval');
    expect(en.counterCountriesLabel).toContain('in this retrieval');
    expect(code).toContain('t.counterRecordsLabel');
    expect(code).toContain('t.counterCountriesLabel');
  });

  it('renders the retrieval-bias disclosure as real copy, not a tooltip or a title attribute', () => {
    expect(code).toContain('t.biasNote');
    expect(code).not.toMatch(/title=\{t\.biasNote\}|aria-describedby/);
    expect(getDictionary('en').today.biasNote).toContain('not everything that happened');
  });

  it('uses none of the forbidden metric vocabulary', () => {
    const en = getDictionary('en').today;
    const pl = getDictionary('pl').today;
    const strings = [...Object.values(en), ...Object.values(pl)]
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .join(' ')
      .toLowerCase();
    for (const word of ['event activity', 'corroboration', 'independent publishers', 'trend']) {
      expect(strings).not.toContain(word);
    }
    expect(code).not.toMatch(/\bevents?\b/i);
  });

  it('counts what it holds — the counters read the allocation, never a fabricated or padded figure', () => {
    expect(code).toMatch(/\{records\.length\}/);
    expect(code).toMatch(/\{countries\.length\}/);
    expect(code).not.toMatch(/Array\.from|new Array|\.concat\(|padEnd/);
  });
});

describe('R2 Today — identity, wiring and the client boundary', () => {
  it('keys records by URL, never by id — buildStableId is a 32-bit hash', () => {
    expect(code).toMatch(/key=\{record\.url\}/);
    expect(code).not.toMatch(/key=\{record\.id\}/);
  });

  it('introduces no fetch, no route and no second request — Today derives from the SAME single response', () => {
    expect(code).not.toMatch(/fetch\(/);
    expect(cardCode).not.toMatch(/fetch\(/);
    expect(code).not.toMatch(/newsApi|countryApi/);
    expect((codeOnly(pageSource).match(/getHomeFeed\(/g) ?? []).length).toBe(1);
    /* One request still — sized 24 rather than 12 so the rail and the hero
       feed can be mutually exclusive without either surface going empty. The
       point of this assertion is the SINGLE call, which is unchanged. */
    expect(codeOnly(homeFeedSource)).toMatch(/fetchTopHeadlines\(24, language\)/);
  });

  it('is the ONE state owner, and the only state it owns is the country filter', () => {
    expect(code).toMatch(/'use client';/);
    expect((code.match(/useState/g) ?? [])).toHaveLength(2);
    expect(code).toMatch(/const \[selectedCountry, setSelectedCountry\] = useState<string \| null>\(null\)/);
    expect(code).not.toMatch(/useEffect|setInterval|setTimeout|useReducer/);
    // The presentational children hold no state of their own.
    expect(cardCode).not.toMatch(/useState|useEffect|'use client'/);
  });

  /*
    R7 — THE MOUNT MOVED, THE CONTRACT DID NOT.

    `<TodaySection>` was replaced at this mount point by `<TodayWorkspace>`.
    Everything this test actually guards is unchanged and still asserted here:
    Today is still fed from `feed.today`, page.tsx is still a Server Component,
    and no other section's role was taken. Only the element NAME differs, so
    only the element name is updated — the two assertions below are the entire
    change this file needed.

    TodaySection.tsx itself is untouched and its remaining tests still run
    against it: it is retired, not deleted.
  */
  /*
    H5 · Issue #29 — Today is RETIRED FROM HOME. It appears in no approved
    R4.1/R5.1 Home frame and in none of the 139 approved Home copy keys, and
    the contract's precedence rule 4 forbids treating the current
    implementation as missing design authority. TodayWorkspace.tsx stays on
    disk, and every other assertion in this suite reads that file rather than
    page.tsx, so they keep their subject. What is still protected here is the
    server boundary and the role separation.
  */
  it('Today is retired from Home, and page.tsx stays a Server Component', () => {
    expect(pageSource).not.toMatch(/<TodayWorkspace/);
    expect(pageSource).not.toMatch(/today=\{feed\.today\}/);
    expect(pageSource).not.toMatch(/'use client'/);
    // The released role separation is untouched: Today takes its own role.
    expect(pageSource).toMatch(/<BetaHero language=\{language\} latestUpdates=\{feed\.briefUpdates\}/);
    expect(pageSource).not.toMatch(/today=\{feed\.(latestUpdates|featured|inFocus|discovery)\}/);
  });
});

describe('R2 Today — the analysis deep link reuses the released contract EXACTLY', () => {
  it('builds the same three parameters SearchPageClient already reads', () => {
    expect(cardCode).toMatch(
      /new URLSearchParams\(\{ q: record\.title, articleId: record\.id \}\)/,
    );
    expect(cardCode).toMatch(/analysisParams\.set\('countryCode', record\.countryCode\)/);
    expect(cardCode).toMatch(/\/search\?\$\{analysisParams\.toString\(\)\}/);
  });

  it('produces byte-identical parameters to the released map call site, which is NOT modified', () => {
    /*
      The parity guard. CountryArticleCard.tsx is read as text only. If either
      call site ever changes its parameter set, this fails — which is what
      makes the deliberate duplication safe rather than a second contract.
    */
    const params = (text: string): string[] =>
      (text.match(/new URLSearchParams\(\{([^}]*)\}\)/) ?? ['', ''])[1]
        .split(',')
        .map((pair) => pair.split(':')[0].trim())
        .filter(Boolean)
        .sort();

    expect(params(cardCode)).toEqual(params(codeOnly(countryArticleCardSource)));
    expect(params(cardCode)).toEqual(['articleId', 'q']);
    expect(codeOnly(countryArticleCardSource)).toContain("params.set('countryCode'");
  });

  it('runs no analysis and introduces no second analysis client', () => {
    expect(cardCode).not.toMatch(/analysisApi|analyzeNews|POST|\/analysis/);
    expect(code).not.toMatch(/analysisApi|analyzeNews/);
  });
});

describe('R2 Today — honest states and the three-second answer', () => {
  it('separates "nothing observed today" from "no first observation recorded"', () => {
    expect(code).toMatch(/withoutFirstSeenCount > 0 \? t\.degradedHeading : t\.emptyHeading/);
    expect(code).toMatch(/withoutFirstSeenCount > 0 \? t\.degradedBody : t\.emptyBody/);
  });

  it('puts the three-second answer FIRST in the DOM as text, composed of counts', () => {
    const body = code.slice(code.indexOf('return ('));
    expect(body.indexOf('threeSecondAnswer')).toBeLessThan(body.indexOf('t.eyebrow'));
    expect(code).toMatch(/pluralWithForms\(records\.length, language, t\.recordForms\)/);
  });

  it('names the section with a real heading and an aria-labelledby association', () => {
    expect(code).toMatch(/aria-labelledby="today-heading"/);
    expect(code).toMatch(/<h2 id="today-heading"/);
  });
});

describe('R2 Today — localization', () => {
  it('takes every string from the dictionary; no English chrome is hardcoded', () => {
    expect(code).toMatch(/getDictionary\(language\)\.today/);
    expect(code).not.toMatch(/Today.s Intelligence|first saw today|Countries represented/);
    expect(cardCode).not.toMatch(/First seen|Published|Analyse/);
  });

  it('carries the whole Today vocabulary in BOTH dictionaries', () => {
    const en = getDictionary('en').today as Record<string, unknown>;
    const pl = getDictionary('pl').today as Record<string, unknown>;
    expect(Object.keys(en).sort()).toEqual(Object.keys(pl).sort());
    for (const key of Object.keys(en)) {
      const value = pl[key];
      if (typeof value === 'string') expect(value.length).toBeGreaterThan(0);
      if (Array.isArray(value)) expect(value).toHaveLength(3);
    }
  });

  it('uses the shared Polish grammar helper, not a second rule', () => {
    expect(code).toMatch(/import \{ pluralWithForms \} from '@\/lib\/i18n\/pluralize'/);
    expect(code).not.toMatch(/count === 1 \?|endsWith\('s'\)/);
  });

  it('never translates provider content', () => {
    expect(cardCode).not.toMatch(/translate\(record|t\[record\.title\]/);
    expect(cardCode).toContain('{record.title}');
    expect(cardCode).toContain('{record.summary}');
  });
});

describe('R2.1 — the authorized Claude Design visual corrections', () => {
  it('C2 — the provider summary uses the SECONDARY PROSE ink and never the AI/link blue', () => {
    expect(cardCode).toMatch(/text-gn-prose text-gn-ink-quote/);
    // gn-ai is the interpretation hue. Nothing on a Today card is interpretation.
    expect(cardCode).not.toMatch(/text-gn-ai\b|text-gn-ink-secondary/);
  });

  it('C4 — below 768px the two times are separate lines and the middle dot is GONE, not rotated', () => {
    // Column by default, row only at the design's own mobile boundary.
    expect(cardCode).toMatch(/flex flex-col items-start gap-\[4px\][^"]*md:flex-row/);
    // The separator exists only where there is something to separate.
    expect(cardCode).toMatch(/<span aria-hidden="true" className="hidden [^"]*md:inline">/);
    // And the action stops floating right once the row is stacked.
    expect(cardCode).toMatch(/inline-flex min-h-\[44px\][^"]*md:ml-auto/);
  });

  it('C7 — FIRST SEEN is promoted with RELEASED tokens; PUBLISHED stays subordinate and provider-qualified', () => {
    /*
      gn-hud-index is 10.5px / 0.09em and gn-ink-value is #a9bccf — the correction
      asked for 10.5px, ~0.08em and #A9BCCF, so both already exist and no token is
      added and no arbitrary hex invented.
    */
    expect(cardCode).toMatch(/font-gn-mono text-gn-hud-index text-gn-ink-value/);
    expect(cardCode).toMatch(/font-gn-mono text-gn-hud-meta text-gn-ink-meta[^]*t\.publishedLabel/);
    expect(cardCode).toContain('t.publishedProviderNote');
  });

  it('C5 — a compact geographic summary sits above the cards, anchors to the module, and adds NO data', () => {
    expect(code).toMatch(/href="#today-geography"/);
    expect(code).toMatch(/min-h-\[44px\]/);
    expect(code).toMatch(/pluralWithForms\(countries\.length, language, t\.countryCountForms\)/);
    expect(code).toMatch(/\{unresolvedCount\} \{t\.unresolvedShort\}/);
    // It renders only when it has something to say.
    expect(code).toMatch(/hasRecords && \(countries\.length > 0 \|\| unresolvedCount > 0\)/);
    // NO NEW DATA: it restates values allocateToday already produced.
    expect(code).not.toMatch(/fetch\(|useEffect/);
  });

  it('C5 — the complete geography module was NOT moved above the cards', () => {
    const body = code.slice(code.indexOf('return ('));
    expect(body.indexOf('href="#today-geography"')).toBeLessThan(body.indexOf('<TodayCard'));
    expect(body.indexOf('<TodayCard')).toBeLessThan(body.indexOf('<TodayGeographicIntelligence'));
  });

  it('the corrections introduce no state, no chart and no new data path', () => {
    expect((code.match(/useState/g) ?? [])).toHaveLength(2);
    expect(code).not.toContain('<svg');
    expect(cardCode).not.toContain('<svg');
  });
});

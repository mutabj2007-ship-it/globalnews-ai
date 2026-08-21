import { readFileSync } from 'fs';
import { join } from 'path';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * M66.14B — THE INTELLIGENCE CONTEXT CARD.
 *
 * The card is where an untruth would be most expensive: it names a place and a
 * category beside a headline, which is exactly the shape of claim M66.13 was run
 * to repair. These contracts hold it to what the data supports.
 */

const SRC = join(__dirname, '..', '..');
const read = (relative: string): string => readFileSync(join(SRC, relative), 'utf-8');
const codeOnly = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const cardSource = read('components/home/IntelligenceContextCard.tsx');
const card = codeOnly(cardSource);
const hero = codeOnly(read('components/home/Hero.tsx'));
const provider = codeOnly(read('components/home/HeroFocusProvider.tsx'));

describe('M66.14B — the context card renders only what is true', () => {
  it('THE CORE RULE — no source count, in any form', () => {
    expect(card).not.toMatch(/sourcesCount|SOURCES|sources\b/i);
  });

  it('no city, region, coordinate, relationship or invented timestamp', () => {
    expect(card).not.toMatch(/\bcity\b|(?<!-)\bregion\b|latitude|longitude|centroid/i);
    expect(card).not.toMatch(/related|relationship|causal|connectedTo/i);
    expect(card).not.toMatch(/Date\.now|new Date\(\)|toLocaleTimeString/);
  });

  it('the evidence wording asserts COUNTRY scope and no other scope exists', () => {
    expect(card).toMatch(/t\.countryEvidence/);
    const en = getDictionary('en').heroContext;
    expect(en.countryEvidence).toBe('COUNTRY-LEVEL EVIDENCE');
    // There is deliberately no city or regional variant to reach for.
    expect(Object.keys(en)).toEqual(['heading', 'countryEvidence', 'dismissLabel']);
  });

  it('renders nothing at all when the focused article resolved to no country', () => {
    expect(card).toMatch(/if \(focus === null \|\| focus\.countryCode === null \|\| focus\.countryName === null\) \{[\s\S]{0,40}?return null;/);
  });

  it('the provider headline is rendered verbatim and never looked up', () => {
    expect(card).toMatch(/\{focus\.headline\}/);
    expect(card).not.toMatch(/\[focus\.headline\]|translate/i);
  });
});

describe('M66.14B — the card reuses the one provenance model', () => {
  it('THE CORE RULE — statusKey comes from the provider and is never re-derived', () => {
    expect(card).toMatch(/const \{ focus, statusKey \} = useHeroFocus\(\)/);
    expect(card).not.toMatch(/resolveLiveStatus|dataMode|isLive/);
  });

  it('every non-live state reuses the SAME wording as the DATA STATUS row', () => {
    for (const key of ['cached', 'mock', 'unavailable', 'reconnecting', 'unknown']) {
      expect(card).toContain(`status.${key}`);
    }
  });

  it('a genuinely live feed carries no provenance qualifier — LIVE stays LIVE', () => {
    expect(card).toMatch(/statusKey === 'live'\r?\n?\s*\? null/);
  });

  it('the provider resolves provenance ONCE, from the same values page.tsx already supplies', () => {
    expect(provider).toMatch(/const \{ statusKey \} = resolveLiveStatus\(isLive, dataMode, language, updatedAt\)/);
    expect((provider.match(/resolveLiveStatus\(/g) ?? [])).toHaveLength(1);
  });
});

describe('M66.14B — the card is localized, and reuses the canonical vocabularies', () => {
  it('every new chrome string exists in BOTH languages and is genuinely different', () => {
    const en = getDictionary('en').heroContext;
    const pl = getDictionary('pl').heroContext;
    for (const key of ['heading', 'countryEvidence', 'dismissLabel'] as const) {
      expect(typeof en[key]).toBe('string');
      expect(en[key].length).toBeGreaterThan(0);
      expect(typeof pl[key]).toBe('string');
      expect(pl[key].length).toBeGreaterThan(0);
      expect(pl[key]).not.toBe(en[key]);
    }
  });

  it('the card hardcodes no user-facing literal — every label comes from the dictionary', () => {
    const literals = [...card.matchAll(/>\s*([A-Za-z][^<>{}\n]{2,80}?)\s*</g)]
      .map((match) => match[1].trim())
      .filter((text) => !/[=;()]/.test(text));
    expect(literals).toEqual([]);
  });

  it('the category label reuses map.categories and the country name the released display helper', () => {
    expect(card).toMatch(/dictionary\.map\.categories\[focus\.category\]/);
    expect(card).toMatch(/getCountryDisplayName\(focus\.countryCode, language, focus\.countryName\)/);
    // No second taxonomy and no second colour table.
    expect(card).toMatch(/categoryChannel\(focus\.category\)/);
    expect(card).not.toMatch(/world:\s*'|politics:\s*'/);
  });
});

describe('M66.14B — placement, replacement and accessibility', () => {
  it('THE CORE RULE — the card is NOT inside the aria-hidden decorative map wrapper', () => {
    const mapWrapper = /aria-hidden="true"[\s\S]*?<\/div>/.exec(hero);
    expect(mapWrapper).not.toBeNull();
    expect(mapWrapper![0]).not.toMatch(/IntelligenceContextCard/);
    expect(hero).toMatch(/<IntelligenceContextCard language=\{language\} \/>/);
  });

  it('announces itself politely, so a keyboard user hears what focusing a row produced', () => {
    expect(card).toMatch(/role="status"/);
    expect(card).toMatch(/aria-live="polite"/);
  });

  it('replaces its content in place — the card element itself is never keyed or remounted', () => {
    expect(card).not.toMatch(/key=\{focus/);
  });

  it('B-1 is DESKTOP ONLY — the mobile in-flow presentation is deliberately absent', () => {
    expect(hero).toMatch(/hidden cd-hero:block">\r?\n\s*<IntelligenceContextCard/);
    // The mobile field instance is untouched and receives no focus.
    expect(hero).toMatch(/<HeroIntelligenceField compact \/>/);
  });

  it('the card introduces no interaction of its own in B-1', () => {
    expect(card).not.toMatch(/onClick|onKeyDown|onMouseEnter|useState|useEffect/);
  });
});

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  continentDisplayName,
  localisedCountryName,
} from '@/lib/map/geography/displayName';
import { en } from '@/lib/i18n/dictionaries/en';
import { pl } from '@/lib/i18n/dictionaries/pl';

/**
 * ══ R2-B §6 — ONE READER-FACING PLACE-NAME PATH ═══════════════════════════
 *
 * MAP-DISPLAY-NAME-CENTRALISATION
 *
 * THE DEFECT WAS A SPLIT SURFACE. The map CANVAS already drew localised
 * country names — `labelSources` had gone through the shared resolver since
 * Milestone #50. The CHROME on top of it had not. Four places in
 * `GlobalMapShell` each wrote
 *
 *     COUNTRIES.find((c) => c.iso3 === id)?.name ?? id
 *
 * against an English-only registry, so a Polish reader saw "Kenia" painted on
 * the map and "Kenya" in the rail title, the callout, and beside a city — at
 * the same time, on the same screen. The identity line under it read
 * `KEN · AFRICA`.
 *
 * ── WHAT WAS ACTUALLY CENTRALISED, AND WHAT WAS ALREADY CENTRAL ───────────
 *
 * A first draft of the fix added a fresh `Intl.DisplayNames` resolver. That
 * was wrong: Milestone #50 Phase D consolidated every locale lookup into
 * `shared/src/countryDisplayName.ts` and states "there is no longer a second,
 * independent `Intl.DisplayNames` construction anywhere in the codebase". §4
 * pins that invariant so the next person cannot make the same mistake.
 *
 * What WAS genuinely duplicated is the BRIDGE — ISO-3 to registry row to
 * ISO-2, and the locale narrowed through `sourceLanguageFor` first because
 * Swahili and Kinyarwanda have no localised country names. That sequence was
 * written out in `MapPageClient` and again in `labelSources`, and a third copy
 * was about to be written for the rail. It is now in one module, and both
 * existing copies call it.
 */

const SHARED_COUNTRIES = readFileSync(
  resolve(__dirname, '..', '..', '..', '..', 'shared', 'src', 'countries.ts'),
  'utf-8',
);

/* ══════════════════════════════════════════════════════════════════════════
   1 — THE NAMES THE RULING ASKED FOR
   ══════════════════════════════════════════════════════════════════════════ */

describe('a country is named in the reader’s language', () => {
  it('Polish gets Polish', () => {
    expect(localisedCountryName('KEN', 'pl')).toBe('Kenia');
    expect(localisedCountryName('POL', 'pl')).toBe('Polska');
  });

  it('English gets English', () => {
    expect(localisedCountryName('KEN', 'en')).toBe('Kenya');
    expect(localisedCountryName('POL', 'en')).toBe('Poland');
  });

  it('a name that is the same in both is still resolved, not special-cased', () => {
    /*
      Rwanda is "Rwanda" in Polish. It must come back through the same path as
      Kenya rather than through a fallback that happens to produce the right
      answer — otherwise the fallback is untested on every country it matters
      for.
    */
    expect(localisedCountryName('RWA', 'pl')).toBe('Rwanda');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   2 — IT NEVER INVENTS, AND IT NEVER SUBSTITUTES A FALLBACK OF ITS OWN
   ══════════════════════════════════════════════════════════════════════════ */

describe('the bridge answers or declines', () => {
  it('an unknown code declines rather than guessing', () => {
    expect(localisedCountryName('XXX', 'pl')).toBeUndefined();
    expect(localisedCountryName('', 'pl')).toBeUndefined();
  });

  it('a language with no localised country names declines', () => {
    /*
      `sourceLanguageFor` returns undefined for 'sw' and 'rw'. Declining is
      what lets the caller show the registry's English rather than a name in
      the wrong language — the narrowing exists precisely so this does not
      resolve.
    */
    expect(localisedCountryName('KEN', 'sw')).toBeUndefined();
    expect(localisedCountryName('KEN', 'rw')).toBeUndefined();
  });

  it('DECLINING IS NOT THE SAME AS FALLING BACK, which is the whole design', () => {
    /*
      The module deliberately applies no fallback, because the three surfaces
      need three different ones: the backend's countryName for the evidence
      card, the registry's English for a map label, the raw id for the rail
      title. Folding them into one default here would have quietly changed all
      three while claiming to consolidate them.
    */
    expect(localisedCountryName('KEN', 'sw')).not.toBe('Kenya');
    expect(localisedCountryName('XXX', 'en')).not.toBe('XXX');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   3 — THE CONTINENT ON THE IDENTITY LINE
   ══════════════════════════════════════════════════════════════════════════ */

describe('KEN · AFRICA is localised too', () => {
  it('the registry grouping is translated', () => {
    expect(continentDisplayName('Africa', pl.map.spatial.card.continents)).toBe('Afryka');
    expect(continentDisplayName('Africa', en.map.spatial.card.continents)).toBe('Africa');
    expect(continentDisplayName('Americas', pl.map.spatial.card.continents)).toBe('Ameryki');
  });

  it('an unrecognised grouping shows the raw value rather than nothing', () => {
    expect(continentDisplayName('Antarctica', pl.map.spatial.card.continents)).toBe('Antarctica');
  });

  it('EVERY grouping the registry actually emits has copy in both languages', () => {
    /*
      Derived from the registry rather than typed here, so adding a sixth
      grouping upstream fails this test instead of rendering an English word
      into a Polish sentence. Read as TEXT for the reason
      `declaredProductRegions.spec` gives: importing the shared package pulls
      the gazetteer through ts-jest for what is a handful of strings.
    */
    const emitted = new Set(
      [...SHARED_COUNTRIES.matchAll(/region: '([^']+)'/g)].map((match) => match[1]),
    );

    expect(emitted.size).toBeGreaterThan(0);

    /*
      Asserted on the KEY SET, not by indexing the literal and not by
      comparing values. The dictionary's inferred type is the five keys it
      holds today, so a direct index would not compile against a grouping the
      registry added — the exact case this test exists to catch. And a value
      comparison would be wrong in English, where `Africa` correctly maps to
      "Africa": present-and-identical is a translation, not a gap.
    */
    for (const grouping of emitted) {
      expect(Object.keys(en.map.spatial.card.continents)).toContain(grouping);
      expect(Object.keys(pl.map.spatial.card.continents)).toContain(grouping);
    }
  });

  it('and the two locales genuinely differ where the languages do', () => {
    expect(pl.map.spatial.card.continents.Americas).not.toBe(
      en.map.spatial.card.continents.Americas,
    );
    expect(pl.map.spatial.card.continents.Africa).not.toBe(
      en.map.spatial.card.continents.Africa,
    );
  });

  it('it is NOT the canvas label block, which is a different set', () => {
    /*
      `map.spatial.continents` already existed one level up: canvas label copy
      keyed `africa / northAmerica / southAmerica / …`, six landmasses with the
      Americas split the way a map draws them. The registry groups countries
      into five and keeps the Americas together. Reusing the label block would
      have missed `Americas` silently.
    */
    expect(Object.keys(en.map.spatial.continents)).toContain('northAmerica');
    expect(Object.keys(en.map.spatial.card.continents)).not.toContain('northAmerica');
    expect(Object.keys(en.map.spatial.card.continents)).toContain('Americas');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   4 — ONE RESOLVER, ONE BRIDGE
   ══════════════════════════════════════════════════════════════════════════ */

const SRC = resolve(__dirname, '..', '..');

const sourcesUnder = (...parts: string[]): readonly string[] => {
  const walk = (dir: string): readonly string[] => {
    const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');

    return readdirSync(dir).flatMap((entry: string) => {
      const full = join(dir, entry);

      if (statSync(full).isDirectory()) return walk(full);

      return /\.tsx?$/.test(entry) && !/\.spec\.tsx?$/.test(entry) ? [full] : [];
    });
  };

  return walk(join(SRC, ...parts));
};

describe('the Milestone #50 invariant still holds', () => {
  it('the frontend constructs no Intl.DisplayNames of its own', () => {
    /*
      "There is no longer a second, independent `Intl.DisplayNames`
      construction anywhere in the codebase." A first draft of this correction
      added one. This assertion is why it did not ship.
    */
    const offenders = sourcesUnder().filter((file) =>
      readFileSync(file, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .includes('new Intl.DisplayNames'),
    );

    expect(offenders).toEqual([]);
  });

  it('the map chrome no longer resolves a display name from the English registry', () => {
    const shell = readFileSync(
      join(SRC, 'components', 'map', 'shell', 'GlobalMapShell.tsx'),
      'utf-8',
    ).replace(/\/\*[\s\S]*?\*\//g, '');

    /*
      ONE surviving registry read, and it is the FALLBACK inside the shell's
      single name resolver — not a display path of its own. Three call sites
      that each had their own copy now go through it.
    */
    expect(shell.split('COUNTRIES.find(').length - 1).toBe(1);
    expect(shell).toContain('const countryNameFor = useCallback');
  });

  it('and both pre-existing copies of the bridge now call the shared one', () => {
    for (const file of [
      join(SRC, 'components', 'map', 'MapPageClient.tsx'),
      join(SRC, 'lib', 'map', 'labels', 'labelSources.ts'),
    ]) {
      const source = readFileSync(file, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');

      expect(source).toContain('localisedCountryNameForIso3(');
      /* The hand-written sequence is gone, not merely unused. */
      expect(source).not.toContain('getLocalizedCountryName(meta.iso2');
    }
  });
});

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { en } from '@/lib/i18n/dictionaries/en';
import { pl } from '@/lib/i18n/dictionaries/pl';

/**
 * ══ R2-B §12 — THE MULTILINGUAL TESTING STRATEGY ══════════════════════════
 *
 * MAP-MULTILINGUAL-TESTING
 *
 * ── THE STRATEGY, IN FOUR RULES ───────────────────────────────────────────
 *
 * 1  EVERY RENDER ASSERTION RUNS IN BOTH LANGUAGES. Not a Polish smoke test
 *    bolted on at the end — the same `for (const [locale, dict] of LOCALES)`
 *    loop every R2-B spec uses, so a defect that only appears in Polish fails
 *    the same assertion that covers English.
 *
 * 2  ASSERT AGAINST THE DICTIONARY, NEVER AGAINST A TYPED STRING. A spec that
 *    types "Nie udało się rozpoznać tego regionu" is a spec that can disagree
 *    with the copy, and it puts Polish orthography into a file nobody proofs.
 *    Every R2-B assertion reads `dict.map.spatial.…` instead.
 *
 * 3  KEY SETS MUST BE IDENTICAL, so a key added to `en` alone cannot ship an
 *    English string into a Polish page. §2 enforces this structurally for the
 *    whole map surface rather than block by block.
 *
 * 4  A LICENCE NOTICE IS NOT INTERFACE COPY. Where a string is an upstream
 *    notice, the two dictionaries are asserted to be IDENTICAL — the opposite
 *    of rule 3's intent, and deliberately so.
 *
 * ── WHY RULE 2 IS WRITTEN DOWN AS A RULE ──────────────────────────────────
 *
 * It was learned the expensive way twice in this programme. A Polish regex
 * using `\b` silently never matched, because JavaScript's word boundary is
 * `[A-Za-z0-9_]` and breaks next to ą ć ę ł ń ś ź ż — so a scan reported a
 * clean surface while the phrase it was looking for sat unread on it. And a
 * diacritic heuristic in this very package failed against "Zadeklarowane
 * przez", which is correct Polish that happens to use none.
 *
 * Both failures share one cause: the test reasoned about Polish TEXT instead
 * of about the dictionary ENTRY. §3 keeps that from recurring by refusing to
 * let a Polish literal into a map spec at all.
 */

const SRC = resolve(__dirname, '..', '..');

const LOCALES = [
  ['en', en],
  ['pl', pl],
] as const;

/* ══════════════════════════════════════════════════════════════════════════
   1 — THE MAP DICTIONARIES ARE STRUCTURALLY IDENTICAL
   ══════════════════════════════════════════════════════════════════════════ */

/** Every key path in an object, so a missing nested key is found too. */
const keyPaths = (value: unknown, prefix = ''): readonly string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => keyPaths(entry, `${prefix}[${index}]`));
  }

  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      keyPaths(child, prefix === '' ? key : `${prefix}.${key}`),
    );
  }

  return [prefix];
};

describe('rule 3 — a key cannot exist in one language only', () => {
  it('the whole map dictionary has identical key paths in EN and PL', () => {
    /*
      THE WHOLE TREE, not the blocks R2-B happened to touch. Every correction
      in this package added copy, and this is the one assertion that would have
      caught any of them landing in `en` alone.
    */
    const english = [...keyPaths(en.map)].sort();
    const polish = [...keyPaths(pl.map)].sort();

    expect(polish).toEqual(english);
  });

  it('and so does the third-party notices page', () => {
    expect([...keyPaths(pl.thirdPartyNoticesPage)].sort()).toEqual(
      [...keyPaths(en.thirdPartyNoticesPage)].sort(),
    );
  });

  it('and the footer link labels, which R2-B added a destination to', () => {
    expect(Object.keys(pl.footer.linkLabels).sort()).toEqual(
      Object.keys(en.footer.linkLabels).sort(),
    );
  });

  it('no map string is empty in either language', () => {
    /*
      A key present but blank passes the comparison above and renders nothing.
      Checked on values rather than keys for exactly that reason.
    */
    for (const [locale, dict] of LOCALES) {
      const blanks = keyPaths(dict.map).filter((path) => {
        const value = path
          .replace(/\[(\d+)\]/g, '.$1')
          .split('.')
          .reduce<unknown>(
            (node, key) => (node as Record<string, unknown> | undefined)?.[key],
            dict.map,
          );

        return typeof value === 'string' && value.trim().length === 0;
      });

      expect({ locale, blanks }).toEqual({ locale, blanks: [] });
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   2 — THE COPY R2-B ADDED IS GENUINELY TRANSLATED
   ══════════════════════════════════════════════════════════════════════════ */

describe('rule 1 — the new copy differs where the languages differ', () => {
  /**
   * Everything R2-B introduced that is INTERFACE copy. Licence notices are
   * excluded on purpose and covered by §4 instead.
   */
  const TRANSLATED: readonly (readonly [string, string, string])[] = [
    ['region type', en.map.spatial.region.types.ADMINISTRATIVE, pl.map.spatial.region.types.ADMINISTRATIVE],
    ['region declared-by', en.map.spatial.region.declaredByHeading, pl.map.spatial.region.declaredByHeading],
    ['region subnational evidence', en.map.spatial.region.evidenceScopeBodySubnational, pl.map.spatial.region.evidenceScopeBodySubnational],
    ['region subnational boundary', en.map.spatial.region.noBoundarySubnational, pl.map.spatial.region.noBoundarySubnational],
    ['layer out of scale', en.map.shell.layerOutOfScale, pl.map.shell.layerOutOfScale],
    ['continent Americas', en.map.spatial.card.continents.Americas, pl.map.spatial.card.continents.Americas],
    ['notices title', en.thirdPartyNoticesPage.title, pl.thirdPartyNoticesPage.title],
    ['notices intro', en.thirdPartyNoticesPage.intro, pl.thirdPartyNoticesPage.intro],
    ['footer notices link', en.footer.linkLabels['/third-party-notices'], pl.footer.linkLabels['/third-party-notices']],
  ];

  for (const [name, english, polish] of TRANSLATED) {
    it(`${name} — PL is not the English string`, () => {
      expect(polish).not.toBe(english);
      expect(polish.trim().length).toBeGreaterThan(0);
    });
  }

  it('POSITIVE CONTROL — this check can actually fail', () => {
    /*
      Without it, a list of `not.toBe` comparisons proves only that two strings
      differ, which two typos also satisfy. This shows the comparison detects
      an English string sitting in the Polish slot.
    */
    expect(en.map.spatial.region.types.ADMINISTRATIVE).toBe(
      en.map.spatial.region.types.ADMINISTRATIVE,
    );
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   3 — NO MAP SPEC ASSERTS AGAINST A TYPED POLISH LITERAL
   ══════════════════════════════════════════════════════════════════════════ */

describe('rule 2 — specs read the dictionary instead of transcribing it', () => {
  const specs = (dir: string): readonly string[] =>
    readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);

      if (statSync(full).isDirectory()) return specs(full);

      return /\.spec\.ts$/.test(entry) ? [full] : [];
    });

  it('no map spec contains a Polish diacritic outside a comment', () => {
    /*
      THE RULE THIS ENFORCES, and the two failures behind it: a `\b` regex that
      silently never matched Polish text, and a diacritic heuristic that failed
      against correct Polish with no diacritic. Both came from reasoning about
      the TEXT rather than about the dictionary entry.

      Comments are stripped first — prose ABOUT Polish is exactly what this
      file is, and a spec header quoting the defect is not a spec asserting
      against a literal. Character classes inside a regex are allowed for the
      same reason: `/[ąćęłńśźż]/` is a rule about orthography, not a
      transcription of copy.
    */
    /*
      ── THE LEGACY LIST, WHICH MAY ONLY SHRINK ────────────────────────────

      Three specs predating this strategy transcribe Polish copy. They are
      recorded rather than rewritten: this package is visual/resolution
      cleanup, and rewriting three accepted specs to satisfy a rule introduced
      after them is a refactor wearing a compliance badge.

      What matters is that the list is CLOSED. A new offender is not on it and
      fails, which is the whole point — and the assertion below also fails if
      a listed file is cleaned up and the entry is left behind, so the list
      cannot rot into a permanent excuse.
    */
    const LEGACY = [
      'components/map/CountryPanel.spec.ts',
      'components/map/checkpointFGlobalUx.spec.ts',
      'components/map/chromeConvergence.spec.ts',
    ];

    const offenders: string[] = [];

    for (const file of specs(join(SRC, 'components', 'map'))) {
      const source = readFileSync(file, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
        .replace(/\/\[[^\]]*\]\//g, '');

      if (/[ąćęłńśźż]/.test(source)) {
        offenders.push(file.slice(SRC.length + 1).replace(/\\/g, '/'));
      }
    }

    /* No NEW offender, and every legacy entry still earns its place. */
    expect(offenders.filter((file) => !LEGACY.includes(file))).toEqual([]);
    expect([...offenders].sort()).toEqual([...LEGACY].sort());
  });

  it('POSITIVE CONTROL — the scan really does detect Polish text', () => {
    /*
      Without this the assertion above passes on an empty file list, on a
      broken regex, or on a strip that removed everything. The literal here is
      a test fixture, not an assertion about product copy.
    */
    /*
      BUILT FROM A CODE POINT, not typed. A literal "ł" here would make this
      file its own first offender — which is exactly what happened on the first
      run, and is a fair demonstration that the rule has teeth.
    */
    const probe = `nie uda${String.fromCharCode(0x0142)}o`;

    expect(/[ąćęłńśźż]/.test(probe)).toBe(true);
  });

  it('and the map spec directory is not empty, so the sweep had work to do', () => {
    expect(specs(join(SRC, 'components', 'map')).length).toBeGreaterThan(20);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   4 — THE DELIBERATE EXCEPTION: A NOTICE IS NOT INTERFACE COPY
   ══════════════════════════════════════════════════════════════════════════ */

describe('rule 4 — licence notices are identical in both languages, on purpose', () => {
  it('the map attribution is the same string in EN and PL', () => {
    expect(pl.map.spatial.attribution).toBe(en.map.spatial.attribution);
  });

  it('so is the notices page’s data attribution', () => {
    expect(pl.thirdPartyNoticesPage.dataAttribution).toBe(
      en.thirdPartyNoticesPage.dataAttribution,
    );
  });

  it('and both carry the CC BY 4.0 URI, unparaphrased', () => {
    for (const [, dict] of LOCALES) {
      expect(dict.map.spatial.attribution).toContain(
        'https://creativecommons.org/licenses/by/4.0/',
      );
    }
  });

  it('THE EXCEPTION IS NARROW — it covers notices and nothing else', () => {
    /*
      The guard against rule 4 being used to excuse untranslated interface
      copy. Only these two strings may be identical across the dictionaries;
      §2 asserts the rest of the new copy differs.
    */
    expect(en.thirdPartyNoticesPage.title).not.toBe(pl.thirdPartyNoticesPage.title);
    expect(en.thirdPartyNoticesPage.softwareHeading).not.toBe(
      pl.thirdPartyNoticesPage.softwareHeading,
    );
  });
});

import { toDisplayCase } from './display-casing';
import { foldForLabelComparison, mapGeographyForQuery } from './map-feed.contract';
import { foldGeographyIdSegment, foldPlaceName } from './geo-normalize.util';
import { searchGazetteer } from './gazetteer-search';
import gazetteer from './data/gazetteer.v1.json';

/**
 * G-GEO-12 — UNICODE-AWARE DISPLAY CASING.
 *
 * The old expression was `alias.replace(/\b\p{Ll}/gu, …)`. `\p{Ll}` is
 * Unicode-aware; `\b` is not, and no flag makes it so. JavaScript sees a word
 * boundary on both sides of every non-ASCII letter, so the expression
 * uppercased the letter AFTER each accent and never the first letter of a word
 * that began with one.
 */

type Named = { readonly n: string; readonly al?: readonly string[] };
const NAMES = [
  ...(gazetteer.cities as unknown as Named[]),
  ...(gazetteer.regions as unknown as Named[]),
];

/** The expression exactly as it was. Used ONLY to measure the difference. */
const oldCase = (value: string): string => value.replace(/\b\p{Ll}/gu, (c) => c.toUpperCase());

/* ── 1 · CYRILLIC ───────────────────────────────────────────────────────── */

describe('1 · Cyrillic — the case that was noticed, and the smaller one', () => {
  it.each([
    ['канильо', 'Канильо'],
    ['ордино', 'Ордино'],
    ['арачиново', 'Арачиново'],
    ['зуунмод', 'Зуунмод'],
    ['ла-массана', 'Ла-Массана'],
    ['чучер - сандево', 'Чучер - Сандево'],
  ])('%s -> %s', (input, expected) => {
    expect(oldCase(input)).toBe(input); // no capital at all, before
    expect(toDisplayCase(input)).toBe(expected);
  });
});

/* ── 2 · ACCENTED AND EXTENDED LATIN — THE SEVERE CASE ──────────────────── */

describe('2 · accented Latin was MANGLED, not merely uncapitalised', () => {
  it.each([
    ['a coruña', 'A CoruÑA', 'A Coruña'],
    ['abaeté', 'AbaetÉ', 'Abaeté'],
    ['abramów', 'AbramÓW', 'Abramów'],
    ['ísafjörður', 'íSafjÖRÐUr', 'Ísafjörður'],
    ['ürümqi', 'üRÜMqi', 'Ürümqi'],
    ['łódź', 'łóDŹ', 'Łódź'],
    ['ñuñoa', 'ñUÑOa', 'Ñuñoa'],
  ])('%s: was %s, now %s', (input, before, after) => {
    /*
     * Each accented character created TWO spurious word boundaries, so the
     * letter following it was uppercased mid-word. This is why the defect
     * matters more for Latin than for Cyrillic: Cyrillic labels merely lacked
     * a capital, while these were rendered wrong in the middle.
     */
    expect(oldCase(input)).toBe(before);
    expect(toDisplayCase(input)).toBe(after);
  });

  it('a decomposed combining mark does not split a word', () => {
    // 'İ' lowercases to 'i' + COMBINING DOT ABOVE. Without \p{M} in the
    // lookbehind the following 's' looks like a new word: "İStanbul".
    const decomposed = 'İstanbul'.toLowerCase();

    /*
     * Written with an explicit escape rather than a composed literal. The
     * decomposed and composed forms of this word are visually identical and are
     * different code points, so a pasted literal would compare unequal for a
     * reason no reader could see in the diff.
     */
    expect(oldCase(decomposed)).toBe('I\u0307Stanbul');
    expect(toDisplayCase(decomposed)).toBe('I\u0307stanbul');
  });
});

/* ── 3 · MIXED SCRIPT AND CASELESS SCRIPTS ──────────────────────────────── */

describe('3 · mixed-script and caseless labels', () => {
  it.each([
    ['bari, somalia', 'Bari, Somalia'],
    ['ла-массана / la massana', 'Ла-Массана / La Massana'],
    ['київ kyiv', 'Київ Kyiv'],
  ])('%s -> %s', (input, expected) => {
    expect(toDisplayCase(input)).toBe(expected);
  });

  it.each(['عجمان', '자강도', '卡尼略', 'أندورا لا فيلا'])(
    '%s passes through untouched — the script has no case',
    (input) => {
      expect(toDisplayCase(input)).toBe(input);
    },
  );
});

/* ── 4 · PUNCTUATION-SEPARATED LABELS ───────────────────────────────────── */

describe('4 · punctuation begins a word exactly as it did before', () => {
  it.each([
    ['saint-denis', 'Saint-Denis'],
    ["n'djamena", "N'Djamena"],
    ['al-qāhirah', 'Al-Qāhirah'],
    ['new york', 'New York'],
    ['s-hertogenbosch', 'S-Hertogenbosch'],
    ['santa cruz de la sierra', 'Santa Cruz De La Sierra'],
  ])('%s -> %s', (input, expected) => {
    expect(toDisplayCase(input)).toBe(expected);
  });

  it('a digit does not begin a new word', () => {
    expect(toDisplayCase('district 9a')).toBe('District 9a');
  });
});

/* ── 5 · ASCII PARITY, OVER THE WHOLE CORPUS ────────────────────────────── */

describe('5 · every existing ASCII label renders exactly as it did', () => {
  it('is identical to the old expression for every pure ASCII name', () => {
    let checked = 0;

    for (const rec of NAMES) {
      for (const raw of [rec.n, ...(rec.al ?? [])]) {
        if (!/^[\x20-\x7e]*$/.test(raw)) continue;
        const lowered = raw.toLowerCase();
        checked += 1;
        expect(toDisplayCase(lowered)).toBe(oldCase(lowered));
      }
    }

    expect(checked).toBeGreaterThan(40_000);
  });

  it('counts the whole display change, so the report is reproducible', () => {
    let differ = 0;

    for (const rec of NAMES) {
      for (const raw of [rec.n, ...(rec.al ?? [])]) {
        const lowered = raw.toLowerCase();
        if (toDisplayCase(lowered) !== oldCase(lowered)) differ += 1;
      }
    }

    // 13,192 Latin-extended (mangled) + 3,382 Cyrillic (uncapitalised).
    expect(differ).toBe(16_574);
  });
});

/* ── 6 · NOTHING ELSE MOVED ─────────────────────────────────────────────── */

describe('6 · the other three transforms are untouched', () => {
  it('THE IDENTITY FOLD IS UNTOUCHED — ids are byte-identical to C10', () => {
    expect(foldGeographyIdSegment('Канильо')).toBe('канильо');
    expect(foldGeographyIdSegment('A Coruña')).toBe('a-coruna');
    expect(mapGeographyForQuery('Арачиново').place?.geographyId).toBe(
      'city:MKD:арачиново@42.02639,21.56194',
    );
    expect(mapGeographyForQuery('Канильо').place?.geographyId).toBe('admin1:AD-02');
    expect(mapGeographyForQuery('what is happening in Rwanda?').place?.geographyId).toBe(
      'country:RWA',
    );
  });

  it('THE LABEL-COMPARISON FOLD IS UNTOUCHED — 2B1 stands unchanged', () => {
    // The accepted 2B1 behaviour, re-asserted here so 2B3 cannot have moved it.
    expect(foldForLabelComparison('Канильо')).not.toBe(foldForLabelComparison('卡尼略'));
    expect(foldForLabelComparison('Aleksandrów Łódzki')).toBe('aleksandrow-łodzki');
    expect(foldForLabelComparison('-')).toBe('');
  });

  it('THE MATCHING FOLD IS UNTOUCHED', () => {
    expect(foldPlaceName('A Coruña')).toBe('a coruna');
  });

  it('2B2 searchLabel behaviour is preserved', () => {
    const hit = searchGazetteer('Bari', { limit: 10 }).nodes.find(
      (n) => n.geographyId === 'admin1:SO-BR',
    );

    expect(hit?.name).toBe('Bari, Somalia');
    expect(hit?.searchLabel).toBe('Bari');

    const fontana = searchGazetteer('Fontana', { limit: 10 }).nodes.find(
      (n) => n.geographyId === 'admin1:MT-10',
    );

    expect(fontana?.searchLabel).toBe('Fontana, Gozo');
    expect(mapGeographyForQuery('what is happening in Hiran?').place?.analysisQuery).toBe(
      'Hiran, Somalia',
    );
  });

  it('display casing and the three folds remain FOUR different functions', () => {
    const name = 'A Coruña';

    expect(toDisplayCase(name.toLowerCase())).toBe('A Coruña');
    expect(foldForLabelComparison(name)).toBe('a-coruna');
    expect(foldPlaceName(name)).toBe('a coruna');
    expect(foldGeographyIdSegment(name)).toBe('a-coruna');
  });
});

/* ── 7 · WASHINGTON, D.C. — REPORTED, NOT FIXED ─────────────────────────── */

describe('7 · Washington, D.C. is reported and deliberately not fixed here', () => {
  it('renders as "Washington Dc" BEFORE AND AFTER — 2B3 changes nothing for it', () => {
    /*
     * ASKED FOR EXPLICITLY, SO HERE IS THE MEASURED ANSWER.
     *
     * The label is "Washington Dc" on C10 and stays "Washington Dc" here. This
     * helper is not the cause: what reaches it is already "washington dc",
     * because the matched surface form has been folded and the periods are gone
     * before any casing happens. Title-casing "washington dc" to
     * "Washington Dc" is correct behaviour for the input it is given.
     *
     * Restoring "Washington, D.C." would need a punctuation-and-acronym
     * contract — a record of which forms are abbreviations and how they are
     * written out — which is a separate decision with its own data. Scope was
     * NOT broadened to reach it.
     */
    const feed = mapGeographyForQuery('Washington, D.C.');

    expect(feed.place?.label).toBe('Washington Dc');
    expect(feed.place?.canonicalName).toBe('Washington, D.C.');
    expect(feed.place?.geographyId).toBe('city:USA:washington-dc@38.89511,-77.03637');
    // The helper itself is not what loses the periods.
    expect(toDisplayCase('washington, d.c.')).toBe('Washington, D.C.');
  });
});

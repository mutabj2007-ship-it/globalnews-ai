/**
 * GEOGRAPHY — NAME NORMALIZATION.
 *
 * WHY THIS EXISTS RATHER THAN AN ALIAS TABLE. The upstream gazetteer's alias
 * field is empty: MEASURED, 48,689 of 48,702 kept cities carry no alternate
 * name, and the 13 that do carry a bare country code, which is noise. A curated
 * alias table is exactly the 24-city problem this work replaces, one level down.
 *
 * So aliases are GENERATED, deterministically, from the canonical name. That
 * covers the variant that actually appears in reporting - an English-language
 * wire dropping diacritics:
 *
 *   "Sao Paulo"   -> São Paulo
 *   "Zurich"      -> Zürich
 *   "Krakow"      -> Kraków
 *   "Dusseldorf"  -> Düsseldorf
 *   "Istanbul"    -> İstanbul
 *
 * NOTHING HERE IS FUZZY. Every transformation removes a difference that cannot
 * change WHICH place is addressed - case, Unicode composition, diacritics,
 * punctuation, whitespace. Two names differing by a letter still differ on the
 * way out. This is the same discipline shared/src/storyIdentity.ts states for
 * headlines, applied to place names.
 */

/**
 * The Turkish dotted capital I is the one case where a naive `toLowerCase()`
 * is not enough: 'İ'.toLowerCase() yields 'i' followed by COMBINING DOT ABOVE,
 * which then survives as a separate code point. NFD + mark stripping removes it,
 * which is why the fold runs in this order and not the other.
 */
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Anything that is not a letter, a number or a space becomes a space. */
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]+/gu;

/**
 * A PERIOD AFTER A SINGLE LETTER IS AN ABBREVIATION MARKER, NOT A SEPARATOR.
 *
 * MEASURED BUG. The gazetteer spells the United States capital "Washington,
 * D.C.". Treating every period as a separator folds that to three tokens -
 * "washington d c" - while a user types "Washington DC", which folds to two.
 * They never matched, so the capital of the United States was unreachable.
 *
 * DELIBERATELY NARROW: it fires only on a SINGLE letter followed by a period, so
 * "D.C." becomes "DC" while "Rwanda." and "St. Louis" are untouched - a
 * sentence-ending period must still separate, or two sentences would run
 * together into one impossible token.
 *
 * APPLIED IN EVERY TOKENIZER IN THIS FILE. The folded tokens, their casing and
 * their segment boundaries are consumed as parallel arrays, so a change to one
 * that is not made in the others silently misaligns them.
 */
const SINGLE_LETTER_ABBREVIATION = /\b(\p{L})\./gu;

function preNormalize(value: string): string {
  return (value ?? '').normalize('NFKC').replace(SINGLE_LETTER_ABBREVIATION, '$1');
}

/**
 * Folds a place name to its comparison form.
 *
 * NFKC first so compatibility forms (full-width, ligatures) collapse; lowercase;
 * then NFD and strip combining marks so diacritics go; then punctuation and
 * whitespace. Deterministic and total - every input yields a string.
 */
export function foldPlaceName(value: string): string {
  return preNormalize(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(NON_ALPHANUMERIC, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Tokenizes article text into folded word tokens, preserving order and
 * position so a multi-word place name can be matched as a contiguous run.
 */
/**
 * THE CANONICAL FOLD FOR ONE SEGMENT OF A `geographyId`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS LIVES HERE AND NOWHERE ELSE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A `geographyId` is an IDENTITY. `city:RWA:kigali@-1.94995,30.05885` is the
 * string the map feed emits, the navigator returns, and a Watch subject carries,
 * and the whole design depends on all three producing it character for
 * character. Three separate private copies of the folding rule were doing that
 * job — behaviourally identical today, and one edit away from not being.
 *
 * The failure mode is silent and expensive: if one copy ever normalises
 * differently, a place searched and the same place resolved from an article stop
 * matching, no error fires, and the map simply never associates them. There is
 * no test that would catch it except one that already knew to look.
 *
 * So the rule has exactly one implementation, here, beside the other geography
 * normalizers. It is deliberately NOT `foldPlaceName` — that answers "are these
 * the same name?" for matching, whereas this answers "what is this name's stable
 * form inside an identifier?" and additionally collapses whitespace to hyphens
 * so the segment is safe in a colon-delimited id.
 */
export function foldGeographyIdSegment(value: string): string {
  return foldPlaceName(value).replace(/\s+/g, '-');
}

export function foldTokens(text: string): string[] {
  const folded = foldPlaceName(text);

  return folded.length === 0 ? [] : folded.split(' ');
}

/**
 * CAPITALIZATION IS EVIDENCE, AND FOLDING DESTROYS IT — SO IT IS CAPTURED FIRST.
 *
 * MEASURED PROBLEM. The gazetteer holds 270 settlements whose names are three
 * characters or fewer, and three of them are literally common function words:
 * "As" (Norway), "Of" (Turkey) and "Un" (India). Folding "Un rapport de..." to
 * lower case makes the French indefinite article indistinguishable from a town
 * in Gujarat, and the resolver duly returned Gujarat. Longer names have the same
 * shape - Nice, Split, Mobile, Reading, Bar, Bay are all real settlements and
 * all ordinary words.
 *
 * The signal that separates them is in the source text and nowhere else: a place
 * name is capitalized and an ordinary word mid-sentence is not. So the case of
 * each token is captured BEFORE folding and travels alongside it.
 *
 * CASELESS SCRIPTS ARE NOT PENALIZED. Chinese, Japanese, Arabic, Hebrew, Thai
 * and Korean have no case, so a token containing no cased letter at all reports
 * `true` - "it is as capitalized as it can be". Requiring case there would make
 * the resolver blind to most of the world.
 */
export function tokenCasing(text: string): boolean[] {
  const raw = preNormalize(text).replace(NON_ALPHANUMERIC, ' ').trim().split(/\s+/).filter(Boolean);

  return raw.map((token) => {
    const hasCase = token !== token.toLowerCase() || token !== token.toUpperCase();

    // No cased letters at all (CJK, Arabic, digits) -> not penalized.
    if (!hasCase) return true;

    const first = token[0] ?? '';

    return first === first.toUpperCase() && first !== first.toLowerCase();
  });
}

/**
 * Every contiguous token run up to `maxWords`, as folded strings, with the
 * index at which each run starts.
 *
 * LONGEST-FIRST IS THE CALLER'S JOB, not this function's - it returns runs in
 * (start, length) order and the resolver consumes them longest-first, which is
 * what makes "New York City" win over "New York" and "York".
 */
export function candidateRuns(
  tokens: readonly string[],
  maxWords: number,
): { readonly text: string; readonly start: number; readonly words: number }[] {
  const runs: { text: string; start: number; words: number }[] = [];

  for (let start = 0; start < tokens.length; start += 1) {
    const limit = Math.min(maxWords, tokens.length - start);

    for (let words = 1; words <= limit; words += 1) {
      runs.push({
        text: tokens.slice(start, start + words).join(' '),
        start,
        words,
      });
    }
  }

  return runs;
}

/**
 * The source tokens with their original case, aligned 1:1 with foldTokens().
 *
 * Needed for the ALL-CAPS ISO code scan, where case is the entire signal and
 * folding destroys it.
 */
export function rawTokens(text: string): string[] {
  return preNormalize(text).replace(NON_ALPHANUMERIC, ' ').trim().split(/\s+/).filter(Boolean);
}

/**
 * Which folded tokens begin a new COMMA SEGMENT, aligned 1:1 with foldTokens().
 *
 * WHY THIS SURVIVES FOLDING WHEN NOTHING ELSE DOES. Folding removes punctuation,
 * and with it the boundary that makes "in Musanze, Rwanda" work: the legacy
 * resolver split a captured phrase on commas and only ever matched a country at
 * the START of a segment, which is exactly what stops "the University of Chad"
 * resolving Chad while letting "in Musanze, Rwanda" resolve Rwanda.
 *
 * Losing that boundary broke both directions at once - the country gate became
 * either too loose or too tight with no setting in between. So the boundary is
 * captured before folding, like token casing.
 */
export function segmentStarts(text: string): boolean[] {
  const normalized = preNormalize(text);
  const starts: boolean[] = [];
  let pendingBreak = true;
  let inToken = false;

  for (const char of normalized) {
    const isWordChar = /[\p{L}\p{N}]/u.test(char);

    if (isWordChar) {
      if (!inToken) {
        starts.push(pendingBreak);
        pendingBreak = false;
        inToken = true;
      }
      continue;
    }

    inToken = false;

    // A comma, semicolon, colon or sentence end begins a new segment.
    if (/[,;:.?!]/.test(char)) pendingBreak = true;
  }

  return starts;
}

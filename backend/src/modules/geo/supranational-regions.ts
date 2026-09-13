/**
 * SUPRANATIONAL REGIONS — THE CONTROLLED VOCABULARY, IN ITS REFUSAL-ONLY FORM.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT THIS FIXES, MEASURED
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   resolveGeography('unrest in East Africa')
 *     -> precision: PROVINCE, provenance: CONTESTED
 *        candidates: [East Region (Cameroon), Eastern Region (Iceland)]
 *
 * "East Africa" is in no gazetteer index, so the scanner fell back to the
 * SHORTER run "east" — which really is an alias for two subdivisions — and
 * reported a contested province. A reader asking about East Africa was offered
 * Cameroon and Iceland.
 *
 * That is not an ambiguity to be resolved. It is a category error: the phrase
 * names a SUPRANATIONAL region, and matching a prefix of it against a
 * SUBNATIONAL index is answering a different question from the one asked.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY REFUSAL IS THE COMPLETE ANSWER TODAY, AND NOT A PLACEHOLDER
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The approved design specification is unusually explicit here, and it asks for
 * exactly this behaviour:
 *
 *   "REGION has no fixed radius: it fits the bounds of the named region from a
 *    controlled region gazetteer, and a region with no gazetteer entry degrades
 *    to UNKNOWN rather than to an invented radius."
 *
 *   "A controlled supranational region gazetteer is also required before REGION
 *    precision can be rendered."
 *
 * That gazetteer does not exist. It is a dataset acquisition with its own
 * licence question — regional bodies define their own membership and the sets
 * genuinely disagree — and inventing bounds for "the Sahel" would be precisely
 * the fabrication the whole geographic foundation exists to refuse.
 *
 * So this file delivers the half that can be delivered honestly: THE NAMES. A
 * name is enough to recognise that a supranational region was asked about, and
 * recognising it is enough to REFUSE — which is what the specification asks for
 * anyway. When the bounds dataset arrives, this list becomes its key set and
 * the refusal becomes a resolution. Nothing here is thrown away.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS NOT "ANOTHER TINY CURATED TABLE"
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The ruling that a curated table is unacceptable was about SETTLEMENTS — a
 * 24-city table standing in for the world's cities, so that Perth and Musanze
 * were unreachable. This is the opposite kind of object:
 *
 *   - It resolves NOTHING. There is no coordinate, no extent, no precision
 *     raised. Its only output is a refusal.
 *   - Its domain is genuinely small and genuinely closed. There are a few dozen
 *     supranational regions in common journalistic use, not 135,000.
 *   - It cannot cause a false positive by growing. Every entry can only ever
 *     turn a wrong confident answer into UNKNOWN.
 *   - It is verified against the gazetteer at test time: an entry that shadows
 *     a real country or a real settlement FAILS the suite (see the spec file),
 *     the same build-time discipline the exonym table is held to.
 *
 * The worst thing a missing entry can do is leave today's behaviour unchanged.
 */

/**
 * The controlled supranational vocabulary.
 *
 * Entries are matched as WHOLE PHRASES, case-insensitively, on word boundaries.
 * A leading "the" is optional at match time and is therefore not written here.
 *
 * DELIBERATE EXCLUSIONS, each for a reason:
 *
 *   "Africa", "Asia", "Europe" and the other bare continents. They are
 *   supranational, but a continent is too coarse to be a useful refusal and
 *   the phrase "in Africa" is more often a modifier than a subject. They are
 *   also already unresolvable — no index holds them — so they reach UNKNOWN
 *   without help.
 *
 *   "America". Ambiguous with the United States in ordinary usage, and
 *   refusing it would suppress a country a reader plainly meant.
 *
 *   "Georgia", "Jordan", "Chad" and the other word-shaped names. Not
 *   supranational; handled by the existing preposition gate.
 */
export const SUPRANATIONAL_REGIONS: readonly string[] = [
  // Africa
  'East Africa',
  'Eastern Africa',
  'West Africa',
  'Western Africa',
  'North Africa',
  'Northern Africa',
  'Southern Africa',
  'Central Africa',
  'Sub-Saharan Africa',
  'Sahel',
  'Horn of Africa',
  'Great Lakes region',
  'Maghreb',
  'East African Community',

  // Europe
  'Western Europe',
  'Eastern Europe',
  'Central Europe',
  'Northern Europe',
  'Southern Europe',
  'South-Eastern Europe',
  'Southeastern Europe',
  'Baltic region',
  'Baltic states',
  'Baltics',
  'Nordic countries',
  'Nordics',
  'Scandinavia',
  'Balkans',
  'Western Balkans',
  'Iberian Peninsula',
  'Caucasus',
  'South Caucasus',
  'North Caucasus',

  // Middle East and Asia
  'Middle East',
  'Near East',
  'Levant',
  'Gulf states',
  'Persian Gulf',
  'Arabian Peninsula',
  'Central Asia',
  'South Asia',
  'Southeast Asia',
  'South-East Asia',
  'East Asia',
  'Southern Asia',
  'Western Asia',
  'Indian subcontinent',
  'Indochina',

  // Americas and Oceania
  'Latin America',
  'Central America',
  'South America',
  'North America',
  'Caribbean',
  'West Indies',
  'Southern Cone',
  'Andean region',
  'Oceania',
  'Pacific Islands',
  'Melanesia',
  'Polynesia',
  // 'Micronesia' IS ABSENT DELIBERATELY. It names a sovereign state - the
  // Federated States of Micronesia, FSM - as well as a cultural-geographic
  // region. Masking it would erase a country from the resolver, which would be
  // a far worse defect than the one this file fixes. The verification below
  // fails the suite if it is ever added back.

  // Cross-cutting
  'Arctic',
  'Antarctic',
  'Mediterranean',
  'Eurasia',
  'Global South',
  'Global North',
];

/**
 * ENTRIES THAT KNOWINGLY SHADOW A REAL SUBDIVISION.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THE HARD RULE, ENFORCED BY TEST AND NOT NEGOTIABLE: no entry may shadow a
 * SOVEREIGN STATE. Masking a country would delete it from the resolver, which
 * is strictly worse than the defect this file fixes. "Micronesia" was removed
 * for exactly that.
 *
 * THE SOFTER RULE, WHICH THIS SET IMPLEMENTS: an entry MAY shadow a
 * subdivision, but never silently. Anything in this set is a judgement someone
 * made on purpose, with the cost written down, and the verification suite fails
 * on any collision that is NOT listed here. The set exists so that the next
 * person to add a region name cannot do this accidentally.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * "Sahel" — shadows Sahel Region, Burkina Faso (BF-12), a real admin1 unit.
 *
 *   KEPT MASKED, and here is the reasoning I want on the record rather than
 *   buried. In journalistic English "the Sahel" overwhelmingly means the belt
 *   from Senegal to Sudan; a wire story about "violence across the Sahel" is
 *   not a story about one Burkinabè region. Resolving it to BF-12 would produce
 *   a confident, specific, wrong answer with real bounds attached - the exact
 *   failure class this guard exists to remove, merely relocated.
 *
 *   THE MEASURED COST, STATED PLAINLY: the string "Sahel Region" no longer
 *   resolves to BF-12. A query naming Burkina Faso alongside it still resolves
 *   to Burkina Faso at COUNTRY precision, so the country is not lost - only the
 *   region-level fix is, and only for that one name. Given the alternative is a
 *   wrong answer about the whole Sahel, that is the better trade.
 *
 *   IT IS ALSO TEMPORARY. When the controlled supranational gazetteer arrives,
 *   "the Sahel" resolves at REGION precision, "Sahel Region, Burkina Faso"
 *   resolves at PROVINCE, and this entry leaves the set.
 */
export const ACKNOWLEDGED_SUBDIVISION_SHADOWING: readonly string[] = ['Sahel'];

/** A half-open [start, end) span of character offsets in the ORIGINAL text. */
export interface TextSpan {
  readonly start: number;
  readonly end: number;
  readonly phrase: string;
}

/**
 * Escapes a phrase into a regex that matches it case-insensitively on word
 * boundaries, tolerating any run of whitespace or a hyphen between its words.
 *
 * "Sub-Saharan Africa" therefore also matches "Sub Saharan Africa", and
 * "South-East Asia" matches "South East Asia", without either spelling needing
 * its own entry.
 */
function phrasePattern(phrase: string): RegExp {
  const words = phrase.split(/[\s-]+/).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  return new RegExp(`(?<![\\p{L}\\p{N}])${words.join('[\\s-]+')}(?![\\p{L}\\p{N}])`, 'giu');
}

const PATTERNS: readonly { readonly phrase: string; readonly pattern: RegExp }[] =
  SUPRANATIONAL_REGIONS.map((phrase) => ({ phrase, pattern: phrasePattern(phrase) }));

/**
 * Finds every supranational phrase in the text.
 *
 * LONGEST WINS, and overlaps are dropped. "Southern Africa" and "Africa" would
 * both match the same characters if "Africa" were in the list; the longer span
 * is kept so a phrase is never half-masked, which would leave a fragment behind
 * and reintroduce the exact defect this file removes.
 */
export function findSupranationalSpans(text: string): readonly TextSpan[] {
  const found: TextSpan[] = [];

  for (const { phrase, pattern } of PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      found.push({ start: match.index, end: match.index + match[0].length, phrase });
    }
  }

  found.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);

  const kept: TextSpan[] = [];
  for (const span of found) {
    if (kept.some((other) => span.start < other.end && other.start < span.end)) continue;
    kept.push(span);
  }

  return kept.sort((a, b) => a.start - b.start);
}

/**
 * Blanks the supranational spans out of the text, PRESERVING EVERY CHARACTER
 * OFFSET.
 *
 * WHY LENGTH-PRESERVING MASKING RATHER THAN DELETION. The resolver runs four
 * tokenizers over this text — folded tokens, raw tokens, casing flags, segment
 * starts — and every downstream rule indexes across them by position. Deleting
 * characters would shift three of those arrays out of alignment with the
 * fourth, which is the class of bug that made "Washington, D.C." unreachable
 * until the tokenizers were made to agree. Replacing each letter with a lower-
 * case 'x' changes nothing any of them measures except the identity of the
 * words, which is exactly and only what needs to change.
 *
 * 'x' is chosen because it is a letter (so the token survives tokenization and
 * keeps the slot), it is lowercase (so the article-mode capitalisation gate
 * refuses it independently), and no gazetteer name is a run of x's.
 */
export function maskSupranationalSpans(text: string, spans: readonly TextSpan[]): string {
  if (spans.length === 0) return text;

  let masked = '';
  let cursor = 0;

  for (const span of spans) {
    masked += text.slice(cursor, span.start);
    masked += text.slice(span.start, span.end).replace(/[\p{L}\p{N}]/gu, 'x');
    cursor = span.end;
  }

  return masked + text.slice(cursor);
}

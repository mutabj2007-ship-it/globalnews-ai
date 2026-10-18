import { resolveCountryByAnyIdentifier, type CountryMeta } from '@globalnews-ai/shared';
import { resolveGeography } from '../../geo/geo-resolver';

/*
  CTO R164 P-1 — A FOLLOW-UP THAT NAMES A NEW COUNTRY IS NOT ANSWERED FROM THE EARLIER ONE ALONE.

  Measured at a3e5b1e: "What happened in Gaza?" → "How does that affect Kenya?" was routed entirely by
  the earlier question (topic continuity), so only Gaza was searched, Kenya never was, and nothing told
  the reader. The follow-up keeps the earlier EVENT (its place) AND searches the place it names; a
  correction ("not Rwanda, Kenya") replaces the rejected place instead of adding to it. A purely
  anaphoric follow-up ("and yesterday?") names no place and is untouched.
*/

export interface FollowUpGeography {
  /** Countries the earlier question placed its subject in. */
  readonly origin: readonly CountryMeta[];
  /** The words the earlier question named its place with ("gaza"), plus the origin country names. */
  readonly originTerms: readonly string[];
  /** Countries the follow-up names that the earlier question did not. */
  readonly added: readonly CountryMeta[];
  /** Countries the follow-up explicitly rejects ("not Rwanda"). Never searched. */
  readonly rejected: readonly CountryMeta[];
  /** The follow-up corrects the earlier place rather than asking about its effect elsewhere. */
  readonly correction: boolean;
}

/** "not Rwanda", "not the DRC" — the name after a negation, up to the next clause break. "not only
    Kenya but also Uganda" rejects nothing (Politics R164 V-5). */
const NEGATED =
  /\bnot\s+(?!(?:only|just|merely|simply|even)\b)(?:the\s+)?([\p{L}][\p{L}'’ -]*?)(?=\s*(?:[,.;:!?]|$|\s(?:but|rather|instead|i\s+mean)\b))(?!\s*,?\s*but\s+also\b)/giu;
const CORRECTION = /^\s*(?:no\b|not\b|sorry\b|actually\b|i\s+meant?\b)|\bi\s+meant\b/i;

function countriesOf(text: string): CountryMeta[] {
  const geo = resolveGeography(text);
  if (geo.precision === 'UNKNOWN') return [];
  const places = geo.place ? [geo.place] : geo.candidates;
  const out = new Map<string, CountryMeta>();
  for (const p of places) {
    const c = resolveCountryByAnyIdentifier(p.country.iso3);
    if (c !== undefined) out.set(c.iso3, c);
  }
  return [...out.values()];
}

function blank(text: string, phrase: string): string {
  const at = text.toLowerCase().indexOf(phrase.toLowerCase());
  return at < 0
    ? text
    : text.slice(0, at) + ' '.repeat(phrase.length) + text.slice(at + phrase.length);
}

export function readFollowUpGeography(followUp: string, prior: string): FollowUpGeography {
  const rejected = new Map<string, CountryMeta>();
  let rest = followUp;
  for (const m of followUp.matchAll(NEGATED)) {
    const phrase = (m[1] ?? '').trim();
    const c = resolveCountryByAnyIdentifier(phrase) ?? countriesOf(phrase)[0];
    if (c !== undefined) {
      rejected.set(c.iso3, c);
      rest = blank(rest, phrase);
    }
  }
  const origin = countriesOf(prior);
  const priorPlace = resolveGeography(prior).matchedText;
  const originTerms = [
    ...new Set(
      [...(priorPlace === undefined ? [] : [priorPlace]), ...origin.map((c) => c.name)].map((t) =>
        t.toLowerCase(),
      ),
    ),
  ];
  const named = countriesOf(rest).filter((c) => !rejected.has(c.iso3));
  return {
    origin,
    originTerms,
    added: named.filter((c) => !origin.some((o) => o.iso3 === c.iso3)),
    rejected: [...rejected.values()],
    correction: rejected.size > 0 || CORRECTION.test(followUp),
  };
}

/** The follow-up without its rejected places or the correction opener ("No, not Rwanda, Kenya." → "Kenya."). */
export function withoutRejectedPlaces(followUp: string): string {
  return followUp
    .replace(NEGATED, '')
    .replace(/\bnot\s+(?:the\s+)?(?=[,.;:!?]|$)/giu, '')
    .replace(/^\s*(?:(?:no|sorry|actually)\b[\s,.;:!]*)+/i, '')
    .replace(/^[\s,.;:]+/, '');
}

/** A sentence asserting that one thing affects / causes / drives another (Politics R164 V-4 widened it). */
const IMPACT_CLAIM =
  /\b(?:affect(?:s|ed|ing)?|impact(?:s|ed|ing)?|caus(?:e|es|ed|ing)|le(?:a)?ds? to|led to|result(?:s|ed|ing)? in|because of|due to|owing to|as a result|consequences?|conseq\p{L}*|driv(?:e|es|ing|en)|hurt(?:s|ing)?|boost(?:s|ed|ing)?|spill(?:s|ed|ing)?\s*over|spillover|knock-on|ripple|means? (?:that|for|higher|lower|more|less)|exposed to|exposure|vulnerab\p{L}*|rais(?:e|es|ed|ing) (?:prices?|costs?|inflation)|push(?:es|ed|ing)? (?:up|down)|weigh(?:s|ed|ing)? on|pressure on|threat(?:en|ens|ened)?\s+to|disrupt(?:s|ed|ing|ion)?|fuel(?:s|led|ling)?\s+(?:inflation|prices|tension)|(?:higher|lower|rising|falling) (?:prices?|costs?) (?:in|for))\b/iu;
export function assertsImpact(text: string | undefined): boolean {
  return text !== undefined && IMPACT_CLAIM.test(text);
}

/** Every answer list a cause-and-effect claim can sit in (the same set the negative-assertion guard reads). */
const IMPACT_LIST_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ['keyFacts', 'claim'],
  ['context', 'claim'],
  ['relevance', 'claim'],
  ['immediateImpacts', 'claim'],
  ['spilloverImplications', 'claim'],
  ['watchNext', 'claim'],
  ['agreements', 'point'],
  ['timeline', 'event'],
];

/** The answer with every list item asserting an effect removed (Politics R164 V-3). Removal only. */
export function withoutImpactClaims<T extends object>(
  analysis: T,
): { analysis: T; removed: number } {
  let removed = 0;
  const out: Record<string, unknown> = { ...(analysis as Record<string, unknown>) };
  for (const [field, key] of IMPACT_LIST_FIELDS) {
    const items = out[field];
    if (!Array.isArray(items)) continue;
    out[field] = items.filter((item: unknown) => {
      const text = (item as Record<string, unknown> | null)?.[key];
      const bad = typeof text === 'string' && assertsImpact(text);
      if (bad) removed += 1;
      return !bad;
    });
  }
  return { analysis: (removed === 0 ? analysis : out) as T, removed };
}

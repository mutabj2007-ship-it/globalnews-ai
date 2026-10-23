import {
  countryAliasesFor,
  getCuratedCityNames,
  resolveCountryByAnyIdentifier,
  resolveCountryByCity,
  type CountryMeta,
} from '@globalnews-ai/shared';
import { resolveGeography } from '../../geo/geo-resolver';
import { COUNTRY_DEMONYMS_BY_ISO3, demonymForms } from '../../news/country/country-relevance.util';

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
  /\b(?:affect(?:s|ed|ing)?|impact(?:s|ed|ing)?|caus(?:e|es|ed|ing)|le(?:a)?ds? to|led to|result(?:s|ed|ing)? in|because of|due to|owing to|as a result|consequences?|conseq\p{L}*|driv(?:e|es|ing|en)|hurt(?:s|ing)?|boost(?:s|ed|ing)?|spill(?:s|ed|ing)?\s*over|spillover|knock-on|ripple|means? (?:that|for|higher|lower|more|less|cheaper|costlier|dearer)|makes? (?:\p{L}+\s+){0,3}(?:cheaper|costlier|dearer|more expensive)|exposed to|exposure|vulnerab\p{L}*|rais(?:e|es|ed|ing) (?:prices?|costs?|inflation)|linked to|tied to|(?:rais|push|driv)(?:es|ing)\s+(?:\p{L}+\s+){0,2}?(?:prices?|costs?|bills?|inflation)(?:\s+up)?|(?:higher|lower|rising|falling)\s+(?:\p{L}+\s+){0,2}?(?:prices?|costs?)|push(?:es|ed|ing)? (?:up|down)|weigh(?:s|ed|ing)? on|pressure on|threat(?:en|ens|ened)?\s+to|disrupt(?:s|ed|ing|ion)?|fuel(?:s|led|ling)?\s+(?:inflation|prices|tension)|(?:higher|lower|rising|falling) (?:prices?|costs?) (?:in|for))\b/iu;
export function assertsImpact(text: string | undefined): boolean {
  return text !== undefined && IMPACT_CLAIM.test(text);
}

/**
 * Politics RV-12b — a report LINKS the places only when one sentence of its accessible body
 * names the earlier event's place AND asserts an effect: an effect of something else in a report
 * that mentions the event elsewhere is no link.
 */
export function bodyAssertsEffectOf(
  summary: string | undefined,
  originTerms: readonly string[],
): boolean {
  return (summary ?? '').split(/(?<=[.!?])\s+|\n+/).some((sentence) => {
    const lower = sentence.toLowerCase();
    return originTerms.some((term) => lower.includes(term)) && assertsImpact(sentence);
  });
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

/** The two sides of a cross-region follow-up, as lower-case names / demonyms / place terms. */
export interface ImpactPlaces {
  readonly origin: readonly string[];
  readonly destination: readonly string[];
}

/** Politics LX-2c — every occurrence is tested: "Gazans fled; since the Gaza war …" names Gaza. */
function namesTerm(lower: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(lower);
}

/*
  EA LX-2 P2 — "Congolese" names BOTH Congos, so it can never enter COUNTRY_DEMONYMS_BY_ISO3, which
  routes country relevance (it would send a Brazzaville story to Kinshasa). Here it is guard-only:
  the both-places test can only WITHHOLD an uncited sentence, so a word shared by two countries
  over-withholds at worst and never misroutes.
*/
const GUARD_ONLY_DEMONYMS: Readonly<Partial<Record<string, readonly string[]>>> = {
  COD: ['congolese'],
  COG: ['congolese'],
};

/**
 * Politics LX-2a/b — the both-places test reads each side as a reader names it: the origin
 * country's demonyms ("Palestinian") and the earlier place's own demonym ("Gazan"); the destination
 * country's demonyms and its curated cities ("Nairobi"). Guard-only and fail-closed: a wider
 * vocabulary can only withhold an uncited sentence, never admit one. The link test
 * (bodyAssertsEffectOf) keeps the narrow originTerms, so what counts as a link is unchanged.
 */
export function impactPlacesFor(
  originTerms: readonly string[],
  origin: readonly CountryMeta[],
  destination: readonly CountryMeta[],
): ImpactPlaces {
  const demonymsOf = (c: CountryMeta) => [
    ...(COUNTRY_DEMONYMS_BY_ISO3[c.iso3] ?? []).flatMap(demonymForms),
    ...(GUARD_ONLY_DEMONYMS[c.iso3] ?? []),
  ];
  const citiesOf = (c: CountryMeta) =>
    getCuratedCityNames().filter((city) => resolveCountryByCity(city)?.iso3 === c.iso3);
  /* EA LX-2 P2 — how readers name the country ("DRC", "Democratic Republic of Congo"), from the
     resolver's own alias table. Two-letter aliases ("us", "uk") are left out: "us" is a pronoun. */
  const aliasesOf = (c: CountryMeta) =>
    countryAliasesFor(c.iso3).filter((alias) => alias.length >= 3);
  /* "gaza" → "gazan", "gazans": only the regular -a → -an form */
  const placeDemonyms = originTerms.flatMap((t) => (/\p{L}a$/u.test(t) ? [`${t}n`, `${t}ns`] : []));
  const lower = (terms: readonly string[]) => [...new Set(terms.map((t) => t.toLowerCase()))];
  return {
    origin: lower([
      ...originTerms,
      ...placeDemonyms,
      ...origin.flatMap((c) => [...demonymsOf(c), ...aliasesOf(c)]),
    ]),
    destination: lower(
      destination.flatMap((c) => [c.name, ...demonymsOf(c), ...aliasesOf(c), ...citiesOf(c)]),
    ),
  };
}

/**
 * Politics LX-1 — structural, wording-independent: a sentence naming BOTH the earlier event's
 * place and the place asked about relates them, whatever verb it uses ("suffered amid", "pays more
 * since"), so while an impact-gap state is set it needs a linking citation like an effect does.
 */
function namesBothPlaces(text: string, places: ImpactPlaces | undefined): boolean {
  if (places === undefined) return false;
  const lower = text.toLowerCase();
  return (
    places.origin.some((term) => namesTerm(lower, term)) &&
    places.destination.some((term) => namesTerm(lower, term))
  );
}

function sentencesIn(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim().length > 0);
}

/** One sentence (or item) that asserts an effect, or relates both places, needs a linking citation. */
function needsLinkCitation(text: string, places: ImpactPlaces | undefined): boolean {
  return assertsImpact(text) || namesBothPlaces(text, places);
}

/** Does any sentence of the text assert an effect, or relate both places? */
export function relatesPlaces(text: string | undefined, places?: ImpactPlaces): boolean {
  return sentencesIn(text ?? '').some((sentence) => needsLinkCitation(sentence, places));
}

/** True when the item cites one of the citable (linking) reports. */
function citesAny(item: unknown, citable: ReadonlySet<string> | undefined): boolean {
  const ids = (item as Record<string, unknown> | null)?.['sourceArticleIds'];
  return citable !== undefined && Array.isArray(ids) && ids.some((id) => citable.has(String(id)));
}

/**
 * The answer with every item asserting an effect removed (Politics R164 V-3) — unless it cites a
 * report that itself links the places and asserts the effect (CTO R164 R-1, PO-approved
 * 2026-10-23). With no citable set, every effect is removed. Removal only.
 */
export function withoutImpactClaims<T extends object>(
  analysis: T,
  citable?: ReadonlySet<string>,
  places?: ImpactPlaces,
): { analysis: T; removed: number } {
  let removed = 0;
  const keep = (item: unknown, key: string) => {
    const text = (item as Record<string, unknown> | null)?.[key];
    const bad =
      typeof text === 'string' && needsLinkCitation(text, places) && !citesAny(item, citable);
    if (bad) removed += 1;
    return !bad;
  };
  const out: Record<string, unknown> = { ...(analysis as Record<string, unknown>) };
  for (const [field, key] of IMPACT_LIST_FIELDS) {
    const items = out[field];
    if (!Array.isArray(items)) continue;
    out[field] = items.filter((item: unknown) => keep(item, key));
  }
  /* Politics R164 — the effect-bearing structures beyond the plain lists. */
  if (Array.isArray(out['affectedParties'])) {
    out['affectedParties'] = (out['affectedParties'] as unknown[]).filter((item) =>
      keep(item, 'effect'),
    );
  }
  if (Array.isArray(out['differences'])) {
    out['differences'] = (out['differences'] as Array<Record<string, unknown>>)
      .map((difference) =>
        Array.isArray(difference['positions'])
          ? {
              ...difference,
              positions: (difference['positions'] as unknown[]).filter((p) =>
                keep(p, 'description'),
              ),
            }
          : difference,
      )
      .filter(
        (difference) =>
          !Array.isArray(difference['positions']) || difference['positions'].length > 0,
      );
  }
  const significance = out['significance'] as Record<string, unknown> | null | undefined;
  if (
    significance !== null &&
    significance !== undefined &&
    Array.isArray(significance['rationale'])
  ) {
    out['significance'] = {
      ...significance,
      rationale: (significance['rationale'] as unknown[]).filter((item) => keep(item, 'claim')),
    };
  }
  return { analysis: (removed === 0 ? analysis : out) as T, removed };
}

/**
 * CTO R164 R-1 — may the brief's summary carry its effect sentence(s)? Only when every effect it
 * asserts sits in a statement that cites a linking report. A summary without validated statements
 * cannot show its citation, so an effect in it fails closed.
 */
export function impactSummaryCited(
  summary: string | undefined,
  statements:
    | ReadonlyArray<{ readonly text: string; readonly sourceArticleIds: readonly string[] }>
    | undefined,
  citable: ReadonlySet<string>,
  places?: ImpactPlaces,
): boolean {
  if (!relatesPlaces(summary, places)) return true;
  if (statements === undefined || statements.length === 0) return false;
  let rest = summary ?? '';
  for (const statement of statements) {
    if (!needsLinkCitation(statement.text, places)) continue;
    if (!statement.sourceArticleIds.some((id) => citable.has(id))) return false;
    rest = rest.split(statement.text).join(' ');
  }
  return !relatesPlaces(rest, places);
}

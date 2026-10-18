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
  /** Countries the follow-up names that the earlier question did not. */
  readonly added: readonly CountryMeta[];
  /** Countries the follow-up explicitly rejects ("not Rwanda"). Never searched. */
  readonly rejected: readonly CountryMeta[];
  /** The follow-up corrects the earlier place rather than asking about its effect elsewhere. */
  readonly correction: boolean;
}

/** "not Rwanda", "not the DRC" — the name after a negation, up to the next clause break. */
const NEGATED =
  /\bnot\s+(?:the\s+)?([\p{L}][\p{L}'’ -]*?)(?=\s*(?:[,.;:!?]|$|\s(?:but|rather|instead|i\s+mean)\b))/giu;
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
  const named = countriesOf(rest).filter((c) => !rejected.has(c.iso3));
  return {
    origin,
    added: named.filter((c) => !origin.some((o) => o.iso3 === c.iso3)),
    rejected: [...rejected.values()],
    correction: rejected.size > 0 || CORRECTION.test(followUp),
  };
}

/** The follow-up without its rejected places ("No, not Rwanda, Kenya." → "No, , Kenya."). */
export function withoutRejectedPlaces(followUp: string): string {
  return followUp.replace(NEGATED, '').replace(/\bnot\s+(?:the\s+)?(?=[,.;:!?]|$)/giu, '');
}

/** A sentence asserting that one thing affects / causes / drives another. */
const IMPACT_CLAIM =
  /\b(?:affect(?:s|ed|ing)?|impact(?:s|ed|ing)?|caus(?:e|es|ed|ing)|le(?:a)?ds? to|result(?:s|ed)? in|because of|due to|driv(?:e|es|ing|en)|hurt(?:s|ing)?|boost(?:s|ed|ing)?|spill(?:s|ed|ing)? over|knock-on|ripple)\b/i;
export function assertsImpact(text: string | undefined): boolean {
  return text !== undefined && IMPACT_CLAIM.test(text);
}

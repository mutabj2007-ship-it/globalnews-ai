import { COUNTRY_ALIASES_BY_ISO3, resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';
import type { CountryMeta, LanguageCode } from '@globalnews-ai/shared';
import { allCities, citiesNamed } from '../../geo/geo-gazetteer';
import { foldForPlan } from '../../news/relevance/compound-plan-relevance.util';
import {
  flightIdentifiersIn,
  type EventEndpoint,
  type EventFrameAdmission,
  type EventType,
} from '../../news/relevance/event-frame-relevance.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK TRUTHFUL RETRIEVAL R2A — THE EVENT / CLAIM FRAME (BETA-ASK-006)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * "tell me in details what happened today in the Air from Dubai to Israel in a passenger
 * plane. How did it happen?, Indicate if there were some casualties in that incidence" was
 * reduced to its one resolvable country (Israel) and answered from Israel country news. The
 * question is about ONE EVENT: an aviation incident on a route, with claims about how it
 * happened and about casualties.
 *
 * Deterministic, no model call. The frame is built only when the question names an event
 * type (closed vocabulary) AND a place or an identifier the existing authorities resolve:
 *
 *   endpoints     "from X to Y" — each side resolved by the shared country authority, else
 *                 the governed gazetteer (most populous match). A country endpoint is also
 *                 named by its large cities (≥ 200,000, from the gazetteer), so "Tel Aviv"
 *                 names Israel without any place being written here.
 *   identifiers   flight-number shapes the reader typed.
 *   claims        OCCURRENCE always; ROUTE with two endpoints; TIME when a day is stated;
 *                 CAUSE ("how did it happen", "why"); CASUALTIES ("casualties", "injured" …).
 *   queries       at most 3 bounded searches built from the endpoints and the event noun.
 *
 * Anything else returns undefined and keeps exactly its path.
 */

export type ClaimType =
  | 'OCCURRENCE'
  | 'ACTOR'
  | 'ACTION'
  | 'LOCATION'
  | 'ROUTE'
  | 'TIME'
  | 'CASUALTIES'
  | 'CAUSE'
  | 'IMPACT';

export interface ClaimFrame {
  readonly id: string;
  readonly type: ClaimType;
  readonly text: string;
}

export interface EventFrame extends EventFrameAdmission {
  readonly origin: EventEndpoint | null;
  readonly destination: EventEndpoint | null;
  readonly claims: readonly ClaimFrame[];
  readonly queries: readonly string[];
}

export const MAX_EVENT_SEARCHES = 3;
const MIN_ENDPOINT_CITY_POPULATION = 200_000;
const TODAY_HOURS = 72;

const EVENT_TYPE_QUESTION: ReadonlyArray<{
  type: EventType;
  pattern: RegExp;
  noun: string;
  alt: string;
}> = [
  {
    type: 'AVIATION',
    pattern:
      /\b(?:flights?|planes?|aircraft|airliners?|airplanes?|aeroplanes?|jets?|airlines?|airports?|in the air|emergency landing|turbulence)\b/i,
    noun: 'flight',
    alt: 'plane',
  },
  {
    type: 'MARITIME',
    pattern: /\b(?:ships?|vessels?|ferr(?:y|ies)|boats?|capsiz\w*|shipwreck)\b/i,
    noun: 'ferry',
    alt: 'boat',
  },
  {
    type: 'RAIL',
    pattern: /\b(?:trains?|railway|derail\w*)\b/i,
    noun: 'train',
    alt: 'railway',
  },
];

const ROUTE =
  /\bfrom\s+(?:the\s+)?([\p{Lu}][\p{L}'’.-]*(?:\s+[\p{Lu}][\p{L}'’.-]*){0,3})\s+to\s+(?:the\s+)?([\p{Lu}][\p{L}'’.-]*(?:\s+[\p{Lu}][\p{L}'’.-]*){0,3})/u;

function countryNames(country: CountryMeta): string[] {
  const names = new Set<string>([foldForPlan(country.name)]);
  for (const [alias, iso3] of Object.entries(COUNTRY_ALIASES_BY_ISO3)) {
    if (iso3 === country.iso3) names.add(foldForPlan(alias));
  }
  for (const lang of ['en', 'fr']) {
    const shown = new Intl.DisplayNames([lang], { type: 'region' }).of(country.iso2);
    if (shown !== undefined) names.add(foldForPlan(shown));
  }
  return [...names].filter((n) => n.length >= 3);
}

function majorCities(country: CountryMeta): string[] {
  return allCities()
    .filter(
      (c) => c.cc === country.iso2 && c.fc !== 'PPLX' && (c.p ?? 0) >= MIN_ENDPOINT_CITY_POPULATION,
    )
    .map((c) => foldForPlan(c.n))
    .filter((n) => /^[a-z ]+$/.test(n));
}

/** Resolve the reader's span to a place: the longest prefix the country authority or gazetteer knows. */
export function resolveEndpoint(span: string): EventEndpoint | null {
  const words = span.trim().split(/\s+/);
  for (let n = words.length; n >= 1; n -= 1) {
    const label = words
      .slice(0, n)
      .join(' ')
      .replace(/[.,;:!?]+$/, '');
    const country = resolveCountryByAnyIdentifier(label);
    if (country !== undefined && label.length > 3) {
      return {
        label,
        iso3: country.iso3,
        names: [...new Set([...countryNames(country), ...majorCities(country)])],
      };
    }
    const cities = [...citiesNamed(foldForPlan(label))].sort((a, b) => (b.p ?? 0) - (a.p ?? 0));
    const city = cities[0];
    const owner = city === undefined ? undefined : resolveCountryByAnyIdentifier(city.cc);
    if (city !== undefined && owner !== undefined) {
      return {
        label,
        iso3: owner.iso3,
        names: [...new Set([foldForPlan(city.n), ...countryNames(owner)])],
      };
    }
  }
  return null;
}

export function deriveEventFrame(
  question: string,
  requestedLanguage: LanguageCode,
  requestInstant: Date = new Date(),
): EventFrame | undefined {
  if (requestedLanguage !== 'en') return undefined;
  const kind = EVENT_TYPE_QUESTION.find((k) => k.pattern.test(question));
  if (kind === undefined) return undefined;

  const route = question.match(ROUTE);
  const origin = route?.[1] ? resolveEndpoint(route[1]) : null;
  const destination = route?.[2] ? resolveEndpoint(route[2]) : null;
  const endpoints = [origin, destination].filter((e): e is EventEndpoint => e !== null);
  const identifiers = kind.type === 'AVIATION' ? flightIdentifiersIn(question) : [];
  if (endpoints.length === 0 && identifiers.length === 0) return undefined;

  const today = /\b(?:today|tonight|this (?:morning|afternoon|evening))\b/i.test(question);
  const claims: ClaimFrame[] = [
    {
      id: 'occurrence',
      type: 'OCCURRENCE',
      text: `An ${kind.type.toLowerCase()} incident occurred`,
    },
  ];
  if (origin !== null && destination !== null) {
    claims.push({
      id: 'route',
      type: 'ROUTE',
      text: `The incident involved travel from ${origin.label} to ${destination.label}`,
    });
  }
  if (today) claims.push({ id: 'time', type: 'TIME', text: 'The incident happened today' });
  if (/\b(?:how did|how it happened|why|cause[sd]?|reason)\b/i.test(question)) {
    claims.push({ id: 'cause', type: 'CAUSE', text: 'How / why the incident happened' });
  }
  if (/\b(?:casualt\w*|injur\w*|dead|deaths?|killed|hurt|wounded|fatalit\w*)\b/i.test(question)) {
    claims.push({ id: 'casualties', type: 'CASUALTIES', text: 'Whether there were casualties' });
  }

  const place = endpoints.map((e) => e.label).join(' ');
  const queries = [
    ...identifiers.map((id) => `${id.toUpperCase()} ${kind.noun}`),
    ...(place === '' ? [] : [`${place} ${kind.noun}`, `${place} ${kind.alt}`]),
  ].slice(0, MAX_EVENT_SEARCHES);

  return {
    eventType: kind.type,
    endpoints,
    origin,
    destination,
    identifiers,
    notBefore: today
      ? new Date(requestInstant.getTime() - TODAY_HOURS * 3_600_000).toISOString()
      : null,
    claims,
    queries,
  };
}

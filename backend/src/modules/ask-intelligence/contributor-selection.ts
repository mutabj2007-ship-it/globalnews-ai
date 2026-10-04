import type { AskR2Route } from '../ask-router/ask-r2-route';
import { resolveGeography } from '../geo/geo-resolver';
import { nisrDistricts, nisrProvinces } from '../geo/rwanda-nisr.authority';
import type { AskContributorSelection } from './ask-contribution.contract';
import { readRetainedImihigo } from './imihigo-retained.reader';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * INTELLIGENCE BINDING R1 — WHICH GOVERNED READS SERVE THIS QUESTION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Pure: no I/O, no model, no clock. It reads ONLY what the existing Ask router already
 * produced — the envelope's typed geography, its analytical domains, the plan's specialist
 * legs — plus, per contributor, a closed list of the SUBJECT TERMS of the one retained
 * artifact that contributor can serve. That list is scope matching for a governed artifact
 * ("does this question ask about procurement notices / the CPI series / the Imihigo cycle?"),
 * not an intent classifier: it cannot route, re-route or re-classify a question, and a
 * question the router already answers takes exactly the same route with or without it.
 *
 * The reader never names a module. They ask "How serious is the situation in eastern DRC?";
 * the router already reads DR Congo; the Conflict contributor is consulted because the
 * question is a country situation question — and contributes only if governed retained
 * Conflict observations exist for that scope.
 */

/** Closed, reviewed subject terms per artifact (EN + the PL forms reporting/readers use). */
export const CONTRIBUTOR_SCOPE_TERMS = {
  /** A country's security/situation, served by Conflict. "security" itself is the governed domain. */
  SITUATION: [
    'situation',
    'crisis',
    'fighting',
    'clashes',
    'violence',
    'unrest',
    'insurgency',
    'rebels',
    'armed groups',
    'sytuacja',
    'sytuacji',
    'kryzys',
    'walki',
    'przemoc',
    'starcia',
  ],
  /** The retained TED contract-notice capture. */
  PROCUREMENT: [
    'procurement',
    'tender',
    'tenders',
    'public contract',
    'public contracts',
    'contract notice',
    'contract notices',
    'przetarg',
    'przetargi',
    'przetargów',
    'zamówienia publiczne',
    'zamówień publicznych',
  ],
  /** The retained NISR headline CPI series. */
  CPI: [
    'cpi',
    'consumer price',
    'consumer prices',
    'consumer price index',
    'inflation',
    'inflacja',
    'inflacji',
    'ceny konsumpcyjne',
    'wskaźnik cen',
  ],
  /** The retained NISR Imihigo evaluation. */
  IMIHIGO: ['imihigo', 'performance contract', 'performance contracts'],
  /** Humanitarian conditions (served by no governed reader in R1 — degraded, disclosed). */
  HUMANITARIAN: [
    'humanitarian',
    'displacement',
    'displaced',
    'refugee',
    'refugees',
    'famine',
    'food insecurity',
    'humanitarna',
    'humanitarny',
    'humanitarnej',
    'uchodźcy',
    'uchodźców',
    'przesiedleni',
    'głód',
  ],
} as const;

function normalize(text: string): string {
  return ` ${(text ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;
}

export function namesScope(text: string, terms: readonly string[]): boolean {
  const normalized = normalize(text);
  return terms.some((term) => normalized.includes(` ${normalize(term).trim()} `));
}

/** An NISR district named in the question (the governed authority's canonical names). */
export function nisrDistrictNamed(
  text: string,
): { id: string; name: string; province: string | null } | null {
  const normalized = normalize(text);
  for (const district of nisrDistricts()) {
    const name = district.name.canonicalName;
    if (normalized.includes(` ${normalize(name).trim()} `)) {
      const province = nisrProvinces().find((p) => p.provinceId === district.provinceId);
      return {
        id: district.externalId,
        name,
        province: province?.name.canonicalName ?? null,
      };
    }
  }
  return null;
}

/** A place finer than a country, from the existing geography resolver (no network). */
export function placeNamed(text: string): string | null {
  const resolution = resolveGeography(text);
  const place = resolution.place as
    { cityName?: string; regionName?: string; country?: { name: string } } | undefined;
  if (resolution.precision !== 'CITY' || place?.cityName === undefined) return null;
  return [place.cityName, place.regionName, place.country?.name].filter(Boolean).join(', ');
}

/**
 * LIVE ACCEPTANCE REPAIR R1 — a compass qualifier the reader put on a country ("eastern DRC",
 * "wschodnia Ukraina"). It is NOT resolved to provinces (no governed mapping exists); it is only
 * returned so a country-scoped read can disclose that it did not narrow to it.
 */
const SUBNATIONAL_QUALIFIERS: readonly string[] = [
  'north eastern',
  'north western',
  'south eastern',
  'south western',
  'northeastern',
  'northwestern',
  'southeastern',
  'southwestern',
  'eastern',
  'western',
  'northern',
  'southern',
  'central',
  'wschodni',
  'wschodnia',
  'wschodniej',
  'wschodnim',
  'zachodni',
  'zachodnia',
  'zachodniej',
  'północny',
  'północna',
  'północnej',
  'południowy',
  'południowa',
  'południowej',
  'środkowy',
  'środkowa',
  'środkowej',
];

export function subnationalQualifier(text: string): string | null {
  const normalized = normalize(text);
  return SUBNATIONAL_QUALIFIERS.find((q) => normalized.includes(` ${q} `)) ?? null;
}

const cycleKey = (value: string): string => value.replace(/\s+/g, '').replace(/[-–—]/g, '/');

/**
 * Does a governed retained artifact cover EXACTLY this stated period for this question? Today:
 * the admitted NISR Imihigo evaluation cycle, asked about by name.
 */
export function retainedCycleCovers(question: string, statedPeriod: string): boolean {
  if (!namesScope(question, CONTRIBUTOR_SCOPE_TERMS.IMIHIGO)) return false;
  const view = readRetainedImihigo();
  if (view.state !== 'ADMITTED') return false;
  /* The period reader may capture "2024" from "2024/2025": every stated year must lie
     inside the retained cycle, and the cycle must be named in the question. */
  const cycleYears: string[] = [...(view.cycle.match(/\d{4}/g) ?? [])];
  const statedYears: string[] = [...(statedPeriod.match(/\d{4}/g) ?? [])];
  const named = (question.match(/\d{4}\s*[/\-–—]\s*\d{2,4}/g) ?? []).some((span) => {
    const years = span.match(/\d{2,4}/g) ?? [];
    const expanded = years.map((y) => (y.length === 2 ? `${(years[0] ?? '').slice(0, 2)}${y}` : y));
    return cycleKey(expanded.join('/')) === cycleKey(view.cycle);
  });
  return named && statedYears.length > 0 && statedYears.every((y) => cycleYears.includes(y));
}

export function selectContributors(route: AskR2Route): AskContributorSelection[] {
  const own = route.envelope.rawQuestion;
  const typed = route.envelope.geography.candidates.find(
    (c) => c.source === 'TYPED_GEOGRAPHY' && /^[A-Z]{3}$/.test(c.value),
  )?.value;
  /*
    SHARED R4 CONTINUITY (CTO "EARLIER_TURN SUBJECT CARRY") — a turn the R4 resolver bound to a
    SPECIFIC earlier answer ("Show me the official evidence.", "Is that still true now?") carries no
    subject of its own: its subject is that answer's, exposed by the execution contract as
    route.inheritedScope. It is read here AS INHERITED — the scope is marked EARLIER_TURN, the typed
    geography stays empty — and only when the turn names no place of its own (a new explicit
    subject always wins). No contributor-specific logic: every governed contributor sees it alike.
  */
  const inherited = route.inheritedScope;
  const inherit =
    inherited !== undefined &&
    typed === undefined &&
    nisrDistrictNamed(own) === null &&
    placeNamed(own) === null;
  const question = inherit ? inherited.question : own;
  const district = nisrDistrictNamed(question);
  const inheritedCountry =
    inherit && inherited.countries.length === 1 ? (inherited.countries[0] ?? null) : null;
  const countryIso3 = typed ?? (district !== null ? 'RWA' : inheritedCountry);
  const place = district === null ? placeNamed(question) : null;
  const domains = route.envelope.domains.domains;
  const scope = {
    countryIso3,
    district: district === null ? null : { id: district.id, name: district.name },
    place,
    qualifier: district === null && place === null ? subnationalQualifier(question) : null,
    ...(inherit ? { provenance: 'EARLIER_TURN' as const } : {}),
  };

  const out: AskContributorSelection[] = [];

  if (district !== null || place !== null) {
    out.push({ contributorId: 'GEOGRAPHY', domain: 'geography', applicability: 'CONTEXT', scope });
  }

  const dataScoped =
    namesScope(question, CONTRIBUTOR_SCOPE_TERMS.PROCUREMENT) ||
    namesScope(question, CONTRIBUTOR_SCOPE_TERMS.CPI) ||
    namesScope(question, CONTRIBUTOR_SCOPE_TERMS.IMIHIGO);
  const security = domains.includes('security');
  if (
    countryIso3 !== null &&
    (security || (!dataScoped && namesScope(question, CONTRIBUTOR_SCOPE_TERMS.SITUATION)))
  ) {
    const leg = route.plan.specialistLegs.find((l) => l.domain === 'security');
    out.push({
      contributorId: 'CONFLICT',
      /* Security intelligence is served THROUGH Conflict — one domain, one store. */
      domain: 'security',
      applicability: leg?.requiredness === 'REQUIRED' ? 'REQUIRED' : 'SUPPLEMENTARY',
      scope,
    });
  }
  if (countryIso3 !== null && namesScope(question, CONTRIBUTOR_SCOPE_TERMS.PROCUREMENT)) {
    out.push({
      contributorId: 'MARKET_PROCUREMENT',
      domain: 'economic',
      applicability: 'SUPPLEMENTARY',
      scope,
    });
  }
  if (countryIso3 !== null && namesScope(question, CONTRIBUTOR_SCOPE_TERMS.CPI)) {
    out.push({
      contributorId: 'ECONOMY_CPI',
      domain: 'economic',
      applicability: 'SUPPLEMENTARY',
      scope,
    });
  }
  if (
    namesScope(question, CONTRIBUTOR_SCOPE_TERMS.IMIHIGO) &&
    (district !== null || countryIso3 === 'RWA')
  ) {
    out.push({
      contributorId: 'IMIHIGO',
      domain: 'governance',
      applicability: 'SUPPLEMENTARY',
      scope,
    });
  }
  if (namesScope(question, CONTRIBUTOR_SCOPE_TERMS.HUMANITARIAN)) {
    out.push({
      contributorId: 'HUMANITARIAN',
      domain: 'humanitarian',
      applicability: 'SUPPLEMENTARY',
      scope,
    });
  }
  return out;
}

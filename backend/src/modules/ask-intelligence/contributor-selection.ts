import { detectRequestedDomains } from '../analysis/query/detect-analytical-domains.util';
import type { AskR2Route } from '../ask-router/ask-r2-route';
import { PL_DOMAIN_FORMS } from '../ask-router/normalization/pl-readings.resources';
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
 * The reader never names a module. They ask "How serious is the fighting in eastern DRC?";
 * the router already reads DR Congo; the Conflict contributor is consulted because the
 * question is an armed-conflict / security question — and contributes only if governed
 * retained Conflict observations exist for that scope.
 *
 * STAGE 2 · T3 — a typed country plus a GENERIC noun ("situation", "crisis", "sytuacja",
 * "kryzys") is never Conflict relevance: "What is the travel / visa / political / energy
 * situation in X?" carries no security domain and must not inject Conflict records.
 */

/** Closed, reviewed subject terms per artifact (EN + the PL forms reporting/readers use). */
export const CONTRIBUTOR_SCOPE_TERMS = {
  /**
   * Armed-conflict vocabulary served by Conflict that the reading's security lexicon does not
   * (yet) carry. Domain words only: a generic noun ("situation", "crisis", "sytuacja",
   * "kryzys") is NEVER here — the router's security domain facet / security leg is the
   * primary key (STAGE 2 · T3).
   */
  ARMED_CONFLICT: [
    'fighting',
    'clashes',
    'violence',
    'unrest',
    'insurgency',
    'rebels',
    'armed groups',
    'walki',
    'przemoc',
    'starcia',
  ],
  /**
   * R4 + EAST AFRICA CONVERGENCE — the SECURITY DOMAIN words of the five interpreter-first locales
   * (fr/de/es/pt/ar), whose questions get no lexical domain reading from the router (EN reads
   * `detectRequestedDomains`, PL reads `PL_DOMAIN_FORMS`). The same class of word the EN reader keys
   * on ("security", "military", "conflict"), whole tokens only. Generic nouns ("situation", "Lage",
   * "situación", "situação", "الوضع") are NEVER here: T3 holds in every locale.
   */
  SECURITY_DOMAIN_INTERPRETER_FIRST: [
    'sécurité',
    'sécuritaire',
    'sécuritaires',
    'militaire',
    'militaires',
    'conflit',
    'conflits',
    'sicherheit',
    'sicherheitslage',
    'militär',
    'militärische',
    'militärischen',
    'konflikt',
    'konflikte',
    'seguridad',
    'segurança',
    'militar',
    'militares',
    'conflicto',
    'conflictos',
    'conflito',
    'conflitos',
    'الأمن',
    'الأمني',
    'الأمنية',
    'أمني',
    'أمنية',
    'العسكري',
    'العسكرية',
    'النزاع',
    'الصراع',
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

/**
 * R4 + EAST AFRICA CONVERGENCE — does this text carry the SECURITY domain, read by the router's own
 * readers (EN `detectRequestedDomains`, PL `PL_DOMAIN_FORMS.security`) plus the interpreter-first
 * locales' closed security words? Used for a turn that INHERITS an earlier answer's question: the
 * route's domain facet belongs to the follow-up's own words ("Is that still true now?"), so the
 * inherited subject is read the way the router read it when it was asked. No generic noun ever
 * qualifies (STAGE 2 · T3).
 */
export function securityDomainNamed(text: string): boolean {
  if (detectRequestedDomains(text).some((d) => d.domain === 'security')) return true;
  if (namesScope(text, Object.values(PL_DOMAIN_FORMS.security).flat())) return true;
  return interpreterFirstSecurityNamed(text);
}

/**
 * "Food security" is a food-supply subject, not a security one. The EN reader's substring match
 * still has that leak (recorded as a T3 todo, not changed here); the interpreter-first words must
 * not add it in five more languages, so these phrases are removed before the words are read.
 */
const FOOD_SECURITY_PHRASES: readonly string[] = [
  'sécurité alimentaire',
  'insécurité alimentaire',
  'seguridad alimentaria',
  'inseguridad alimentaria',
  'segurança alimentar',
  'insegurança alimentar',
  'الأمن الغذائي',
];

function interpreterFirstSecurityNamed(text: string): boolean {
  let normalized = normalize(text);
  for (const phrase of FOOD_SECURITY_PHRASES) {
    normalized = normalized.split(` ${normalize(phrase).trim()} `).join(' ');
  }
  return namesScope(normalized, CONTRIBUTOR_SCOPE_TERMS.SECURITY_DOMAIN_INTERPRETER_FIRST);
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
  /* STAGE 2 · T3 — keyed on the router's security domain facet (or its security specialist
     leg), never on a typed country + a generic noun. R4 + EA CONVERGENCE: an inherited subject
     is read by the same domain readers (the facet describes the follow-up's words, not the
     subject's); an interpreter-first question (fr/de/es/pt/ar) has no lexical facet, so its
     closed security words stand in for it. */
  const leg = route.plan.specialistLegs.find((l) => l.domain === 'security');
  const security =
    leg !== undefined ||
    domains.includes('security') ||
    (inherit
      ? securityDomainNamed(question)
      : interpreterFirstSecurityNamed(question));
  if (
    countryIso3 !== null &&
    (security || (!dataScoped && namesScope(question, CONTRIBUTOR_SCOPE_TERMS.ARMED_CONFLICT)))
  ) {
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

import { routeAskR2, type AskR2Route } from '../ask-router/ask-r2-route';
import { landedSpecialistRegistryPort } from '../ask-router/specialist-registry.port';
import { selectContributors } from './contributor-selection';

/**
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * STAGE 2 · T3 — SHARED ASK CONTRIBUTOR-SELECTION DOMAIN LEAK (REPRODUCE + SPEC ONLY)
 * ════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Defect: `selectContributors` selects the CONFLICT contributor (up to 10 UCDP records injected
 * into the governed prompt as specialist evidence) for ANY typed country + a generic noun from
 * `CONTRIBUTOR_SCOPE_TERMS.SITUATION` ("situation", "crisis", "sytuacja", "sytuacji", "kryzys"),
 * even when the router's reading / SemanticTurnIR carries NO security domain and the plan
 * carries NO security specialist leg. Contract: a country match + a generic noun is never
 * sufficient domain relevance.
 *
 * Everything here runs the REAL router (routeAskR2 → qualified reading → SemanticTurnIR
 * interpretTurn → frozen C plan) and the REAL selectContributors. Nothing on the decision path
 * is mocked.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * HOW THIS FILE FLIPS WHEN THE FIX LANDS (docs/convergence/stage2/T3-contributor-selection.patch)
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * Every `test.failing(...)` below encodes the CORRECT expectation that the current seam
 * violates; jest reports it as passing ONLY while the assertion fails. When the fix lands every
 * `test.failing` MUST become `test` (the patch does exactly that) — otherwise the suite goes
 * red, which is the intended tripwire. Positive controls are plain `test`s that must stay green
 * before and after the fix.
 */

const NOW = new Date('2026-10-04T12:00:00.000Z');
type Lang = 'en' | 'pl';

const route = (q: string, lang: Lang): AskR2Route =>
  routeAskR2(
    {
      originalQuestion: q,
      sourceLanguage: lang,
      normalizationLanguage: lang,
      displayLanguage: lang,
      origin: 'ASK',
    },
    { computeConsent: 'GRANTED', requestInstant: NOW.toISOString() },
    { specialistRegistry: landedSpecialistRegistryPort(() => ['CONFLICT'], ['CONFLICT']) },
  );

const typedCountry = (r: AskR2Route): string | undefined =>
  r.envelope.geography.candidates.find(
    (c) => c.source === 'TYPED_GEOGRAPHY' && /^[A-Z]{3}$/.test(c.value),
  )?.value;
const hasSecurityFacet = (r: AskR2Route): boolean =>
  r.envelope.domains.domains.includes('security') ||
  r.plan.specialistLegs.some((l) => l.domain === 'security');
const contributorIds = (r: AskR2Route): string[] =>
  selectContributors(r).map((s) => s.contributorId);

/* ── defect probes: [question, lang, typed country, the domains the router CORRECTLY reads] ── */
const DEFECT_PROBES: readonly [string, Lang, string, readonly string[]][] = [
  /* Stage 0 probes */
  ['What is the travel situation in Kenya?', 'en', 'KEN', []],
  ['What is the visa situation for travelling to Ukraine?', 'en', 'UKR', []],
  ['What is the political situation in Poland?', 'en', 'POL', ['political']],
  ['What is the energy situation in Poland?', 'en', 'POL', ['infrastructure']],
  [
    'What is the economic situation in Poland and who is the president?',
    'en',
    'POL',
    ['economic', 'political'],
  ],
  ['Jaka jest sytuacja w Polsce?', 'pl', 'POL', []],
  /* the same leak, other non-security subjects / PL parity */
  ['What is the situation in Poland?', 'en', 'POL', []],
  ['What is the weather situation in Kenya?', 'en', 'KEN', []],
  ['What is the unemployment situation in Kenya?', 'en', 'KEN', []],
  ['What is the economic crisis in Poland?', 'en', 'POL', ['economic']],
  ['What is the crisis in Sudan?', 'en', 'SDN', []],
  ['Jaka jest sytuacja polityczna w Polsce?', 'pl', 'POL', ['political']],
  ['Jaka jest sytuacja gospodarcza w Polsce?', 'pl', 'POL', ['economic']],
  ['Jaka jest sytuacja energetyczna w Polsce?', 'pl', 'POL', ['infrastructure']],
  ['Jaka jest sytuacja wizowa dla podróżujących na Ukrainę?', 'pl', 'UKR', []],
  ['Jaki jest kryzys energetyczny w Polsce?', 'pl', 'POL', ['infrastructure']],
  /* Contract decision (see dossier §4): a bare "situation in <country>" is the same question
     as "What is happening in <country>?", which the binding contract already asserts selects NO
     contributor (ask-intelligence.spec.ts §10/11/12). The existing G1 phrasing is therefore
     itself an instance of the leak; the fix rewords those existing fixtures. */
  ['How serious is the situation in eastern DRC?', 'en', 'COD', []],
  ['How serious is the situation in DRC?', 'en', 'COD', []],
  ['Jaka jest sytuacja we wschodniej Ukrainie?', 'pl', 'UKR', []],
];

describe('T3 · first incorrect transition — the router is right, the term net is wrong', () => {
  /* These PASS today: they pin that normalization → reading → SemanticTurnIR → plan yield the
     correct typed country and a domain set WITHOUT security, and NO security specialist leg.
     The first wrong value is produced inside selectContributors (SITUATION term net). */
  test.each(DEFECT_PROBES)(
    'upstream is correct for %s (%s): country %s, domains %j, no security facet',
    (q, lang, iso3, domains) => {
      const r = route(q, lang);
      expect(typedCountry(r)).toBe(iso3);
      expect(r.envelope.domains.domains).toEqual(domains);
      expect(hasSecurityFacet(r)).toBe(false);
      expect(r.plan.specialistLegs.map((l) => l.domain)).not.toContain('security');
    },
  );
});

describe('T3 · negative controls — country + generic noun must NOT select Conflict', () => {
  test.each(DEFECT_PROBES)('%s (%s) does not select CONFLICT', (q, lang) => {
    expect(contributorIds(route(q, lang))).not.toContain('CONFLICT');
  });

  /* Already correct today — must stay correct. */
  test.each([
    ['What is the weather in Poland?', 'en'],
    ['What is the weather in Kenya this week?', 'en'],
    ['Jaka jest pogoda w Polsce?', 'pl'],
    ['Is it safe to travel to Kenya?', 'en'],
    ['Tell me about Rwanda', 'en'],
    ['Opowiedz mi o Rwandzie', 'pl'],
    ['What is the history and background of DR Congo?', 'en'],
    ['What is the population of Sudan?', 'en'],
    ['Who is the prime minister of Poland?', 'en'],
    ['Who won the Polish election?', 'en'],
    ['What is happening in Kenya?', 'en'],
  ] as [string, Lang][])('%s (%s) does not select CONFLICT', (q, lang) => {
    expect(contributorIds(route(q, lang))).not.toContain('CONFLICT');
  });

  /* A data-scoped question keeps its own governed contributor and never Conflict. */
  test.each([
    ['What is the inflation situation in Poland?', 'en', 'ECONOMY_CPI'],
    ['What is the procurement situation in Poland?', 'en', 'MARKET_PROCUREMENT'],
  ] as [string, Lang, string][])('%s (%s) → %s only', (q, lang, id) => {
    expect(contributorIds(route(q, lang))).toEqual([id]);
  });
});

describe('T3 · humanitarian — Humanitarian is selected, Conflict is not', () => {
  const HUMANITARIAN: readonly [string, Lang][] = [
    ['What is the humanitarian situation in Sudan?', 'en'],
    ['What is the refugee situation in Poland?', 'en'],
    ['What is the humanitarian situation in eastern DRC?', 'en'],
  ];
  test.each(HUMANITARIAN)('%s (%s) selects HUMANITARIAN', (q, lang) => {
    expect(contributorIds(route(q, lang))).toContain('HUMANITARIAN');
  });
  test.each(HUMANITARIAN)('%s (%s) does not select CONFLICT', (q, lang) => {
    expect(contributorIds(route(q, lang))).not.toContain('CONFLICT');
  });
});

describe('T3 · positive controls — genuine armed-conflict / security questions keep Conflict', () => {
  /* Keyed on the router's security domain facet / security specialist leg. */
  test.each([
    ['What is the security situation in Somalia?', 'en', 'SOM'],
    ['What is the security situation in Kenya?', 'en', 'KEN'],
    ['What is the conflict in Sudan about?', 'en', 'SDN'],
    ['Is there violence in Haiti?', 'en', 'HTI'],
    /* explicit security / threat words: a travel-safety question that NAMES security or a threat
       is a security question by the router's own reading — Conflict is legitimate */
    ['What is the security situation for tourists travelling to Kenya?', 'en', 'KEN'],
    ['Any travel advice for Kenya? Is there a threat to visitors?', 'en', 'KEN'],
    ['Jaka jest sytuacja bezpieczeństwa w Ukrainie?', 'pl', 'UKR'],
    ['Jaka jest sytuacja bezpieczeństwa w Kenii?', 'pl', 'KEN'],
    ['Jaka jest sytuacja bezpieczeństwa w Somalii?', 'pl', 'SOM'],
    ['Jaki jest konflikt na Ukrainie?', 'pl', 'UKR'],
    ['Czy w Haiti jest przemoc?', 'pl', 'HTI'],
  ] as [string, Lang, string][])('%s (%s) → security facet → CONFLICT/%s', (q, lang, iso3) => {
    const r = route(q, lang);
    expect(hasSecurityFacet(r)).toBe(true);
    expect(selectContributors(r).find((s) => s.contributorId === 'CONFLICT')).toMatchObject({
      domain: 'security',
      scope: { countryIso3: iso3 },
    });
  });

  /* Armed-conflict-specific vocabulary the reading's security lexicon does not yet carry
     (fighting / clashes / armed groups / insurgency / unrest / walki / starcia). These are
     domain words, NOT generic nouns, and must keep Conflict (the patch keeps them). */
  test.each([
    ['Is there fighting in eastern DRC?', 'en', 'COD'],
    ['Are there clashes between armed groups in Sudan?', 'en', 'SDN'],
    ['Is there an insurgency in Mozambique?', 'en', 'MOZ'],
    ['Is there unrest in Kenya?', 'en', 'KEN'],
    ['Czy na Ukrainie trwają walki?', 'pl', 'UKR'],
    ['Czy w Kenii są starcia?', 'pl', 'KEN'],
  ] as [string, Lang, string][])('%s (%s) → CONFLICT/%s', (q, lang, iso3) => {
    expect(
      selectContributors(route(q, lang)).find((s) => s.contributorId === 'CONFLICT'),
    ).toMatchObject({ domain: 'security', scope: { countryIso3: iso3 } });
  });

  /* Out of T3 scope (different first-incorrect transition, recorded in the dossier §6). */
  test.todo('geography: "Is there fighting in eastern Congo?" types no country (Congo ambiguity)');
  test.todo('geography: PL locative "w Sudanie" ("Czy w Sudanie trwają walki?") types no country');
  test.todo(
    'reading: EN "food insecurity" yields the security domain (substring "security" in detectRequestedDomains)',
  );
});

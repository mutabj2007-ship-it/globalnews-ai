import * as intentModule from '../analysis/query/query-intent.util';
import * as domainModule from '../analysis/query/detect-analytical-domains.util';
import { missingSeams, routeAskR2, type AskR2Route } from './ask-r2-route';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';

/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE C — IC-8 INTENT SEAM WIRING GUARD (§5).
 *
 * Proven by MUTATION, not by inspection: each seam is cut or perturbed at its source and
 * the frozen plan must move. A producer that returned a plausible default would leave
 * the plan unchanged under these mutations, and these tests would fail.
 *
 *   IC8-1  the landed intent classifier actually feeds the producer and frozen C
 *   IC8-2  source-language normalization actually feeds the qualified reading
 *   IC8-3  the qualified reading actually feeds frozen C
 *   IC8-4  a missing required reading is observable (missingSeams names it)
 *   IC8-5  a candidate cannot qualify with the seam absent
 */

const deps = { specialistRegistry: specialistRegistryFixture };
const ask = (q: string, lg: 'en' | 'pl' = 'en', map?: string): AskR2Route =>
  routeAskR2(
    {
      originalQuestion: q,
      sourceLanguage: lg,
      normalizationLanguage: lg,
      displayLanguage: lg,
      origin: 'ASK',
    },
    map === undefined ? {} : { mapContextCountry: map },
    deps,
  );

afterEach(() => jest.restoreAllMocks());

describe('IC8-1 — the landed intent classifier feeds the producer and the router', () => {
  it('classifyQueryIntent is called with the reader’s exact question', () => {
    const spy = jest.spyOn(intentModule, 'classifyQueryIntent');
    ask('Czym jest NATO?', 'pl', 'POL');
    expect(spy.mock.calls.some(([q]) => q === 'Czym jest NATO?')).toBe(true);
  });

  it('perturbing the landed intent moves both the eligibility decision and the frozen class', () => {
    const before = ask('What is NATO?', 'en', 'POL');
    expect(before.eligibility?.decision).toBe('SUPPRESSED');
    expect(before.plan.questionClass).toBe('REFERENCE');

    jest.spyOn(intentModule, 'classifyQueryIntent').mockReturnValue({
      intent: 'CURRENT_EVENT',
      sides: [],
      countries: [],
      reason: 'IC-8 mutation',
    });
    const after = ask('What is NATO?', 'en', 'POL');
    expect(after.eligibility?.decision).toBe('ELIGIBLE');
    expect(after.plan.questionClass).toBe('CURRENT_REPORTING');
    expect(after.plan.scopedBy).toBe('MAP_GEOGRAPHY_CONTEXT');
  });
});

describe('IC8-2 — source-language normalization feeds the reading', () => {
  it('a Polish question is read with Polish resources, and its domains carry PL provenance', () => {
    const r = ask('Jakie są zagrożenia bezpieczeństwa w regionie?', 'pl');
    expect(r.outcome.status).toBe('QUALIFIED');
    if (r.outcome.status === 'NOT_READ') return;
    expect(r.outcome.reading.domains.map((d) => [d.value, d.source])).toEqual([
      ['security', 'PL_DOMAIN_FORMS'],
      ['regional', 'PL_DOMAIN_FORMS'],
    ]);
    expect(r.seam.landed?.analyticalDomains).toEqual(['PL_DOMAIN_FORMS', 'PL_DOMAIN_FORMS']);
  });

  it('English domains come from the landed detector: cutting it empties the frozen domain axis', () => {
    expect(ask('What is the security situation on the border?').envelope.domains.domains).toEqual([
      'security',
    ]);
    jest.spyOn(domainModule, 'detectRequestedDomains').mockReturnValue([]);
    expect(ask('What is the security situation on the border?').envelope.domains.domains).toEqual(
      [],
    );
  });
});

describe('IC8-3 — the qualified reading feeds frozen C', () => {
  it('Polish axes are READ (not LANGUAGE_UNSUPPORTED) and carry the reading’s values', () => {
    const r = ask('Jakie są zagrożenia bezpieczeństwa w regionie?', 'pl');
    expect(r.envelope.domains.derivation).toBe('DERIVED');
    expect(r.envelope.domains.domains).toEqual(['security', 'regional']);
    expect(r.envelope.language.questionLanguage).toBe('pl');
    expect(r.plan.refusals).not.toContain('LANGUAGE_UNSUPPORTED');
  });

  it('a stated period reaches the frozen time axis in both languages', () => {
    expect(ask('What happened yesterday in Nairobi?').envelope.time.statedPeriod).toBe('yesterday');
    expect(ask('Co wydarzyło się wczoraj w Nairobi?', 'pl').envelope.time.statedPeriod).toBe(
      'wczoraj',
    );
  });
});

describe('IC8-4 / IC8-5 — a missing seam is observable, and disqualifies', () => {
  const wired = ask('Czym jest NATO?', 'pl', 'POL');

  it('a fully wired route reports no missing seam', () => {
    expect(missingSeams(wired)).toEqual([]);
  });

  it.each([
    [
      'landed readings absent',
      (r: AskR2Route): AskR2Route => ({ ...r, seam: { ...r.seam, landed: null } }),
      'LANDED_READINGS',
    ],
    [
      'eligibility never evaluated',
      (r: AskR2Route): AskR2Route => ({ ...r, seam: { ...r.seam, eligibility: 'NOT_EVALUATED' } }),
      'QQ10_ELIGIBILITY',
    ],
    [
      'axes never derived',
      (r: AskR2Route): AskR2Route => ({ ...r, seam: { ...r.seam, axesDerivedIn: null } }),
      'AXES_NOT_DERIVED',
    ],
    [
      'reading domains not reaching frozen C',
      (r: AskR2Route): AskR2Route => ({
        ...r,
        envelope: { ...r.envelope, domains: { ...r.envelope.domains, domains: ['security'] } },
      }),
      'READING_TO_FROZEN_DOMAINS',
    ],
    [
      'source language lost on the envelope',
      (r: AskR2Route): AskR2Route => ({
        ...r,
        envelope: { ...r.envelope, language: { ...r.envelope.language, questionLanguage: 'en' } },
      }),
      'SOURCE_LANGUAGE_TO_ENVELOPE',
    ],
  ] as const)('%s → named, not defaulted', (_n, cut, seam) => {
    expect(missingSeams(cut(wired))).toContain(seam);
  });
});

describe('ALPHA ENABLEMENT R1 — MC-055: the one landed verdict the wrapper re-reads is traced', () => {
  const route = (q: string, identityVerified: boolean) =>
    routeAskR2(
      {
        originalQuestion: q,
        sourceLanguage: 'en',
        normalizationLanguage: 'en',
        displayLanguage: 'en',
        origin: 'ASK',
      },
      { computeConsent: 'GRANTED', identityVerified },
      { specialistRegistry: specialistRegistryFixture },
    );

  it('"Compare my saved stories" is the personal class, not a member-less comparison', () => {
    const out = route('Compare my saved stories', false);
    expect(out.seam.landedOverride).toBe('PERSONAL_MEMBER_SET');
    expect(out.plan.questionClass).toBe('PERSONAL_INTELLIGENCE');
    expect(out.plan.terminalState).toBe('IDENTITY_REQUIRED');
    expect(missingSeams(out)).toEqual([]);
  });

  it('a member-less comparison that is NOT personal still clarifies (no override)', () => {
    const out = route('Compare them.', false);
    expect(out.seam.landedOverride).toBeNull();
    expect(out.plan.terminalState).toBe('CLARIFICATION_REQUIRED');
  });
});

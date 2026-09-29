import type { ConflictObservation, ConflictRetainedEvidenceDetail } from '@globalnews-ai/shared';
import { routeAskR2, type AskR2Route } from '../ask-router/ask-r2-route';
import { landedSpecialistRegistryPort } from '../ask-router/specialist-registry.port';
import {
  AskSpecialistReadCoordinator,
  citedOutletsOf,
  conflictObservation,
  type AskContributionSet,
} from './ask-specialist-read.coordinator';
import { selectContributors, subnationalQualifier } from './contributor-selection';
import {
  deterministicGovernedSelection,
  explicitOfficialUnavailable,
  governedPromptSection,
  governedRecordBasis,
} from './governed-answer';
import type { AskContribution } from './ask-contribution.contract';

/**
 * ASK INTELLIGENCE BINDING — LIVE ACCEPTANCE REPAIR R1: the pure bridge decisions, proved on the
 * EXACT live G1–G9 questions through the REAL router and REAL selection.
 */
const NOW = new Date('2026-09-29T20:00:00.000Z');
const route = (q: string, lang: 'en' | 'pl' = 'en'): AskR2Route =>
  routeAskR2(
    {
      originalQuestion: q,
      sourceLanguage: lang,
      normalizationLanguage: lang,
      displayLanguage: lang,
      origin: 'ASK',
    },
    { computeConsent: 'GRANTED', requestInstant: NOW.toISOString(), identityVerified: true },
    { specialistRegistry: landedSpecialistRegistryPort(() => ['CONFLICT'], ['CONFLICT']) },
  );

export const G = {
  G1: 'How serious is the situation in eastern DRC?',
  G2: 'What are the important procurement changes in Poland?',
  G3: "What was Ngoma's 2024/2025 Imihigo result?",
  G4: "What was Gasabo's 2024/2025 Imihigo result?",
  G5: 'What is the humanitarian situation in Sudan?',
  G6: 'Russian missile and drone attacks on Ukraine',
  G7: 'What happened in Polish politics today?',
  G8: "What is NBP's official reference rate?",
  G9: "What is Rwanda's latest inflation (CPI)?",
} as const;

const deterministic = (q: string): boolean => {
  const r = route(q);
  return deterministicGovernedSelection(r, selectContributors(r)) !== null;
};

describe('A — which live questions a governed record answers alone (zero model)', () => {
  it.each([
    ['G2', G.G2],
    ['G3', G.G3],
    ['G4', G.G4],
    ['G9', G.G9],
  ])('%s is a deterministic retained-record question', (_id, q) => {
    expect(deterministic(q)).toBe(true);
  });

  it.each([
    ['G1', G.G1],
    ['G5', G.G5],
    ['G6', G.G6],
    ['G7', G.G7],
    ['G8', G.G8],
  ])('%s keeps the ordinary path (reporting / official truth)', (_id, q) => {
    expect(deterministic(q)).toBe(false);
  });

  it('negative controls: a CPI question about another country, an Imihigo question without a district, and a procurement question on a reporting plan stay ordinary', () => {
    expect(deterministic('What is inflation in Kenya?')).toBe(false);
    expect(deterministic('How do Imihigo performance contracts work in Rwanda?')).toBe(false);
    /* situation + procurement → Conflict is not selected (data-scoped), but any non-eligible
       contributor keeps the whole question on the ordinary path */
    expect(deterministic('What is the humanitarian and procurement situation in Poland?')).toBe(
      false,
    );
  });

  it('G8: an explicit OFFICIAL request the plan cannot verify officially is the official-unavailable truth', () => {
    expect(explicitOfficialUnavailable(route(G.G8))).toBe(true);
    expect(
      explicitOfficialUnavailable(route('Jaka jest oficjalna stopa referencyjna NBP?', 'pl')),
    ).toBe(
      route('Jaka jest oficjalna stopa referencyjna NBP?', 'pl').plan.refusals.includes(
        'OFFICIAL_VERIFICATION_UNAVAILABLE',
      ),
    );
    /* no "official" in the question → the ordinary current-status path is untouched */
    expect(explicitOfficialUnavailable(route("What is NBP's reference rate?"))).toBe(false);
    /* "official" without an unverifiable current status (a general question) → untouched */
    expect(explicitOfficialUnavailable(route('What is the official language of Rwanda?'))).toBe(
      false,
    );
  });
});

const contribution = (over: Partial<AskContribution>): AskContribution => ({
  contributorId: 'CONFLICT',
  domain: 'security',
  status: 'USED',
  applicability: 'SUPPLEMENTARY',
  observations: [],
  temporalBasis: 'RETAINED_EVENT_RECORD',
  geographyBasis: 'COD',
  disclosures: [],
  degradationReason: null,
  ...over,
});
const set = (contributions: AskContribution[]): AskContributionSet => ({
  considered: contributions.map((c) => ({
    contributorId: c.contributorId,
    domain: c.domain,
    applicability: c.applicability,
    scope: { countryIso3: 'COD', district: null, place: null },
  })),
  contributions,
});
const obs = (period: string) => ({
  reference: `k-${period}`,
  kind: 'ARMED_CLASH',
  label: null,
  value: null,
  unit: null,
  period,
  geography: 'COD',
  source: { name: 'UCDP', url: null, licence: null },
  retainedAt: null,
});

describe('A — the retained-record decision', () => {
  it('a record → GOVERNED_RECORD; a stated absence (Gasabo) → GOVERNED_NO_RECORD; a failed read → GOVERNED_READ_DEGRADED', () => {
    expect(
      governedRecordBasis(
        set([contribution({ contributorId: 'IMIHIGO', observations: [obs('2024/2025')] })]),
      ),
    ).toBe('GOVERNED_RECORD');
    expect(
      governedRecordBasis(
        set([
          contribution({
            contributorId: 'GEOGRAPHY',
            applicability: 'CONTEXT',
            observations: [obs('')],
          }),
          contribution({
            contributorId: 'IMIHIGO',
            status: 'NO_MATCH',
            disclosures: ['AGGREGATE_NOT_ASSIGNED_TO_DISTRICT'],
          }),
        ]),
      ),
    ).toBe('GOVERNED_NO_RECORD');
    expect(
      governedRecordBasis(
        set([contribution({ contributorId: 'ECONOMY_CPI', status: 'DEGRADED' })]),
      ),
    ).toBe('GOVERNED_READ_DEGRADED');
  });

  it('geography context alone is never a record', () => {
    expect(
      governedRecordBasis(
        set([
          contribution({
            contributorId: 'GEOGRAPHY',
            applicability: 'CONTEXT',
            observations: [obs('')],
          }),
        ]),
      ),
    ).toBe('GOVERNED_NO_RECORD');
  });
});

describe('B — the governed section that binds the ONE model call', () => {
  it('is empty when nothing was considered, so every other prompt stays byte-identical', () => {
    expect(governedPromptSection({ considered: [], contributions: [] })).toBe('');
  });

  it('G1: retained Conflict records are data with rules — not current, no severity, country-level scope', () => {
    const text = governedPromptSection(
      set([
        contribution({
          observations: [obs('2026-08-31')],
          disclosures: [
            'RETAINED_NOT_CURRENT',
            'SEVERITY_NOT_ASSESSED',
            'NO_RECENT_RETAINED_RECORD',
            'SUBNATIONAL_SCOPE_NOT_APPLIED',
          ],
        }),
      ]),
    );
    expect(text).toContain('NOT news reporting, NOT current');
    expect(text).toContain('2026-08-31');
    expect(text).toMatch(/do not rank, grade or characterise severity/);
    expect(text).toMatch(/more than a week old/);
    expect(text).toMatch(/retained scope is country-level/);
    expect(text).toMatch(/do not summarise unrelated reporting/);
    expect(text).toMatch(/Never attach a news evidence id to a retained record/);
  });

  it('G2 (reporting plans): one TED snapshot can never become a change series', () => {
    const text = governedPromptSection(
      set([
        contribution({
          contributorId: 'MARKET_PROCUREMENT',
          domain: 'economic',
          temporalBasis: 'RETAINED_PUBLICATION',
          observations: [obs('2026-09-24')],
          disclosures: ['RETAINED_NOT_CURRENT', 'SNAPSHOT_NOT_CHANGE_SERIES'],
        }),
      ]),
    );
    expect(text).toMatch(/ONE retained publication-day snapshot/);
    expect(text).toMatch(/never describe procurement changes, trends, reforms or developments/);
  });

  it('G5: Humanitarian NOT_ASSESSED is stated as not assessed and forbidden as support — no record is listed for it', () => {
    const text = governedPromptSection(
      set([
        contribution({
          contributorId: 'HUMANITARIAN',
          domain: 'humanitarian',
          status: 'NOT_ASSESSED',
          temporalBasis: 'NONE',
          disclosures: ['HUMANITARIAN_NOT_ASSESSED'],
        }),
        contribution({ status: 'NO_MATCH' }),
      ]),
    );
    expect(text).toMatch(/Humanitarian Intelligence: NOT ASSESSED/);
    expect(text).toMatch(/never state or imply that Humanitarian Intelligence supports/);
    expect(text).toMatch(/not evidence that nothing happened/);
    expect(text).not.toMatch(/Humanitarian Intelligence: \d+ record/);
  });
});

const conflictRow = (key: string, citation: string): ConflictObservation =>
  ({
    observationKey: key,
    identity: { authority: 'UCDP_GED', upstreamEventId: key },
    eventType: 'EVENT_TYPE_NOT_CLASSIFIED',
    owner: 'CONFLICT',
    actors: [],
    geography: { countryIso3: 'COD' },
    temporal: {
      eventStartedAt: '2026-08-31',
      ingestedAt: '2026-09-24T12:00:00Z',
      temporalProvenance: 'EVENT_DATED_BY_SOURCE',
    },
    severity: { kind: 'UNAVAILABLE' },
    sourceReference: { citation },
  }) as unknown as ConflictObservation;

describe('C — Conflict records as concise structured observations (evidence unchanged)', () => {
  const citation =
    'Radio Okapi,2026-08-31,"Attack near Beni";Actualite.cd,2026-09-01,Other;AFP,2026-09-01,X;Extra,2026-09-02,Y';
  const detail: ConflictRetainedEvidenceDetail = {
    observationKey: 'k1',
    authority: 'UCDP_GED',
    upstreamEventId: 'k1',
    sourceParties: ['ADF', 'Civilians'],
    whereDescription: 'Beni territory, North Kivu',
    sourceHeadline: 'Attack near Beni',
    snapshotRetrievalId: 'r',
    snapshotContentAddress: 'a'.repeat(64),
  };

  it('date · place · parties · headline · cited outlets — never the raw concatenated citation as text', () => {
    const o = conflictObservation(conflictRow('k1', citation), detail);
    expect(o.period).toBe('2026-08-31');
    expect(o.label).toBe('Attack near Beni');
    expect(o.label).not.toContain(';');
    expect(o.detail).toEqual({
      place: 'Beni territory, North Kivu',
      parties: ['ADF', 'Civilians'],
      headline: 'Attack near Beni',
      citedOutlets: [
        'Radio Okapi,2026-08-31,"Attack near Beni"',
        'Actualite.cd,2026-09-01,Other',
        'AFP,2026-09-01,X',
      ],
    });
  });

  it('without retained detail the record is unchanged in substance: no label is invented', () => {
    const o = conflictObservation(conflictRow('k2', citation));
    expect(o.label).toBeNull();
    expect(o.detail?.place).toBeNull();
    expect(o.detail?.parties).toEqual([]);
    expect(citedOutletsOf(undefined)).toEqual([]);
  });

  it('the coordinator reads detail in ONE batched call; an unreadable capture leaves the contribution USED', async () => {
    const make = (details: 'ok' | 'throw') => {
      const evidenceDetails = jest.fn(async (keys: readonly string[]) => {
        if (details === 'throw') throw new Error('capture unreadable');
        return new Map(keys.map((k) => [k, { ...detail, observationKey: k }]));
      });
      const c = new AskSpecialistReadCoordinator(
        {
          currentForCountry: jest.fn(async () => [
            conflictRow('k1', citation),
            conflictRow('k2', citation),
          ]),
          evidenceDetails,
        } as never,
        { procurement: jest.fn(async () => []) } as never,
        { readNisrHeadlineCpi: jest.fn() } as never,
      );
      return { c, evidenceDetails };
    };
    const ok = make('ok');
    const set1 = await ok.c.read(route(G.G1), NOW);
    expect(ok.evidenceDetails).toHaveBeenCalledTimes(1);
    expect(ok.evidenceDetails.mock.calls[0][0]).toEqual(['k1', 'k2']);
    const conflict = set1.contributions.find((x) => x.contributorId === 'CONFLICT')!;
    expect(conflict.observations[0].detail?.place).toBe('Beni territory, North Kivu');
    expect(conflict.disclosures).toContain('SUBNATIONAL_SCOPE_NOT_APPLIED');

    const bad = make('throw');
    const set2 = await bad.c.read(route(G.G1), NOW);
    const degradedDetail = set2.contributions.find((x) => x.contributorId === 'CONFLICT')!;
    expect(degradedDetail.status).toBe('USED');
    expect(degradedDetail.observations[0].detail?.place).toBeNull();
  });
});

describe('the sub-national qualifier is disclosed, never resolved', () => {
  it.each([
    ['How serious is the situation in eastern DRC?', 'eastern'],
    ['What is happening in north-eastern Nigeria?', 'north eastern'],
    ['Jaka jest sytuacja we wschodniej Ukrainie?', 'wschodniej'],
    ['How serious is the situation in DRC?', null],
  ])('%s → %s', (q, expected) => {
    expect(subnationalQualifier(q)).toBe(expected);
  });

  it('a named NISR district or city is resolved geography, so no qualifier is carried', () => {
    const [geo] = selectContributors(route(G.G3));
    expect(geo.scope.qualifier).toBeNull();
  });
});

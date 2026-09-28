import { routeAskR2, type AskR2Route, type AskRouteContext } from './ask-r2-route';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';
import { decideContextEligibility, readSemanticSubject } from './normalization/semantic-subject';
import { PL_OFFICE_HEAD_NOUNS, PL_SUBJECT_FRAMES } from './normalization/pl-readings.resources';
import { decideInheritedContextEligibility } from '../analysis/context-producers/inherited-context-eligibility';
import { CORPUS_DELTA, FINAL_CORPUS_DELTA } from '../analysis/context-producers/corpus-addendum';
import { OFFICE_HEAD_NOUNS } from '../analysis/context-producers/office-geography.producer';
import { classifyQueryIntent } from '../analysis/query/query-intent.util';

/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE C — QQ-10 (MANDATORY GATE), contract §3.
 *
 * "Equivalence of meaning, not grammar." Every row below is an EN question and its PL
 * twin asked with the same inherited context; both must reach the same eligibility
 * decision AND the same frozen scope. Categories required by §3 — stable
 * concept/reference, named entity, context-dependent office, context-dependent quantity,
 * current event, explicit typed geography, article anchor — are each present, and the
 * gate is NOT passed by the English rows alone: every assertion is on the pair.
 */

const deps = { specialistRegistry: specialistRegistryFixture };

function ask(q: string, lg: 'en' | 'pl', ctx: AskRouteContext): AskR2Route {
  return routeAskR2(
    {
      originalQuestion: q,
      sourceLanguage: lg,
      normalizationLanguage: lg,
      displayLanguage: lg,
      origin: 'ASK',
    },
    ctx,
    deps,
  );
}

type Row = readonly [
  category: string,
  en: string,
  pl: string,
  ctx: AskRouteContext,
  decision: 'ELIGIBLE' | 'SUPPRESSED',
  /** The rank that scopes the answer. */
  scopedBy: string,
];

const POL = { mapContextCountry: 'POL' };
const RWA = { mapContextCountry: 'RWA' };

const QQ10: readonly Row[] = [
  ['stable concept', 'What is NATO?', 'Czym jest NATO?', POL, 'SUPPRESSED', 'CLASSIFIED_SHAPE'],
  [
    'stable concept',
    'What is inflation?',
    'Czym jest inflacja?',
    POL,
    'SUPPRESSED',
    'CLASSIFIED_SHAPE',
  ],
  [
    'stable concept',
    'What is a recession?',
    'Czym jest recesja?',
    POL,
    'SUPPRESSED',
    'CLASSIFIED_SHAPE',
  ],
  [
    'stable concept',
    'How does an induction motor work?',
    'Jak działa silnik indukcyjny?',
    POL,
    'SUPPRESSED',
    'CLASSIFIED_SHAPE',
  ],
  [
    'stable concept',
    'Explain inflation.',
    'Wyjaśnij inflację.',
    POL,
    'SUPPRESSED',
    'CLASSIFIED_SHAPE',
  ],
  ['named entity', 'Who is Kagame?', 'Kim jest Kagame?', POL, 'SUPPRESSED', 'CLASSIFIED_SHAPE'],
  [
    'named entity',
    'Who is Macron?',
    'Kim jest Macron?',
    { mapContextCountry: 'KEN' },
    'SUPPRESSED',
    'CLASSIFIED_SHAPE',
  ],
  [
    'context-dependent office',
    'Who is the president?',
    'Kto jest prezydentem?',
    RWA,
    'ELIGIBLE',
    'MAP_GEOGRAPHY_CONTEXT',
  ],
  [
    'context-dependent office',
    'Who is the prime minister?',
    'Kto jest premierem?',
    RWA,
    'ELIGIBLE',
    'MAP_GEOGRAPHY_CONTEXT',
  ],
  [
    'context-dependent quantity',
    'What is the inflation rate?',
    'Jaka jest stopa inflacji?',
    RWA,
    'ELIGIBLE',
    'MAP_GEOGRAPHY_CONTEXT',
  ],
  [
    'context-dependent quantity',
    'What is the unemployment rate?',
    'Ile wynosi stopa bezrobocia?',
    RWA,
    'ELIGIBLE',
    'MAP_GEOGRAPHY_CONTEXT',
  ],
  [
    'current event',
    'What is happening?',
    'Co się dzieje?',
    RWA,
    'ELIGIBLE',
    'MAP_GEOGRAPHY_CONTEXT',
  ],
  [
    'current event',
    'What is the security situation?',
    'Jaka jest sytuacja bezpieczeństwa?',
    RWA,
    'ELIGIBLE',
    'MAP_GEOGRAPHY_CONTEXT',
  ],
  [
    'explicit typed geography',
    'What is inflation in Rwanda?',
    'Czym jest inflacja w Rwandzie?',
    POL,
    'ELIGIBLE',
    'TYPED_GEOGRAPHY',
  ],
  [
    'explicit typed geography',
    'What is happening in Kenya?',
    'Co się dzieje w Kenii?',
    POL,
    'ELIGIBLE',
    'TYPED_GEOGRAPHY',
  ],
  [
    'explicit typed geography',
    'Who is the president of Rwanda?',
    'Kto jest prezydentem Rwandy?',
    POL,
    'ELIGIBLE',
    'TYPED_GEOGRAPHY',
  ],
  [
    'article anchor',
    'What is inflation?',
    'Czym jest inflacja?',
    {
      mapContextCountry: 'POL',
      hasResolvedArticleAnchor: true,
      storyAnchorCountry: 'KEN',
      articleRefs: ['a'.repeat(64)],
    },
    'ELIGIBLE',
    'SELECTION',
  ],
];

/**
 * IA-2 — AN INTENTIONAL ASYMMETRY IN THE LANDED INTENT CLASSIFIER, NAMED.
 * The context decision and the scope are equal (asserted above for every row); the class
 * is not, and why is accepted landed authority, not integration drift:
 * `classifyQueryIntent` accepts a Polish country after a place preposition
 * (G-ALPHA-2.1 A: "w Rwandzie" → GEOGRAPHIC_REGIONAL; the PL form set was measured to
 * have zero collisions), while English requires a coordination frame before any country
 * NAME is read, because Georgia / Turkey / Chad / Jordan are homographs. So the PL twin
 * is read as a regional question, the EN twin as an explanation with typed geography.
 */
const CLASS_ASYMMETRIES: Readonly<Record<string, readonly [string, string]>> = {
  'What is inflation in Rwanda?': ['REFERENCE', 'CURRENT_REPORTING'],
};

describe('QQ-10 — IA-2 held visibly', () => {
  it.each(Object.entries(CLASS_ASYMMETRIES))('%s', (en, [enClass, plClass]) => {
    const row = QQ10.find((r) => r[1] === en)!;
    expect(ask(en, 'en', row[3]).plan.questionClass).toBe(enClass);
    expect(ask(row[2], 'pl', row[3]).plan.questionClass).toBe(plClass);
    expect(classifyQueryIntent(row[2], {}).intent).toBe('GEOGRAPHIC_REGIONAL');
  });
});

describe('QQ-10 — EN and PL twins reach the same context decision and the same scope', () => {
  it.each(QQ10.map((r) => [`${r[0]}: ${r[1]} / ${r[2]}`, r] as const))('%s', (_n, row) => {
    const [, en, pl, ctx, decision, scopedBy] = row;
    const e = ask(en, 'en', ctx);
    const p = ask(pl, 'pl', ctx);
    expect({ lang: 'en', decision: e.eligibility?.decision, scopedBy: e.plan.scopedBy }).toEqual({
      lang: 'en',
      decision,
      scopedBy,
    });
    expect({ lang: 'pl', decision: p.eligibility?.decision, scopedBy: p.plan.scopedBy }).toEqual({
      lang: 'pl',
      decision,
      scopedBy,
    });
    if (!(en in CLASS_ASYMMETRIES)) {
      expect(p.plan.questionClass).toBe(e.plan.questionClass);
      expect(p.plan.terminalState).toBe(e.plan.terminalState);
    }
    /* A suppressed Map country is absent from the plan's scope constraints entirely. */
    if (decision === 'SUPPRESSED') {
      for (const r of [e, p]) {
        expect(r.plan.constraints.some((c) => c.value.startsWith('MAP_GEOGRAPHY_CONTEXT:'))).toBe(
          false,
        );
      }
    }
  });

  it('covers every QQ-10 category the contract names', () => {
    expect(new Set(QQ10.map((r) => r[0]))).toEqual(
      new Set([
        'stable concept',
        'named entity',
        'context-dependent office',
        'context-dependent quantity',
        'current event',
        'explicit typed geography',
        'article anchor',
      ]),
    );
  });
});

describe('QQ-10 — G’s rule, not a copy of it', () => {
  /* Parity: for every English row G itself carries, the reading-based decision is G's
     exact result. So G's semantics are consumed, and the only new thing is that the
     subject arrives as a reading. */
  const gRows = [...CORPUS_DELTA, ...FINAL_CORPUS_DELTA];

  it.each(gRows.map((r) => [r.id, r] as const))(
    '%s: identical to decideInheritedContextEligibility',
    (_id, row) => {
      const inputs = {
        typedGeographyPresent:
          row.effectiveGeography !== null && row.effectiveGeography !== row.mapSelected,
        resolvedArticleAnchorPresent: false,
        intentClass: row.intentClass ?? classifyQueryIntent(row.question, {}).intent,
      };
      expect(decideContextEligibility(readSemanticSubject(row.question, 'en'), inputs)).toEqual(
        decideInheritedContextEligibility(row.question, inputs),
      );
    },
  );

  it('an absent intent seam (empty string) suppresses nothing — G’s safe direction', () => {
    const subject = readSemanticSubject('Czym jest NATO?', 'pl');
    expect(
      decideContextEligibility(subject, {
        typedGeographyPresent: false,
        resolvedArticleAnchorPresent: false,
        intentClass: '',
      }).decision,
    ).toBe('ELIGIBLE');
  });
});

describe('QQ-10 — meaning, not grammar', () => {
  it('no English determiner and no simulated article appears in any Polish reading', () => {
    for (const [, , pl] of QQ10) {
      const s = readSemanticSubject(pl, 'pl');
      if (s.subject === undefined) continue;
      expect(s.subject.toLowerCase().split(' ')).not.toEqual(expect.arrayContaining(['the']));
      expect(s.subject.toLowerCase().split(' ')).not.toEqual(expect.arrayContaining(['a', 'an']));
    }
  });

  it('every Polish office noun set is keyed by one of G’s OFFICE_HEAD_NOUNS (no over-coverage)', () => {
    expect(Object.keys(PL_OFFICE_HEAD_NOUNS).filter((k) => !OFFICE_HEAD_NOUNS.includes(k))).toEqual(
      [],
    );
  });

  it('every Polish subject frame names the G frame it mirrors', () => {
    for (const f of PL_SUBJECT_FRAMES) expect(f.mirrors.length).toBeGreaterThan(0);
  });

  it('never guesses a country from a name: "Kim jest Kagame?" carries no typed geography', () => {
    const p = ask('Kim jest Kagame?', 'pl', POL);
    expect(p.source.typedGeography).toBeUndefined();
    expect(p.source.mapContextCountry).toBeUndefined();
    expect(p.source.entityGeography).toBeUndefined();
  });
});

describe('contract §2 — homograph safety', () => {
  it('"the cost of turkey at christmas" does not route to Türkiye', () => {
    const e = ask('What is the cost of turkey at christmas?', 'en', {});
    expect(e.source.typedGeography?.value).not.toBe('TUR');
  });

  it('"the president of Turkey" resolves governed Türkiye through the office construction', () => {
    expect(ask('Who is the president of Turkey?', 'en', {}).source.typedGeography?.value).toBe(
      'TUR',
    );
    expect(ask('Kto jest prezydentem Turcji?', 'pl', {}).source.typedGeography?.value).toBe('TUR');
  });
});

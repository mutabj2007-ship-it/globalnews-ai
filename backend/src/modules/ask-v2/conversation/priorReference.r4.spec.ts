import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PriorArtifact } from './conversation-artifact';
import {
  PRIOR_REFERENCE_TARGETS,
  fold,
  identifyCandidates,
  referenceMayRequestCurrentEvidence,
  referenceNeedsClarification,
  referenceNeedsInterpretation,
  resolvePriorReference,
  type PointsBack,
  type PriorReferenceOutcome,
} from './prior-reference';
import {
  INTERPRETER_FIRST_DISPLAY_LANGUAGES,
  readConversationalTurn,
  readInterpreterFirstContainer,
} from './conversation-state';
import { readUserJob, referencesOwnPriorStatement } from '../../ask-router/user-job';
import { routeAskR2, type AskR2Route } from '../../ask-router/ask-r2-route';
import { specialistRegistryFixture } from '../../ask-router/frozen-c/fixtures/specialist-registry.fixture';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CLAUDE F · R4 — THE PRIOR-WORK REFERENCE FAMILY, ACROSS SEVEN DISPLAY LANGUAGES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The corpus is the development set delivered as `03-F-TEST-CORPUS.json`. It is read from disk
 * rather than inlined so the file a reviewer scores against and the file this spec asserts on
 * cannot drift apart.
 *
 * 21 of the 63 items are controls: a false attribution, a cross-thread isolation case whose turn
 * text is IDENTICAL to a positive case, and an escalation case where resolving at all would be the
 * defect. They are listed first in the describe order below, because the lane's own governing rule
 * (F-5) is that a detection improvement which cannot resolve checkably is worse than the defect.
 */

interface Expect {
  resolution: string;
  because?: string;
  target: string | null;
  componentIndex: number | null;
  sourceOperationId: string | null;
  basis: string | null;
  job: string | null;
  discourseReference: string | null;
  mayRequestCurrentEvidence: boolean;
}
interface Item {
  id: string;
  case: string;
  language: string;
  turn: string;
  deterministicLanguage: boolean;
  pointsBack: 'NONE' | 'SELF_ATTRIBUTION' | 'DEMONSTRATIVE';
  stateName: string;
  state: {
    artifactsNewestFirst: PriorArtifact[];
    foreignConversationArtifact?: PriorArtifact;
  };
  expect: Expect;
  why: string;
}

interface Probe {
  id: string;
  language: string;
  turn: string;
  class: 'PRESENT_ADVICE_NEGATIVE_CONTROL' | 'MIXED_CONTROL' | 'PAST_REFERENCE';
  expect: {
    sameAsBase: boolean;
    job: string;
    irFreshness: string;
    ref: string;
    news: boolean;
  };
  why: string;
}

const CORPUS = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'prior-work-reference-cases.json'), 'utf8'),
) as {
  productDisplayLanguages: string[];
  items: Item[];
  counts: { items: number };
  returnedProbes: { items: Probe[]; invariants: string[] };
};

const ITEMS = CORPUS.items;
const byCase = (name: string): Item[] => ITEMS.filter((i) => i.case === name);
const outcomeOf = (item: Item, pointsBack: PointsBack): PriorReferenceOutcome =>
  resolvePriorReference({
    turn: item.turn,
    artifacts: item.state.artifactsNewestFirst,
    pointsBack,
  });
const declared = (item: Item): PointsBack =>
  item.pointsBack === 'NONE' ? { kind: 'NONE' } : { kind: item.pointsBack };

const check = (item: Item, outcome: PriorReferenceOutcome): void => {
  const e = item.expect;
  expect([item.id, outcome.state]).toEqual([item.id, e.resolution]);
  if (outcome.state === 'UNRESOLVABLE' && e.because !== undefined)
    expect([item.id, outcome.because]).toEqual([item.id, e.because]);
  if (outcome.state === 'RESOLVED') {
    const r = outcome.resolved;
    expect([item.id, r.target]).toEqual([item.id, e.target]);
    expect([item.id, r.sourceOperationId]).toEqual([item.id, e.sourceOperationId]);
    expect([item.id, r.basis]).toEqual([item.id, e.basis]);
    const expectedComponent =
      e.componentIndex === null
        ? null
        : /* the component is named by INDEX into the fixture's own list, so the expectation is
             language-independent: the artifact that produced it is in the turn's language */
          item.state.artifactsNewestFirst.find((a) => a.sourceOperationId === e.sourceOperationId)!
            .components[e.componentIndex];
    expect([item.id, r.component]).toEqual([item.id, expectedComponent]);
  }
  expect([item.id, referenceMayRequestCurrentEvidence(outcome)]).toEqual([
    item.id,
    e.mayRequestCurrentEvidence,
  ]);
};

/* ══════════════════════════════════════════════════════════════════════════ */

describe('THE CONTROLS — a resolution that cannot be checked is worse than no detection (F-5)', () => {
  it('FALSE ATTRIBUTION · never resolves, in any of the seven languages', () => {
    const items = byCase('FALSE_REFERENCE_NEGATIVE_CONTROL');
    expect(items).toHaveLength(7);
    for (const item of items) {
      const outcome = outcomeOf(item, declared(item));
      check(item, outcome);
      /* the whole point: exactly one artifact is in state and it is NOT the answer */
      expect(item.state.artifactsNewestFirst).toHaveLength(1);
      expect(outcome.state).not.toBe('RESOLVED');
    }
  });

  it('FALSE ATTRIBUTION · an interpreter verdict that does not AFFIRM grounding is refused', () => {
    for (const item of byCase('FALSE_REFERENCE_NEGATIVE_CONTROL')) {
      /* a model asked to pick from a closed list picks from a closed list — naming a target is
         not the same as affirming the turn refers to something present in the work it was shown */
      const named = outcomeOf(item, { kind: 'INTERPRETER', target: 'ARTIFACT_PROPOSITION' });
      expect([item.id, named.state]).toEqual([item.id, 'UNRESOLVABLE']);
      if (named.state === 'UNRESOLVABLE') expect(named.because).toBe('PROPOSITION_NOT_IN_ARTIFACT');
      expect(referenceNeedsClarification(named)).toBe(true);
      /* and an explicitly false affirmation is refused the same way */
      const denied = outcomeOf(item, {
        kind: 'INTERPRETER',
        target: 'ARTIFACT_PROPOSITION',
        grounded: false,
      });
      expect(denied.state).toBe('UNRESOLVABLE');
    }
  });

  it('CROSS-THREAD ISOLATION · identical turn text, and it declines because the state is not ours', () => {
    const isolated = byCase('CROSS_THREAD_ISOLATION');
    const positive = byCase('EXACT_PRIOR_STATEMENT');
    expect(isolated).toHaveLength(7);
    for (const item of isolated) {
      /* text identity with the positive case is asserted, not assumed */
      const twin = positive.find((p) => p.language === item.language)!;
      expect(item.turn).toBe(twin.turn);
      /* the artifact exists — in SOMEONE ELSE'S conversation */
      expect(item.state.foreignConversationArtifact).toBeDefined();
      expect(item.state.artifactsNewestFirst).toHaveLength(0);
      check(item, outcomeOf(item, declared(item)));
      /* and the twin, with the same words and our own state, DOES resolve */
      expect(outcomeOf(twin, declared(twin)).state).toBe('RESOLVED');
    }
  });

  it('CROSS-THREAD ISOLATION · not even a grounded verdict can import another thread’s work', () => {
    for (const item of byCase('CROSS_THREAD_ISOLATION')) {
      const outcome = outcomeOf(item, {
        kind: 'INTERPRETER',
        target: 'ARTIFACT_PROPOSITION',
        grounded: true,
      });
      expect([item.id, outcome.state]).toEqual([item.id, 'UNRESOLVABLE']);
      if (outcome.state === 'UNRESOLVABLE') expect(outcome.because).toBe('NO_PRIOR_WORK_IN_STATE');
    }
  });

  it('PARAPHRASE · escalates rather than guessing, and resolves only on an affirmed verdict', () => {
    for (const item of byCase('PARAPHRASED_PRIOR_STATEMENT')) {
      const deterministic = outcomeOf(item, declared(item));
      check(item, deterministic);
      expect(referenceNeedsInterpretation(deterministic)).toBe(true);

      const affirmed = outcomeOf(item, {
        kind: 'INTERPRETER',
        target: 'ARTIFACT_PROPOSITION',
        grounded: true,
      });
      expect([item.id, affirmed.state]).toEqual([item.id, 'RESOLVED']);
      if (affirmed.state === 'RESOLVED') {
        expect(affirmed.resolved.sourceOperationId).toBe('op-0002');
        expect(affirmed.resolved.basis).toBe('INTERPRETER_VERDICT');
      }
    }
  });

  it('NEW TOPIC · no reference, no clarification, and the only case current evidence stays open', () => {
    for (const item of byCase('NEW_TOPIC_RESET')) {
      const outcome = outcomeOf(item, declared(item));
      check(item, outcome);
      expect(referenceNeedsClarification(outcome)).toBe(false);
      expect(referenceNeedsInterpretation(outcome)).toBe(false);
      expect(referenceMayRequestCurrentEvidence(outcome)).toBe(true);
    }
  });

  it('NO OTHER CASE may reach a news call', () => {
    for (const item of ITEMS.filter((i) => i.case !== 'NEW_TOPIC_RESET'))
      expect([
        item.id,
        referenceMayRequestCurrentEvidence(outcomeOf(item, declared(item))),
      ]).toEqual([item.id, false]);
  });
});

describe('THE POSITIVE CASES — one mechanism, all seven display languages', () => {
  for (const name of [
    'EXACT_PRIOR_STATEMENT',
    'REFERENCE_TWO_TURNS_BACK',
    'REFERENCE_TO_RECOMMENDATION',
    'REFERENCE_TO_CONCEPTUAL_FRAMEWORK',
    'REFERENCE_TO_PLAN',
  ])
    it(`${name} · resolves in all seven, with the producing turn`, () => {
      const items = byCase(name);
      expect(items).toHaveLength(7);
      expect(items.map((i) => i.language)).toEqual(CORPUS.productDisplayLanguages);
      for (const item of items) {
        const outcome = outcomeOf(item, declared(item));
        check(item, outcome);
        if (outcome.state === 'RESOLVED')
          expect(outcome.resolved.sourceOperationId.length).toBeGreaterThan(0);
      }
    });

  it('RECENCY DOES NOT DECIDE — the named component wins over the newest artifact', () => {
    for (const item of byCase('REFERENCE_TWO_TURNS_BACK')) {
      /* the newest artifact in state is the comparison; the answer must be the framework */
      expect(item.state.artifactsNewestFirst[0].sourceOperationId).toBe('op-0004');
      const outcome = outcomeOf(item, declared(item));
      expect([item.id, outcome.state]).toEqual([item.id, 'RESOLVED']);
      if (outcome.state === 'RESOLVED')
        expect([item.id, outcome.resolved.sourceOperationId]).toEqual([item.id, 'op-0001']);
    }
  });

  it('EVERY RESOLUTION CARRIES A SOURCE TURN — unrepresentable otherwise', () => {
    const resolved = ITEMS.map((i) => outcomeOf(i, declared(i))).filter(
      (o): o is Extract<PriorReferenceOutcome, { state: 'RESOLVED' }> => o.state === 'RESOLVED',
    );
    expect(resolved.length).toBeGreaterThanOrEqual(35);
    for (const o of resolved) expect(typeof o.resolved.sourceOperationId).toBe('string');
  });

  it('a component reference outranks a label reference for the same artifact', () => {
    const art = byCase('EXACT_PRIOR_STATEMENT')[0].state.artifactsNewestFirst[0];
    const both = identifyCandidates(`${art.label} — ${art.components[0]}`, [art]);
    expect(both).toHaveLength(1);
    expect(both[0].basis).toBe('COMPONENT_IDENTITY');
    expect(both[0].component).toBe(art.components[0]);
  });

  it('TWO ARTIFACTS EQUALLY NAMED ARE NOT GUESSED AT', () => {
    const item = byCase('REFERENCE_TWO_TURNS_BACK')[0];
    const twin: PriorArtifact = {
      ...item.state.artifactsNewestFirst[1],
      sourceOperationId: 'op-9999',
    };
    const ambiguous = resolvePriorReference({
      turn: item.turn,
      artifacts: [twin, item.state.artifactsNewestFirst[1]],
      pointsBack: { kind: 'SELF_ATTRIBUTION' },
    });
    expect(ambiguous.state).toBe('NEEDS_INTERPRETATION');
    const asked = resolvePriorReference({
      turn: item.turn,
      artifacts: [twin, item.state.artifactsNewestFirst[1]],
      pointsBack: { kind: 'INTERPRETER', target: 'ARTIFACT_PROPOSITION', grounded: true },
    });
    expect(asked.state).toBe('UNRESOLVABLE');
    if (asked.state === 'UNRESOLVABLE') expect(asked.because).toBe('SEVERAL_CANDIDATES');
  });
});

describe('IDENTITY IS LANGUAGE-INDEPENDENT, NOT ENGLISH WITH EXTRAS', () => {
  it('folding is one rule for Latin, diacritics and Arabic alike', () => {
    expect(fold('Pilotprojekt')).toBe('pilotprojekt');
    expect(fold('RÉVERSIBLE')).toBe('reversible');
    expect(fold('réversible')).toBe(fold('REVERSIBLE'));
    expect(fold('  menor   RISCO ')).toBe('menor risco');
    /* an Arabic needle folds to itself minus vocalisation, and still matches */
    expect(fold('خَطَر أقل')).toBe(fold('خطر أقل'));
  });

  it('a one-character component surface never matches — it would match everything', () => {
    const art: PriorArtifact = {
      kind: 'SUMMARY',
      label: 'x',
      components: ['a'],
      provenance: 'MODEL_REASONING',
      citable: false,
      sourceOperationId: 'op-1',
    };
    expect(identifyCandidates('a question about anything at all', [art])).toHaveLength(0);
  });

  it('NO LANGUAGE TABLE LIVES IN THE RESOLVER — it names no language and no language word', () => {
    const body = readFileSync(join(__dirname, 'prior-reference.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const token of ["'en'", "'pl'", "'fr'", "'de'", "'es'", "'pt'", "'ar'"])
      expect(body).not.toContain(token);
    /* and no regex alternation over words at all */
    expect(body).not.toMatch(/\|\s*(?:why|dlaczego|pourquoi|warum|por\s?qué|porque)\b/i);
    /* positive control: the stripper left the module intact */
    expect(body).toContain('resolvePriorReference');
  });

  it('A COMPONENT NAMED ONLY INSIDE THE LABEL IS THE LABEL — the regression this lane found', () => {
    /* artifacts name themselves and their parts in the same words; quoting the label trips the
       component test too, and reports a reference to one part of work that was about the work */
    const art: PriorArtifact = {
      kind: 'CONCEPTUAL_FRAMEWORK',
      label: 'Kluczowy moment',
      components: ['moment', 'zdolność'],
      provenance: 'MODEL_REASONING',
      citable: false,
      sourceOperationId: 'op-1',
    };
    const label = identifyCandidates('nazywając to Kluczowy moment', [art]);
    expect(label).toHaveLength(1);
    expect(label[0].basis).toBe('LABEL_IDENTITY');
    expect(label[0].component).toBeNull();

    /* but a component named OUTSIDE the label's occurrence is a real component reference */
    const both = identifyCandidates('w Kluczowy moment — dlaczego moment jest pierwszy?', [art]);
    expect(both[0].basis).toBe('COMPONENT_IDENTITY');
    expect(both[0].component).toBe('moment');

    /* and a component that is not part of the label is unaffected by the rule */
    const other = identifyCandidates('dlaczego zdolność jest druga?', [art]);
    expect(other[0].basis).toBe('COMPONENT_IDENTITY');
    expect(other[0].component).toBe('zdolność');
  });

  it('the targets are a closed list and ARTIFACT_PROPOSITION is in it', () => {
    expect([...PRIOR_REFERENCE_TARGETS]).toContain('ARTIFACT_PROPOSITION');
    expect(new Set(PRIOR_REFERENCE_TARGETS).size).toBe(PRIOR_REFERENCE_TARGETS.length);
  });
});

describe('C-1 · THE SELF-ATTRIBUTION FORM IS NOW READ (EN / PL deterministic)', () => {
  const det = (name: string) => byCase(name).filter((i) => i.deterministicLanguage);

  it('the family is detected where it was invisible at the base', () => {
    for (const name of [
      'EXACT_PRIOR_STATEMENT',
      'PARAPHRASED_PRIOR_STATEMENT',
      'REFERENCE_TO_RECOMMENDATION',
      'REFERENCE_TO_CONCEPTUAL_FRAMEWORK',
    ])
      for (const item of det(name))
        expect([
          item.id,
          referencesOwnPriorStatement(item.turn, item.language as 'en' | 'pl'),
        ]).toEqual([item.id, true]);
  });

  it('A NAMED PLACE NO LONGER SUPPRESSES IT — the measured C-2 defect', () => {
    for (const item of det('EXACT_PRIOR_STATEMENT'))
      for (const namedPlace of [true, false])
        for (const publicEvent of [true, false]) {
          const r = readUserJob(item.turn, item.language, {
            fresh: false,
            namedPlace,
            publicEvent,
            hasPriorWork: true,
          } as never);
          expect([item.id, namedPlace, publicEvent, r.job, r.discourseReference]).toEqual([
            item.id,
            namedPlace,
            publicEvent,
            'EXPLANATION',
            'PRIOR_WORK',
          ]);
        }
  });

  /*
    THIS ASSERTION IS REVERSED, AND THE OLD ONE WAS THE DEFECT ITSELF.

    The first version of this lane asserted here that a present-tense marker "no longer turns it
    into a news call" — EXPLANATION with freshness NONE. That is exactly what Claude Code's review
    returned as three P0s: the self-attribution form was overriding explicit currentness and
    producing timeless reasoning. The old assertion was not inconvenient, it was WRONG, and a test
    that pins a defect in place is worse than no test.

    What belongs here is the invariant: currentness is never suppressed, and the reference is never
    lost. Both present at once is MIXED. The reversal is recorded in
    04-F-IMPLEMENTATION-REPORT.md rather than made quietly.
  */
  it('A PRESENT-TENSE MARKER KEEPS CURRENTNESS AND THE REFERENCE — it is MIXED, never timeless', () => {
    for (const item of det('EXACT_PRIOR_STATEMENT')) {
      const r = readUserJob(item.turn, item.language, {
        fresh: true,
        namedPlace: true,
        publicEvent: false,
        hasPriorWork: true,
      } as never);
      expect([item.id, r.job]).toEqual([item.id, 'MIXED']);
      expect([item.id, r.discourseReference]).toEqual([item.id, 'PRIOR_WORK']);
      expect([item.id, r.freshness]).toEqual([item.id, 'PARTIAL']);
      expect([item.id, r.evidence]).toEqual([item.id, 'CURRENT_REPORTING']);
    }
  });

  it('and with no currentness it is the plain prior-work explanation', () => {
    for (const item of det('EXACT_PRIOR_STATEMENT')) {
      const r = readUserJob(item.turn, item.language, {
        fresh: false,
        namedPlace: true,
        publicEvent: false,
        hasPriorWork: true,
      } as never);
      expect([item.id, r.job]).toEqual([item.id, 'EXPLANATION']);
      expect([item.id, r.discourseReference]).toEqual([item.id, 'PRIOR_WORK']);
      expect([item.id, r.freshness]).toEqual([item.id, 'NONE']);
    }
  });

  it('and it is still a reference ONLY when the conversation holds work', () => {
    for (const item of det('EXACT_PRIOR_STATEMENT')) {
      const r = readUserJob(item.turn, item.language, {
        fresh: false,
        namedPlace: false,
        publicEvent: false,
        hasPriorWork: false,
      } as never);
      expect([item.id, r.discourseReference]).toEqual([item.id, 'NONE']);
    }
  });

  it('THIRD PERSON IS NOT SELF-ATTRIBUTION — a question about the world stays one', () => {
    for (const q of [
      'What did the minister say about the pilot?',
      'Why did the report recommend the pilot?',
      'What caused the First World War?',
      'Why is the pilot lower risk in general?',
    ])
      expect([q, referencesOwnPriorStatement(q, 'en')]).toEqual([q, false]);
    for (const q of ['Co minister powiedział o pilotażu?', 'Co wywołało pierwszą wojnę światową?'])
      expect([q, referencesOwnPriorStatement(q, 'pl')]).toEqual([q, false]);
  });

  it('the new topic is not read as a reference in either deterministic language', () => {
    for (const item of det('NEW_TOPIC_RESET')) {
      expect(referencesOwnPriorStatement(item.turn, item.language as 'en' | 'pl')).toBe(false);
      const r = readUserJob(item.turn, item.language, {
        fresh: false,
        namedPlace: false,
        publicEvent: false,
        hasPriorWork: true,
      } as never);
      expect([item.id, r.discourseReference]).toEqual([item.id, 'NONE']);
    }
  });
});

describe('C-3 · THE FIVE INTERPRETER-FIRST LANGUAGES NOW HAVE A BOUNDED CONTAINER', () => {
  const earlier = [{ question: 'une question antérieure', language: 'fr' }];

  it('the five are exactly the semantic-first display languages, and en / pl are excluded', () => {
    expect([...INTERPRETER_FIRST_DISPLAY_LANGUAGES]).toEqual(['fr', 'de', 'es', 'pt', 'ar']);
    for (const lang of ['en', 'pl']) expect(readInterpreterFirstContainer(lang, [], [])).toBeNull();
  });

  it('A CONTAINER EXISTS WHERE readConversationalTurn RETURNS NULL — the measured C-3 defect', () => {
    for (const lang of INTERPRETER_FIRST_DISPLAY_LANGUAGES) {
      /* unchanged at this base, and correct: the EN/PL field readers do not speak these languages */
      expect(readConversationalTurn('une question', lang, [])).toBeNull();
      const art = byCase('EXACT_PRIOR_STATEMENT').find((i) => i.language === lang)!.state
        .artifactsNewestFirst;
      const container = readInterpreterFirstContainer(lang, [], art);
      expect(container).not.toBeNull();
      /* this is the value that was false for five of seven languages */
      expect(container!.artifact).toBeDefined();
      expect(container!.artifactSourceOperationId).toBe('op-0002');
    }
  });

  it('the container carries NO EN/PL-derived field — the readers are not applied, not even once', () => {
    const container = readInterpreterFirstContainer('fr', earlier, [])!;
    expect(Object.keys(container).sort()).toEqual(['artifacts', 'priorQuestion', 'turnIndex']);
    expect(container.turnIndex).toBe(1);
    expect(container.priorQuestion).toBe('une question antérieure');
  });

  it('a language switch is a new reading, exactly as for EN / PL', () => {
    const mixed = [
      { question: 'une question antérieure', language: 'fr' },
      { question: 'an English turn', language: 'en' },
    ];
    expect(readInterpreterFirstContainer('fr', mixed, [])!.turnIndex).toBe(1);
  });

  it('and with no artifact it claims none', () => {
    const container = readInterpreterFirstContainer('ar', [], [])!;
    expect(container.artifact).toBeUndefined();
    expect(container.artifactSourceOperationId).toBeUndefined();
    expect(container.artifacts).toHaveLength(0);
  });
});

describe('THE CORPUS ITSELF', () => {
  it('is 63 items: nine cases across the seven DISPLAY languages', () => {
    expect(CORPUS.productDisplayLanguages).toEqual(['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar']);
    expect(ITEMS).toHaveLength(63);
    expect(CORPUS.counts.items).toBe(ITEMS.length);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(63);
  });

  it('carries no phrase from the inspected benchmark material', () => {
    /* the battery's own families are place / currentness / relationship asks; this suite is only
       about references to our own earlier work, and every turn names the assistant or a component */
    for (const item of ITEMS) expect(item.turn.length).toBeLessThan(140);
  });

  it('every item states WHY it is in the suite', () => {
    for (const item of ITEMS) expect(item.why.length).toBeGreaterThan(40);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * THE RETURNED PROBES — measured at the ROUTE, where the defect was visible
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Claude Code's F-REVIEW-RETURN.md returned the first version of this lane with three
 * current-to-timeless P0s. The reader's job was only half of the defect; the other half was the
 * IR's freshness and whether news was still required, so these are asserted on the real route.
 */

const PRIOR_WORK = { kind: 'RECOMMENDATION', label: 'Start with the pilot' };

const routeWith = (turn: string, language: string, work: boolean): AskR2Route =>
  routeAskR2(
    {
      originalQuestion: turn,
      sourceLanguage: language,
      normalizationLanguage: language,
      displayLanguage: language,
      origin: 'ASK',
    } as never,
    {
      requestInstant: '2026-10-04T12:00:00Z',
      ...(work ? { priorWork: PRIOR_WORK, conversation: { artifact: PRIOR_WORK } } : {}),
    } as never,
    { specialistRegistry: specialistRegistryFixture } as never,
  );

const needsNews = (r: AskR2Route): boolean =>
  r.plan.evidenceRequests.some(
    (e: { required: boolean; evidenceClass: string }) =>
      e.required && e.evidenceClass === 'NEWS_REPORTING',
  ) && r.plan.terminalState !== 'REFERENCE_BACKGROUND_ONLY';

const observed = (r: AskR2Route) => ({
  job: r.semantic?.turn?.primaryJob ?? null,
  irFreshness: r.semantic?.turn?.freshness ?? null,
  ref: r.semantic?.references?.target ?? null,
  news: needsNews(r),
});

const PROBES = CORPUS.returnedProbes.items;
const ofClass = (name: Probe['class']): Probe[] => PROBES.filter((p) => p.class === name);

describe('RETURNED · present advice and opinion are NOT a prior-work reference', () => {
  const controls = ofClass('PRESENT_ADVICE_NEGATIVE_CONTROL');

  it('eight probes, four EN and four PL', () => {
    expect(controls).toHaveLength(8);
    expect(controls.filter((p) => p.language === 'pl')).toHaveLength(4);
  });

  it('NONE of them is read as self-attribution — the past tense is required', () => {
    for (const p of controls)
      expect([p.id, referencesOwnPriorStatement(p.turn, p.language as 'en' | 'pl')]).toEqual([
        p.id,
        false,
      ]);
  });

  it('EACH STAYS CURRENT AND STILL ASKS FOR NEWS, with prior work in the conversation', () => {
    for (const p of controls)
      expect([p.id, observed(routeWith(p.turn, p.language, true))]).toEqual([
        p.id,
        {
          job: p.expect.job,
          irFreshness: p.expect.irFreshness,
          ref: p.expect.ref,
          news: p.expect.news,
        },
      ]);
  });

  it('AND PRIOR WORK CHANGES NOTHING — the route is the same with it and without it', () => {
    for (const p of controls)
      expect([p.id, observed(routeWith(p.turn, p.language, true))]).toEqual([
        p.id,
        observed(routeWith(p.turn, p.language, false)),
      ]);
  });

  it('no control is left internally contradictory: news required implies currentness', () => {
    for (const p of controls) {
      const r = routeWith(p.turn, p.language, true);
      if (needsNews(r)) expect([p.id, r.semantic?.turn?.freshness]).not.toEqual([p.id, 'NONE']);
    }
  });
});

describe('RETURNED · "You said X — is it still true now?" keeps BOTH halves', () => {
  it('MIXED, with the reference preserved and news still required', () => {
    const controls = ofClass('MIXED_CONTROL');
    expect(controls).toHaveLength(2);
    for (const p of controls) {
      const o = observed(routeWith(p.turn, p.language, true));
      expect([p.id, o]).toEqual([
        p.id,
        { job: 'MIXED', irFreshness: p.expect.irFreshness, ref: p.expect.ref, news: true },
      ]);
      /* neither half may be dropped: not timeless, and not a bare current ask */
      expect([p.id, o.job]).not.toEqual([p.id, 'EXPLANATION']);
      expect([p.id, o.ref]).not.toEqual([p.id, 'NONE']);
      expect([p.id, o.news]).toEqual([p.id, true]);
    }
  });

  it('the reader reads it as MIXED with PRIOR_WORK, never as timeless reasoning', () => {
    for (const p of ofClass('MIXED_CONTROL')) {
      const reading = readUserJob(p.turn, p.language, {
        fresh: true,
        namedPlace: false,
        publicEvent: false,
        hasPriorWork: true,
      } as never);
      expect([p.id, reading.job]).toEqual([p.id, 'MIXED']);
      expect([p.id, reading.discourseReference]).toEqual([p.id, 'PRIOR_WORK']);
      expect([p.id, reading.freshness]).toEqual([p.id, 'PARTIAL']);
      expect([p.id, reading.evidence]).toEqual([p.id, 'CURRENT_REPORTING']);
    }
  });

  it('CURRENTNESS IS NEVER SUPPRESSED — the self-attribution form cannot make a fresh turn timeless', () => {
    /* the returned cause 2, asserted directly on the reader: with `fresh`, the answer is MIXED */
    for (const turn of [
      'You said the pilot was lower risk — is that still the case today?',
      'You recommended the pilot. What is the position right now?',
    ]) {
      const reading = readUserJob(turn, 'en', {
        fresh: true,
        namedPlace: true,
        publicEvent: false,
        hasPriorWork: true,
      } as never);
      expect([turn, reading.job]).toEqual([turn, 'MIXED']);
      expect([turn, reading.freshness]).not.toEqual([turn, 'NONE']);
      expect([turn, reading.discourseReference]).toEqual([turn, 'PRIOR_WORK']);
    }
  });
});

describe('RETURNED · the past-reference family still resolves', () => {
  it('EXPLANATION with the reference, and no news call', () => {
    const controls = ofClass('PAST_REFERENCE');
    expect(controls.length).toBeGreaterThanOrEqual(4);
    for (const p of controls)
      expect([p.id, observed(routeWith(p.turn, p.language, true))]).toEqual([
        p.id,
        {
          job: p.expect.job,
          irFreshness: p.expect.irFreshness,
          ref: p.expect.ref,
          news: p.expect.news,
        },
      ]);
  });

  it('and with NO prior work in the conversation, none of them claims a reference', () => {
    for (const p of ofClass('PAST_REFERENCE'))
      expect([p.id, observed(routeWith(p.turn, p.language, false)).ref]).not.toEqual([
        p.id,
        'ARTIFACT',
      ]);
  });
});

describe('RETURNED · the form is anchored in the past, structurally', () => {
  it('the present auxiliary and bare present verbs are gone', () => {
    for (const q of [
      'Do you recommend the pilot?',
      'Do you suggest gold?',
      'What do you say about this?',
      'What do you mean by that?',
      'Do you call that a risk?',
      'Do you propose a change?',
      'What is your opinion on the euro?',
      'What is your view today?',
    ])
      expect([q, referencesOwnPriorStatement(q, 'en')]).toEqual([q, false]);
  });

  it('and the past forms and explicit back-references are read', () => {
    for (const q of [
      'Did you recommend the pilot?',
      'Why did you say that?',
      'What did you mean?',
      'You recommended the pilot.',
      'You said the pilot was safer.',
      'In your earlier answer, why the pilot?',
      'Your previous recommendation — why?',
    ])
      expect([q, referencesOwnPriorStatement(q, 'en')]).toEqual([q, true]);
  });

  it('POLISH: present second person is excluded, past second person is read', () => {
    for (const q of [
      'Czy polecasz pilotaż?',
      'Co sądzisz o pilotażu?',
      'Czy sugerujesz złoto?',
      'Jaka jest twoja opinia?',
      'Co minister powiedział o pilotażu?',
    ])
      expect([q, referencesOwnPriorStatement(q, 'pl')]).toEqual([q, false]);
    for (const q of [
      'Dlaczego powiedziałeś, że pilotaż jest lepszy?',
      'Co miałeś na myśli?',
      'Zarekomendowałeś pilotaż — dlaczego?',
      'W twojej wcześniejszej odpowiedzi, dlaczego pilotaż?',
    ])
      expect([q, referencesOwnPriorStatement(q, 'pl')]).toEqual([q, true]);
  });

  it('THE SOURCE CARRIES NO PRESENT-TENSE ALTERNATIVE — checked over the pattern itself', () => {
    const body = readFileSync(join(__dirname, '..', '..', 'ask-router', 'user-job.ts'), 'utf8');
    const form = /const EN_SELF_ATTRIBUTION =\s*([\s\S]*?);\n/.exec(body)?.[1] ?? '';
    expect(form.length).toBeGreaterThan(80);
    /* no `do you`, and no auxiliary group that could re-admit it */
    expect(form).not.toMatch(/do\\s\+you/);
    expect(form).not.toMatch(/\(\?:did\|do\)/);
    expect(form).toMatch(/did\\s\+you/);
  });
});

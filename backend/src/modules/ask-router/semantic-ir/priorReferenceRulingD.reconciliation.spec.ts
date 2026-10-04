import { routeAskR2, type AskR2Route } from '../ask-r2-route';
import { specialistRegistryFixture } from '../frozen-c/fixtures/specialist-registry.fixture';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PROPOSED · RECONCILIATION WITH beaa095 — EVIDENCE ONLY, NOT PART OF 05
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `beaa095` completed ruling D on the EN/PL deterministic path: a turn running from a past baseline
 * to the present endpoint is `CHANGE_ANALYSIS` with temporal role `SINCE_PAST_TO_PRESENT`, and
 * `MIXED` is reserved for a turn whose clauses genuinely ask two things. Claude F's lane also
 * reaches for `MIXED`, for a different reason: our earlier claim re-examined against the present.
 *
 * Two readings reaching for one job is exactly where a rebase quietly changes behaviour, so this
 * spec pins the boundary rather than trusting that a clean three-way merge means a correct one.
 *
 * THE TEST THAT MATTERS is not "does F produce the right job" but "does F change ruling D's answer
 * at all". Every ruling-D row below is asserted IDENTICAL with and without prior work in the
 * conversation: if F's reference reading were interfering, that equality would break.
 */

const PRIOR_WORK = { kind: 'RECOMMENDATION', label: 'Start with the pilot' };

const route = (turn: string, language: string, work: boolean): AskR2Route =>
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

/** everything ruling D decides — deliberately excluding `references`, which is F's to add */
const temporal = (r: AskR2Route) => ({
  job: r.semantic?.turn?.primaryJob ?? null,
  freshness: r.semantic?.turn?.freshness ?? null,
  temporalRole: r.semantic?.turn?.temporalRole ?? null,
  clauses: r.semantic?.clauses?.length ?? 0,
  news: needsNews(r),
});

const RULING_D: ReadonlyArray<readonly [string, string, string]> = [
  ['D1', 'en', 'How has inflation changed since 2020?'],
  ['D2', 'pl', 'Jak zmieniła się inflacja od 2020 roku?'],
  ['D3', 'en', 'What has happened to the euro since then?'],
];

describe('RULING D · the since-to-present reading is untouched by the prior-work lane', () => {
  it('CHANGE_ANALYSIS with SINCE_PAST_TO_PRESENT, and current evidence required', () => {
    for (const [id, lang, turn] of RULING_D.slice(0, 2)) {
      const t = temporal(route(turn, lang, true));
      expect([id, t.job]).toEqual([id, 'CHANGE_ANALYSIS']);
      expect([id, t.temporalRole]).toEqual([id, 'SINCE_PAST_TO_PRESENT']);
      expect([id, t.news]).toEqual([id, true]);
      /* ruling D's own rule: a since-to-present turn is NOT MIXED */
      expect([id, t.job]).not.toEqual([id, 'MIXED']);
    }
  });

  it('PRIOR WORK CHANGES NOTHING RULING D DECIDES — asserted as equality, every row', () => {
    for (const [id, lang, turn] of RULING_D)
      expect([id, temporal(route(turn, lang, true))]).toEqual([
        id,
        temporal(route(turn, lang, false)),
      ]);
  });

  it('the present endpoint keeps its currentness — SINCE_PAST_TO_PRESENT survives', () => {
    for (const [id, lang, turn] of RULING_D) {
      const t = temporal(route(turn, lang, true));
      expect([id, t.temporalRole]).toEqual([id, 'SINCE_PAST_TO_PRESENT']);
      expect([id, t.freshness]).not.toEqual([id, 'NONE']);
    }
  });
});

describe('THE BOUNDARY · an attributed claim AND a since-to-present question', () => {
  const BOTH: ReadonlyArray<readonly [string, string, string]> = [
    ['DX1', 'en', 'You said growth was strong — how has it changed since 2020?'],
    ['DX2', 'pl', 'Powiedziałeś, że wzrost był silny — jak to się zmieniło od 2020 roku?'],
  ];

  it('MIXED is correct here BY RULING D’s OWN CRITERION — the clauses ask two things', () => {
    for (const [id, lang, turn] of BOTH) {
      const t = temporal(route(turn, lang, true));
      expect([id, t.job]).toEqual([id, 'MIXED']);
      /* ruling D reserves MIXED for genuinely multi-clause turns; the segmentation agrees */
      expect(t.clauses).toBeGreaterThanOrEqual(2);
      expect([id, t.news]).toEqual([id, true]);
    }
  });

  it('and F adds ONLY the reference — every temporal field is the same without prior work', () => {
    for (const [id, lang, turn] of BOTH) {
      expect([id, temporal(route(turn, lang, true))]).toEqual([
        id,
        temporal(route(turn, lang, false)),
      ]);
      /* the one thing that does change, and the only thing that should */
      expect([id, route(turn, lang, true).semantic?.references?.target]).toEqual([id, 'ARTIFACT']);
      expect([id, route(turn, lang, false).semantic?.references?.target]).toEqual([id, 'NONE']);
    }
  });
});

describe('SHARED CLAUSE SEGMENTATION feeds the IR, and the reference rides alongside it', () => {
  it('a reference clause beside a current clause keeps both parts and asks for news', () => {
    const r = route(
      'Why did you recommend the pilot, and what is happening in Mali today?',
      'en',
      true,
    );
    const t = temporal(r);
    expect(t.clauses).toBeGreaterThanOrEqual(2);
    expect(t.job).toBe('MIXED');
    expect(t.news).toBe(true);
    expect(r.semantic?.references?.target).toBe('ARTIFACT');
  });

  it('every clause the IR carries has a span inside the reader text', () => {
    const turn = 'Why did you recommend the pilot, and what is happening in Mali today?';
    const r = route(turn, 'en', true);
    for (const c of r.semantic?.clauses ?? []) {
      expect(c.span[0]).toBeGreaterThanOrEqual(0);
      expect(c.span[1]).toBeLessThanOrEqual(turn.length + 2);
      expect(c.span[1]).toBeGreaterThanOrEqual(c.span[0]);
    }
  });
});

describe('CURRENTNESS PRECEDENCE · the lane can never make a current turn timeless', () => {
  const CURRENT: ReadonlyArray<readonly [string, string, string]> = [
    ['P1', 'en', 'Do you recommend travelling to Mali right now?'],
    ['P2', 'en', 'What do you say about the Fed rate decision today?'],
    ['P3', 'en', 'Do you suggest I buy gold this week?'],
    ['P1pl', 'pl', 'Czy polecasz teraz podróż do Mali?'],
    ['P3pl', 'pl', 'Czy sugerujesz, żebym kupił złoto w tym tygodniu?'],
    ['M1', 'en', 'You said inflation was easing — is it still true now?'],
    ['D1', 'en', 'How has inflation changed since 2020?'],
  ];

  it('no turn carrying explicit currentness loses it, and none drops its news requirement', () => {
    for (const [id, lang, turn] of CURRENT) {
      const t = temporal(route(turn, lang, true));
      expect([id, t.freshness]).not.toEqual([id, 'NONE']);
      expect([id, t.news]).toEqual([id, true]);
    }
  });

  it('and present-tense advice is still not a reference, on this base too', () => {
    for (const [id, lang, turn] of CURRENT.slice(0, 5))
      expect([id, route(turn, lang, true).semantic?.references?.target]).toEqual([id, 'NONE']);
  });
});

describe('SemanticTurnIR IS THE SOLE ROUTING AUTHORITY — the reference lives in the IR', () => {
  it('a resolved reference is visible in the IR, not only in the plan', () => {
    const r = route('Why did you say the pilot was lower risk?', 'en', true);
    expect(r.semantic).toBeDefined();
    expect(r.semantic?.references?.target).toBe('ARTIFACT');
    expect(r.semantic?.turn?.primaryJob).toBe('EXPLANATION');
    /* and the IR agrees with the plan it produced: no news for a timeless reference */
    expect(needsNews(r)).toBe(false);
    expect(r.semantic?.turn?.freshness).toBe('NONE');
  });

  it('IR freshness and the news requirement never contradict each other', () => {
    const turns: ReadonlyArray<readonly [string, string]> = [
      ['en', 'Why did you say the pilot was lower risk?'],
      ['en', 'You said inflation was easing — is it still true now?'],
      ['en', 'Do you recommend travelling to Mali right now?'],
      ['en', 'How has inflation changed since 2020?'],
      ['pl', 'Dlaczego powiedziałeś, że pilotaż to mniejsze ryzyko?'],
      ['pl', 'Powiedziałeś, że inflacja spada — czy to nadal prawda teraz?'],
    ];
    for (const [lang, turn] of turns) {
      const r = route(turn, lang, true);
      if (needsNews(r)) expect([turn, r.semantic?.turn?.freshness]).not.toEqual([turn, 'NONE']);
    }
  });

  it('the IR validates against the reader text on every one of these turns', () => {
    for (const [, lang, turn] of [
      ...RULING_D,
      ['X', 'en', 'Why did you say the pilot was lower risk?'] as const,
    ]) {
      const r = route(turn as string, lang as string, true);
      expect(r.semantic?.version).toBeDefined();
      expect(r.semantic?.language).toBe(lang);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * THE EN / PL CURRENTNESS ASYMMETRY (CTO request)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * A pure "why did you say X earlier?" must use the earlier work WITHOUT asking for news.
 * "is it still true now?" must keep BOTH the reference and the current evidence.
 *
 * Measured on beaa095 before the companion's gate, the two were asymmetric: in Polish a pure past
 * reference whose REPORTED clause carries present or future tense became MIXED and asked for news,
 * while the same question in English did not. The gate keys on beaa095's own clause segmentation —
 * the attribution and the present tense are the SAME clause in a pure reference, and a separate
 * clause when the reader really asks about now.
 */

const PURE_PAST: ReadonlyArray<readonly [string, string, string]> = [
  ['EN-1', 'en', 'Why did you say the pilot was lower risk?'],
  ['EN-presrep', 'en', 'Why did you say inflation is easing?'],
  ['EN-event', 'en', 'Why did you say the Fed would hold rates?'],
  ['EN-place', 'en', 'Why did you say Mali was the safer destination?'],
  ['PL-1', 'pl', 'Dlaczego powiedziałeś, że pilotaż to mniejsze ryzyko?'],
  ['PL-presrep', 'pl', 'Dlaczego powiedziałeś, że inflacja spada?'],
  ['PL-event', 'pl', 'Dlaczego powiedziałeś, że Fed utrzyma stopy?'],
  ['PL-place', 'pl', 'Dlaczego powiedziałeś, że Mali jest bezpieczniejszym kierunkiem?'],
];
const STILL_NOW: ReadonlyArray<readonly [string, string, string]> = [
  ['EN-s1', 'en', 'You said inflation was easing — is it still true now?'],
  ['EN-s2', 'en', 'You said the pilot was lower risk — is that still right?'],
  ['PL-s1', 'pl', 'Powiedziałeś, że inflacja spada — czy to nadal prawda teraz?'],
  ['PL-s2', 'pl', 'Powiedziałeś, że pilotaż jest mniej ryzykowny — czy to nadal prawda?'],
];

describe('ASYMMETRY · a pure past reference is one clause and is answered from the earlier work', () => {
  it('every pure reference segments to ONE clause, in both languages', () => {
    for (const [id, lang, turn] of PURE_PAST)
      expect([id, route(turn, lang, true).semantic?.clauses?.length]).toEqual([id, 1]);
  });

  it('EXPLANATION, freshness NONE, the reference kept — identical in EN and PL', () => {
    for (const [id, lang, turn] of PURE_PAST) {
      const r = route(turn, lang, true);
      expect([id, r.semantic?.turn?.primaryJob]).toEqual([id, 'EXPLANATION']);
      expect([id, r.semantic?.turn?.freshness]).toEqual([id, 'NONE']);
      expect([id, r.semantic?.references?.target]).toEqual([id, 'ARTIFACT']);
    }
  });

  it('and the IR is the SAME SHAPE for the EN and PL members of each pair', () => {
    const shape = (lang: string, turn: string) => {
      const r = route(turn, lang, true);
      return {
        job: r.semantic?.turn?.primaryJob,
        freshness: r.semantic?.turn?.freshness,
        ref: r.semantic?.references?.target,
        clauses: r.semantic?.clauses?.length,
      };
    };
    for (const name of ['1', 'presrep', 'event', 'place']) {
      const en = PURE_PAST.find((p) => p[0] === `EN-${name}`)!;
      const pl = PURE_PAST.find((p) => p[0] === `PL-${name}`)!;
      expect([name, shape(en[1], en[2])]).toEqual([name, shape(pl[1], pl[2])]);
    }
  });
});

describe('ASYMMETRY · "is it still true now?" keeps both halves, in both languages', () => {
  it('two or more clauses, MIXED, the reference kept AND current evidence required', () => {
    for (const [id, lang, turn] of STILL_NOW) {
      const r = route(turn, lang, true);
      expect((r.semantic?.clauses?.length ?? 0) >= 2).toBe(true);
      expect([id, r.semantic?.turn?.primaryJob]).toEqual([id, 'MIXED']);
      expect([id, r.semantic?.references?.target]).toEqual([id, 'ARTIFACT']);
      expect([id, r.semantic?.turn?.freshness]).not.toEqual([id, 'NONE']);
      expect([id, needsNews(r)]).toEqual([id, true]);
    }
  });

  it('the gate cannot fire on them — it requires a single clause', () => {
    for (const [id, lang, turn] of STILL_NOW)
      expect([id, route(turn, lang, true).semantic?.turn?.primaryJob]).not.toEqual([
        id,
        'EXPLANATION',
      ]);
  });
});

describe('ASYMMETRY · the residual, and exactly where it lives (NOT in F’s grant)', () => {
  /*
    Six of the eight pure references ask for no news. Two Polish phrasings still do, and the cause
    is ONE envelope field that F cannot reach:

        EN "Why did you say inflation is easing?"        classifiers.queryIntent = EXPLANATION
        PL "Dlaczego powiedziałeś, że inflacja spada?"   classifiers.queryIntent = CURRENT_EVENT

    Everything else in the envelope is identical — time.requirement NONE, currentStatus.requested
    false, no domains. Frozen C's planner then requires NEWS_REPORTING through
    `PRESENT_TENSE_INTENTS.has(e.classifiers.queryIntent)` (frozen-c/src/planner.ts, the
    `wantsReporting` block). The Polish query-intent classifier reads the present tense of the
    REPORTED clause as a current event.

    F changed everything F controls: the job, the IR freshness and the temporal verdict handed to
    the plan are now identical in EN and PL, asserted above. The classifier is another lane's file
    and frozen C may not be touched by anyone, so the residual is reported, pinned here, and left.

    THIS TEST ASSERTS THE RESIDUAL ON PURPOSE. If the classifier is corrected, it fails and names
    the reason — which is what should happen, rather than the behaviour drifting unnoticed.
  */
  it('the two Polish phrasings still reach the planner with queryIntent CURRENT_EVENT', () => {
    for (const [id, lang, turn] of [
      ['PL-presrep', 'pl', 'Dlaczego powiedziałeś, że inflacja spada?'],
      ['PL-event', 'pl', 'Dlaczego powiedziałeś, że Fed utrzyma stopy?'],
    ] as const) {
      const r = route(turn, lang, true) as unknown as {
        envelope?: { classifiers?: { queryIntent?: string } };
      };
      expect([id, r.envelope?.classifiers?.queryIntent]).toEqual([id, 'CURRENT_EVENT']);
    }
  });

  it('their IR is nonetheless correct — the contradiction is confined to the plan', () => {
    for (const [id, lang, turn] of [
      ['PL-presrep', 'pl', 'Dlaczego powiedziałeś, że inflacja spada?'],
      ['PL-event', 'pl', 'Dlaczego powiedziałeś, że Fed utrzyma stopy?'],
    ] as const) {
      const r = route(turn, lang, true);
      expect([id, r.semantic?.turn?.primaryJob]).toEqual([id, 'EXPLANATION']);
      expect([id, r.semantic?.turn?.freshness]).toEqual([id, 'NONE']);
      expect([id, r.semantic?.references?.target]).toEqual([id, 'ARTIFACT']);
    }
  });

  it('six of the eight pure references ask for no news, and the two that do are only these', () => {
    const asking = PURE_PAST.filter(([, lang, turn]) => needsNews(route(turn, lang, true))).map(
      ([id]) => id,
    );
    expect(asking).toEqual(['PL-presrep', 'PL-event']);
  });
});

describe('DEFECT 2 PRECEDENCE · a single clause may still ask about the present', () => {
  /*
    The first version of the gate fired on these and took their currentness away.
    beaa095's own `semantic-ir.defects.spec.ts` caught it; they are pinned here too, because a
    guard that only another lane's spec protects is a guard this lane can break again.
  */
  const REEXAMINED: ReadonlyArray<readonly [string, string]> = [
    ['E1', 'Is that advice still sound given what happened lately?'],
    ['E2', 'Does this plan still hold up right now?'],
    ['E3', 'You said the pilot was lower risk — does that still hold right now?'],
  ];

  it('an explicit present-state marker outranks the clause count', () => {
    for (const [id, turn] of REEXAMINED) {
      const r = route(turn, 'en', true);
      expect([id, r.semantic?.turn?.freshness]).not.toEqual([id, 'NONE']);
      expect([id, r.semantic?.turn?.primaryJob]).not.toEqual([id, 'EXPLANATION']);
    }
  });

  it('and the gate never fires where the reader asked about now', () => {
    for (const [id, turn] of REEXAMINED)
      expect([id, needsNews(route(turn, 'en', true))]).toEqual([id, true]);
  });
});

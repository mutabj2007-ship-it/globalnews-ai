import { readSubject, decideInheritedContextEligibility, eligibleMapGeography, REFERENCE_FRAMES,
         STABLE_INTENT_CLASSES, INTENT_IS_READ_NEVER_DERIVED_HERE } from './inherited-context-eligibility';
import { detectOfficeGeography } from './office-geography.producer';
import { detectStatedPeriod } from './stated-period.producer';
import { readEffectiveContext } from './effective-context';
import {
  ADDENDUM_GEOGRAPHY_PROJECTION, ARTICLE_ANCHOR_IS_NEVER_SUPPRESSED,
  DECLARED_CANONICAL, QUALIFIED_ENTITY_PRODUCER_EXISTS, SUBJECT_SHAPES,
} from './addendum.contract';
import { CORPUS_DELTA, PRIOR_ROW_RESOLVED, FINAL_CORPUS_DELTA } from './corpus-addendum';

/**
 * FINAL ADDENDUM · the intent is now an INPUT, measured on canonical and passed
 * in rather than guessed. `ENTITY_BACKGROUND` is the landed reading for every
 * `who is` question in this corpus; `EXPLANATION` for every `what is`/`explain`/
 * `how does … work` one; `CURRENT_EVENT` for the happening family.
 */
const BG = 'ENTITY_BACKGROUND';
const EXPL = 'EXPLANATION';
const EVENT = 'CURRENT_EVENT';

const NO_TYPED = { typedGeographyPresent: false, resolvedArticleAnchorPresent: false, intentClass: BG };
const TYPED = { typedGeographyPresent: true, resolvedArticleAnchorPresent: false, intentClass: BG };
const ANCHORED = { typedGeographyPresent: false, resolvedArticleAnchorPresent: true, intentClass: BG };
const stable = (intentClass: string) => ({ typedGeographyPresent: false, resolvedArticleAnchorPresent: false, intentClass });

/* ══════════════════════════════════════════════════════════════════════════
 * THE FOUR CASES THE ADDENDUM NAMES
 * ══════════════════════════════════════════════════════════════════════════ */

describe('ADDENDUM · the four named cases', () => {
  it('1 · "Who is Kagame?" with Map = Poland — Poland must NOT become effective geography', () => {
    const e = decideInheritedContextEligibility('Who is Kagame?', NO_TYPED);
    expect(e.decision).toBe('SUPPRESSED');
    expect(e.reason).toBe('EXPLICIT_NAMED_SUBJECT_NO_TYPED_GEOGRAPHY');
    expect(e.suppresses).toContain('MAP_GEOGRAPHY_CONTEXT');

    // The selection is withheld from retrieval rather than used.
    expect(eligibleMapGeography({ countryCode: 'POL', displayName: 'Poland' }, e)).toBeUndefined();
  });

  it('1a · the subject is RETAINED, and no country is guessed from the surname', () => {
    const e = decideInheritedContextEligibility('Who is Kagame?', NO_TYPED);
    expect(e.subject.subject).toBe('Kagame');
    expect(e.subject.shape).toBe('EXPLICIT_NAMED_SUBJECT');
    // Nothing anywhere in the decision names a country.
    expect(JSON.stringify(e)).not.toMatch(/RWA|Rwanda|rwanda/);
    expect(QUALIFIED_ENTITY_PRODUCER_EXISTS).toBe(false);
  });

  it('1b · reference execution remains possible — suppression is not a refusal', () => {
    const e = decideInheritedContextEligibility('Who is Kagame?', NO_TYPED);
    expect(e.blocksExecution).toBe(false);
  });

  it('2 · "Who is Macron?" with Map = Kenya — Kenya must not silently scope it', () => {
    const e = decideInheritedContextEligibility('Who is Macron?', NO_TYPED);
    expect(e.decision).toBe('SUPPRESSED');
    expect(eligibleMapGeography({ countryCode: 'KEN', displayName: 'Kenya' }, e)).toBeUndefined();
    expect(JSON.stringify(e)).not.toMatch(/FRA|France/);
  });

  it('3 · "Who is the president?" with Map = Rwanda — DIFFERENT: inherited context stays eligible', () => {
    const e = decideInheritedContextEligibility('Who is the president?', NO_TYPED);
    expect(e.decision).toBe('ELIGIBLE');
    expect(e.subject.shape).toBe('DEFINITE_DESCRIPTION');
    expect(e.suppresses).toEqual([]);
    const geo = { countryCode: 'RWA', displayName: 'Rwanda' };
    expect(eligibleMapGeography(geo, e)).toBe(geo);
  });

  it('4 · "What did Kagame say in Kenya yesterday?" — typed Kenya outranks, period survives', () => {
    const q = 'What did Kagame say in Kenya yesterday?';
    // Not a reference frame, and a typed place is present: nothing is suppressed.
    const e = decideInheritedContextEligibility(q, TYPED);
    expect(e.decision).toBe('ELIGIBLE');
    expect(e.subject.shape).toBe('NOT_A_REFERENCE_QUESTION');
    // And the stated period is untouched by this addendum.
    expect(detectStatedPeriod(q)?.statedPeriod).toBe('yesterday');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * THE DISCRIMINATOR — GRAMMATICAL, NOT ENCYCLOPAEDIC
 * ══════════════════════════════════════════════════════════════════════════ */

describe('ADDENDUM · a determiner separates a role from a name', () => {
  it.each([
    ['Who is the president?', 'DEFINITE_DESCRIPTION'],
    ['Who is the prime minister?', 'DEFINITE_DESCRIPTION'],
    ['Who is the chief justice?', 'DEFINITE_DESCRIPTION'],
    ['Who is a governor?', 'DEFINITE_DESCRIPTION'],
    ['Who is this minister?', 'DEFINITE_DESCRIPTION'],
    ['Who is president?', 'DEFINITE_DESCRIPTION'],
    ['Who is Kagame?', 'EXPLICIT_NAMED_SUBJECT'],
    ['Who is Macron?', 'EXPLICIT_NAMED_SUBJECT'],
    ['Who is president Kagame?', 'EXPLICIT_NAMED_SUBJECT'],
    ['Who is Rwanda?', 'GEOGRAPHIC_SUBJECT'],
    ['Who is Kenya?', 'GEOGRAPHIC_SUBJECT'],
    ['What happened in Kenya?', 'NOT_A_REFERENCE_QUESTION'],
  ])('%s -> %s', (q, shape) => {
    expect(readSubject(q).shape).toBe(shape);
  });

  it('NEGATIVE CONTROL — no person is ever looked up, and no list of people exists', () => {
    const src = require('fs').readFileSync(`${__dirname}/inherited-context-eligibility.ts`, 'utf8') as string;
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    // Neither name appears in the code, so neither can be special-cased.
    expect(code).not.toMatch(/kagame|macron|Kagame|Macron/);
    // POSITIVE CONTROL — the scan can see real code, so it is not vacuous.
    expect(code).toMatch(/DETERMINERS/);
  });

  it('NEGATIVE CONTROL — the country vocabulary is consulted only to EXCLUDE', () => {
    // A name the vocabulary does not claim is never turned into a country.
    const e = decideInheritedContextEligibility('Who is Kagame?', NO_TYPED);
    expect(e.suppresses.length).toBeGreaterThan(0);
    expect('countryCode' in e).toBe(false);
    // And a subject the vocabulary DOES claim is excluded from suppression.
    expect(readSubject('Who is Rwanda?').shape).toBe('GEOGRAPHIC_SUBJECT');
    expect(decideInheritedContextEligibility('Who is Rwanda?', NO_TYPED).decision).toBe('ELIGIBLE');
  });

  it('capitalisation is recorded as evidence and never required', () => {
    expect(readSubject('Who is Kagame?').capitalizedInRawQuery).toBe(true);
    const lower = readSubject('who is kagame');
    expect(lower.capitalizedInRawQuery).toBe(false);
    expect(lower.shape).toBe('EXPLICIT_NAMED_SUBJECT');   // still suppresses
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * FALSE POSITIVES — SUPPRESSION MUST NOT LEAK INTO ORDINARY QUESTIONS
 * ══════════════════════════════════════════════════════════════════════════ */

describe('ADDENDUM · false-positive controls', () => {
  it.each([
    'What happened at the convention centre yesterday?',
    'Entertainment news in Rwanda this week',
    'Security developments in Kenya',
    'What is happening in Kenya?',
    'Summarize these',
    'why?',
    'what changed?',
    '',
  ])('does not suppress inherited context for "%s"', (q) => {
    expect(decideInheritedContextEligibility(q, NO_TYPED).decision).toBe('ELIGIBLE');
  });

  it('a long subject is not a name', () => {
    // Phrased with `who is` on purpose: `what is` is no longer a frame, so a
    // `what is` probe would pass here for the wrong reason and test nothing.
    expect(readSubject('Who is responsible for the new electoral law').shape).not.toBe('EXPLICIT_NAMED_SUBJECT');
    expect(readSubject('Who is the person who signed the new electoral law').shape).not.toBe('EXPLICIT_NAMED_SUBJECT');
  });

  it('a subject with digits or symbols is not a name', () => {
    for (const q of ['Describe COVID-19', 'Describe 2026', 'Describe x + 1']) {
      expect(readSubject(q).shape).not.toBe('EXPLICIT_NAMED_SUBJECT');
    }
  });

  it('a subject containing a function word is not a name', () => {
    /**
     * ISOLATED DELIBERATELY. The first version of this test used
     * "Tell me about happening in Kenya", "Describe the end of the year" and
     * "Who is going to Kenya" — and mutation A-3 removed the function-word guard
     * without failing any of them, because EVERY ONE is caught by a different
     * guard first: the country-token guard, or the determiner test.
     *
     * The cases below carry a function word, NO determiner in first position and
     * NO place token, so the function-word guard is the only thing that can
     * refuse them. Fourth instance in this lane of a clause that is correct,
     * load-bearing and invisible to every test that claimed to cover it.
     */
    for (const q of ['Describe cost of living', 'Tell me about end of year',
                     'What do you know about rise and fall']) {
      expect(readSubject(q).shape).not.toBe('EXPLICIT_NAMED_SUBJECT');
    }
  });

  it('the guards are independent — each of the three refuses on its own ground', () => {
    expect(readSubject('Describe the year').shape).toBe('DEFINITE_DESCRIPTION');       // determiner
    expect(readSubject('Describe Kenya').shape).toBe('GEOGRAPHIC_SUBJECT');            // vocabulary
    expect(readSubject('Describe cost of living').shape).toBe('NOT_A_REFERENCE_QUESTION'); // function word
  });

  it('a subject containing a place is GEOGRAPHIC, never a bare identity', () => {
    expect(readSubject('Tell me about Kagame Kenya').shape).toBe('GEOGRAPHIC_SUBJECT');
  });

  it('REGRESSION — the happening family stays eligible, now for the RIGHT reason', () => {
    /**
     * PERMANENTLY COVERED, AND THE COVER CHANGED.
     *
     * The first addendum kept "What is happening in Kenya?" eligible by REMOVING
     * the `what is` frame — which worked and cost the whole stable-explanation
     * class. The final addendum re-admits the frame and gates suppression on the
     * landed intent instead. So this case must now pass because its intent is
     * CURRENT_EVENT, not because the frame is missing, and BOTH halves are
     * asserted so a future edit cannot silently swap one cover for the other.
     */
    expect(REFERENCE_FRAMES.some((f) => /what\\s\+\(\?:is/.test(f.source))).toBe(true);
    for (const q of ['What is happening in Kenya?', 'What is happening?', 'What is going on?']) {
      expect(decideInheritedContextEligibility(q, stable(EVENT)).decision).toBe('ELIGIBLE');
    }
    // And even if a caller mislabelled the intent, "happening" is refused by the
    // function-word guard — belt and braces, asserted.
    expect(readSubject('What is happening?').shape).toBe('NOT_A_REFERENCE_QUESTION');
  });

  it('a typed place always defeats suppression, whatever the subject', () => {
    expect(decideInheritedContextEligibility('Who is Kagame in Kenya?', TYPED).decision).toBe('ELIGIBLE');
    expect(decideInheritedContextEligibility('Who is Macron?', TYPED).decision).toBe('ELIGIBLE');
  });

  it('producer A is unaffected — the safe country rules are not weakened', () => {
    // The addendum adds a suppression gate; it does not touch the conjunction.
    expect(detectOfficeGeography('the president of Rwanda')?.countryCode).toBe('RWA');
    expect(detectOfficeGeography('the president of Turkey')?.countryCode).toBe('TUR');
    expect(detectOfficeGeography('the cost of turkey at christmas')).toBeNull();
    expect(detectOfficeGeography('the end of jordan career')).toBeNull();
    expect(detectOfficeGeography('president of the board')).toBeNull();
  });

  it('an office-of-country question is never an explicit-named-subject question', () => {
    // "Who is the president of Rwanda?" carries a determiner AND typed geography
    // from producer A. Both routes agree: nothing is suppressed.
    const q = 'Who is the current president of Rwanda?';
    expect(readSubject(q).shape).toBe('DEFINITE_DESCRIPTION');
    expect(detectOfficeGeography(q)?.countryCode).toBe('RWA');
    expect(decideInheritedContextEligibility(q, TYPED).decision).toBe('ELIGIBLE');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * FOLLOW-UPS
 * ══════════════════════════════════════════════════════════════════════════ */

describe('ADDENDUM · follow-ups', () => {
  it('turn 1 typed Kenya, turn 2 "Who is Kagame?" — turn 1\'s geography must not scope turn 2', () => {
    const t1 = decideInheritedContextEligibility('What is happening in Kenya?', TYPED);
    expect(t1.decision).toBe('ELIGIBLE');
    const t2 = decideInheritedContextEligibility('Who is Kagame?', NO_TYPED);
    expect(t2.decision).toBe('SUPPRESSED');
    expect(eligibleMapGeography({ countryCode: 'KEN', displayName: 'Kenya' }, t2)).toBeUndefined();
  });

  it('turn 2 "Who is the president?" — inherited context MAY legitimately help', () => {
    const t2 = decideInheritedContextEligibility('Who is the president?', NO_TYPED);
    expect(t2.decision).toBe('ELIGIBLE');
    const geo = { countryCode: 'RWA', displayName: 'Rwanda' };
    expect(eligibleMapGeography(geo, t2)).toBe(geo);
  });

  it('the decision is a pure function of the turn, so no stale turn can leak into it', () => {
    const a = decideInheritedContextEligibility('Who is Kagame?', NO_TYPED);
    const b = decideInheritedContextEligibility('Who is Kagame?', NO_TYPED);
    expect(a).toEqual(b);
  });

  it('a short bare follow-up is not a reference question and inherits normally', () => {
    for (const q of ['why?', 'tell me more', 'what happened next']) {
      expect(decideInheritedContextEligibility(q, NO_TYPED).decision).toBe('ELIGIBLE');
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * PRECEDENCE, RANK 2, AND THE CHIP
 * ══════════════════════════════════════════════════════════════════════════ */

describe('ADDENDUM · precedence and the chip', () => {
  it('a RESOLVED ARTICLE ANCHOR is never suppressed — rank 2 is untouched', () => {
    const e = decideInheritedContextEligibility('Who is Kagame?', ANCHORED);
    expect(e.decision).toBe('SUPPRESSED');
    expect(e.suppresses).toContain('MAP_GEOGRAPHY_CONTEXT');
    expect(e.suppresses).not.toContain('STORY_COUNTRY_HINT');
    expect(ARTICLE_ANCHOR_IS_NEVER_SUPPRESSED).toBe(true);
  });

  it('the country-hint form of story context IS suppressed when no anchor resolved', () => {
    const e = decideInheritedContextEligibility('Who is Kagame?', NO_TYPED);
    expect(e.suppresses).toContain('STORY_COUNTRY_HINT');
  });

  it('the geography projection names five slots and adds no rank to the frozen eight', () => {
    expect([...ADDENDUM_GEOGRAPHY_PROJECTION]).toEqual([
      'DECLARED_REGION', 'TYPED_GEOGRAPHY', 'QUALIFIED_ENTITY_GEOGRAPHY',
      'STORY_COUNTRY_HINT', 'MAP_GEOGRAPHY_CONTEXT',
    ]);
  });

  it('a suppressed selection renders as NOT_ELIGIBLE with no change to D', () => {
    // Suppression makes the server omit the stamp, which is already D's meaning
    // of "never eligible". The chip needs no new state.
    const r = readEffectiveContext({ }, { storyContextPresent: false, geographyContextPresent: true });
    expect(r.mapGeography).toBe('NOT_ELIGIBLE');
    expect(r.globalScopeIsHonest).toBe(true);
  });

  it('every declared subject shape is reachable', () => {
    const reached = new Set(
      ['Who is Kagame?', 'Who is the president?', 'Who is Rwanda?', 'What happened in Kenya?']
        .map((q) => readSubject(q).shape),
    );
    expect(reached.size).toBe(SUBJECT_SHAPES.length);
  });

  it('every reference frame matches at least one question, so none is dead', () => {
    const probes = ['who is Kagame', 'what is inflation', 'tell me about Kagame',
                    'what do you know about Kagame', 'describe Kagame',
                    'explain inflation', 'how does an induction motor work'];
    for (const frame of REFERENCE_FRAMES) {
      expect(probes.some((p) => frame.test(p))).toBe(true);
    }
  });
});

describe('ADDENDUM · the corpus delta, as one table', () => {
  it.each(CORPUS_DELTA.map((r) => [r.id, r] as const))('%s', (_id, row) => {
    const typedGeographyPresent =
      row.id === 'AD4-kagame-in-kenya-yesterday' || row.id === 'AD9-what-is-happening-in-kenya' ||
      row.id === 'AD7-geographic-subject' || row.id === 'AD12-office-of-country';
    const resolvedArticleAnchorPresent = row.id === 'AD17-named-subject-with-article-anchor';
    /* The landed intent for each row, measured on canonical. `who is` -> BG,
       `what is`/`explain`/`how does` -> EXPL, the happening family -> EVENT. */
    const intentClass = /^(who is|who was)/i.test(row.question) ? BG
      : /happening|going on|security situation|^why|^what happened/i.test(row.question) ? EVENT
      : /^(what is|what was|explain|how does|how do|tell me about|describe)/i.test(row.question) ? EXPL
      : EVENT;
    const e = decideInheritedContextEligibility(row.question, {
      typedGeographyPresent, resolvedArticleAnchorPresent, intentClass,
    });
    expect(e.decision).toBe(row.expectDecision);
    expect(e.subject.shape).toBe(row.expectSubjectShape);
    if (row.expectDecision === 'SUPPRESSED') {
      expect(eligibleMapGeography({ countryCode: row.mapSelected }, e)).toBeUndefined();
    } else if (row.mapSelected !== null) {
      expect(eligibleMapGeography({ countryCode: row.mapSelected }, e)).toBeDefined();
    }
  });

  it('AD17 — with a resolved article anchor, only the Map slot is suppressed', () => {
    const e = decideInheritedContextEligibility('Who is Kagame?', {
      typedGeographyPresent: false, resolvedArticleAnchorPresent: true, intentClass: BG,
    });
    expect(e.suppresses).toEqual(['MAP_GEOGRAPHY_CONTEXT']);
  });

  it('records the one prior row whose verdict moves', () => {
    expect(PRIOR_ROW_RESOLVED.row).toBe('E1-person-name');
    expect(PRIOR_ROW_RESOLVED.closedBy).toMatch(/ADDENDUM R1/);
  });
});

describe('ADDENDUM · baseline', () => {
  it('carries the CTO-declared canonical and claims no local verification of it', () => {
    expect(DECLARED_CANONICAL.branch).toBe('release/alpha-m08-integrated-r1');
    expect(DECLARED_CANONICAL.commit).toBe('6a163fdfa06b69b83df22fd0b33888a604c81c7a');
    expect(DECLARED_CANONICAL.verifiedByThisPackage).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * FINAL ADDENDUM — THE STABLE-REFERENCE CLASS
 * ══════════════════════════════════════════════════════════════════════════ */

describe('FINAL · Map Poland — stable reference questions suppress Poland', () => {
  const POL = { countryCode: 'POL', displayName: 'Poland' };

  it.each([
    ['Who is Kagame?', BG],
    ['What is NATO?', EXPL],
    ['What is inflation?', EXPL],
    ['What is a recession?', EXPL],
    ['How does an induction motor work?', EXPL],
    ['Explain inflation.', EXPL],
  ])('%s -> Poland suppressed', (q, intent) => {
    const e = decideInheritedContextEligibility(q, stable(intent));
    expect(e.decision).toBe('SUPPRESSED');
    expect(e.reason).toBe('EXPLICIT_NAMED_SUBJECT_NO_TYPED_GEOGRAPHY');
    expect(eligibleMapGeography(POL, e)).toBeUndefined();
    expect(e.blocksExecution).toBe(false);
    expect(e.intentClass).toBe(intent);
  });

  it('no country is invented for any of them', () => {
    for (const [q, intent] of [['What is NATO?', EXPL], ['Who is Kagame?', BG]] as const) {
      const e = decideInheritedContextEligibility(q, stable(intent));
      expect(JSON.stringify(e)).not.toMatch(/RWA|POL|KEN|FRA|Rwanda|Poland|Kenya|France/);
    }
    expect(QUALIFIED_ENTITY_PRODUCER_EXISTS).toBe(false);
  });
});

describe('FINAL · Map Rwanda — contextual questions keep Rwanda eligible', () => {
  const RWA = { countryCode: 'RWA', displayName: 'Rwanda' };

  it.each([
    ['Who is the president?', BG, 'DEFINITE_DESCRIPTION'],
    ['What is happening?', EVENT, 'NOT_A_REFERENCE_QUESTION'],
    ['What is the security situation?', EVENT, 'DEFINITE_DESCRIPTION'],
    ['What is the inflation rate?', EXPL, 'DEFINITE_DESCRIPTION'],
  ])('%s -> Rwanda eligible', (q, intent, shape) => {
    const e = decideInheritedContextEligibility(q, stable(intent));
    expect(e.decision).toBe('ELIGIBLE');
    expect(e.subject.shape).toBe(shape);
    expect(eligibleMapGeography(RWA, e)).toBe(RWA);
  });

  it('THE PAIR THAT DEFINES THE RULE — definite needs a referent, indefinite names a kind', () => {
    // Same intent, same frame, opposite outcome. The article is the whole difference.
    expect(decideInheritedContextEligibility('What is the inflation rate?', stable(EXPL)).decision).toBe('ELIGIBLE');
    expect(decideInheritedContextEligibility('What is a recession?', stable(EXPL)).decision).toBe('SUPPRESSED');
    expect(readSubject('What is the inflation rate?').shape).toBe('DEFINITE_DESCRIPTION');
    expect(readSubject('What is a recession?').shape).toBe('EXPLICIT_NAMED_SUBJECT');
  });

  it('an indefinite article is stripped, not treated as a description', () => {
    expect(readSubject('What is an emerging market?').shape).toBe('EXPLICIT_NAMED_SUBJECT');
    expect(readSubject('Describe a recession').shape).toBe('EXPLICIT_NAMED_SUBJECT');
  });

  it('NOT every EXPLANATION is suppressed — the subject reading still decides', () => {
    // The brief's rule 3: do not convert every EXPLANATION into unconditional
    // suppression when the subject is a definite contextual description.
    expect(decideInheritedContextEligibility('What is the inflation rate?', stable(EXPL)).decision).toBe('ELIGIBLE');
    expect(decideInheritedContextEligibility('What is the exchange rate?', stable(EXPL)).decision).toBe('ELIGIBLE');
  });
});

describe('FINAL · explicit geography always remains eligible and effective', () => {
  it('What is inflation in Rwanda? -> typed wins, and two guards independently refuse suppression', () => {
    /**
     * MEASURED, NOT ASSUMED. I first asserted `GEOGRAPHIC_SUBJECT` here and it
     * failed: the FUNCTION-WORD guard fires on "in" before the country guard is
     * reached, so the shape is `NOT_A_REFERENCE_QUESTION`. Both refuse
     * suppression, so the eligibility is right either way — but the shape is an
     * implementation detail of guard order and the behaviour is the contract.
     * Asserting the shape I expected rather than the one that occurs would have
     * pinned the wrong fact.
     */
    expect(readSubject('What is inflation in Rwanda?').shape).toBe('NOT_A_REFERENCE_QUESTION');
    // And with the function word removed, the country guard is what refuses it:
    expect(readSubject('What is Rwanda inflation?').shape).toBe('GEOGRAPHIC_SUBJECT');
    const e = decideInheritedContextEligibility('What is inflation in Rwanda?', {
      typedGeographyPresent: true, resolvedArticleAnchorPresent: false, intentClass: EXPL,
    });
    expect(e.decision).toBe('ELIGIBLE');
  });

  it("Explain NATO's role in Poland. -> typed Poland", () => {
    const e = decideInheritedContextEligibility("Explain NATO's role in Poland.", {
      typedGeographyPresent: true, resolvedArticleAnchorPresent: false, intentClass: EXPL,
    });
    expect(e.decision).toBe('ELIGIBLE');
  });

  it('What is happening in Kenya? -> typed Kenya, never suppressed', () => {
    const e = decideInheritedContextEligibility('What is happening in Kenya?', {
      typedGeographyPresent: true, resolvedArticleAnchorPresent: false, intentClass: EVENT,
    });
    expect(e.decision).toBe('ELIGIBLE');
  });

  it('a typed place defeats suppression even for a stable subject', () => {
    const e = decideInheritedContextEligibility('What is inflation?', {
      typedGeographyPresent: true, resolvedArticleAnchorPresent: false, intentClass: EXPL,
    });
    expect(e.decision).toBe('ELIGIBLE');
  });
});

describe('FINAL · the intent gate', () => {
  it('only EXPLANATION and ENTITY_BACKGROUND are stable', () => {
    expect([...STABLE_INTENT_CLASSES].sort()).toEqual(['ENTITY_BACKGROUND', 'EXPLANATION']);
  });

  it('GEOGRAPHIC_REGIONAL and article-anchored forms never suppress', () => {
    for (const intent of ['GEOGRAPHIC_REGIONAL', 'ARTICLE_ANCHORED', 'CURRENT_EVENT',
                          'MULTI_ENTITY', 'COMPARISON_RESEARCH', 'CLARIFICATION_REQUIRED']) {
      expect(decideInheritedContextEligibility('What is inflation?', stable(intent)).decision).toBe('ELIGIBLE');
    }
  });

  it('a missing intent reading fails SAFE — nothing is suppressed', () => {
    // An integration that forgets the seam passes an empty string. Suppression is
    // the riskier direction, so absence must not trigger it.
    expect(decideInheritedContextEligibility('What is inflation?', stable('')).decision).toBe('ELIGIBLE');
    expect(INTENT_IS_READ_NEVER_DERIVED_HERE).toBe(true);
  });

  it('NEGATIVE CONTROL — the intent is never derived in this module', () => {
    const src = require('fs').readFileSync(`${__dirname}/inherited-context-eligibility.ts`, 'utf8') as string;
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(code).not.toMatch(/classifyQueryIntent|CURRENT_EVENT_MARKERS/);
    expect(code).toMatch(/STABLE_INTENT_CLASSES/);   // positive control
  });

  it('the decision records which intent qualified it', () => {
    expect(decideInheritedContextEligibility('What is NATO?', stable(EXPL)).intentClass).toBe(EXPL);
    expect(decideInheritedContextEligibility('Who is the president?', stable(BG)).intentClass).toBe(BG);
  });
});

describe('FINAL · article anchors remain untouched', () => {
  it('a background-phrased question does not suppress a resolved anchor', () => {
    const e = decideInheritedContextEligibility('What is NATO?', {
      typedGeographyPresent: false, resolvedArticleAnchorPresent: true, intentClass: EXPL,
    });
    expect(e.decision).toBe('SUPPRESSED');
    expect(e.suppresses).toEqual(['MAP_GEOGRAPHY_CONTEXT']);
    expect(e.suppresses).not.toContain('STORY_COUNTRY_HINT');
    expect(ARTICLE_ANCHOR_IS_NEVER_SUPPRESSED).toBe(true);
  });
});

describe('FINAL · the final corpus delta, as one table', () => {
  it.each(FINAL_CORPUS_DELTA.map((r) => [r.id, r] as const))('%s', (_id, row) => {
    const typedGeographyPresent = row.id === 'FN11-inflation-in-rwanda'
      || row.id === 'FN12-nato-role-in-poland' || row.id === 'FN13-happening-in-kenya';
    const resolvedArticleAnchorPresent = row.id === 'FN14-background-with-anchor';
    const e = decideInheritedContextEligibility(row.question, {
      typedGeographyPresent, resolvedArticleAnchorPresent, intentClass: row.intentClass ?? '',
    });
    expect(e.decision).toBe(row.expectDecision);
    expect(e.subject.shape).toBe(row.expectSubjectShape);
    expect(e.intentClass).toBe(row.intentClass);
    if (row.expectDecision === 'SUPPRESSED') {
      expect(eligibleMapGeography({ countryCode: row.mapSelected }, e)).toBeUndefined();
    } else if (row.mapSelected !== null) {
      expect(eligibleMapGeography({ countryCode: row.mapSelected }, e)).toBeDefined();
    }
  });

  it('every row carries a measured intent reading', () => {
    for (const row of FINAL_CORPUS_DELTA) {
      expect(['EXPLANATION', 'ENTITY_BACKGROUND', 'CURRENT_EVENT']).toContain(row.intentClass);
    }
  });
});

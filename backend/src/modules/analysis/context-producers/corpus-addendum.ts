/**
 * CORPUS DELTA — ADDENDUM R1
 *
 * Rows ADDED by the addendum. The 19 rows of CONTEXT PRODUCER CLOSURE R1 are
 * unchanged; `E1-person-name` is the only prior row whose verdict MOVES, and it
 * moves from an open gap to a closed one.
 *
 * `mapSelected` is the inherited Map country in force when the question is asked.
 * `effectiveGeography` is what may scope retrieval after the eligibility decision.
 */

export interface AddendumRow {
  readonly id: string;
  readonly question: string;
  /** FINAL ADDENDUM: the landed classifyQueryIntent() reading, measured on canonical. */
  readonly intentClass?: string;
  readonly mapSelected: string | null;
  readonly expectDecision: 'ELIGIBLE' | 'SUPPRESSED';
  readonly expectSubjectShape: string;
  readonly effectiveGeography: string | null;
  readonly note?: string;
}

export const CORPUS_DELTA: readonly AddendumRow[] = [
  /* ── the four named cases ────────────────────────────────────────────────── */
  { id: 'AD1-kagame-map-poland', question: 'Who is Kagame?', mapSelected: 'POL',
    expectDecision: 'SUPPRESSED', expectSubjectShape: 'EXPLICIT_NAMED_SUBJECT', effectiveGeography: null,
    note: 'subject retained; Poland withheld; NO country guessed from the surname' },
  { id: 'AD2-macron-map-kenya', question: 'Who is Macron?', mapSelected: 'KEN',
    expectDecision: 'SUPPRESSED', expectSubjectShape: 'EXPLICIT_NAMED_SUBJECT', effectiveGeography: null },
  { id: 'AD3-the-president-map-rwanda', question: 'Who is the president?', mapSelected: 'RWA',
    expectDecision: 'ELIGIBLE', expectSubjectShape: 'DEFINITE_DESCRIPTION', effectiveGeography: 'RWA',
    note: 'no explicitly named entity, so governed inherited context may legitimately help' },
  { id: 'AD4-kagame-in-kenya-yesterday', question: 'What did Kagame say in Kenya yesterday?', mapSelected: 'POL',
    expectDecision: 'ELIGIBLE', expectSubjectShape: 'NOT_A_REFERENCE_QUESTION', effectiveGeography: 'KEN',
    note: 'typed Kenya outranks inherited Poland; statedPeriod "yesterday" survives' },

  /* ── the discriminator ───────────────────────────────────────────────────── */
  { id: 'AD5-bare-office-noun', question: 'Who is president?', mapSelected: 'RWA',
    expectDecision: 'ELIGIBLE', expectSubjectShape: 'DEFINITE_DESCRIPTION', effectiveGeography: 'RWA',
    note: 'a bare role is still a role: "who is THE president" with the article dropped' },
  { id: 'AD6-office-plus-name', question: 'Who is president Kagame?', mapSelected: 'POL',
    expectDecision: 'SUPPRESSED', expectSubjectShape: 'EXPLICIT_NAMED_SUBJECT', effectiveGeography: null },
  { id: 'AD7-geographic-subject', question: 'Who is Rwanda?', mapSelected: 'POL',
    expectDecision: 'ELIGIBLE', expectSubjectShape: 'GEOGRAPHIC_SUBJECT', effectiveGeography: 'RWA',
    note: 'the subject IS a place; typed geography owns it' },
  { id: 'AD8-lowercase-name', question: 'who is kagame', mapSelected: 'POL',
    expectDecision: 'SUPPRESSED', expectSubjectShape: 'EXPLICIT_NAMED_SUBJECT', effectiveGeography: null,
    note: 'capitalisation is evidence, never a requirement' },

  /* ── false positives ─────────────────────────────────────────────────────── */
  { id: 'AD9-what-is-happening-in-kenya', question: 'What is happening in Kenya?', mapSelected: 'POL',
    expectDecision: 'ELIGIBLE', expectSubjectShape: 'NOT_A_REFERENCE_QUESTION', effectiveGeography: 'KEN',
    note: 'THE FALSE POSITIVE THE FIRST DRAFT PRODUCED. `what is` is not a frame; its subject slot takes a gerund.' },
  { id: 'AD10-what-is-happening', question: 'What is happening?', mapSelected: 'RWA',
    expectDecision: 'ELIGIBLE', expectSubjectShape: 'NOT_A_REFERENCE_QUESTION', effectiveGeography: 'RWA',
    note: 'exactly the question that SHOULD inherit the selection' },
  { id: 'AD11-convention-centre', question: 'What happened at the convention centre yesterday?', mapSelected: 'RWA',
    expectDecision: 'ELIGIBLE', expectSubjectShape: 'NOT_A_REFERENCE_QUESTION', effectiveGeography: 'RWA',
    note: 'unchanged from R1: nothing typed, so the selection legitimately applies' },
  { id: 'AD12-office-of-country', question: 'Who is the current president of Rwanda?', mapSelected: 'POL',
    expectDecision: 'ELIGIBLE', expectSubjectShape: 'DEFINITE_DESCRIPTION', effectiveGeography: 'RWA',
    note: 'both routes agree: determiner AND producer A typed geography. R1 finding still closed.' },
  { id: 'AD13-long-subject', question: 'Who is responsible for the new electoral law', mapSelected: 'RWA',
    expectDecision: 'ELIGIBLE', expectSubjectShape: 'NOT_A_REFERENCE_QUESTION', effectiveGeography: 'RWA' },

  /* ── follow-ups ──────────────────────────────────────────────────────────── */
  { id: 'AD14-followup-named-after-typed', question: 'Who is Kagame?', mapSelected: 'KEN',
    expectDecision: 'SUPPRESSED', expectSubjectShape: 'EXPLICIT_NAMED_SUBJECT', effectiveGeography: null,
    note: 'turn 2 after "What is happening in Kenya?" — turn 1 geography must not scope turn 2' },
  { id: 'AD15-followup-role-after-typed', question: 'Who is the president?', mapSelected: 'KEN',
    expectDecision: 'ELIGIBLE', expectSubjectShape: 'DEFINITE_DESCRIPTION', effectiveGeography: 'KEN',
    note: 'turn 2 with no named entity — inherited context may legitimately help' },
  { id: 'AD16-short-followup', question: 'why?', mapSelected: 'RWA',
    expectDecision: 'ELIGIBLE', expectSubjectShape: 'NOT_A_REFERENCE_QUESTION', effectiveGeography: 'RWA' },

  /* ── rank 2 survives ─────────────────────────────────────────────────────── */
  { id: 'AD17-named-subject-with-article-anchor', question: 'Who is Kagame?', mapSelected: 'POL',
    expectDecision: 'SUPPRESSED', expectSubjectShape: 'EXPLICIT_NAMED_SUBJECT', effectiveGeography: null,
    note: 'with a RESOLVED article anchor: Map suppressed, STORY_COUNTRY_HINT retained, rank 2 untouched' },
];

/** The one prior row whose verdict moves, stated so the delta is auditable. */
export const PRIOR_ROW_RESOLVED = {
  row: 'E1-person-name',
  was: 'no geography by any path; map country inherited — GAP, reported not closed',
  now: 'inherited Map geography SUPPRESSED; subject retained; no country guessed',
  closedBy: 'ADDENDUM R1 inherited-context eligibility',
} as const;

/**
 * FINAL ADDENDUM · THE STABLE-REFERENCE CLASS.
 *
 * `intentClass` on every row is the LANDED `classifyQueryIntent()` value, measured
 * out of tree at the CTO-declared commit — not assumed. The measurement is the
 * reason no new classifier was needed:
 *
 *   EXPLANATION        what is inflation / NATO / a recession · explain inflation
 *                      · how does an induction motor work · what is the inflation rate
 *   ENTITY_BACKGROUND  who is Kagame · who is Macron · who is the president
 *   CURRENT_EVENT      what is happening · what is happening in Kenya
 *                      · what is the security situation
 */
export const FINAL_CORPUS_DELTA: readonly AddendumRow[] = [
  /* ── Map Poland · stable reference questions suppress Poland ─────────────── */
  { id: 'FN1-who-is-kagame', question: 'Who is Kagame?', intentClass: 'ENTITY_BACKGROUND',
    mapSelected: 'POL', expectDecision: 'SUPPRESSED', expectSubjectShape: 'EXPLICIT_NAMED_SUBJECT',
    effectiveGeography: null, note: 'unchanged from the first addendum; re-asserted under the intent gate' },
  { id: 'FN2-what-is-nato', question: 'What is NATO?', intentClass: 'EXPLANATION',
    mapSelected: 'POL', expectDecision: 'SUPPRESSED', expectSubjectShape: 'EXPLICIT_NAMED_SUBJECT',
    effectiveGeography: null, note: 'the under-coverage case the final addendum closes' },
  { id: 'FN3-what-is-inflation', question: 'What is inflation?', intentClass: 'EXPLANATION',
    mapSelected: 'POL', expectDecision: 'SUPPRESSED', expectSubjectShape: 'EXPLICIT_NAMED_SUBJECT',
    effectiveGeography: null },
  { id: 'FN4-what-is-a-recession', question: 'What is a recession?', intentClass: 'EXPLANATION',
    mapSelected: 'POL', expectDecision: 'SUPPRESSED', expectSubjectShape: 'EXPLICIT_NAMED_SUBJECT',
    effectiveGeography: null, note: 'INDEFINITE article stripped: "a recession" names a kind' },
  { id: 'FN5-induction-motor', question: 'How does an induction motor work?', intentClass: 'EXPLANATION',
    mapSelected: 'POL', expectDecision: 'SUPPRESSED', expectSubjectShape: 'EXPLICIT_NAMED_SUBJECT',
    effectiveGeography: null, note: 'new frame: how does X work' },
  { id: 'FN6-explain-inflation', question: 'Explain inflation.', intentClass: 'EXPLANATION',
    mapSelected: 'POL', expectDecision: 'SUPPRESSED', expectSubjectShape: 'EXPLICIT_NAMED_SUBJECT',
    effectiveGeography: null, note: 'new frame: explain X' },

  /* ── Map Rwanda · contextual questions keep Rwanda ──────────────────────── */
  { id: 'FN7-who-is-the-president', question: 'Who is the president?', intentClass: 'ENTITY_BACKGROUND',
    mapSelected: 'RWA', expectDecision: 'ELIGIBLE', expectSubjectShape: 'DEFINITE_DESCRIPTION',
    effectiveGeography: 'RWA', note: 'DEFINITE article: a referent is required and inherited context supplies it' },
  { id: 'FN8-what-is-happening', question: 'What is happening?', intentClass: 'CURRENT_EVENT',
    mapSelected: 'RWA', expectDecision: 'ELIGIBLE', expectSubjectShape: 'NOT_A_REFERENCE_QUESTION',
    effectiveGeography: 'RWA' },
  { id: 'FN9-security-situation', question: 'What is the security situation?', intentClass: 'CURRENT_EVENT',
    mapSelected: 'RWA', expectDecision: 'ELIGIBLE', expectSubjectShape: 'DEFINITE_DESCRIPTION',
    effectiveGeography: 'RWA', note: 'eligible twice over: CURRENT_EVENT intent AND a definite description' },
  { id: 'FN10-inflation-rate', question: 'What is the inflation rate?', intentClass: 'EXPLANATION',
    mapSelected: 'POL', expectDecision: 'ELIGIBLE', expectSubjectShape: 'DEFINITE_DESCRIPTION',
    effectiveGeography: 'POL',
    note: 'THE PAIR WITH FN4: same intent, same frame, opposite outcome. The article is the whole difference.' },

  /* ── explicit geography always effective ────────────────────────────────── */
  { id: 'FN11-inflation-in-rwanda', question: 'What is inflation in Rwanda?', intentClass: 'EXPLANATION',
    mapSelected: 'POL', expectDecision: 'ELIGIBLE', expectSubjectShape: 'NOT_A_REFERENCE_QUESTION',
    effectiveGeography: 'RWA', note: 'typed Rwanda; the function-word guard refuses suppression first' },
  { id: 'FN12-nato-role-in-poland', question: "Explain NATO's role in Poland.", intentClass: 'EXPLANATION',
    mapSelected: 'KEN', expectDecision: 'ELIGIBLE', expectSubjectShape: 'NOT_A_REFERENCE_QUESTION',
    effectiveGeography: 'POL', note: 'typed Poland outranks inherited Kenya' },
  { id: 'FN13-happening-in-kenya', question: 'What is happening in Kenya?', intentClass: 'CURRENT_EVENT',
    mapSelected: 'POL', expectDecision: 'ELIGIBLE', expectSubjectShape: 'NOT_A_REFERENCE_QUESTION',
    effectiveGeography: 'KEN', note: 'PERMANENTLY COVERED. Now eligible because the intent is CURRENT_EVENT, not because the frame is missing.' },

  /* ── article anchor ─────────────────────────────────────────────────────── */
  { id: 'FN14-background-with-anchor', question: 'What is NATO?', intentClass: 'EXPLANATION',
    mapSelected: 'POL', expectDecision: 'SUPPRESSED', expectSubjectShape: 'EXPLICIT_NAMED_SUBJECT',
    effectiveGeography: null,
    note: 'with a RESOLVED anchor: Map suppressed, STORY_COUNTRY_HINT retained. A background phrasing does not suppress rank 2.' },
];

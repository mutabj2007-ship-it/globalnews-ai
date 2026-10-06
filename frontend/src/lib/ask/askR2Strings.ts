/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE G — D25 interface copy, EN/PL, verbatim from
 * ASK-INTELLIGENCE-WORKSPACE-R2 `14_COPY_EN_PL.md` (the frozen design authority). Keys follow
 * that table. Strings the table marks "(gov)" already live in `askStrings.ts` and are read
 * from there, not duplicated. No answer text lives here: answers come from the server.
 */
export type AskR2Locale = 'en' | 'pl';

export interface AskR2Strings {
  readonly askTitle: string;
  readonly ask: string;
  readonly close: string;
  readonly returnMap: string;
  readonly youAsked: string;
  readonly scope: string;
  readonly noScope: string;
  /** ASK R3 RETRIEVAL POLICY CLOSEOUT R2 — a follow-up that continued the prior subject. */
  readonly inheritedScope: string;
  readonly scopePending: string;
  readonly keptAsAsked: string;
  readonly answer: string;
  readonly sources: string;
  readonly openFull: string;
  readonly openFullMeta: string;
  readonly runDeep: string;
  readonly runDeepMeta: string;
  readonly newQ: string;
  readonly earlier: string;
  readonly deepEyebrow: string;
  readonly deepTitle: string;
  readonly deepBody: string;
  readonly notNow: string;
  readonly runConfirm: string;
  readonly badges: Readonly<
    Record<
      'ref' | 'ver' | 'cur' | 'clar' | 'part' | 'insuf' | 'unavail' | 'rec' | 'calc' | 'retrep',
      string
    >
  >;
  readonly referenceNoteTitle: string;
  readonly referenceNoteBody: string;
  /** CTO P0 — advice / decision support: general guidance from reasoning, not sourced research. */
  readonly guidanceNoteTitle: string;
  readonly guidanceNoteBody: string;
  readonly guidanceCurrentGap: string;
  readonly freshness: {
    readonly reference: string;
    /** LIVE ACCEPTANCE REPAIR R1 — a retained-record answer: not current, no AI. */
    readonly retainedRecord: string;
    /** R1 — a deterministic computation from the reader's own values. */
    readonly computed: string;
    /**
     * A reference answer that DID draw on retrieved sources — D25's mixed case (mapref,
     * "Background: reference · current role: checked …"), adapted by the integration: the
     * sources are real, so they are cited and the time they were checked is stated.
     */
    readonly referenceWithSources: string;
    readonly nothingRan: string;
    /** `{when}` · `{n}` placeholders; plural handled by `sourcesLabel`. */
    readonly checked: string;
    readonly retainedTo: string;
    /** BETA-ASK-005 — the bounded publication window the evidence was restricted to. */
    readonly publishedWindow: string;
    readonly zero: string;
    /**
     * ASK FIRST-ANSWER RETRIEVAL R3 — a provider REFUSED the search (rate limit, outage): the
     * zero is a statement about us, never about the world. `{when}` placeholder.
     */
    readonly limited: string;
    /**
     * CURRENT STATUS CORROBORATION R1 — a PARTIAL current-status answer: `{when}` is the
     * freshest corroborating report's publication time. It says "as of", never "verified now".
     */
    readonly corroboratedAsOf: (reports: number) => string;
  };
  readonly clarificationFooter: string;
  readonly sourcesAfterChoice: string;
  readonly insufficientTitle: string;
  /** ASK TRUTHFUL RETRIEVAL R2A — what was checked, and what the system may (not) conclude. */
  readonly verification: {
    readonly notVerified: string;
    readonly coverageIncomplete: string;
    readonly sourcesChecked: string;
    readonly available: string;
    readonly unavailable: string;
    readonly claims: string;
    readonly lanes: Readonly<Record<string, string>>;
    readonly reasons: Readonly<Record<string, string>>;
    readonly states: Readonly<Record<string, string>>;
  };
  /** R3 — the title when the empty result came from a refused search, not an answered one. */
  readonly limitedTitle: string;
  /** R3 — an answer that stands on the reporting that could be reached while a source was down. */
  readonly limitedNote: string;
  readonly unavailable: string;
  /** LIVE ACCEPTANCE REPAIR R1 — a compute-budget refusal is named as such, never "unavailable". */
  readonly budgetRefused: string;
  /**
   * ASK READING EXPERIENCE R1 — the ONE truthful working state while a request is in flight.
   * No retrieval stage is claimed: the client receives no progress events (H-FREEZE §5, D1).
   */
  readonly working: string;
  /** ASK READING EXPERIENCE R1 — a wide table's scroll hint, shown only when it overflows. */
  readonly tableScrollHint: (columns: number) => string;
  /** TRUST R1 — a failed Send keeps the draft; the reader retries by pressing Ask. */
  /** TRUST R1 §12 — pre-login links under the composer. */
  readonly privacyLink: string;
  readonly cookiesLink: string;
  readonly retryKept: string;
  /** TRUST R1 — a new answer arrived while the reader was reading earlier turns. */
  readonly newAnswerBelow: string;
  /** LIVE ACCEPTANCE REPAIR R1 — the lead line of a retained-record answer. */
  readonly retainedAnswer: string;
  /** GOVERNED ANSWER CONVERSATIONAL UX R1 — the label over suggested follow-up drafts. */
  readonly followUpHint: string;
  /**
   * GOVERNED RETAINED GAP REPAIR R1 — a retained-record card never renders blank: the line shown
   * when a record answer has no lead and no note, per basis.
   */
  readonly retainedFallback: {
    readonly GOVERNED_NO_RECORD: string;
    readonly GOVERNED_RECORD: string;
  };
  /**
   * GOVERNED RETAINED GAP REPAIR R1 — CAPABILITY_UNAVAILABLE / GOVERNED_RECORD_UNAVAILABLE copy,
   * chosen by the contribution's DISCLOSURE so an unreadable held artifact is never confused
   * with a missing capture, and neither with a true absence.
   */
  readonly governedGap: {
    readonly notDisplayable: Readonly<Record<string, string>>;
    readonly noCapture: Readonly<Record<string, string>>;
    readonly unreadable: string;
  };
  readonly noCitable: string;
  /**
   * GATE H — INTEGRATION-AUTHORED, flagged for Product copy review. A typed refusal says
   * WHAT is missing, keyed by the server's answer basis; `unavailable` stays the copy for
   * "Ask itself is not available".
   */
  readonly unavailableBecause: Readonly<Record<string, string>>;
  /** GATE H — the freshness line of a typed refusal: nothing was presented as fact. */
  readonly noAnswer: string;
  /** GATE H — a clarification the executor asked (e.g. an ambiguous country), with choices. */
  readonly whichOne: string;
  readonly clarificationFooterNoAi: string;
  readonly askedBeforeAnswering: string;
  /** GATE H (MD-005) — an opened stored result past its validity. */
  readonly expiredNote: string;
  /** CTO checkpoint 5 §5 — a composed cross-country continuation, disclosed. */
  readonly continuationAnsweredAs: string;
  readonly continuationNote: string;
  /**
   * CONVERSATIONAL INTELLIGENCE JOURNEY R3 — human labels (§28) for: a turn answered inside the
   * reader's trip / decision / relationship; decision support; a partial answer whose current part
   * could not be verified (§6); a two-sided relationship scope (§14); the two zero-compute asks
   * ("best for what?", a noted constraint).
   */
  readonly r3: {
    readonly continuationJobNote: string;
    readonly decisionNoteTitle: string;
    readonly decisionNoteBody: string;
    readonly decisionObjective: string;
    readonly partialCurrent: Readonly<Record<'UNAVAILABLE' | 'NO_EVIDENCE', string>>;
    readonly relationshipScope: (a: string, b: string, relations: readonly string[]) => string;
    readonly relations: Readonly<Record<string, string>>;
    readonly decisionObjectiveMissing: string;
    readonly objectives: Readonly<Record<string, string>>;
    readonly choiceFor: (question: string, objective: string) => string;
    readonly constraintNoted: string;
    /** L-3 — a send that never reached Ask (dropped connection): nothing about the service is claimed. */
    readonly networkFailed: string;
  };
  /**
   * CTO R4 — conceptual analysis and conversation work (a plan, a table…) answered by model
   * reasoning: zero sources is normal here, never a failure. `builtOn` names the earlier work used.
   */
  readonly r4: {
    readonly conceptualNoteTitle: string;
    readonly conceptualNoteBody: string;
    readonly workNoteTitle: string;
    readonly workNoteBody: string;
    readonly framework: string;
    /** R4 ALPHA R-2 — a MIXED answer: the explanatory part (model reasoning) beside the sourced current part */
    readonly mixedStableTitle: string;
    /** R4 ALPHA R-2 — the explanatory part could not be produced; the sourced current part stands */
    readonly mixedStableUnavailable: string;
    /** R4 ALPHA R-4 — the turn refers to an earlier answer this conversation does not hold */
    readonly priorReferenceUnresolved: string;
  };
  /** ALPHA ENABLEMENT R1 (MC-070) — a continuation (“And Kenya?”) with nothing to continue; the place stays a chip. */
  readonly noPriorSubject: string;
  /**
   * ALPHA VISUAL ACCEPTANCE REPAIR R1 — a clarification is NEVER shown without a question.
   * `broadening` names the parts of the question Ask cannot apply as a search limit yet
   * (the plan's not-applied chips); `codes` asks the question each plan clarification code
   * stands for; `fallback` is the question when nothing more specific is known.
   */
  readonly clarify: {
    readonly broadening: (notApplied: readonly string[], withSuggestion: boolean) => string;
    readonly suggestion: string;
    readonly useSuggestion: string;
    readonly chooseHint: string;
    readonly codes: Readonly<Record<string, string>>;
    readonly fallback: string;
  };
  /**
   * SIGNED-OUT FALLBACK REMOVAL R1 — Ask V2 answered 401: the reader must sign in. The
   * question was not sent and nothing ran; it waits in the composer.
   */
  readonly signInRequired: {
    readonly title: string;
    readonly body: string;
    readonly action: string;
  };
  /**
   * ASK GUEST TRIAL R3 — the first-visit guest. Restrained, never promotional: three
   * questions without signing in, a server-authoritative counter, and sign-in as the
   * continuation of THIS conversation — never a paywall, never "unlimited".
   */
  readonly guest: {
    readonly intro: string;
    readonly remaining: (n: number) => string;
    readonly notCounted: string;
    readonly exhaustedTitle: string;
    readonly exhaustedBody: string;
    readonly continueAction: string;
    readonly signInOptional: string;
    readonly inProgress: string;
    readonly cooldown: string;
    readonly limited: string;
    readonly attemptsExhausted: string;
    readonly unavailable: string;
    readonly signInForDeeper: string;
    readonly privacy: string;
    readonly cancelled: string;
    readonly failed: string;
    readonly resumed: string;
  };
  /**
   * ALPHA ENABLEMENT R1 (MC-055) — the reader's own library, by the scope the server read:
   * `signIn` without identity, `notAvailable` when its executor is not wired. NEUTRAL when
   * the payload names no scope.
   */
  readonly personal: Readonly<
    Record<'SAVED_STORIES' | 'INTERESTS' | 'NEUTRAL', { signIn: string; notAvailable: string }>
  >;
  /**
   * UNIFIED INTELLIGENCE BINDING R2C — the canonical-engine states every Ask surface shares:
   * the context reference could not be resolved (nothing ran; the question is kept), Ask V2 is
   * unavailable (nothing is sent anywhere else), and starting a new topic.
   */
  readonly unified: {
    readonly contextUnavailable: string;
    readonly askUnavailable: string;
    readonly newTopic: string;
    readonly newTopicStarted: string;
  };
  sourcesLabel(n: number): string;
}

const EN: AskR2Strings = {
  askTitle: 'Ask GlobalNewsAI',
  ask: 'Ask',
  close: 'Close',
  returnMap: 'Return to Map',
  youAsked: 'YOU ASKED',
  scope: 'SCOPE',
  noScope: 'General question · no scope applied',
  inheritedScope: 'Follow-up · continues {subject}',
  scopePending: 'Scope waits for your choice',
  keptAsAsked: 'Kept as asked',
  answer: 'ANSWER',
  sources: 'Sources',
  openFull: 'Open full analysis',
  openFullMeta: '0 AI · 0 provider · no compute',
  runDeep: 'Run deeper analysis',
  runDeepMeta: 'Asks before running',
  newQ: 'New question',
  earlier: 'EARLIER IN THIS CONVERSATION',
  deepEyebrow: 'EXPLICIT COMPUTE',
  deepTitle: 'Run deeper analysis?',
  deepBody:
    'Deeper analysis reads more sources across a wider window and prepares a structured report. It runs only after you confirm.',
  notNow: 'Not now',
  runConfirm: 'Run deeper analysis',
  badges: {
    ref: 'REFERENCE BACKGROUND',
    ver: 'CURRENTLY VERIFIED',
    cur: 'CURRENT INTELLIGENCE',
    clar: 'CLARIFICATION REQUIRED',
    part: 'PARTIAL EVIDENCE',
    insuf: 'INSUFFICIENT EVIDENCE',
    unavail: 'CAPABILITY UNAVAILABLE',
    rec: 'RETAINED RECORD',
    retrep: 'RETAINED REPORTING',
    calc: 'CALCULATION',
  },
  referenceNoteTitle: 'Model background · no citations',
  guidanceNoteTitle: 'General guidance · model reasoning',
  guidanceNoteBody:
    'This is general advice from reasoning and general knowledge, not current sourced research. No source was checked, and nothing here is a verified current fact (prices, competitors, market figures).',
  guidanceCurrentGap: 'Needs current sourced evidence — not answered here:',
  referenceNoteBody:
    'No external reference source is attached to this answer. Treat it as orientation, not as verified current fact.',
  freshness: {
    reference: 'Stable general knowledge · not checked against current sources',
    retainedRecord: 'Retained record · not current · no AI used',
    computed:
      'Calculated deterministically from the values in your question · no sources needed · no AI used',
    referenceWithSources: 'Background: reference · checked {when} · {sources}',
    nothingRan: 'One question before searching · nothing has run',
    checked: 'Checked {when} · {sources}',
    retainedTo: 'Retained reporting to {when} · {sources}',
    publishedWindow: 'Reporting published {from} – {to}',
    zero: 'Checked {when} · 0 matching reports',
    limited:
      'Checked {when} · a news source was temporarily unavailable, so this was not a complete search',
    corroboratedAsOf: (n) => `As of {when} · ${n} independent reports agree`,
  },
  clarificationFooter: 'No sources searched · no compute used',
  sourcesAfterChoice: 'Sources appear after you choose',
  insufficientTitle: 'Not enough matching reporting',
  verification: {
    notVerified: 'I could not verify this claim from the sources successfully checked.',
    coverageIncomplete: 'Verification was incomplete because some source lanes were unavailable.',
    sourcesChecked: 'Sources checked',
    available: 'checked',
    unavailable: 'unavailable',
    claims: 'Claim status',
    lanes: {
      gnews: 'GNews',
      'gdelt-doc': 'GDELT',
      'rss-feeds': 'Publisher feeds',
      'news-providers': 'News providers',
      x: 'X',
      youtube: 'YouTube',
    },
    reasons: {
      'not-configured': 'not configured',
      'rate-limited': 'rate limited',
      auth: 'access refused',
      timeout: 'timed out',
      unavailable: 'unavailable',
    },
    states: {
      CONFIRMED: 'Confirmed',
      CORROBORATED_REPORTING: 'Corroborated reporting',
      REPORTED: 'Reported (one source)',
      DISPUTED: 'Disputed',
      NOT_VERIFIED: 'Not verified',
      COVERAGE_INCOMPLETE: 'Not verified — coverage incomplete',
    },
  },
  limitedTitle: 'Search was limited',
  limitedNote:
    'A news source was temporarily unavailable. This answer uses the reporting that could be reached.',
  unavailable: 'Ask is unavailable right now. Nothing was run.',
  privacyLink: 'Privacy',
  cookiesLink: 'Cookies',
  retryKept: 'Not answered — your question is still in the box. Press Ask to try again.',
  newAnswerBelow: 'New answer below',
  working: 'Working on your answer…',
  tableScrollHint: (columns) => `Scroll sideways to see all ${columns} columns`,
  budgetRefused:
    'You have reached today’s Ask limit, so nothing was run and nothing was charged. Questions answered from retained records still work.',
  retainedAnswer: 'Answered from a retained governed record — no AI was used.',
  followUpHint: 'You could ask next',
  retainedFallback: {
    GOVERNED_NO_RECORD: 'No individual retained record exists for this question’s scope.',
    GOVERNED_RECORD: 'The retained record is shown below with its source.',
  },
  governedGap: {
    notDisplayable: {
      ECONOMY_CPI:
        'A retained NISR CPI release is held, but it cannot currently be read under its governed extraction rules, so no value is shown. Nothing was run in its place.',
      IMIHIGO:
        'The retained NISR Imihigo evaluation is held, but it cannot currently be read under its governed admission rules, so no result is shown. Nothing was run in its place.',
      default:
        'A retained governed record is held, but it cannot currently be read under its governed rules, so no value is shown. Nothing was run in its place.',
    },
    noCapture: {
      ECONOMY_CPI:
        'No retained NISR CPI release is held, so no value is shown. Nothing was run in its place.',
      MARKET_PROCUREMENT:
        'No retained TED procurement snapshot is held, so no notices are shown. Nothing was run in its place.',
      default:
        'No retained governed record is held for this question, so nothing is shown. Nothing was run in its place.',
    },
    unreadable:
      'The retained record for this question could not be read just now. Nothing is claimed either way, and nothing was run in its place.',
  },
  noCitable: 'No citable sources',
  unavailableBecause: {
    REFERENCE_UNAVAILABLE:
      'This needs up-to-date information that general background cannot reliably give, so it was not answered from memory. Try asking for the latest news on it, or name a place or period.',
    EXECUTOR_NOT_WIRED:
      'This question needs a source Ask cannot read yet — such as your saved stories, an official release or a specialist assessment. Nothing was answered from news in its place.',
    PLAN_IDENTITY_REQUIRED: 'Sign in to use your saved information.',
    PLAN_CAPABILITY_UNAVAILABLE:
      'This kind of question needs a capability Ask does not have — such as calculations, files, code, official releases or specialist assessments. Nothing was run.',
    OFFICIAL_SOURCE_UNAVAILABLE:
      'You asked for the official figure. Ask has no approved reader for this official source, so it cannot give the official value, and news reporting is not presented as official. Nothing was run.',
    GOVERNED_RECORD_UNAVAILABLE:
      'The retained record for this question cannot be shown right now. Nothing was run in its place.',
  },
  noAnswer: 'No answer given · nothing presented as fact',
  whichOne: 'Which one do you mean?',
  clarificationFooterNoAi: 'No AI used · nothing was answered',
  askedBeforeAnswering: 'One question before answering · no AI used',
  expiredNote: 'This saved answer has expired · shown as it was, not re-checked',
  continuationAnsweredAs: 'Answered as',
  continuationNote: 'continuing your earlier question for the new place',
  r4: {
    conceptualNoteTitle: 'Conceptual analysis · model reasoning',
    conceptualNoteBody:
      'An analysis built by reasoning, not a report of current events. No sources were needed, and nothing here is presented as a verified current fact.',
    workNoteTitle: 'Conversation work · model reasoning',
    workNoteBody:
      'Built from the earlier answers in this conversation. It is reasoning, not current sourced data: check any figure before you rely on it.',
    framework: 'Framework',
    mixedStableTitle: 'Explanation · model reasoning (not a source)',
    mixedStableUnavailable:
      'The explanatory part of your question could not be answered right now; the current part below is from sourced reporting.',
    priorReferenceUnresolved:
      'I can’t find an earlier answer in this conversation that this refers to. Which answer or statement do you mean?',
  },
  r3: {
    continuationJobNote: 'continuing what you are working on in this conversation',
    decisionNoteTitle: 'Decision support · general reasoning',
    decisionNoteBody:
      'The options are weighed against your objective under stated assumptions. This is reasoning, not current sourced data: no figure here is a verified current fact.',
    decisionObjective: 'Objective',
    partialCurrent: {
      UNAVAILABLE:
        'The current part could not be verified right now. The general explanation above still stands.',
      NO_EVIDENCE:
        'No current reporting was found for this part. The general explanation above still stands.',
    },
    relationshipScope: (a, b, relations) =>
      `Between ${a} and ${b}${relations.length > 0 ? ` · ${relations.join(', ')}` : ''}`,
    relations: {
      BORDER: 'border',
      CORRIDOR: 'corridor',
      TRADE: 'trade',
      TRANSPORT: 'transport',
      ENERGY: 'energy',
      INSTITUTIONAL: 'regional institutions',
      DIPLOMATIC: 'relations',
      SECURITY: 'security',
      /* CTO R4 fourth pass — relation families beyond commerce */
      WAR: 'war',
      TERRITORIAL_DISPUTE: 'territorial dispute',
      ALLIANCE: 'alliance',
      COMPETITION: 'rivalry',
      POLICY_COORDINATION: 'policy coordination',
      ECONOMIC: 'economic ties',
      HISTORICAL_RELATION: 'history',
    },
    decisionObjectiveMissing: 'Best for what objective? The answer depends on it.',
    objectives: {
      investment: 'investment',
      logistics: 'logistics',
      'market size': 'market size',
      growth: 'growth',
    },
    choiceFor: (question, objective) => `${question} — for ${objective}?`,
    constraintNoted:
      "Noted — I'll keep that for the rest of this conversation. What would you like to know?",
    networkFailed:
      'The connection failed before Ask could start. Nothing was run. Your question is still available to retry.',
  },
  /* TRUST R1 (checkpoint 5, live Alpha) — "And in Kenya?" asks back even when the thread HAS an
     earlier question (MC-070: a bare place is never combined with the earlier topic). Saying
     "there's no earlier question" was untrue there; this wording is true in both cases. */
  noPriorSubject:
    "What would you like to know about this place? An earlier question isn't carried over to a new place on its own.",
  clarify: {
    broadening: (notApplied, withSuggestion) =>
      `Ask can't limit a reporting search to ${quoteList(notApplied, 'and')} yet, so nothing was searched. It can search the most recent reporting without that limit — ${
        withSuggestion
          ? 'use the suggested question below, or rephrase.'
          : 'rephrase without it and ask again.'
      }`,
    suggestion: 'Suggested question',
    useSuggestion: 'Use this question',
    chooseHint: 'Choosing one adds it to your question below — nothing runs until you press Ask.',
    codes: {
      /* R4 closeout — REACHABLE: an EN / PL selection whose question is written in another
         language (frozen C's LANGUAGE_DECLARATION_CONFLICT → UNCLASSIFIED). Ask supports seven
         languages, so the copy never claims English and Polish only. */
      LANGUAGE_UNCLASSIFIED:
        'This question could not be handled in the selected language. Try rephrasing it, or choose the language you are writing in from the language menu.',
      /*
        DORMANT legacy path: only a source language outside the seven product languages
        reaches LANGUAGE_UNSUPPORTED, and the request contract rejects those before routing.

        ── R4 · PHASE B — THIS SENTENCE BECAME FALSE, AND CLAUDE L CAUGHT IT ──

        It read: "Ask answers in English and Polish. Could you ask your question in one of
        them?" That was true of the engine this catalogue was written against. It is not
        true of the current one — the answer comes back in the reader's own language, all
        seven — and Phase B made the shell say so everywhere else.

        Claude L refused to translate it faithfully, which was the right call: a faithful
        French rendering would have told a French reader, in French, that Ask only answers
        in English and Polish. L delivered a truthful rendering in all five and flagged the
        English as H's to fix. Leaving it would have made the product contradict itself by
        surface — five languages saying one thing and English saying another.

        The replacement names no list on purpose. An explicit list is what drifted here, and
        a list in six languages drifts six times; the language menu is the one place the
        set is actually true.

        This is a COPY change to a catalogue whose header says it is transcribed verbatim
        from the frozen D25 table, so it is flagged in the handoff for the CTO rather than
        made quietly. Reverting it is this one string and its Polish counterpart.
      */
      LANGUAGE_UNSUPPORTED:
        'This question could not be handled in the selected language. Try rephrasing it, or choose a different language from the language menu.',
      SOURCE_FRAME_UNPARSED:
        'Which source should the answer come from? Name the outlet or institution — for example “What does Reuters report about …?”',
      SELECTION_EXCEEDS_MAX: 'Too many stories are selected. Select fewer stories and ask again.',
      SELECTION_BELOW_MINIMUM:
        'Not enough stories are selected. Select more stories and ask again.',
    },
    fallback:
      'What exactly should this cover? Add one specific place, topic or period and ask again.',
  },
  signInRequired: {
    title: 'SIGN-IN REQUIRED',
    body: 'Sign in to ask GlobalNewsAI. Your question is kept below and was not sent — nothing was run.',
    action: 'Sign in to ask',
  },
  guest: {
    intro: 'Ask 3 questions — no sign-in required.',
    remaining: (n) => `${n} guest question${n === 1 ? '' : 's'} remaining`,
    notCounted: 'This one didn’t use a guest question.',
    exhaustedTitle: 'GUEST QUESTIONS USED',
    exhaustedBody:
      'You’ve used your 3 guest questions. Sign in to continue this conversation and keep your answers.',
    continueAction: 'Sign in to continue',
    signInOptional: 'Sign in',
    inProgress: 'Your previous question is still being answered. Your new question is kept below.',
    cooldown:
      'Guest questions are temporarily limited. Try again in a few minutes, or sign in. Your question is kept below.',
    limited:
      'The service is busy right now, so nothing was run. Try again shortly. Your question is kept below.',
    attemptsExhausted:
      'Guest questions are limited for this browser. Sign in to continue. Your question is kept below.',
    unavailable: 'Guest questions are unavailable right now. Sign in to ask.',
    signInForDeeper: 'Deeper analysis is available after you sign in.',
    privacy:
      'Guest questions and answers are kept on our servers for up to 7 days. To answer, your question goes to an AI provider (OpenAI) and search words go to news services. Signing in shares only your email address.',
    cancelled: 'Sign-in was cancelled. Your conversation is still here.',
    failed: 'Sign-in did not complete. Your conversation is still here.',
    resumed: 'Signed in. Your conversation continues here — nothing was run again.',
  },
  unified: {
    contextUnavailable:
      "The story, place or record this question was about couldn't be found, so nothing was run. Your question is kept below.",
    askUnavailable:
      'Ask is unavailable right now, so nothing was run. Your question is kept below.',
    newTopic: 'New topic',
    newTopicStarted: 'New topic — earlier questions are not carried into it.',
  },
  personal: {
    SAVED_STORIES: {
      signIn: 'Sign in to compare your saved stories.',
      notAvailable: "Comparing your saved stories isn't available yet.",
    },
    INTERESTS: {
      signIn: 'Sign in to use your interests.',
      notAvailable: "Using your interests isn't available yet.",
    },
    NEUTRAL: {
      signIn: 'Sign in to use your saved information.',
      notAvailable: "Your saved information isn't available here yet.",
    },
  },
  sourcesLabel: (n) => `${n} ${n === 1 ? 'source' : 'sources'}`,
};

/* Polish plural: 1 źródło · 2–4 źródła (except 12–14) · otherwise źródeł. */
function plSources(n: number): string {
  if (n === 1) return '1 źródło';
  const t = n % 10;
  const h = n % 100;
  return `${n} ${t >= 2 && t <= 4 && !(h >= 12 && h <= 14) ? 'źródła' : 'źródeł'}`;
}

const PL: AskR2Strings = {
  /*
    R4 · CTO BRAND RULING — the product NAME is canonical in all seven locales and is no
    longer translated. Polish reads `Ask GlobalNewsAI` here; `Zapytaj` remains the Ask ACTION
    directly below, which is what the ruling preserves. The value is projected from
    `ASK_PRODUCT_NAME` for every locale anyway (see `askShellSource`), so this line can no
    longer be the thing that diverges — it is corrected rather than left to be overridden.
  */
  askTitle: 'Ask GlobalNewsAI',
  ask: 'Zapytaj',
  close: 'Zamknij',
  returnMap: 'Wróć do mapy',
  youAsked: 'TWOJE PYTANIE',
  scope: 'ZAKRES',
  noScope: 'Pytanie ogólne · bez zakresu',
  inheritedScope: 'Pytanie uzupełniające · kontynuacja: {subject}',
  scopePending: 'Zakres zależy od Twojego wyboru',
  keptAsAsked: 'Zachowano zgodnie z pytaniem',
  answer: 'ODPOWIEDŹ',
  sources: 'Źródła',
  openFull: 'Otwórz pełną analizę',
  openFullMeta: '0 AI · 0 dostawców · bez obliczeń',
  runDeep: 'Uruchom pogłębioną analizę',
  runDeepMeta: 'Pyta przed uruchomieniem',
  newQ: 'Nowe pytanie',
  earlier: 'WCZEŚNIEJ W TEJ ROZMOWIE',
  deepEyebrow: 'JAWNE OBLICZENIA',
  deepTitle: 'Uruchomić pogłębioną analizę?',
  deepBody:
    'Pogłębiona analiza czyta więcej źródeł w szerszym okresie i przygotowuje uporządkowany raport. Uruchamia się dopiero po Twoim potwierdzeniu.',
  notNow: 'Nie teraz',
  runConfirm: 'Uruchom pogłębioną analizę',
  badges: {
    ref: 'WIEDZA OGÓLNA',
    ver: 'ZWERYFIKOWANE AKTUALNIE',
    cur: 'BIEŻĄCE INFORMACJE',
    clar: 'WYMAGA DOPRECYZOWANIA',
    part: 'CZĘŚCIOWE DOWODY',
    insuf: 'ZBYT MAŁO DOWODÓW',
    unavail: 'FUNKCJA NIEDOSTĘPNA',
    rec: 'ZACHOWANY ZAPIS',
    retrep: 'ZACHOWANE DONIESIENIA',
    calc: 'OBLICZENIE',
  },
  referenceNoteTitle: 'Wiedza modelu · bez przypisów',
  guidanceNoteTitle: 'Ogólne wskazówki · rozumowanie modelu',
  guidanceNoteBody:
    'To ogólna rada oparta na rozumowaniu i wiedzy ogólnej, a nie bieżąca analiza źródeł. Nie sprawdzono żadnego źródła i nic tutaj nie jest zweryfikowanym bieżącym faktem (ceny, konkurenci, dane rynkowe).',
  guidanceCurrentGap: 'Wymaga bieżących źródeł — bez odpowiedzi tutaj:',
  referenceNoteBody:
    'Do tej odpowiedzi nie dołączono zewnętrznego źródła referencyjnego. Traktuj ją jako orientację, a nie zweryfikowany bieżący fakt.',
  freshness: {
    reference: 'Stała wiedza ogólna · niesprawdzana w bieżących źródłach',
    retainedRecord: 'Zachowany zapis · nieaktualny · bez użycia AI',
    computed: 'Obliczone deterministycznie z wartości w pytaniu · bez źródeł · bez użycia AI',
    referenceWithSources: 'Tło: wiedza ogólna · sprawdzono {when} · {sources}',
    nothingRan: 'Jedno pytanie przed wyszukiwaniem · nic nie uruchomiono',
    checked: 'Sprawdzono {when} · {sources}',
    retainedTo: 'Doniesienia do {when} · {sources}',
    publishedWindow: 'Doniesienia opublikowane {from} – {to}',
    zero: 'Sprawdzono {when} · 0 pasujących doniesień',
    limited:
      'Sprawdzono {when} · źródło wiadomości było chwilowo niedostępne, więc wyszukiwanie nie było pełne',
    corroboratedAsOf: (n) =>
      n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
        ? `Stan na {when} · ${n} niezależne doniesienia są zgodne`
        : `Stan na {when} · ${n} niezależnych doniesień jest zgodnych`,
  },
  clarificationFooter: 'Nie przeszukano źródeł · nie użyto obliczeń',
  sourcesAfterChoice: 'Źródła pojawią się po Twoim wyborze',
  insufficientTitle: 'Za mało pasujących doniesień',
  verification: {
    notVerified: 'Nie udało się zweryfikować tej informacji w pomyślnie sprawdzonych źródłach.',
    coverageIncomplete: 'Weryfikacja była niepełna, ponieważ część źródeł była niedostępna.',
    sourcesChecked: 'Sprawdzone źródła',
    available: 'sprawdzono',
    unavailable: 'niedostępne',
    claims: 'Status informacji',
    lanes: {
      gnews: 'GNews',
      'gdelt-doc': 'GDELT',
      'rss-feeds': 'Kanały wydawców',
      'news-providers': 'Dostawcy wiadomości',
      x: 'X',
      youtube: 'YouTube',
    },
    reasons: {
      'not-configured': 'nieskonfigurowane',
      'rate-limited': 'limit zapytań',
      auth: 'odmowa dostępu',
      timeout: 'przekroczony czas',
      unavailable: 'niedostępne',
    },
    states: {
      CONFIRMED: 'Potwierdzone',
      CORROBORATED_REPORTING: 'Potwierdzone w doniesieniach',
      REPORTED: 'Zgłoszone (jedno źródło)',
      DISPUTED: 'Sporne',
      NOT_VERIFIED: 'Niezweryfikowane',
      COVERAGE_INCOMPLETE: 'Niezweryfikowane — niepełne pokrycie',
    },
  },
  limitedTitle: 'Wyszukiwanie było ograniczone',
  limitedNote:
    'Źródło wiadomości było chwilowo niedostępne. Ta odpowiedź opiera się na doniesieniach, do których udało się dotrzeć.',
  unavailable: 'Zapytaj AI jest teraz niedostępne. Nic nie zostało uruchomione.',
  privacyLink: 'Prywatność',
  cookiesLink: 'Pliki cookie',
  retryKept:
    'Brak odpowiedzi — Twoje pytanie nadal jest w polu. Naciśnij Zapytaj, aby spróbować ponownie.',
  newAnswerBelow: 'Nowa odpowiedź poniżej',
  working: 'Pracuję nad odpowiedzią…',
  tableScrollHint: (columns) => `Przewiń w bok, aby zobaczyć wszystkie kolumny (${columns})`,
  budgetRefused:
    'Wykorzystano dzisiejszy limit Zapytaj AI, więc nic nie uruchomiono ani nie naliczono. Pytania, na które odpowiadają zachowane zapisy, nadal działają.',
  retainedAnswer: 'Odpowiedź z zachowanego, zweryfikowanego zapisu — bez użycia AI.',
  followUpHint: 'Możesz zapytać dalej',
  retainedFallback: {
    GOVERNED_NO_RECORD: 'Dla zakresu tego pytania nie istnieje osobny zachowany zapis.',
    GOVERNED_RECORD: 'Zachowany zapis wraz ze źródłem pokazano poniżej.',
  },
  governedGap: {
    notDisplayable: {
      ECONOMY_CPI:
        'Przechowywana jest zachowana publikacja CPI NISR, ale obecnie nie można jej odczytać zgodnie z zasadami zweryfikowanej ekstrakcji, więc nie pokazano wartości. Nic nie uruchomiono w zamian.',
      IMIHIGO:
        'Przechowywana jest zachowana ocena Imihigo NISR, ale obecnie nie można jej odczytać zgodnie z zasadami dopuszczenia, więc nie pokazano wyniku. Nic nie uruchomiono w zamian.',
      default:
        'Przechowywany jest zachowany zweryfikowany zapis, ale obecnie nie można go odczytać zgodnie z jego zasadami, więc nie pokazano wartości. Nic nie uruchomiono w zamian.',
    },
    noCapture: {
      ECONOMY_CPI:
        'Nie przechowujemy zachowanej publikacji CPI NISR, więc nie pokazano wartości. Nic nie uruchomiono w zamian.',
      MARKET_PROCUREMENT:
        'Nie przechowujemy zachowanej migawki zamówień TED, więc nie pokazano ogłoszeń. Nic nie uruchomiono w zamian.',
      default:
        'Dla tego pytania nie przechowujemy zachowanego zweryfikowanego zapisu, więc nic nie pokazano. Nic nie uruchomiono w zamian.',
    },
    unreadable:
      'Nie udało się teraz odczytać zachowanego zapisu dla tego pytania. Niczego nie stwierdzono i nic nie uruchomiono w zamian.',
  },
  noCitable: 'Brak źródeł do przytoczenia',
  unavailableBecause: {
    REFERENCE_UNAVAILABLE:
      'To pytanie wymaga aktualnych informacji, których ogólna wiedza nie zapewnia wiarygodnie, więc nie odpowiedziano z pamięci. Zapytaj o najnowsze wiadomości na ten temat albo podaj miejsce lub okres.',
    EXECUTOR_NOT_WIRED:
      'To pytanie wymaga źródła, którego Zapytaj AI jeszcze nie czyta — np. Twoich zapisanych materiałów, oficjalnej publikacji lub oceny specjalisty. Nie odpowiedziano zamiast tego na podstawie wiadomości.',
    PLAN_IDENTITY_REQUIRED: 'Zaloguj się, aby korzystać z zapisanych informacji.',
    PLAN_CAPABILITY_UNAVAILABLE:
      'Ten rodzaj pytania wymaga funkcji, której Zapytaj AI nie ma — np. obliczeń, plików, kodu, oficjalnych publikacji lub ocen specjalistów. Nic nie uruchomiono.',
    OFFICIAL_SOURCE_UNAVAILABLE:
      'Pytasz o oficjalną wartość. Zapytaj AI nie ma zatwierdzonego czytnika tego oficjalnego źródła, więc nie poda oficjalnej wartości, a doniesienia medialne nie są przedstawiane jako oficjalne. Nic nie uruchomiono.',
    GOVERNED_RECORD_UNAVAILABLE:
      'Zachowanego zapisu dla tego pytania nie można teraz pokazać. Nic nie uruchomiono w zamian.',
  },
  noAnswer: 'Brak odpowiedzi · nic nie przedstawiono jako faktu',
  whichOne: 'Które z nich masz na myśli?',
  clarificationFooterNoAi: 'Nie użyto AI · nie udzielono odpowiedzi',
  askedBeforeAnswering: 'Jedno pytanie przed odpowiedzią · nie użyto AI',
  expiredNote: 'Ta zapisana odpowiedź wygasła · pokazana bez ponownego sprawdzenia',
  continuationAnsweredAs: 'Odpowiedź na pytanie',
  continuationNote: 'kontynuacja Twojego wcześniejszego pytania dla nowego miejsca',
  r4: {
    conceptualNoteTitle: 'Analiza koncepcyjna · rozumowanie modelu',
    conceptualNoteBody:
      'Analiza zbudowana przez rozumowanie, a nie relacja z bieżących wydarzeń. Źródła nie były potrzebne i nic tutaj nie jest przedstawiane jako zweryfikowany bieżący fakt.',
    workNoteTitle: 'Praca w rozmowie · rozumowanie modelu',
    workNoteBody:
      'Zbudowane na wcześniejszych odpowiedziach w tej rozmowie. To rozumowanie, a nie bieżące dane ze źródeł: sprawdź każdą liczbę, zanim na niej polegasz.',
    framework: 'Ramy',
    mixedStableTitle: 'Wyjaśnienie · rozumowanie modelu (nie źródło)',
    mixedStableUnavailable:
      'Nie udało się teraz odpowiedzieć na część wyjaśniającą pytania; bieżąca część poniżej pochodzi ze źródeł.',
    priorReferenceUnresolved:
      'Nie znajduję w tej rozmowie wcześniejszej odpowiedzi, do której to się odnosi. O którą odpowiedź lub stwierdzenie chodzi?',
  },
  r3: {
    continuationJobNote: 'kontynuacja tego, nad czym pracujesz w tej rozmowie',
    decisionNoteTitle: 'Wsparcie decyzji · ogólne rozumowanie',
    decisionNoteBody:
      'Opcje są ważone względem Twojego celu przy jawnych założeniach. To rozumowanie, a nie bieżące dane ze źródeł: żadna liczba tutaj nie jest zweryfikowanym bieżącym faktem.',
    decisionObjective: 'Cel',
    partialCurrent: {
      UNAVAILABLE:
        'Bieżącej części nie udało się teraz zweryfikować. Ogólne wyjaśnienie powyżej pozostaje aktualne.',
      NO_EVIDENCE:
        'Nie znaleziono bieżących doniesień dla tej części. Ogólne wyjaśnienie powyżej pozostaje aktualne.',
    },
    relationshipScope: (a, b, relations) =>
      `Między: ${a} i ${b}${relations.length > 0 ? ` · ${relations.join(', ')}` : ''}`,
    relations: {
      BORDER: 'granica',
      CORRIDOR: 'korytarz',
      TRADE: 'handel',
      TRANSPORT: 'transport',
      ENERGY: 'energia',
      INSTITUTIONAL: 'instytucje regionalne',
      DIPLOMATIC: 'stosunki',
      SECURITY: 'bezpieczeństwo',
      WAR: 'wojna',
      TERRITORIAL_DISPUTE: 'spór terytorialny',
      ALLIANCE: 'sojusz',
      COMPETITION: 'rywalizacja',
      POLICY_COORDINATION: 'koordynacja polityki',
      ECONOMIC: 'więzi gospodarcze',
      HISTORICAL_RELATION: 'historia',
    },
    decisionObjectiveMissing: 'Najlepsza pod jakim względem? Od tego zależy odpowiedź.',
    objectives: {
      investment: 'inwestycje',
      logistics: 'logistyka',
      'market size': 'wielkość rynku',
      growth: 'wzrost',
    },
    choiceFor: (question, objective) => `${question} — pod kątem: ${objective}?`,
    constraintNoted: 'Zanotowane — zachowam to do końca tej rozmowy. Co chcesz wiedzieć?',
    networkFailed:
      'Połączenie przerwało się, zanim Zapytaj zdążyło zacząć. Nic nie zostało uruchomione. Możesz ponowić to pytanie.',
  },
  noPriorSubject:
    'Co chcesz wiedzieć o tym miejscu? Wcześniejsze pytanie nie przechodzi samo na nowe miejsce.',
  clarify: {
    broadening: (notApplied, withSuggestion) =>
      `Zapytaj GlobalNewsAI nie potrafi jeszcze zawęzić wyszukiwania doniesień do ${quoteList(notApplied, 'i', '„')}, więc niczego nie wyszukano. Może przeszukać najnowsze doniesienia bez tego ograniczenia — ${
        withSuggestion
          ? 'użyj proponowanego pytania poniżej albo przeformułuj pytanie.'
          : 'przeformułuj pytanie bez niego i zapytaj ponownie.'
      }`,
    suggestion: 'Proponowane pytanie',
    useSuggestion: 'Użyj tego pytania',
    chooseHint:
      'Wybór doda go do Twojego pytania poniżej — nic nie zostanie uruchomione, dopóki nie naciśniesz Zapytaj.',
    codes: {
      LANGUAGE_UNCLASSIFIED:
        'Nie udało się obsłużyć tego pytania w wybranym języku. Spróbuj je przeformułować albo wybierz w menu języka ten, w którym piszesz.',
      /* R4 · the same ruling as the English above; see the note there. */
      LANGUAGE_UNSUPPORTED:
        'Nie udało się obsłużyć tego pytania w wybranym języku. Spróbuj je przeformułować albo wybierz inny język w menu języka.',
      SOURCE_FRAME_UNPARSED:
        'Z jakiego źródła ma pochodzić odpowiedź? Podaj nazwę redakcji lub instytucji — np. „Co Reuters podaje o …?”',
      SELECTION_EXCEEDS_MAX:
        'Zaznaczono zbyt wiele artykułów. Zaznacz mniej artykułów i zapytaj ponownie.',
      SELECTION_BELOW_MINIMUM:
        'Zaznaczono za mało artykułów. Zaznacz więcej artykułów i zapytaj ponownie.',
    },
    fallback:
      'Czego dokładnie ma to dotyczyć? Dodaj jedno konkretne miejsce, temat lub okres i zapytaj ponownie.',
  },
  signInRequired: {
    title: 'WYMAGANE LOGOWANIE',
    body: 'Zaloguj się, aby zapytać GlobalNewsAI. Twoje pytanie czeka poniżej i nie zostało wysłane — nic nie uruchomiono.',
    action: 'Zaloguj się, aby zapytać',
  },
  guest: {
    intro: 'Zadaj 3 pytania — bez logowania.',
    /* Polish plural: 1 pytanie · 2–4 pytania (not 12–14) · 0, 5+ pytań. */
    remaining: (n) =>
      n === 1
        ? 'Pozostało 1 pytanie gościa'
        : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
          ? `Pozostały ${n} pytania gościa`
          : `Pozostało ${n} pytań gościa`,
    notCounted: 'To pytanie nie zostało policzone.',
    exhaustedTitle: 'WYKORZYSTANO PYTANIA GOŚCIA',
    exhaustedBody:
      'Wykorzystano 3 pytania gościa. Zaloguj się, aby kontynuować tę rozmowę i zachować odpowiedzi.',
    continueAction: 'Zaloguj się, aby kontynuować',
    signInOptional: 'Zaloguj się',
    inProgress: 'Poprzednie pytanie wciąż jest opracowywane. Nowe pytanie czeka poniżej.',
    cooldown:
      'Pytania gościa są chwilowo ograniczone. Spróbuj ponownie za kilka minut lub zaloguj się. Twoje pytanie czeka poniżej.',
    limited:
      'Serwis jest teraz obciążony, więc nic nie uruchomiono. Spróbuj ponownie za chwilę. Twoje pytanie czeka poniżej.',
    attemptsExhausted:
      'Pytania gościa są ograniczone w tej przeglądarce. Zaloguj się, aby kontynuować. Twoje pytanie czeka poniżej.',
    unavailable: 'Pytania gościa są teraz niedostępne. Zaloguj się, aby zapytać.',
    signInForDeeper: 'Pogłębiona analiza jest dostępna po zalogowaniu.',
    privacy:
      'Pytania i odpowiedzi gościa przechowujemy na naszych serwerach do 7 dni. Aby odpowiedzieć, pytanie trafia do dostawcy AI (OpenAI), a słowa wyszukiwania do serwisów informacyjnych. Logowanie udostępnia tylko Twój adres e-mail.',
    cancelled: 'Logowanie zostało anulowane. Twoja rozmowa jest nadal tutaj.',
    failed: 'Logowanie nie zostało ukończone. Twoja rozmowa jest nadal tutaj.',
    resumed: 'Zalogowano. Rozmowa trwa dalej tutaj — nic nie zostało uruchomione ponownie.',
  },
  unified: {
    contextUnavailable:
      'Nie udało się odnaleźć artykułu, miejsca ani rekordu, którego dotyczy pytanie, więc nic nie uruchomiono. Twoje pytanie czeka poniżej.',
    askUnavailable:
      'Zapytaj jest teraz niedostępne, więc nic nie uruchomiono. Twoje pytanie czeka poniżej.',
    newTopic: 'Nowy temat',
    newTopicStarted: 'Nowy temat — wcześniejsze pytania nie są w nim kontynuowane.',
  },
  personal: {
    SAVED_STORIES: {
      signIn: 'Zaloguj się, aby porównać zapisane artykuły.',
      notAvailable: 'Porównywanie zapisanych artykułów nie jest jeszcze dostępne.',
    },
    INTERESTS: {
      signIn: 'Zaloguj się, aby korzystać ze swoich zainteresowań.',
      notAvailable: 'Korzystanie z zainteresowań nie jest jeszcze dostępne.',
    },
    NEUTRAL: {
      signIn: 'Zaloguj się, aby korzystać z zapisanych informacji.',
      notAvailable: 'Twoje zapisane informacje nie są jeszcze tutaj dostępne.',
    },
  },
  sourcesLabel: plSources,
};

/** “a”, “a” and “b”, “a”, “b” and “c” — the reader's own words, quoted (PL opens with „). */
function quoteList(items: readonly string[], and: string, open = '“'): string {
  const quoted = items.map((item) => `${open}${item}”`);
  if (quoted.length <= 1) return quoted[0] ?? '';
  return `${quoted.slice(0, -1).join(', ')} ${and} ${quoted[quoted.length - 1]}`;
}

export function askR2Strings(locale: AskR2Locale): AskR2Strings {
  return locale === 'pl' ? PL : EN;
}

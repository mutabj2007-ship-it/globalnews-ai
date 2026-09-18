import type {
  SupportCategory,
  SupportTicketStatus,
  SupportAuthorType,
} from '@globalnews-ai/shared';

/**
 * S4 — English dictionary for the authenticated user Support surface.
 *
 * STANDALONE, AND NOT SPREAD INTO `en.ts`, UNLIKE `adminEn`.
 *
 * `adminEn` lives in its own file but is composed into `en.ts` (`admin:
 * adminEn`), so every admin screen still resolves through `getDictionary()`.
 * Support cannot follow that precedent in this checkpoint: `en.ts` and `pl.ts`
 * are owned by another lane and are off-limits while R4 is in flight. The
 * support page therefore resolves this dictionary directly.
 *
 * That is a deliberate, temporary difference and it is recorded as the second
 * post-R4 integration hook. Folding it in later is one line per file, and the
 * surface is fully correct and fully bilingual without it.
 *
 * IDENTIFIERS ARE NOT TRANSLATED. The `GN-` reference prefix is a protocol
 * token that a person reads aloud and types back; translating it would break
 * the thing it exists for. Status NAMES are translated because they are prose
 * shown to a member of the public, not values sent anywhere.
 */
export const supportEn = {
  meta: {
    title: 'Support — GlobalNews AI',
    description: 'Open a support request and follow its replies.',
  },

  heading: 'Support',
  intro:
    'Ask a question, report a problem, or send feedback. You can see every reply here — we never reply anywhere else.',

  signedOut: {
    title: 'Sign in to open a support request',
    body: 'Support requests belong to an account so that you and only you can read the replies. GlobalNews AI itself works without one.',
    /*
      SUPPORT CLOSURE — Help is discoverable from the public chrome, so a
      signed-out visitor reaches this screen deliberately. Naming the action
      here rather than leaving them to find the header control is the
      difference between an explanation and a dead end.
    */
    signIn: 'Sign in with Google',
  },

  list: {
    heading: 'Your requests',
    newRequest: 'New request',
    emptyTitle: 'You have not opened a request yet',
    emptyBody: 'When you open one it appears here, with every reply attached to it.',
    errorTitle: 'Your requests could not be loaded',
    errorBody:
      'The request failed. Nothing is shown rather than a partial list — if you have open requests, they are still there.',
    loading: 'Loading your requests…',
    retry: 'Try again',
    messageCount: 'messages',
    opened: 'Opened',
    lastActivity: 'Last activity',
  },

  form: {
    heading: 'New support request',
    categoryLabel: 'What is this about?',
    categoryPlaceholder: 'Choose one',
    subjectLabel: 'Subject',
    subjectPlaceholder: 'A short summary',
    messageLabel: 'Message',
    messagePlaceholder: 'What happened, and what were you expecting?',
    submit: 'Send request',
    submitting: 'Sending…',
    sendingNotice: 'Sending your request. It will appear here once it is saved.',
    cancel: 'Cancel',
    charactersRemaining: 'characters remaining',
    tooShortSubject: 'Please give the subject at least 3 characters.',
    tooShortMessage: 'Please describe the problem in at least 10 characters.',
    categoryRequired: 'Please choose what this is about.',
  },

  thread: {
    back: 'All requests',
    reference: 'Reference',
    replyLabel: 'Reply',
    replyPlaceholder: 'Add to this request',
    send: 'Send reply',
    sending: 'Sending…',
    tooShortReply: 'Please write at least 2 characters.',
    errorTitle: 'This request could not be loaded',
    errorBody: 'The request failed. Nothing is shown rather than part of a conversation.',
    loading: 'Loading…',
    /*
      SUPPORT CLOSURE (G4) — RESOLVED IS A FACT ABOUT THIS REQUEST, NOT ABOUT
      THE THING THAT WAS REPORTED. "Something is broken" is one of the seven
      categories, so a reader who filed a fault can easily take a closed thread
      as confirmation that the fault is gone. It is not, and this says so
      without contradicting an operator who genuinely has fixed something.
    */
    resolvedNotice:
      'This request is resolved. That refers to the request itself — it is not confirmation that a problem you reported has been fixed unless a reply says so. Replying to it will reopen it, and somebody will look at it again.',
  },

  /**
   * ONE MESSAGE FOR BOTH 429 CONDITIONS, DELIBERATELY.
   *
   * The backend returns 429 for two different reasons — the per-user
   * open-request cap and the route throttle — and they are not distinguishable
   * without parsing an English error string from the API, which would be
   * fragile and would break the moment the backend is localised. Telling
   * someone the wrong one of the two is worse than telling them both, so this
   * message is true whichever it was. Accepted for MVP; a machine-readable
   * error code is the right long-term fix.
   */
  errors: {
    sendFailedTitle: 'Your message was not sent',
    sendFailedBody:
      'Nothing was sent. Either this came too soon after your last message, or you already have the maximum number of open requests — resolving or closing one will let you open another.',
    genericTitle: 'Something went wrong',
    genericBody: 'Nothing was sent. Please try again in a moment.',
  },

  categories: {
    NEWS_QUESTION: 'A question about a story',
    BUG_REPORT: 'Something is broken',
    CONTENT_REPORT: 'Report content',
    FEEDBACK: 'Feedback or a suggestion',
    ABUSE_REPORT: 'Report abuse',
    ACCOUNT_PROBLEM: 'A problem with my account',
    OTHER: 'Something else',
  } satisfies Record<SupportCategory, string>,

  statuses: {
    OPEN: 'Open',
    AWAITING_USER: 'Waiting for you',
    AWAITING_ADMIN: 'With our team',
    RESOLVED: 'Resolved',
  } satisfies Record<SupportTicketStatus, string>,

  /**
   * SYSTEM_AI is labelled as a machine and must stay that way. A person has to
   * be able to tell whether an answer came from a human, and nothing about a
   * generated reply may be presented as one. Nothing writes SYSTEM_AI today;
   * this label exists so that if anything ever does, it arrives already
   * labelled rather than needing to be caught later.
   */

  /**
   * SUPPORT AI CONVERSATION V1 — the conversational Support surface.
   *
   * AUTHORITY. Every string marked C-n below is drafted in
   * F-SUPPORT-AI-CONVERSATION-V1-CONTRACT-1 file `05`, and is reproduced here
   * VERBATIM. What that contract fixes is the TRUTH CONDITION each string must
   * satisfy; L holds final language authority and may rewrite any sentence
   * that keeps its condition. A rewrite that changes the condition is a change
   * to the contract, not to the copy.
   *
   * Strings NOT marked C-n are surface chrome the contract does not cover — a
   * field label, a button, a heading. They are drafted here, are flagged as
   * drafted in the delivery manifest, and are L's to accept or replace.
   *
   * FOUR STRINGS ARE CARRIED UNCHANGED FROM THE LIVE RELEASE (`05` §1): the
   * analysis preamble, the sources label, the analysis limits footer, and the
   * three author labels in `authors` above. V1 invents less than it keeps.
   */
  conversation: {
    heading: 'Support',
    /* C-1 — describes a conversation, promises an answer here, names that a
       person may take over, promises nothing about speed. */
    intro:
      'Ask about GlobalNews AI: how something works, where to find it, or a problem you are having. You get an answer here, and a person can take over when one is needed. Everything stays in this conversation.',

    disclosure: {
      heading: 'Before you write',
      /* C-2 — discharges E1 A-3 in its V1, conversation-scope form. Says the
         CONVERSATION is sent, not the message; says an external model
         provider; says authored answers are sent nowhere; makes no retention,
         training or deletion claim; names no vendor. */
      beforeFirstSend:
        'To answer questions about the news, GlobalNews AI sends this conversation — everything you write in it, not only your latest message — to an external model provider. Answers about the product itself are written by people at GlobalNews AI and are sent nowhere. Please do not write passwords, payment details or documents here. If the conversation goes to a person, someone at GlobalNews AI can read it.',
      /* C-3 — persistent after the first turn; keeps the two-source distinction. */
      compact:
        'Questions about the news send this conversation to an external model provider. Answers about the product do not.',
    },

    composer: {
      label: 'Your message',
      placeholder: 'Ask about GlobalNews AI',
      send: 'Send',
      tooShort: 'Please write at least 2 characters.',
    },

    /* C-16 — bounded to this turn only; announced to assistive technology; no
       time estimate. */
    working: {
      label: 'Preparing an answer',
      ariaLabel: 'The automated agent is preparing an answer. It will appear in this conversation.',
    },

    /* C-4 — ONE text for the whole WITHHELD kind. A statement about the
       agent's position, never about the world. */
    withheld: {
      body:
        'I do not have an answer here that I am able to stand behind. That is about what I can support, not about whether your question has an answer. I have not guessed, because a confident-sounding answer with nothing behind it would be worse than none. This conversation stays open, and a person from Support can take it.',
    },

    /* C-5 — ONE text for the whole UNAVAILABLE kind. Identical for flag-off,
       timeout, provider failure, allowance and concurrency; discloses no
       limiter shape; does not promise that retrying works. */
    unavailable: {
      body:
        'I cannot answer on this turn. That is a limit on my side, not something about your question, and I do not know whether asking again later will help. Your message is saved in this conversation, and a person from Support can take it.',
    },

    /* C-6 — the footer on an authored answer. */
    authored: {
      limits:
        'This answer was written by GlobalNews AI Support and describes how the product works today. Reply here if it does not answer what you asked.',
    },

    /* Carried unchanged from the live release — `05` §1. */
    analysis: {
      preamble: 'Based on the reporting GlobalNews AI has stored, here is what I can support:',
      sourcesLabel: 'Sources this rests on',
      limits:
        'This is drawn only from the reporting listed above and may be incomplete or out of date. It is not a technical support answer and confirms no repair. Reply here if it does not answer what you asked, and a person will pick it up.',
    },

    /* C-7 — names that part is unanswered; states the rest was not filled in. */
    partial: {
      notice:
        'That covers only part of what you asked. The rest I have not answered, and I have not filled it in — ask again for that part, or a person can take it.',
    },

    /* C-8 — the H-2 boundary in the reader's words: navigation and policy yes,
       this reader's own record no. */
    account: {
      cannotSee:
        'I cannot see your account, so I cannot check what has happened to it. I can explain how something works and where to find it, and a person from Support can look at the account itself.',
    },

    escalation: {
      /* C-9 — an explicit, always-honoured route. No negotiation.

         THESE TWO ARE TRUE ONLY WHERE A HANDOFF TRANSPORT EXISTS. "I will pass
         it on" is a promise that something is delivered, and the surface may
         render it only when the adapter reports `handoffAvailable`. With the
         no-transport adapter nothing is delivered, so the surface renders
         `noHandoff` in their place and offers `openRequest` instead of
         `action`. See R2-1. */
      offer: 'A person can take this — say so and I will pass it on.',
      action: 'Ask for a person',

      /* R2-1 — the truthful route while no handoff transport exists.

         It states two facts and promises nothing: this conversation reaches
         nobody, and the way to reach a person is the support request on this
         page, which does go to the team. No ticket number, no queue position,
         no waiting time, no acknowledgement — there is nothing to acknowledge,
         because nothing has been sent. */
      noHandoff:
        'This conversation is not sent to anyone, and nobody is notified that you wrote here. To reach a person, open a support request on this page — a request does go to the Support team.',
      openRequest: 'Open a support request',
    },

    transition: {
      /* C-10 — the handoff turn. Visible in the conversation; says the
         automatic answers stop; promises no time. */
      queued:
        'This conversation is now with the human Support team. Nothing further here will be answered automatically.',
      /* C-11 — a person has joined; announces the change of voice explicitly. */
      humanArrived:
        'GlobalNews AI support has joined this conversation. You are no longer speaking with the automated agent.',
    },

    /* C-12 — does not repeat the data back, does not confirm it, does not
       claim it can be withdrawn. */
    sensitive: {
      volunteered:
        'Please do not send passwords, payment details or identity documents here — this conversation is not a secure channel for them, and what has already been sent cannot be taken back. For anything about your account, a person from Support can help directly.',
    },

    /* E1 C-8 — the context bound, as the reader experiences it. NO NUMBER
       appears in either string, and none may be added: C-28 and F's Q-5 forbid
       disclosing the limiter's shape, so these say THAT a bound was reached and
       never by how much. Drafted chrome, not contract copy — L's to replace. */
    context: {
      limitReached:
        'This conversation has grown long enough that its earliest parts are no longer included when an answer is prepared. Starting a new conversation gives a clean one.',
      tooLong:
        'This conversation has reached its length limit, so nothing further here will be answered automatically. Start a new conversation to keep asking, or a person from Support can take this one.',
    },

    /* C-13 — the only user-side control over how much is exported, stated as a
       fact rather than a warning. */
    newConversation: {
      hint: 'Starting a new conversation keeps this one out of what is sent for later questions.',
      action: 'Start a new conversation',
    },

    /* C-14 — the EN/PL boundary. */
    locale: {
      outOfScope:
        'Automatic answers are available in English and Polish only. Write here in either, or a person from Support can take this.',
    },

    /* Surface chrome. A reader-owned close: the reader ends the conversation,
       and `01`'s prohibited CLOSED -> OPEN_AI means replying reopens it with
       the people who owned it, never with the agent. */
    close: {
      action: 'Close this conversation',
    },

    /* C-15 — reopening returns to HUMAN, never to the agent. */
    closed: {
      reopen: 'This conversation is closed. If you reply, it reopens with the human Support team.',
    },

    /* Surface chrome — accessible names for the transcript and the live
       region. Not contract strings. */
    transcript: {
      label: 'Support conversation',
      liveRegionLabel: 'Latest reply in this conversation',
      systemTurnLabel: 'Status of this conversation',
    },

    /* The ticket surface, demoted. `01` — a ticket is what a conversation
       BECOMES when it escalates: escalation infrastructure, not the UX. */
    tickets: {
      heading: 'Your earlier requests',
      body: 'Requests you opened before this conversation surface existed are still here, with every reply attached.',
      open: 'Open your earlier requests',
      hide: 'Hide earlier requests',
    },
  },
  authors: {
    USER: 'You',
    ADMIN: 'GlobalNews AI support',
    SYSTEM_AI: 'GlobalNews AI Support Agent · automated',
  } satisfies Record<SupportAuthorType, string>,
};

/**
 * NOT `as const`, deliberately.
 *
 * `as const` would make every value a LITERAL type, and `supportPl` is typed
 * as this same shape — so the Polish file would only compile if every Polish
 * string were byte-identical to the English one. The compiler caught that
 * immediately, which is the right outcome, but the fix is here rather than in
 * the Polish file: what this type must guarantee is that the two dictionaries
 * have the same KEYS, never the same TEXT.
 *
 * The `satisfies Record<...>` clauses above still do the work that matters:
 * a vocabulary member added to the shared contract without a label here is a
 * compile error, in both languages.
 */
export type SupportDictionary = typeof supportEn;

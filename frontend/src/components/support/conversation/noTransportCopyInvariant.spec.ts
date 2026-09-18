import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { supportEn } from '@/lib/i18n/dictionaries/supportEn';
import { supportPl } from '@/lib/i18n/dictionaries/supportPl';
import { createNoTransportAdapter } from '@/lib/support/conversation/noTransportAdapter';
import { userTurn } from '@/lib/support/conversation/types';
import type { AgentTurn } from '@/lib/support/conversation/types';
import { SupportConversation } from './SupportConversation';
import { TranscriptTurn } from './TranscriptTurn';

/**
 * R2-2 — THE NO-TRANSPORT COPY INVARIANT, OVER THE WHOLE RENDERED SURFACE.
 *
 * THE RULE, AS THE CTO STATED IT:
 *
 *   No visible sentence may imply that a person can take over, receive, or
 *   read the CURRENT CONVERSATION when the adapter declares
 *   handoffAvailable=false. The only human route is the separate real Support
 *   request surface.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM R2-1. R2-1 removed the one sentence that
 * promised delivery outright — `escalation.offer`, "say so and I will pass it
 * on" — and proved it gone. That was necessary and it was not sufficient. The
 * promise is not a property of one string; it is a property of the SURFACE, and
 * several other strings that the live surface still renders make the same claim
 * in gentler words. A guard that names one string only ever catches that
 * string.
 *
 * So this gate does not look at `escalation.offer`. It renders the live surface
 * and its turns in both locales, extracts every visible sentence, and asks of
 * each one whether it implies that a human will receive, read or take over THIS
 * conversation. That is a claim about meaning, so the patterns below are
 * written per-claim and matched per-SENTENCE, with both controls a guard like
 * this needs:
 *
 *   POSITIVE — each pattern is shown to fire on the sentence it exists to
 *              catch. A pattern nobody has seen fire is not known to run.
 *   NEGATIVE — the patterns are shown NOT to fire on copy that is correct and
 *              nearby, so the gate cannot reject the very replacement it is
 *              asking for. The two are easy to confuse in both languages:
 *
 *                FORBIDDEN  "a person from Support can take it"
 *                CORRECT    "To reach a person, open a support request"
 *                FORBIDDEN  "osoba ... może się nią zająć"
 *                CORRECT    "Aby skontaktować się z osobą z zespołu, załóż
 *                            zgłoszenie"
 *
 *              Both mention a person. Only one says the person gets this
 *              conversation.
 *
 * ================================ STATUS ================================
 *
 * THIS GATE IS EXPECTED TO FAIL AT cece7aa, AND THAT IS ITS PURPOSE TODAY.
 *
 * The copy correction is F's to author and is tracked as
 * F-SUPPORT-NO-TRANSPORT-COPY-R3-1, which has not been supplied. No copy is
 * invented here: the dictionary is not modified by this patch. What this file
 * contributes is the ACCEPTANCE TEST that F's replacement must pass, and —
 * by failing — the exact, quoted list of sentences that must change. Run it and
 * the failure message is the requisition.
 *
 * When F's copy lands, this gate goes green with no edit to this file. If it
 * needs an edit to go green, the copy did not satisfy the invariant.
 * =======================================================================
 */

type Locale = 'en' | 'pl';

const dict = (locale: Locale): typeof supportEn => (locale === 'pl' ? supportPl : supportEn);

/* ------------------------------------------------------------------ */
/* THE CLAIMS. Each entry is one way of saying "a human gets this      */
/* conversation", with the sentence it was written to catch.           */
/* ------------------------------------------------------------------ */

interface Claim {
  readonly id: string;
  readonly locale: Locale;
  readonly pattern: RegExp;
  /** A sentence this pattern MUST catch. */
  readonly catches: string;
  /** A correct sentence it must NOT catch. */
  readonly allows: string;
}

const CLAIMS: readonly Claim[] = [
  /* ---------------------------- ENGLISH ---------------------------- */
  {
    id: 'en/person-can-take',
    locale: 'en',
    pattern: /\b(a|the|any)\s+person\b[^.!?]*\b(can|could|will|may|might)\b[^.!?]*\b(take|have|receive|read|see|pick|handle|answer|reply)\b/i,
    catches: 'This conversation stays open, and a person from Support can take it.',
    allows: 'To reach a person, open a support request on this page.',
  },
  {
    id: 'en/support-takes-this',
    locale: 'en',
    pattern: /\b(support|the team|somebody|someone)\b[^.!?]*\b(can|will|could|may)\b[^.!?]*\b(take|pick up|read|see|handle|look at)\b[^.!?]*\b(this|it|the conversation)\b/i,
    catches: 'Support can take this conversation.',
    allows: 'A request does go to the Support team.',
  },
  {
    id: 'en/passed-on',
    locale: 'en',
    pattern: /\b(pass(ed|ing)?|forward(ed|ing)?|hand(ed|ing)?)\b[^.!?]*\b(it|this|on|over|along)\b/i,
    catches: 'The conversation will be passed on.',
    allows: 'Open a support request on this page.',
  },
  {
    id: 'en/take-over',
    locale: 'en',
    pattern: /\btak(e|es|ing)\s+over\b/i,
    catches: 'A person can take over when one is needed.',
    allows: 'To reach a person, open a support request.',
  },
  {
    id: 'en/now-with-a-human',
    locale: 'en',
    pattern: /\b(is|now)\s+(now\s+)?with\s+the\s+(human|support)\b|\bhas\s+joined\s+this\s+conversation\b/i,
    catches: 'This conversation is now with the human Support team.',
    allows: 'A request does go to the Support team.',
  },
  {
    id: 'en/someone-will-read',
    locale: 'en',
    pattern: /\b(somebody|someone|a human|a person)\b[^.!?]*\b(is|are|will be|has been)\b[^.!?]*\b(notified|told|alerted|reading|looking)\b/i,
    catches: 'Someone will be notified that you wrote here.',
    allows: 'Nobody is notified that you wrote here.',
  },
  {
    id: 'en/can-read-it',
    locale: 'en',
    pattern: /\b(can|could|will|may)\s+read\s+(it|this|the conversation|your conversation)\b/i,
    catches: 'Someone at GlobalNews AI can read it.',
    allows: 'Open a support request to reach the team.',
  },

  /* ---------------------------- POLISH -----------------------------
     NO \b IN THE POLISH PATTERNS, DELIBERATELY. JavaScript's \b is defined
     over [A-Za-z0-9_], so a boundary placed next to ą, ć, ę, ł, ń, ś, ź or ż
     asserts the opposite of what it reads as. The first draft of this file
     used \b here and three of these patterns silently never fired — the PL
     scan reported a clean surface while "może się nią zająć" sat in the
     withheld text, unread. The positive control above is the only reason that
     is not still true. Boundaries below are carried by whitespace and by the
     sentence scope instead. */
  {
    id: 'pl/moze-sie-zajac',
    locale: 'pl',
    pattern: /mo[żz]e\s+si[ęe][^.!?]*zaj[ąa][ćc]/i,
    catches: 'Ta rozmowa pozostaje otwarta, a osoba z zespołu wsparcia może się nią zająć.',
    allows: 'Aby skontaktować się z osobą z zespołu, załóż zgłoszenie na tej stronie.',
  },
  {
    id: 'pl/zostanie-przekazana',
    locale: 'pl',
    pattern: /(zostanie|b[ęe]dzie)[^.!?]*przekazan/i,
    catches: 'Napisz o tym, a rozmowa zostanie przekazana dalej.',
    allows: 'Zgłoszenie trafia do zespołu wsparcia.',
  },
  {
    id: 'pl/przekazana-dalej',
    locale: 'pl',
    pattern: /przekazan[aeoy]\s+dalej/i,
    catches: 'Rozmowa przekazana dalej do zespołu.',
    allows: 'Załóż zgłoszenie do wsparcia.',
  },
  {
    id: 'pl/jest-teraz-u-zespolu',
    locale: 'pl',
    pattern: /jest\s+teraz\s+u\s|do[łl][ąa]czy[łl]o\s+do\s+rozmowy/i,
    catches: 'Ta rozmowa jest teraz u zespołu wsparcia.',
    allows: 'Zgłoszenie trafia do zespołu wsparcia.',
  },
  {
    id: 'pl/ktos-przeczyta',
    locale: 'pl',
    pattern: /(kto[śs]|osob[aąęy]|cz[łl]owiek)[^.!?]*(przeczyta|odpowie|odbierze|zajmie\s+si[ęe])/i,
    catches: 'Ktoś z zespołu przeczyta tę rozmowę.',
    /*
      L-2 — THE REQUEST-SCOPED CASE, ADDED BECAUSE F+L MEASURED IT.

      This claim's two siblings already carried a request-scoped `allows`; this
      one did not, and F+L showed what that costs: the otherwise-natural
      "osoba z zespołu wsparcia przeczyta przesłane informacje" is CORRECT under
      the new architecture — scoped to the request, naming no conversation — and
      this pattern rejects it. The shipped wording uses `zespół wsparcia
      GlobalNews AI` and is clear of the pattern, so nothing is blocked today;
      the constraint was accidental rather than stated. It is stated now.

      NOT NARROWED, deliberately. F+L also recommended excluding sentences whose
      object is `zgłoszeni*`, which would let `osoba … przeczyta` through when it
      speaks about a request. That is a change to what the gate DETECTS, and a
      sentence naming both a request and the conversation would slip out with it.
      Recorded as an open recommendation to its owner rather than taken here —
      the shipped sentence below is what this `allows` pins.
    */
    allows:
      'Jeśli założysz zgłoszenie do wsparcia, informacje przesłane w tym zgłoszeniu może przeczytać zespół wsparcia GlobalNews AI.',
  },
  {
    id: 'pl/moze-przeczytac',
    locale: 'pl',
    pattern: /mo[żz]e\s+(j[ąa]|to|t[ęe])\s+(przeczyta[ćc]|zobaczy[ćc])/i,
    catches: 'Osoba z zespołu może ją przeczytać.',
    allows: 'Zgłoszenie trafia do zespołu wsparcia.',
  },
  /*
    THE TWO BELOW WERE ADDED AFTER THE SYMMETRY CHECK FAILED.

    The first pass of this gate flagged four English sentences and only two
    Polish ones. That asymmetry was not a difference in meaning — it was a hole
    in these patterns. `intro` says "przejmie to człowiek" (a human will take it
    over) and `context.tooLong` says "niech zajmie się tą osoba z zespołu
    wsparcia" (let a person from Support take care of this one). Both make
    exactly the claim their English counterparts make; neither was caught,
    because one uses a verb these patterns did not know and the other puts the
    person AFTER the verb.

    Both are scoped to the CONVERSATION and deliberately not to a REQUEST. "The
    Support team will handle your request" is true, is the route this surface
    now points at, and is very likely to appear in F's replacement copy — so it
    is carried as an `allows` case on each, and the gate is proven not to catch
    it.
  */
  {
    id: 'pl/przejmie-rozmowe',
    locale: 'pl',
    pattern: /przejm(ie|ą|uj[ąe])[^.!?]*\b(to|rozmow[ęea]|ni[ąa])\b/i,
    catches: 'Odpowiedź otrzymasz tutaj, a gdy będzie to potrzebne, przejmie to człowiek.',
    allows: 'Zgłoszenie przejmie zespół wsparcia.',
  },
  {
    id: 'pl/zajmie-sie-rozmowa',
    locale: 'pl',
    pattern: /zajmie\s+si[ęe][^.!?]*(rozmow|ni[ąa]|t[ąa]\s|tym\s)|(rozmow|ni[ąa])[^.!?]*zajmie\s+si[ęe]/i,
    catches: 'Rozpocznij nową rozmowę, aby pytać dalej, albo niech zajmie się tą osoba z zespołu wsparcia.',
    allows: 'Zespół wsparcia zajmie się Twoim zgłoszeniem.',
  },

  /* ================================================================
     A-6, AS SUPERSEDED BY THE CTO — THE OTHER DIRECTION.

     F's accepted A-6 read "the deleted disclosure sentence has no
     replacement", and it existed to stop a reassurance about internal access
     being added later by someone being helpful. F's reason for it is still
     correct and still binding:

         "No one at GlobalNews AI will read this conversation" is a claim
         nobody has measured. Silence about internal access is truthful; a
         reassurance about it is not.

     The CTO ruling supersedes the FORM of A-6, not that reasoning. The new
     invariant is symmetric:

         No copy may make a positive or negative claim about who can read the
         current automatic conversation. A privacy statement scoped solely to
         information deliberately submitted through a separate Support request
         is permitted and required.

     The POSITIVE direction was already covered here — en/can-read-it,
     pl/moze-przeczytac, pl/ktos-przeczyta. The NEGATIVE direction was covered
     nowhere in this tree once A-6's own wording was retired, so it is added
     below. Superseding A-6 must not mean losing half of it.

     Both carry the shipped request-scoped disclosure sentence as their
     `allows`, because that sentence is exactly what the ruling PERMITS AND
     REQUIRES, and a guard that caught it would forbid the thing it was written
     to protect.
     ================================================================ */
  {
    id: 'en/a6-no-one-reads-reassurance',
    locale: 'en',
    pattern: /\b(no one|no-one|nobody)\b[^.!?]*\b(read|reads|sees|see)\b/i,
    catches: 'No one at GlobalNews AI will read this conversation.',
    allows:
      'If you open a Support request, the information you submit in that request can be read by GlobalNews AI Support staff.',
  },
  {
    id: 'en/a6-conversation-not-read',
    locale: 'en',
    pattern: /\b(this|your|the)\s+conversation\b[^.!?]*\b(is|are)\s+(never\s+)?not\s+(read|seen)\b|\bnever\s+read\s+by\b/i,
    catches: 'This conversation is not read by anyone at GlobalNews AI.',
    allows: 'This conversation is not sent to anyone, and nobody is notified that you wrote here.',
  },
  {
    id: 'pl/a6-nikt-nie-przeczyta',
    locale: 'pl',
    /*
      `nikt` and `nie` are NOT adjacent in the sentence this catches — "Nikt z
      GlobalNews AI nie przeczyta…" puts the whole attribution between them. The
      first draft required `nikt\s+nie` and silently never fired; the positive
      control caught it, for the third time in this file.
    */
    pattern: /nikt[^.!?]*\bnie\s+(przeczyta|czyta|zobaczy|odczyta)/i,
    catches: 'Nikt z GlobalNews AI nie przeczyta tej rozmowy.',
    allows: 'Ta rozmowa nie jest nikomu przesyłana i nikt nie jest powiadamiany o tym, że tu piszesz.',
  },
  {
    id: 'pl/a6-rozmowa-nie-jest-czytana',
    locale: 'pl',
    pattern: /rozmow[aęy][^.!?]*nie\s+jest\s+(czytan|odczytywan|przegl[ąa]dan)/i,
    catches: 'Ta rozmowa nie jest czytana przez zespół wsparcia.',
    allows:
      'Jeśli założysz zgłoszenie do wsparcia, informacje przesłane w tym zgłoszeniu może przeczytać zespół wsparcia GlobalNews AI.',
  },
];

/* ------------------------------------------------------------------ */
/* RENDERING THE WHOLE SURFACE, not one string.                        */
/* ------------------------------------------------------------------ */

const AT = '2026-09-18T00:00:00.000Z';

const withheldTurn: AgentTurn = {
  kind: 'AGENT',
  id: 'a1',
  at: AT,
  outcome: 'WITHHELD',
  source: null,
  body: '',
  copyKey: 'WITHHELD',
  skipReason: 'no-evidence',
};

/**
 * Every fragment of the live surface a reader can see while
 * `handoffAvailable` is false, rendered rather than listed.
 *
 * The initial surface plus the turns. Server rendering cannot drive the
 * component through its states, so `reachableStrings` below covers what only
 * appears after an interaction — the two together are the whole visible set.
 */
function renderedSurface(locale: Locale): { readonly where: string; readonly html: string }[] {
  const d = dict(locale);
  const adapter = createNoTransportAdapter({ thinkMs: 0, now: () => AT });

  return [
    {
      where: 'the conversation surface, before the first send',
      html: renderToStaticMarkup(
        createElement(SupportConversation, {
          t: d,
          locale,
          adapter,
          onOpenRequestSurface: () => undefined,
        }),
      ),
    },
    {
      where: 'the withheld agent turn',
      html: renderToStaticMarkup(
        createElement(TranscriptTurn, {
          turn: withheldTurn,
          t: d.conversation,
          authors: d.authors,
          handoffAvailable: false,
        }),
      ),
    },
    {
      where: "the reader's own turn",
      html: renderToStaticMarkup(
        createElement(TranscriptTurn, {
          turn: userTurn({ id: 'u1', body: 'Jak to działa?', at: AT }),
          t: d.conversation,
          authors: d.authors,
          handoffAvailable: false,
        }),
      ),
    },
  ];
}

/**
 * The dictionary strings the live surface renders in states server rendering
 * cannot reach — the context notices at the bound and at the ceiling, and the
 * post-send chrome. Named explicitly so that adding a string to a reachable
 * state without adding it here is a visible omission rather than a silent one.
 */
function reachableStrings(locale: Locale): { readonly where: string; readonly text: string }[] {
  const c = dict(locale).conversation;
  return [
    { where: 'conversation.withheld.body (every agent turn)', text: c.withheld.body },
    { where: 'conversation.disclosure.beforeFirstSend (before the first send)', text: c.disclosure.beforeFirstSend },
    { where: 'conversation.escalation.noHandoff', text: c.escalation.noHandoff },
    { where: 'conversation.escalation.openRequest', text: c.escalation.openRequest },
    { where: 'conversation.context.limitReached (at the bound)', text: c.context.limitReached },
    { where: 'conversation.context.tooLong (at the ceiling)', text: c.context.tooLong },
    { where: 'conversation.newConversation.hint (after the first send)', text: c.newConversation.hint },
    { where: 'conversation.disclosure.compact (after the first send)', text: c.disclosure.compact },
    { where: 'conversation.intro', text: c.intro },
    { where: 'conversation.working.ariaLabel', text: c.working.ariaLabel },
  ];
}

/* ------------------------------------------------------------------ */

/** Visible text only: tags out, entities back, whitespace normalised. */
function visibleText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Sentence-scoped, so a match names the sentence and not the whole page. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

interface Violation {
  readonly locale: Locale;
  readonly where: string;
  readonly claim: string;
  readonly sentence: string;
}

function scan(locale: Locale): Violation[] {
  const claims = CLAIMS.filter((claim) => claim.locale === locale);
  const found: Violation[] = [];

  /*
    DICTIONARY ENTRIES FIRST, deliberately. The same sentence is usually found
    twice — once in the rendered markup and once as the string it came from —
    and the de-duplication below keeps whichever was seen first. Naming the
    dictionary KEY is what makes the requisition actionable: "conversation.
    intro" tells whoever writes the replacement exactly what to open, where
    "the conversation surface, before the first send" only tells them where it
    showed up.
  */
  const sources = [
    ...reachableStrings(locale),
    ...renderedSurface(locale).map((f) => ({ where: f.where, text: visibleText(f.html) })),
  ];

  for (const { where, text } of sources) {
    for (const sentence of sentences(text)) {
      for (const claim of claims) {
        if (claim.pattern.test(sentence)) {
          found.push({ locale, where, claim: claim.id, sentence });
        }
      }
    }
  }

  // The same sentence reached through two surfaces is one problem to fix.
  const seen = new Set<string>();
  return found.filter((v) => {
    const key = `${v.claim}::${v.sentence}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* THE GUARD ABOUT THE GUARD                                           */
/* ------------------------------------------------------------------ */

describe('the gate is a real gate before it is a requirement', () => {
  it('every claim fires on the sentence it exists to catch', () => {
    const silent = CLAIMS.filter((claim) => !claim.pattern.test(claim.catches)).map((c) => c.id);
    expect(silent).toEqual([]);
  });

  it('no claim fires on correct, nearby copy — the gate cannot reject its own fix', () => {
    const overreaching = CLAIMS.filter((claim) => claim.pattern.test(claim.allows)).map((c) => ({
      claim: c.id,
      wronglyCaught: c.allows,
    }));
    expect(overreaching).toEqual([]);
  });

  it('the scan actually reaches the surface it claims to be reading', () => {
    for (const locale of ['en', 'pl'] as const) {
      const text = renderedSurface(locale)
        .map((f) => visibleText(f.html))
        .join(' ');
      // If these are absent the scan is reading an empty page.
      expect(text).toContain(dict(locale).conversation.escalation.noHandoff);
      expect(text).toContain(dict(locale).conversation.composer.label);
      expect(text.length).toBeGreaterThan(400);
    }
  });

  it('the scan covers BOTH the rendered markup and the states rendering cannot reach', () => {
    for (const locale of ['en', 'pl'] as const) {
      expect(renderedSurface(locale).length).toBeGreaterThanOrEqual(3);
      expect(reachableStrings(locale).length).toBeGreaterThanOrEqual(9);
    }
  });

  it('sentence splitting keeps sentences whole', () => {
    expect(sentences('One thing. Two things! Three?')).toEqual([
      'One thing.',
      'Two things!',
      'Three?',
    ]);
  });
});

/* ------------------------------------------------------------------ */
/* THE INVARIANT                                                       */
/* ------------------------------------------------------------------ */

describe('R2-2 — no visible sentence implies a human receives THIS conversation', () => {
  for (const locale of ['en', 'pl'] as const) {
    it(`${locale} — the whole no-transport Support surface is clean`, () => {
      const violations = scan(locale);

      /*
        EXPECTED TO FAIL until F-SUPPORT-NO-TRANSPORT-COPY-R3-1 is supplied.
        The failure output below IS the requisition: each entry names the
        dictionary string, the claim it makes and the exact sentence. No
        replacement text is proposed here — authoring it is F's, and inventing
        it is precisely what this whole correction exists to prevent.
      */
      expect(violations).toEqual([]);
    });
  }

  /*
    THE SYMMETRY CHECK — the test that found the hole in this gate.

    EN and PL are translations of one contract, so a sentence that violates the
    invariant in one locale almost always violates it in the other. When the two
    scans disagree about WHICH dictionary key is at fault, exactly one of two
    things is true: the copy genuinely differs in meaning between locales, or
    the patterns have a gap. Both need a human to look, and neither should pass
    silently.

    On its first run this reported {en-only: intro, context.tooLong} — and the
    cause was the gap, not the copy. Two claims were added above.
  */
  it('EN and PL flag the same dictionary keys — a divergence is a hole or a mistranslation', () => {
    const keysFor = (locale: Locale): string[] =>
      [...new Set(scan(locale).map((v) => v.where))].sort();

    const en = keysFor('en');
    const pl = keysFor('pl');

    // Rendered-surface entries carry a prose label rather than a key; compare
    // only the entries that name a dictionary string, which is where a
    // translation can diverge from its counterpart.
    const dictionaryKeys = (keys: string[]): string[] =>
      keys.filter((k) => k.startsWith('conversation.'));

    expect({ enOnly: dictionaryKeys(en).filter((k) => !pl.includes(k)) }).toEqual({ enOnly: [] });
    expect({ plOnly: dictionaryKeys(pl).filter((k) => !en.includes(k)) }).toEqual({ plOnly: [] });
  });

  it('the sentences that must change are enumerated, so the requisition is explicit', () => {
    const all = [...scan('en'), ...scan('pl')];
    // eslint-disable-next-line no-console
    console.log(
      '\nF-SUPPORT-NO-TRANSPORT-COPY-R3-1 — sentences requiring replacement:\n' +
        (all.length === 0
          ? '  (none — the invariant holds)'
          : all
              .map((v) => `  [${v.locale}] ${v.where}\n      claim: ${v.claim}\n      "${v.sentence}"`)
              .join('\n')) +
        '\n',
    );
    expect(Array.isArray(all)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* WHAT MUST REMAIN TRUE WHATEVER F WRITES                             */
/* ------------------------------------------------------------------ */

describe('the only human route stays the separate real Support request surface', () => {
  for (const locale of ['en', 'pl'] as const) {
    it(`${locale} — the surface points at the request route and offers no in-conversation handoff`, () => {
      const c = dict(locale).conversation;
      const text = renderedSurface(locale)
        .map((f) => visibleText(f.html))
        .join(' ');

      expect(text).toContain(c.escalation.openRequest);
      expect(text).not.toContain(c.escalation.action);
      expect(text).not.toContain(c.escalation.offer);
      expect(text).not.toContain(c.transition.queued);
      expect(text).not.toContain(c.transition.humanArrived);
      expect(text).not.toContain(dict(locale).authors.ADMIN);
    });
  }

  it('R2/R2-1 engineering behaviour is untouched by this gate', () => {
    const adapter = createNoTransportAdapter();
    expect(adapter.handoffAvailable).toBe(false);
    expect(adapter.analysisAvailable).toBe(false);
    expect(adapter.id).toBe('no-transport-withheld-v1');
  });
});

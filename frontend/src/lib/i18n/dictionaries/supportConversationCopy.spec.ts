import { supportEn } from './supportEn';
import { supportPl } from './supportPl';

/**
 * THE COPY GUARDS — F `05` §4, `04` F-2, `06` D-5, `07` Q-5, `03` I-5, and
 * E1 C-12, C-13, C-28, C-32.
 *
 * E1 C-13 and F V-9/V-14/V-17 all require the same thing of this file: every
 * guard must be PROVEN TO FIRE on a deliberately non-compliant string. A
 * catalogue guard nobody has seen fail is not known to be running, and this
 * lane has already shipped one naive guard that would have rejected its own
 * correct copy — so the patterns below are exception-aware where that matters.
 */

const en = supportEn.conversation;
const pl = supportPl.conversation;

/** Every reader-visible string in the conversation surface, both locales. */
function allStrings(node: unknown, into: string[] = []): string[] {
  if (typeof node === 'string') {
    into.push(node);
    return into;
  }
  if (node && typeof node === 'object') {
    for (const value of Object.values(node)) allStrings(value, into);
  }
  return into;
}

const EN_STRINGS = allStrings(en);
const PL_STRINGS = allStrings(pl);
const ALL_STRINGS = [...EN_STRINGS, ...PL_STRINGS];

function assertNoneMatch(pattern: RegExp, strings: string[] = ALL_STRINGS): void {
  const offenders = strings.filter((value) => pattern.test(value));
  expect(offenders).toEqual([]);
}

describe('C-12 — the disclosure conveys four facts, all of them true', () => {
  it('1 · the CONVERSATION is sent, not "this message"', () => {
    expect(en.disclosure.beforeFirstSend).toMatch(/sends this conversation/i);
    expect(pl.disclosure.beforeFirstSend).toMatch(/przesyła tę rozmowę/i);
  });

  it('2 · later turns include earlier turns the reader wrote', () => {
    expect(en.disclosure.beforeFirstSend).toMatch(/not only your latest message/i);
    expect(pl.disclosure.beforeFirstSend).toMatch(/nie tylko ostatnią wiadomość/i);
  });

  it('3 · product answers are written by people and are sent nowhere — the disclosure does not OVER-claim', () => {
    expect(en.disclosure.beforeFirstSend).toMatch(/written by people/i);
    expect(en.disclosure.beforeFirstSend).toMatch(/sent nowhere/i);
    expect(pl.disclosure.beforeFirstSend).toMatch(/napisane przez ludzi/i);
  });

  it('4 · a person may read it if it is escalated', () => {
    expect(en.disclosure.beforeFirstSend).toMatch(/can read it/i);
    expect(pl.disclosure.beforeFirstSend).toMatch(/może ją przeczytać/i);
  });

  it('THE SENTENCE E1 CALLS FALSE never appears anywhere', () => {
    assertNoneMatch(/only your latest message is sent/i);
    assertNoneMatch(/this message is sent to/i);
  });

  it('POSITIVE CONTROL — the over-claim guard fires', () => {
    expect(() => assertNoneMatch(/only your latest message is sent/i, ['Only your latest message is sent.'])).toThrow();
  });

  it('the compact form keeps the two-source distinction and survives the whole conversation', () => {
    expect(en.disclosure.compact).toMatch(/external model provider/i);
    expect(en.disclosure.compact).toMatch(/product do not/i);
    expect(pl.disclosure.compact.length).toBeGreaterThan(20);
  });

  it('D-4 — no vendor is named', () => {
    assertNoneMatch(/\b(OpenAI|Anthropic|Claude|GPT|Gemini|Mistral|Azure|Bedrock)\b/i);
  });

  it('POSITIVE CONTROL — the vendor guard fires', () => {
    expect(() => assertNoneMatch(/\b(OpenAI|Anthropic)\b/i, ['We send this to OpenAI.'])).toThrow();
  });
});

describe('D-5 / C-10 — no retention, training or deletion claim, in either direction', () => {
  it('makes no claim about storage, training or deletion', () => {
    assertNoneMatch(/not used for training/i);
    assertNoneMatch(/we do not store/i);
    assertNoneMatch(/deleted after/i);
    assertNoneMatch(/nie (jest|są) (przechowywan|wykorzystywan)/i);
    assertNoneMatch(/usuwane po \d/i);
  });

  it('POSITIVE CONTROL — the retention guard fires', () => {
    expect(() => assertNoneMatch(/not used for training/i, ['Your data is not used for training.'])).toThrow();
  });
});

describe('F-2 — a zero-answer is never a claim about the world', () => {
  it('no non-answer asserts a product fact, a world fact or an account fact', () => {
    for (const pattern of [
      /there is no such feature/i,
      /that has not happened/i,
      /nothing changed/i,
      /your account is fine/i,
      /that is not possible/i,
      /nie ma takiej funkcj/i,
      /to się nie wydarzyło/i,
      /nic się nie zmieniło/i,
      /twoje konto jest w porządku/i,
    ]) {
      assertNoneMatch(pattern);
    }
  });

  it('the withheld text is a statement about the AGENT’s position', () => {
    expect(en.withheld.body).toMatch(/that is about what I can support/i);
    expect(en.withheld.body).toMatch(/not about whether your question has an answer/i);
  });

  it('WITHHELD and UNAVAILABLE say DIFFERENT things — one sentence spanning both would be false in one case', () => {
    expect(en.withheld.body).not.toBe(en.unavailable.body);
    expect(pl.withheld.body).not.toBe(pl.unavailable.body);
    expect(en.unavailable.body).toMatch(/limit on my side/i);
    expect(en.withheld.body).not.toMatch(/limit on my side/i);
  });

  it('POSITIVE CONTROL — the world-claim guard fires', () => {
    expect(() => assertNoneMatch(/there is no such feature/i, ['There is no such feature.'])).toThrow();
  });
});

describe('Q-5 / C-28 — the limiter’s shape is never disclosed', () => {
  it('no counter, countdown, remaining-quota phrasing or numeric limit appears', () => {
    assertNoneMatch(/\b\d+\s*(of|z)\s*\d+\b/i);
    assertNoneMatch(/try again in \d/i);
    assertNoneMatch(/spróbuj ponownie za \d/i);
    assertNoneMatch(/\b(questions|pytań|wiadomości) (left|remaining|pozostał)/i);
    assertNoneMatch(/rate.?limit/i);
  });

  it('the CONTEXT states name no number either — E1 C-8 reported as a fact, never as an amount', () => {
    for (const value of [en.context.limitReached, en.context.tooLong, pl.context.limitReached, pl.context.tooLong]) {
      expect(value).not.toMatch(/\d/);
    }
  });

  it('POSITIVE CONTROL — the counter guard fires', () => {
    expect(() => assertNoneMatch(/\b\d+\s*of\s*\d+\b/i, ['You have used 2 of 5 questions.'])).toThrow();
  });
});

describe('I-5 / C-32 — no persona, and the label is not weakened', () => {
  it('the agent has no name, no personality and no claim to remember the reader', () => {
    // Exception-aware: "I do not know whether asking again later will help" is
    // correct copy and must not be caught by a naive ban on "I ".
    assertNoneMatch(/\bI remember\b/i);
    assertNoneMatch(/\bmy name is\b/i);
    assertNoneMatch(/\bas we discussed\b/i);
    assertNoneMatch(/\bpamiętam\b/i);
    assertNoneMatch(/\bnazywam się\b/i);
  });

  it('POSITIVE CONTROL — the persona guard fires, and does NOT fire on the correct copy', () => {
    expect(() => assertNoneMatch(/\bI remember\b/i, ['I remember you from last time.'])).toThrow();
    // The exception half: the shipped withheld copy must stay legal.
    assertNoneMatch(/\bI remember\b/i, [en.withheld.body, en.unavailable.body]);
  });

  it('the automated label still carries its separator and its trailing word', () => {
    expect(supportEn.authors.SYSTEM_AI).toBe('GlobalNews AI Support Agent · automated');
    expect(supportPl.authors.SYSTEM_AI).toBe('Agent wsparcia GlobalNews AI · automatycznie');
    expect(supportEn.authors.SYSTEM_AI).not.toBe(supportEn.authors.ADMIN);
    expect(supportPl.authors.SYSTEM_AI).not.toBe(supportPl.authors.ADMIN);
  });
});

describe('F `05` §3 — the Polish agent voice is grammatically genderless', () => {
  /*
    The shipped one-shot fallback speaks in the masculine first person
    ("mógłbym", "zgadywałem"). In a one-shot form that is a stray; across a
    multi-turn thread a maintained grammatical gender IS a persona, which I-5
    prohibits. F flagged the departure rather than making it silently, and L
    holds the decision. These assertions pin the genderless drafts so the
    shipped forms cannot reappear here unnoticed.
  */
  const GENDERED_FIRST_PERSON = [
    /mógłbym/i, /mogłabym/i,
    /zgadywałem/i, /zgadywałam/i,
    /sprawdziłem/i, /sprawdziłam/i,
    /napisałem/i, /napisałam/i,
    /byłem/i, /byłam/i,
  ];

  it('no gendered first-person verb form appears in any Polish conversation string', () => {
    for (const pattern of GENDERED_FIRST_PERSON) assertNoneMatch(pattern, PL_STRINGS);
  });

  it('the genderless drafts are the ones actually shipped here', () => {
    expect(pl.withheld.body).toMatch(/za którą można ręczyć/);
    expect(pl.withheld.body).toMatch(/Nie ma tu zgadywania/);
    expect(pl.unavailable.body).toMatch(/nie wiadomo/);
  });

  it('POSITIVE CONTROL — the gender guard fires on the shipped masculine form', () => {
    expect(() =>
      assertNoneMatch(/mógłbym/i, ['Nie mam odpowiedzi, za którą mógłbym ręczyć.']),
    ).toThrow();
  });
});

describe('both locales are real, and neither is the other', () => {
  it('every English conversation string has a Polish counterpart that is not the English one', () => {
    expect(PL_STRINGS).toHaveLength(EN_STRINGS.length);
    const identical = EN_STRINGS.filter((value, index) => value === PL_STRINGS[index]);
    expect(identical).toEqual([]);
  });

  it('no string in either locale is empty', () => {
    for (const value of ALL_STRINGS) expect(value.trim().length).toBeGreaterThan(0);
  });
});

describe('F-6 — no invented operational fact in any failure or transition text', () => {
  it('no ticket number, queue position, waiting time, named person or business hours', () => {
    assertNoneMatch(/within \d+ hours?/i);
    assertNoneMatch(/position \d+/i);
    assertNoneMatch(/w ciągu \d+ godzin/i);
    assertNoneMatch(/\bGN-[A-Z0-9]/);
    assertNoneMatch(/business hours/i);
  });

  it('the handoff text promises no time at all', () => {
    expect(en.transition.queued).not.toMatch(/\d/);
    expect(pl.transition.queued).not.toMatch(/\d/);
  });

  it('POSITIVE CONTROL — the operational-fact guard fires', () => {
    expect(() => assertNoneMatch(/within \d+ hours?/i, ['A person will reply within 24 hours.'])).toThrow();
  });
});

import { resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';
import { detectOfficeGeography, officeGeographyCountryCode, OFFICE_HEAD_NOUNS } from './office-geography.producer';
import { detectReaderTopic, READER_CATEGORY_TERMS, TOPIC_VOCABULARY_SOURCE, CATEGORY_TERMS_BY_LENGTH } from './reader-topic.producer';
import { detectStatedPeriod, RELATIVE_PERIODS_ARE_NEVER_RESOLVED_HERE } from './stated-period.producer';
import { CORPUS_ADDITIONS } from './corpus';
import { isSpanOf, ROUTER_BLOCKERS_CLOSED, ROUTER_ROWS_AFFECTED, TOPIC_FIELD_ALIASES } from './ask-context-producers.contract';

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}-]+/gu, ' ').replace(/\s+/g, ' ').trim();

/* ══════════════════════════════════════════════════════════════════════════
 * A · OFFICE GEOGRAPHY
 * ══════════════════════════════════════════════════════════════════════════ */

describe('A · a current-office construction naming a country produces typed geography', () => {
  it('the round\'s finding: "president of Rwanda" resolves', () => {
    const r = detectOfficeGeography('Who is the current president of Rwanda?');
    expect(r).not.toBeNull();
    expect(r?.countryCode).toBe('RWA');
    expect(r?.officeTerm).toBe('president');
    expect(r?.countryTerm).toBe('rwanda');
  });

  it('provenance stays TYPED_GEOGRAPHY — rank 6, not a new rank', () => {
    const r = detectOfficeGeography('government of Kenya');
    expect(r?.scopeSource).toBe('TYPED_GEOGRAPHY');
    expect(r?.provenance).toBe('STATED');
    expect(r?.construction).toBe('OFFICE_OF_COUNTRY');
  });

  it('an institution counts, not only a person', () => {
    expect(officeGeographyCountryCode('the central bank of Kenya')).toBe('KEN');
    expect(officeGeographyCountryCode('the electoral commission of Kenya')).toBe('KEN');
    expect(officeGeographyCountryCode('the parliament of Rwanda')).toBe('RWA');
  });

  it('a determiner and a multi-word country name both survive', () => {
    expect(officeGeographyCountryCode('the prime minister of the United Kingdom')).toBe('GBR');
    expect(officeGeographyCountryCode('the president of the United States')).toBe('USA');
  });

  it('a permitted infix does not break the construction', () => {
    for (const infix of ['current', 'new', 'former', 'acting', 'sitting', 'incumbent']) {
      expect(officeGeographyCountryCode(`the ${infix} president of Rwanda`)).toBe('RWA');
    }
  });

  it('the longest office noun wins, so "vice president" is not read as "president"', () => {
    const r = detectOfficeGeography('the vice president of Kenya');
    expect(r?.officeTerm).toBe('vice president');
    expect(r?.countryCode).toBe('KEN');
  });

  it('every country term returned is a verbatim span of the question', () => {
    for (const q of ['Who is the current president of Rwanda?', 'the prime minister of the United Kingdom']) {
      const r = detectOfficeGeography(q);
      expect(r).not.toBeNull();
      expect(isSpanOf(r!.countryTerm, norm(q))).toBe(true);
      expect(isSpanOf(r!.officeTerm, norm(q))).toBe(true);
    }
  });
});

describe('A · FALSE-POSITIVE CONTROLS — the three the brief names', () => {
  it.each([
    ['who is the president of the board', 'office noun present, complement is not a country'],
    ['what is the cost of living', 'no office noun'],
    ['what happens at the end of the year', 'no office noun'],
  ])('refuses "%s" (%s)', (q) => {
    expect(detectOfficeGeography(q)).toBeNull();
  });

  it('refuses a generic noun even when the complement IS a country', () => {
    // "history of Rwanda" is a legitimate question and NOT a current-office
    // construction. Admitting it would be the global `of` rule by another route.
    expect(detectOfficeGeography('the history of Rwanda')).toBeNull();
    expect(detectOfficeGeography('a map of Rwanda')).toBeNull();
    expect(detectOfficeGeography('the population of Rwanda')).toBeNull();
  });
});

describe('A · HOMOGRAPH CONTROLS — the hazard the brief\'s examples do not reach', () => {
  it('refuses "the cost of turkey at christmas" though Turkey is a governed country', () => {
    expect(resolveCountryByAnyIdentifier('turkey')).toBeDefined();   // positive control
    expect(detectOfficeGeography('the cost of turkey at christmas')).toBeNull();
  });

  it('refuses "the end of jordan career" though Jordan is a governed country', () => {
    expect(resolveCountryByAnyIdentifier('jordan')).toBeDefined();   // positive control
    expect(detectOfficeGeography('the end of jordan career')).toBeNull();
  });

  it('POSITIVE CONTROL — with an office in front of it, the homograph IS the country', () => {
    // This is the case that makes the conjunction a rule rather than a blocklist.
    expect(officeGeographyCountryCode('the president of Turkey')).toBe('TUR');
    expect(officeGeographyCountryCode('the king of Jordan')).toBe('JOR');
  });

  it('the office-noun lexicon contains no generic noun that would reopen the hazard', () => {
    for (const forbidden of ['cost', 'end', 'history', 'map', 'population', 'price', 'start', 'list']) {
      expect(OFFICE_HEAD_NOUNS).not.toContain(forbidden);
    }
  });
});

describe('A · additive by construction', () => {
  it('declines every shape the landed detectLocation already resolves', () => {
    // The seam consults this producer only where the landed path returned nothing,
    // but declining these anyway proves the producer cannot change an existing case
    // even if the seam were wired the other way round.
    for (const q of ['what is happening in Kenya', 'entertainment news in rwanda this week', 'rwanda']) {
      expect(detectOfficeGeography(q)).toBeNull();
    }
  });

  it('is total and never throws', () => {
    for (const q of ['', ' ', 'of', 'of of of', 'president of', 'of Rwanda', '?!,.', 'president of the of']) {
      expect(() => detectOfficeGeography(q)).not.toThrow();
    }
    expect(detectOfficeGeography('president of')).toBeNull();
    expect(detectOfficeGeography('of Rwanda')).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * B · READER TOPIC
 * ══════════════════════════════════════════════════════════════════════════ */

describe('B · topic preservation', () => {
  it('MANDATORY — Entertainment is retained as TOPIC alongside geography and time', () => {
    const t = detectReaderTopic('Entertainment news in Rwanda this week');
    expect(t.newsCategory).toBe('entertainment');
    expect(t.categoryTerm).toBe('entertainment');
    expect(t.provenance).toBe('STATED');
  });

  it('reads the landed NewsCategory union rather than declaring a vocabulary', () => {
    for (const mapped of Object.values(READER_CATEGORY_TERMS)) {
      expect(TOPIC_VOCABULARY_SOURCE).toContain(mapped);
    }
  });

  it('NEGATIVE CONTROL — entertainment is never inserted into AnalyticalDomain', () => {
    /**
     * COMMENTS ARE STRIPPED BEFORE THE SCAN, AND THE REASON IS A CORRECTION.
     *
     * The first draft scanned the raw source and FAILED — on the producer's own
     * doc comment, which names `AnalyticalDomain` in order to say that it is not
     * imported. A control that reads prose as code fires on the sentence
     * documenting the prohibition it is guarding.
     *
     * Same class as Main's own probe fix, where "a semicolon inside a trailing
     * comment truncated a type block — line comments are now stripped before the
     * scan." Recorded rather than quietly deleted, because the next source-scanning
     * control in this lane will be written by someone who needs to know.
     */
    const raw = require('fs').readFileSync(`${__dirname}/reader-topic.producer.ts`, 'utf8') as string;
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

    expect(code).not.toMatch(/AnalyticalDomain|ANALYTICAL_DOMAINS|detectRequestedDomains/);
    // The property that actually matters: no import of the domain axis.
    expect(code).not.toMatch(/import[^;]*detect-analytical-domains/);
    // POSITIVE CONTROL — the scan can still see real code, so it is not vacuous.
    expect(code).toMatch(/NEWS_CATEGORIES/);
  });

  it('absence is absence, not the classifier\'s "world" floor', () => {
    const t = detectReaderTopic('what happened at the convention centre yesterday');
    expect('newsCategory' in t).toBe(false);
    expect(t.newsCategory).not.toBe('world');
  });

  it('an empty question produces ABSENT with no category key at all', () => {
    const t = detectReaderTopic('');
    expect(t.provenance).toBe('ABSENT');
    expect('newsCategory' in t).toBe(false);
    expect('categoryTerm' in t).toBe(false);
    expect(t.readerTerms).toEqual([]);
  });

  it('topical words with no named category are INTERPRETED, never STATED', () => {
    const t = detectReaderTopic('inflation pressure in Kenya');
    expect(t.provenance).toBe('INTERPRETED');
    expect('newsCategory' in t).toBe(false);
    expect(t.readerTerms).toContain('inflation');
  });

  it('every readerTerm is a span of the question', () => {
    const q = 'Entertainment news in Rwanda this week';
    for (const term of detectReaderTopic(q).readerTerms) expect(isSpanOf(term, norm(q))).toBe(true);
  });

  it('the longest category term wins: "show business" is not "business"', () => {
    expect(detectReaderTopic('show business in Kenya').newsCategory).toBe('entertainment');
  });

  it('INVARIANT — the category scan order is longest-first, independent of insertion order', () => {
    /**
     * This assertion exists because mutation M-7 removed the sort and NOTHING
     * FAILED: the lexicon's insertion order already satisfies longest-first, so
     * every behavioural test passed either way. The clause was correct and
     * unexercised. Asserting the ordering directly is the only thing that catches
     * both a removed sort and a future key appended out of order.
     */
    for (let i = 1; i < CATEGORY_TERMS_BY_LENGTH.length; i += 1) {
      const prev = CATEGORY_TERMS_BY_LENGTH[i - 1] ?? '';
      const here = CATEGORY_TERMS_BY_LENGTH[i] ?? '';
      expect(prev.length).toBeGreaterThanOrEqual(here.length);
    }
    // And no term may be a whole-word substring of a LATER (shorter) term's match
    // path — the property the order protects.
    const multi = CATEGORY_TERMS_BY_LENGTH.filter((t) => t.includes(' '));
    for (const m of multi) {
      const parts = m.split(' ');
      for (const part of parts) {
        if (!CATEGORY_TERMS_BY_LENGTH.includes(part)) continue;
        expect(CATEGORY_TERMS_BY_LENGTH.indexOf(m)).toBeLessThan(CATEGORY_TERMS_BY_LENGTH.indexOf(part));
      }
    }
  });

  it('security is a DOMAIN and does not become a NewsCategory', () => {
    const t = detectReaderTopic('Security developments in Kenya');
    expect('newsCategory' in t).toBe(false);
  });

  it('the router\'s field name is the one recorded', () => {
    expect(TOPIC_FIELD_ALIASES.topicTerms).toBe('readerTerms');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * C · STATED PERIOD
 * ══════════════════════════════════════════════════════════════════════════ */

describe('C · time preservation', () => {
  it.each([
    ['what changed today', 'today', 'DAY', 'RELATIVE_TO_ASK'],
    ['what happened at the convention centre yesterday', 'yesterday', 'DAY', 'RELATIVE_TO_ASK'],
    ['Entertainment news in Rwanda this week', 'this week', 'WEEK', 'RELATIVE_TO_ASK'],
    ['inflation in Kenya last week', 'last week', 'WEEK', 'RELATIVE_TO_ASK'],
    ['what happened in Rwanda this month', 'this month', 'MONTH', 'RELATIVE_TO_ASK'],
    ['what happened in Rwanda last month', 'last month', 'MONTH', 'RELATIVE_TO_ASK'],
  ])('"%s" -> statedPeriod "%s"', (q, stated, precision, anchor) => {
    const p = detectStatedPeriod(q);
    expect(p?.statedPeriod).toBe(stated);
    expect(p?.precision).toBe(precision);
    expect(p?.anchor).toBe(anchor);
    expect(p?.provenance).toBe('STATED');
  });

  it('an explicit date is ABSOLUTE and keeps the reader\'s own form', () => {
    const p = detectStatedPeriod('what happened in Rwanda on 3 March 2026');
    expect(p?.statedPeriod).toBe('3 march 2026');
    expect(p?.precision).toBe('DAY');
    expect(p?.anchor).toBe('ABSOLUTE');
  });

  it('an ISO date is accepted without being reformatted', () => {
    expect(detectStatedPeriod('what happened on 2026-03-03')?.statedPeriod).toBe('2026-03-03');
  });

  it('a month without a day is MONTH precision, not a manufactured day', () => {
    const p = detectStatedPeriod('what happened in March 2026');
    expect(p?.precision).toBe('MONTH');
    expect(p?.statedPeriod).toBe('march 2026');
  });

  it('ORDER CONTROL — a range is not recorded as the first day inside it', () => {
    const p = detectStatedPeriod('what happened between 1 and 7 March 2026');
    expect(p?.precision).toBe('RANGE');
    expect(p?.statedPeriod).toBe('between 1 and 7 march 2026');
    expect(p?.statedPeriod).not.toBe('1 march 2026');
  });

  it('a from/to range is a RANGE', () => {
    const p = detectStatedPeriod('from 1 March 2026 to 7 March 2026');
    expect(p?.precision).toBe('RANGE');
  });

  it('NULL, not an UNBOUNDED default, when the reader stated no time', () => {
    expect(detectStatedPeriod('who is the current president of Rwanda')).toBeNull();
    expect(detectStatedPeriod('')).toBeNull();
  });

  it('NEGATIVE CONTROL — no clock is read, so two calls are identical and nothing resolves to a date', () => {
    const a = detectStatedPeriod('what happened yesterday');
    const b = detectStatedPeriod('what happened yesterday');
    expect(a).toEqual(b);
    expect(a?.statedPeriod).toBe('yesterday');
    expect(a?.statedPeriod).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    const src = require('fs').readFileSync(`${__dirname}/stated-period.producer.ts`, 'utf8');
    expect(src).not.toMatch(/new Date\(|Date\.now\(/);
    expect(RELATIVE_PERIODS_ARE_NEVER_RESOLVED_HERE).toBe(true);
  });

  it('every statedPeriod is a verbatim span of the normalized question', () => {
    for (const row of CORPUS_ADDITIONS) {
      if (row.expectStatedPeriod === null) continue;
      const p = detectStatedPeriod(row.question);
      expect(p).not.toBeNull();
      expect(isSpanOf(p!.statedPeriod, norm(row.question))).toBe(true);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * THE CORPUS, AS ONE TABLE
 * ══════════════════════════════════════════════════════════════════════════ */

describe('corpus additions', () => {
  it.each(CORPUS_ADDITIONS.map((r) => [r.id, r] as const))('%s', (_id, row) => {
    if (row.axis === 'OFFICE_GEO') {
      expect(officeGeographyCountryCode(row.question)).toBe(row.expectCountry);
    }
    if (row.axis === 'FALSE_POSITIVE' || row.axis === 'HOMOGRAPH') {
      expect(detectOfficeGeography(row.question)).toBeNull();
    }
    if (row.expectTopicCategory !== null) {
      expect(detectReaderTopic(row.question).newsCategory).toBe(row.expectTopicCategory);
    } else if (row.axis === 'TOPIC') {
      expect('newsCategory' in detectReaderTopic(row.question)).toBe(false);
    }
    if (row.expectStatedPeriod !== null) {
      expect(detectStatedPeriod(row.question)?.statedPeriod).toBe(row.expectStatedPeriod);
    }
  });

  it('records what the landed path does today for every row', () => {
    for (const row of CORPUS_ADDITIONS) expect(row.landedToday.length).toBeGreaterThan(10);
  });

  it('closes exactly the two router blockers it claims, and says what it does not close', () => {
    expect([...ROUTER_BLOCKERS_CLOSED]).toEqual(['BF-08', 'BF-09']);
    expect(ROUTER_ROWS_AFFECTED[0]?.terminalUnchanged).toBe('CAPABILITY_UNAVAILABLE');
    expect(ROUTER_ROWS_AFFECTED[0]?.refusalRemoved).toBe('CONSTRAINT_UNTRANSPORTABLE');
  });
});

import { scoreGenericRelevance } from './generic-relevance.util';
import {
  GOVERNED_EQUIVALENCE_CLASSES,
  equivalentForms,
  extractParityTerms,
} from './governed-term-parity';

/**
 * ASK RETRIEVAL RECALL R2 — the multi-word generic gate's bounded second
 * admission path. Every decision below is the REAL scoreGenericRelevance().
 */

const art = (title: string, summary = '', category = 'technology') =>
  ({ title, summary, category }) as never;
const admits = (phrase: string, title: string, summary = '') =>
  scoreGenericRelevance(art(title, summary), phrase).isRelevant;

describe('extractParityTerms — framing is never load-bearing', () => {
  it('drops framing words, keeps topic words, lower-cases', () => {
    expect(extractParityTerms('new EU AI regulation')).toEqual(['eu', 'ai', 'regulation']);
    expect(extractParityTerms('the latest AI regulation explained simply')).toEqual([
      'ai',
      'regulation',
    ]);
  });

  /* R2.1 B2 reverses the R2 rule: only the acronym "US" (or "United States") is the country. */
  it('the acronym "US" is the country; lower-case "us" is the pronoun', () => {
    expect(extractParityTerms('US AI regulation')).toEqual(['us', 'ai', 'regulation']);
    expect(extractParityTerms('us ai regulation')).toEqual(['ai', 'regulation']);
  });

  /* Terms are canonical concept keys: PL "UE" is the same concept as "EU". */
  it('Polish function and novelty words are framing', () => {
    expect(extractParityTerms('nowe przepisy UE dotyczące AI')).toEqual(['przepisy', 'eu', 'ai']);
  });

  it('the equivalence table is closed and symmetric per class', () => {
    for (const cls of GOVERNED_EQUIVALENCE_CLASSES) {
      for (const form of cls)
        expect(equivalentForms(form)).toEqual(expect.arrayContaining([...cls]));
    }
    expect(equivalentForms('brussels')).toEqual(['brussels']);
    expect(equivalentForms('tech')).toEqual(['tech']);
  });
});

describe('ADMISSION — equivalent terminology for the same topic (gate phrase "EU AI regulation")', () => {
  it.each([
    ['EU AI Act: what the new rules mean for businesses'],
    ['EU artificial intelligence regulation enters next phase'],
    ['Tech firms push back on EU AI rules'],
    ['European Union AI law takes effect for model providers'],
    ['EU sets out AI legislation timetable'],
    ['New EU AI regulation explained'],
  ])('admits "%s"', (title) => {
    expect(admits('EU AI regulation', title)).toBe(true);
  });

  it('term order does not matter, within one field', () => {
    expect(admits('EU AI regulation', 'Regulation of AI across the EU enters force')).toBe(true);
  });

  it('the reason names each term and the governed form that satisfied it', () => {
    const r = scoreGenericRelevance(art('EU AI Act: what the new rules mean'), 'EU AI regulation');
    expect(r.reasons).toEqual(['governed term-parity match (title): eu, ai, regulation→act']);
  });

  it('one summary sentence can carry the topic when the headline anchors it', () => {
    expect(
      admits(
        'EU AI regulation',
        'EU moves on chatbots',
        'The EU AI Act now applies to model providers.',
      ),
    ).toBe(true);
  });

  it('…but never without a headline anchor, or scattered across sentences', () => {
    expect(
      admits(
        'EU AI regulation',
        'Big changes for chatbots',
        'The EU AI Act now applies to model providers.',
      ),
    ).toBe(false);
    expect(
      admits(
        'EU AI regulation',
        'EU moves on chatbots',
        'AI firms welcomed it. A separate law on ports passed.',
      ),
    ).toBe(false);
  });
});

describe('FALSE-POSITIVE SAFETY — every load-bearing term, in one field, is required', () => {
  it.each([
    ['EU regulation on batteries takes effect', '', 'no AI term'],
    ['US senators propose federal AI regulation', '', 'no EU term'],
    ['EU leaders meet in Brussels', 'Talks covered trade and energy.', 'no AI, no legal term'],
    ['Brussels publishes guidance on high-risk AI obligations', '', 'no EU term and no legal term'],
    [
      'AI startup raises funds',
      'The EU market is growing; new rules are expected.',
      'terms split across fields',
    ],
  ])('rejects "%s" / "%s" (%s)', (title, summary) => {
    expect(admits('EU AI regulation', title, summary)).toBe(false);
  });

  it('"US AI regulation" / "United States AI regulation" do not admit EU-only reporting', () => {
    expect(admits('US AI regulation', 'EU AI Act: what the new rules mean')).toBe(false);
    expect(admits('United States AI regulation', 'EU AI Act: what the new rules mean')).toBe(false);
    expect(admits('US AI regulation', 'United States weighs federal AI rules')).toBe(true);
  });

  it('one load-bearing term can never admit through parity', () => {
    expect(admits('new regulation', 'Regulation of batteries tightened')).toBe(false);
    expect(admits('latest regulation', 'Regulation of batteries tightened')).toBe(false);
  });

  it('a phrase of framing words only admits nothing', () => {
    expect(admits('what is new', 'What is new in AI')).toBe(true); // whole-phrase rule, unchanged
    expect(admits('the latest', 'EU AI Act news')).toBe(false);
  });

  it('whole words only — "act" inside "impact" or "ai" inside "said" do not count', () => {
    expect(admits('EU AI regulation', 'EU said the impact on chips is small')).toBe(false);
  });
});

describe('UNCHANGED — the existing rules still decide first', () => {
  it('a whole-phrase match is still reported as such', () => {
    expect(
      scoreGenericRelevance(art('New EU AI regulation explained'), 'EU AI regulation').reasons,
    ).toEqual(['whole-phrase match']);
  });

  it('single-word queries keep the two-signal corroboration rule', () => {
    const r = scoreGenericRelevance(art('AI regulation debate'), 'regulation');
    expect(r.isRelevant).toBe(false);
    expect(r.corroborationCount).toBe(1);
  });
});

describe('POLISH — the same governed concepts in the forms Polish reporting uses', () => {
  const phrase = 'przepisy UE dotyczące AI';
  it.each([
    ['Nowe przepisy UE o sztucznej inteligencji wchodzą w życie'],
    ['Rozporządzenie UE w sprawie AI: co się zmienia'],
    ['Akt UE o AI zaczyna obowiązywać'],
  ])('admits "%s"', (title) => {
    expect(admits(phrase, title)).toBe(true);
  });

  it.each([['Nowe przepisy UE o bateriach'], ['Przepisy USA dotyczące AI']])(
    'rejects "%s"',
    (title) => {
      expect(admits(phrase, title)).toBe(false);
    },
  );
});

/*
 * PR #41 R2.1 — the three CTO review blockers, each pinned in both directions.
 */
describe('R2.1 B1 — multi-word equivalents are canonicalized on the QUERY side too', () => {
  it('"European Union artificial intelligence regulation" canonicalizes to eu / ai / regulation', () => {
    expect(extractParityTerms('European Union artificial intelligence regulation')).toEqual([
      'eu',
      'ai',
      'regulation',
    ]);
    expect(extractParityTerms('United States AI regulation')).toEqual(['us', 'ai', 'regulation']);
    expect(extractParityTerms('United Kingdom AI regulation')).toEqual(['uk', 'ai', 'regulation']);
    expect(extractParityTerms('United Nations AI regulation')).toEqual(['un', 'ai', 'regulation']);
  });

  it('EU AI regulation query → European Union artificial intelligence law article', () => {
    expect(
      admits('EU AI regulation', 'European Union artificial intelligence law takes effect'),
    ).toBe(true);
  });

  it('European Union artificial intelligence regulation query → EU AI Act article', () => {
    expect(
      admits(
        'European Union artificial intelligence regulation',
        'EU AI Act: what the new rules mean',
      ),
    ).toBe(true);
  });

  it.each([
    ['US AI regulation', 'United States weighs federal AI rules'],
    ['United States AI regulation', 'US senators propose federal AI regulation'],
    ['United States AI regulation', 'U.S. lawmakers draft AI legislation'],
    ['UK AI regulation', 'United Kingdom sets out AI rules'],
    ['United Kingdom AI regulation', 'UK publishes AI regulation plan'],
    ['UN AI regulation', 'United Nations adopts AI resolution on rules'],
    ['United Nations AI regulation', 'UN panel calls for AI rules'],
  ])('%s admits "%s"', (query, title) => {
    expect(admits(query, title)).toBe(true);
  });

  it('expanded forms still do not cross concepts', () => {
    expect(admits('United Kingdom AI regulation', 'United States weighs federal AI rules')).toBe(
      false,
    );
    expect(
      admits('European Union AI regulation', 'United Nations adopts AI resolution on rules'),
    ).toBe(false);
  });
});

describe('R2.1 B2 — lower-case "us" is the pronoun, not the United States', () => {
  it.each([
    ['tell us about AI regulation'],
    ['give us the AI regulation basics'],
    ['us ai regulation'],
    ['Us AI regulation'],
  ])('"%s" carries no country term', (query) => {
    expect(extractParityTerms(query)).not.toContain('us');
  });

  it('"tell us about AI regulation" is about AI regulation, not the US', () => {
    expect(extractParityTerms('tell us about AI regulation')).toEqual(['ai', 'regulation']);
  });

  it('"US" and "United States" remain the country concept', () => {
    expect(extractParityTerms('US AI regulation')).toContain('us');
    expect(extractParityTerms('United States AI regulation')).toContain('us');
  });

  it('an article\'s pronoun "us" never satisfies the US concept', () => {
    expect(admits('US AI regulation', 'EU AI rules: what they mean for us')).toBe(false);
    expect(admits('US AI regulation', 'Tell us: will AI regulation work?')).toBe(false);
  });

  it('acronyms match only as acronyms in articles (no Portuguese "eu", no "Ai Weiwei")', () => {
    expect(admits('EU AI regulation', 'Eu acho que a regulation da AI é boa')).toBe(false);
    expect(admits('AI regulation', 'Ai Weiwei criticises new art regulation')).toBe(false);
  });
});

describe('R2.1 B3 — a directive is not a regulation / act', () => {
  it('"directive" is in no equivalence class', () => {
    expect(equivalentForms('directive')).toEqual(['directive']);
    expect(equivalentForms('regulation')).not.toContain('directive');
    expect(equivalentForms('act')).not.toContain('directive');
  });

  it('EU AI directive query does not admit an EU AI Act article', () => {
    expect(admits('EU AI directive', 'EU AI Act: what the new rules mean')).toBe(false);
    expect(admits('EU AI directive', 'EU AI regulation enters next phase')).toBe(false);
  });

  it('inverse: EU AI regulation / Act queries do not admit an EU AI directive article', () => {
    expect(admits('EU AI regulation', 'EU AI directive on liability withdrawn')).toBe(false);
    expect(admits('EU AI Act', 'EU AI directive on liability withdrawn')).toBe(false);
  });

  it('a directive query still admits directive reporting', () => {
    expect(admits('EU AI directive', 'EU AI liability directive withdrawn')).toBe(true);
  });
});

/*
 * PR #41 R2.1 B2.1 — the EXACT-PHRASE rule must not erase the case distinction
 * between the country acronym "US" and the pronoun "us". Scorer-level, so the
 * whole-phrase path is exercised, not only extractParityTerms().
 */
describe('R2.1 B2.1 — the exact-phrase path respects case-sensitive concept tokens', () => {
  const score = (phrase: string, title: string, summary = '') =>
    scoreGenericRelevance(art(title, summary), phrase);

  it('US AI regulation + "US AI regulation …" → admitted as a whole-phrase match', () => {
    const r = score('US AI regulation', 'US AI regulation bill advances in Congress');
    expect(r.isRelevant).toBe(true);
    expect(r.reasons).toEqual(['whole-phrase match']);
  });

  it('United States AI regulation + "US AI regulation …" → admitted through governed parity', () => {
    const r = score('United States AI regulation', 'US AI regulation bill advances in Congress');
    expect(r.isRelevant).toBe(true);
    expect(r.reasons[0]).toMatch(/^governed term-parity match \(title\): us, ai, regulation$/);
  });

  it('us ai regulation + "US AI regulation …" → never acquires US country scope via the exact phrase', () => {
    const r = score('us ai regulation', 'US AI regulation bill advances in Congress');
    expect(r.reasons).not.toContain('whole-phrase match');
    // it is an AI-regulation question: any admission names only ai + regulation
    expect(r.reasons.join(' ')).not.toMatch(/\bus\b/);
    expect(r.reasons[0]).toBe('governed term-parity match (title): ai, regulation');
  });

  it('US AI regulation + an article whose matching phrase holds the pronoun "us" → rejected', () => {
    expect(score('US AI regulation', 'Tell us AI regulation works, readers say').isRelevant).toBe(
      false,
    );
    expect(
      score('US AI regulation', 'Voters: show us AI regulation that protects jobs').isRelevant,
    ).toBe(false);
  });

  it('…and the pronoun phrase cannot borrow an acronym from elsewhere in the same field', () => {
    expect(
      score('US AI regulation', 'EU and UK officials: tell us AI regulation works').isRelevant,
    ).toBe(false);
  });

  it('conversational "tell us about AI regulation" stays an AI-regulation question', () => {
    const exact = score('tell us about AI regulation', 'Tell us about AI regulation, readers ask');
    expect(exact.isRelevant).toBe(true);
    const other = score('tell us about AI regulation', 'EU AI Act: what the new rules mean');
    expect(other.isRelevant).toBe(true);
    expect(other.reasons[0]).toBe('governed term-parity match (title): ai, regulation→act');
    expect(extractParityTerms('tell us about AI regulation')).toEqual(['ai', 'regulation']);
  });

  it('phrases without a case-sensitive token keep the exact-phrase rule unchanged', () => {
    expect(score('EU AI regulation', 'New eu ai regulation explained').reasons).toEqual([
      'whole-phrase match',
    ]);
    expect(score('semiconductor exports', 'Semiconductor exports fall').reasons).toEqual([
      'whole-phrase match',
    ]);
  });

  it('"U.S." is the acronym for the exact-phrase check as well', () => {
    expect(score('US AI regulation', 'U.S. AI regulation bill advances').isRelevant).toBe(true);
  });
});

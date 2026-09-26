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

  it('an acronym or governed concept is never framing ("US" / "us" is the country)', () => {
    expect(extractParityTerms('US AI regulation')).toEqual(['us', 'ai', 'regulation']);
    expect(extractParityTerms('us ai regulation')).toEqual(['us', 'ai', 'regulation']);
  });

  it('Polish function and novelty words are framing', () => {
    expect(extractParityTerms('nowe przepisy UE dotyczące AI')).toEqual(['przepisy', 'ue', 'ai']);
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

  it('"US AI regulation" does not admit EU-only reporting, in either case', () => {
    expect(admits('US AI regulation', 'EU AI Act: what the new rules mean')).toBe(false);
    expect(admits('us ai regulation', 'EU AI Act: what the new rules mean')).toBe(false);
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

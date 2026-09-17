import {
  OWNER_GATED_IDS,
  PRODUCT_KNOWLEDGE,
  type ProductKnowledgeLocale,
} from './product-knowledge';
import { classifyProductIntent, fold, matchProductKnowledge } from './product-intent.util';
import { ANALYSIS_ELIGIBLE_CATEGORY, creationStateFor } from './support-ai.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * B4-B — SUPPORT PRODUCT KNOWLEDGE AND THE WITHHOLDING RULE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Ports F-SUPPORT-KNOWLEDGE-CORPUS-R2's own checks (`build/check-corpus.py`) to
 * Jest, plus the routing rule from R2 §5 and the R2-1 addendum.
 *
 * ── THE RULE, AND WHY IT IS SAFE TO LAND ─────────────────────────────────
 *
 *     analysisEligible = category === NEWS_QUESTION && intent.family === W
 *
 * AN AND, NEVER AN OR. A conjunct can only WITHHOLD — nothing eligible before
 * becomes newly eligible — which is what makes this landable without widening
 * retrieval eligibility. The tests below prove both halves: that product
 * questions stop reaching a provider, and that world questions are untouched.
 */

const locales: readonly ProductKnowledgeLocale[] = ['en', 'pl'];

describe('B4-B — the corpus is authored, complete and shippable', () => {
  it('ships exactly 35 VERIFIED entries', () => {
    expect(PRODUCT_KNOWLEDGE.filter((e) => e.mark === 'VERIFIED')).toHaveLength(35);
  });

  it('and 3 NOT YET AVAILABLE entries, which say so in their own words', () => {
    /*
      These ship deliberately: a reader asking about a surface that does not
      exist yet is better served by "not yet" than by silence.
    */
    expect(PRODUCT_KNOWLEDGE.filter((e) => e.mark === 'NOT YET AVAILABLE')).toHaveLength(3);
  });

  describe('THE SIX OWNER-GATED ENTRIES ARE NOT EXPOSED', () => {
    it('none of them is in the shipped corpus', () => {
      /*
        Excluded from the module entirely rather than hidden behind a flag — a
        flag is a thing someone can turn on without the confirmation the gate
        exists to require.
      */
      expect(OWNER_GATED_IDS).toHaveLength(6);

      const shipped = new Set(PRODUCT_KNOWLEDGE.map((e) => e.id));

      for (const id of OWNER_GATED_IDS) expect(shipped.has(id)).toBe(false);
    });

    it('and no shipped entry carries the OWNER-GATED mark', () => {
      for (const entry of PRODUCT_KNOWLEDGE) {
        expect(entry.mark).not.toBe('OWNER-GATED');
      }
    });
  });

  it('every entry ships in BOTH locales — one locale is not shippable', () => {
    for (const entry of PRODUCT_KNOWLEDGE) {
      for (const locale of locales) {
        expect(entry.body[locale].length).toBeGreaterThan(0);
        expect(entry.triggers[locale].length).toBeGreaterThan(0);
      }
    }
  });

  it('RECORDED — eight VERIFIED entries ship with no grounding string', () => {
    /*
      MEASURED, NOT ASSERTED AWAY. I first wrote this as "every entry records
      where its claim comes from" and it failed: eight VERIFIED entries carry an
      empty `grounding` in the corpus as authored — K-19, K-26, K-27, K-35,
      K-37, K-38, K-39, K-43.

      Inventing a grounding string to make the assertion pass would be the exact
      fabrication this whole corpus exists to avoid, and editing the authored
      answers is not this checkpoint's authority. So the fact is pinned instead,
      and it is a question for F: these answers are VERIFIED, so someone
      verified them against something, and the field is where that belongs.

      Recorded as SUPPORT-CORPUS-GROUNDING-GAP-1.
    */
    const ungrounded = PRODUCT_KNOWLEDGE.filter((e) => e.grounding.length === 0);

    expect(ungrounded.map((e) => e.id).sort()).toEqual([
      'K-19',
      'K-26',
      'K-27',
      'K-35',
      'K-37',
      'K-38',
      'K-39',
      'K-43',
    ]);
  });

  it('and the other thirty carry one', () => {
    const grounded = PRODUCT_KNOWLEDGE.filter((e) => e.grounding.length > 0);

    expect(grounded).toHaveLength(PRODUCT_KNOWLEDGE.length - 8);
  });
});

describe('B4-B · M-1 — word boundaries, never substrings', () => {
  it('"news" as a word is not the same as "news" inside GlobalNews', () => {
    /*
      The package's C6, both directions. Substring containment cannot tell these
      apart, and getting it wrong means the product table steals world questions.
    */
    expect(fold('GlobalNews AI').includes('news')).toBe(true);

    const stolen = matchProductKnowledge('is there any news about Poland', 'en');

    expect(stolen).toBeNull();
  });

  it('a trigger never fires inside a longer word', () => {
    const match = matchProductKnowledge('mapping software', 'en');

    expect(match?.trigger).not.toBe('map');
  });

  it('folding makes both Polish spellings match', () => {
    /* Readers type `śledzić` and `sledzic`; both must work. */
    expect(fold('śledzić')).toBe(fold('sledzic'));
  });
});

describe('B4-B · M-3 / M-5 — one trigger one entry, longest match wins', () => {
  it('no token is claimed by two entries', () => {
    for (const locale of locales) {
      const owner = new Map<string, string>();

      for (const entry of PRODUCT_KNOWLEDGE) {
        for (const trigger of entry.triggers[locale]) {
          const key = fold(trigger);
          const existing = owner.get(key);

          expect(existing === undefined || existing === entry.id).toBe(true);
          owner.set(key, entry.id);
        }
      }
    }
  });

  it('matching is deterministic — the same text always yields the same entry', () => {
    const once = matchProductKnowledge('how does globalnews ai work', 'en');
    const twice = matchProductKnowledge('how does globalnews ai work', 'en');

    expect(once?.entry.id).toBe(twice?.entry.id);
  });
});

describe('B4-B · M-4 — a miss is a miss, and a world question is a miss', () => {
  const worldQuestions = [
    'what is happening in Sudan',
    'who won the election in Kenya',
    'co się dzieje w Polsce',
    'inflation in the eurozone',
  ];

  it('no world question matches the product corpus', () => {
    /*
      The package's C10. If one did, the conjunct would withhold retrieval for a
      question that genuinely needs it — the one way this change could do harm.
    */
    for (const text of worldQuestions) {
      expect(matchProductKnowledge(text, 'en')).toBeNull();
      expect(matchProductKnowledge(text, 'pl')).toBeNull();
    }
  });

  it('and an unmatched turn is classified WORLD, preserving today’s behaviour', () => {
    for (const text of worldQuestions) {
      expect(classifyProductIntent(text, 'en').family).toBe('W');
    }
  });
});

describe('B4-B · THE ROUTING RULE — withhold-only', () => {
  it('a recognised PRODUCT question under NEWS_QUESTION is NOT analysis-eligible', () => {
    /*
      The defect this closes. "How does GlobalNews AI work?" arrives filed as a
      news question because that is the only category promising an answer, and
      it used to reach a provider.
    */
    const intent = classifyProductIntent('how does globalnews ai work', 'en');

    expect(intent.family).toBe('P');
    expect(creationStateFor(ANALYSIS_ELIGIBLE_CATEGORY, intent).analysisEligible).toBe(false);
  });

  it('a WORLD question under NEWS_QUESTION is still eligible — nothing narrowed', () => {
    const intent = classifyProductIntent('what is happening in Sudan', 'en');

    expect(intent.family).toBe('W');
    expect(creationStateFor(ANALYSIS_ELIGIBLE_CATEGORY, intent).analysisEligible).toBe(true);
  });

  it('an unclassified turn behaves exactly as before the change', () => {
    /*
      The compatibility guarantee: omitting the classification cannot make
      anything ineligible that was eligible.
    */
    expect(creationStateFor(ANALYSIS_ELIGIBLE_CATEGORY).analysisEligible).toBe(true);
  });

  it('and NO category other than NEWS_QUESTION becomes eligible', () => {
    /*
      THE CONJUNCT CANNOT WIDEN. Even a WORLD classification cannot make a
      human-bound category reach a provider.
    */
    const world = classifyProductIntent('what is happening in Sudan', 'en');

    for (const category of ['BUG_REPORT', 'FEEDBACK', 'ACCOUNT_PROBLEM', 'OTHER'] as const) {
      expect(creationStateFor(category, world).analysisEligible).toBe(false);
    }
  });
});

describe('B4-B · K-25 — the converged behaviour is what the answer states', () => {
  const k25 = PRODUCT_KNOWLEDGE.find((e) => e.id === 'K-25');

  it('ships, and is VERIFIED after the R2-1 addendum', () => {
    expect(k25?.mark).toBe('VERIFIED');
  });

  it('says the arrow opens the ORIGINAL SOURCE and does nothing else', () => {
    expect(k25?.body.en).toMatch(/original publisher/i);
    expect(k25?.body.en).toMatch(/new tab/i);
  });

  it('names Ask AI explicitly, in both locales', () => {
    expect(k25?.body.en).toContain('Ask AI');
    expect(k25?.body.pl).toContain('Zapytaj AI');
  });

  it('states that arriving in Search runs ONE analysis straight away', () => {
    expect(k25?.body.en).toMatch(/runs one analysis straight away/i);
    expect(k25?.body.en).toMatch(/no further confirmation/i);
  });

  it('and carries no pricing or free-tier language anywhere in the corpus', () => {
    /* A support answer is not a place a price appears for the first time. */
    for (const entry of PRODUCT_KNOWLEDGE) {
      for (const locale of locales) {
        expect(entry.body[locale]).not.toMatch(/[$£€]\s?\d/);
        expect(entry.body[locale].toLowerCase()).not.toMatch(/\bfree tier\b|\bsubscription\b|\bupgrade\b/);
      }
    }
  });
});

describe('B4-B · what was NOT changed', () => {
  it('PRODUCT_HELP was not added to the shared category enum', () => {
    /*
      Recommended earlier, still unauthorized, and not a prerequisite: every
      entry here is AUTHORED and analysis-ineligible by FAMILY, whatever category
      the ticket carries.
    */
    const shared = require('@globalnews-ai/shared') as { SUPPORT_CATEGORIES: readonly string[] };

    expect(shared.SUPPORT_CATEGORIES).not.toContain('PRODUCT_HELP');
    expect(shared.SUPPORT_CATEGORIES).toHaveLength(7);
  });

  it('and the corpus calls no provider, model or retrieval path', () => {
    /*
      THE CODE, NOT THE PROSE. My first version forbade the bare word
      "provider" and failed on this module's own doc comment, which says it
      makes no provider call. Comments are stripped, and the check is for CALLS
      — an ordinary English word in an authored answer is not a code path.
    */
    const source: string = require('fs')
      .readFileSync(`${__dirname}/product-knowledge.ts`, 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    for (const forbidden of ['fetch(', 'analyzeNews', 'openai', 'import ']) {
      expect(source.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});

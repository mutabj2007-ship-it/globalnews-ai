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
  it('ships exactly 34 VERIFIED entries after the R2-2 delta', () => {
    /*
      35 in B4-B, 34 now: K-43 was DOWNGRADED to OWNER-GATED because its claim is
      CONTRADICTED by the tree — it told readers the product does not use the
      word "beta" while a user-facing `Beta` label ships in both locales.
    */
    expect(PRODUCT_KNOWLEDGE.filter((e) => e.mark === 'VERIFIED')).toHaveLength(34);
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
      expect(OWNER_GATED_IDS).toHaveLength(7);
      expect([...OWNER_GATED_IDS].sort()).toEqual([
        'K-04',
        'K-07',
        'K-10',
        'K-11',
        'K-12',
        'K-22',
        'K-43',
      ]);

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

  it('SUPPORT-CORPUS-GROUNDING-GAP-1 IS CLOSED — every shipped entry records its grounding', () => {
    /*
      SUPERSEDED IN PLACE, NOT DELETED, so the supersession stays visible.

      B4-B pinned a measured defect here: eight VERIFIED entries shipped with an
      empty `grounding` field. I did NOT invent grounding strings to make the
      assertion pass — that would have been the exact fabrication the corpus
      exists to prevent — and the fact was carried as an open item instead.

      F then measured all eight. SEVEN had real support and were simply missing
      their citation; they keep VERIFIED and now carry F's grounding. The eighth,
      K-43, was WRONG — its claim is contradicted by the tree — and it is
      withheld rather than reworded (see below).

      The gap is therefore closed by evidence, not by assertion.
    */
    const ungrounded = PRODUCT_KNOWLEDGE.filter((e) => e.grounding.length === 0);

    expect(ungrounded).toEqual([]);
  });

  it('and the seven newly grounded entries cite a file, a symbol or a measurement', () => {
    /*
      A NON-EMPTY STRING IS NOT A CITATION. Without this, 'ok' would satisfy the
      test above and the gap would be closed in name only.
    */
    for (const id of ['K-19', 'K-26', 'K-27', 'K-35', 'K-37', 'K-38', 'K-39']) {
      const entry = PRODUCT_KNOWLEDGE.find((e) => e.id === id);

      expect(entry?.mark).toBe('VERIFIED');
      expect(entry?.grounding ?? '').toMatch(/\.tsx?\b|\.json\b|= 0\b|= 1\b|:\d+/);
    }
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

describe('B5-D · K-43 — withheld, because the tree contradicts it', () => {
  it('does not ship, and is named as owner-gated', () => {
    /*
      NOT A WORDING SLIP. K-43 told readers the product marks unfinished parts
      "not yet available" RATHER THAN as a beta — while a user-facing `Beta`
      label ships in both locales (en.ts:1308, pl.ts:1064) inside the map
      mode-switcher vocabulary, beside five separate unavailability reasons.

      An answer that contradicts what the reader is looking at is worse than no
      answer: it teaches them Support does not know the product. So the sentence
      is WITHHELD, not reworded — no replacement copy was invented, because
      which vocabulary Support may describe is a question for Spatial/H with L,
      not one this checkpoint may answer.
    */
    expect(PRODUCT_KNOWLEDGE.find((e) => e.id === 'K-43')).toBeUndefined();
    expect(OWNER_GATED_IDS).toContain('K-43');
  });

  it('and the word "beta" appears in no shipped answer at all', () => {
    /*
      The withholding has to cover the CLAIM, not just the entry. A different
      entry asserting the same thing would reopen the contradiction.
    */
    for (const entry of PRODUCT_KNOWLEDGE) {
      for (const locale of locales) {
        expect(entry.body[locale].toLowerCase()).not.toMatch(/\bbeta\b/);
      }
    }
  });

  it('the safe residue still ships — K-40 and K-41 are untouched', () => {
    /*
      Withholding K-43 must not silently remove what IS known: that some parts
      are visible but not yet available, and what works today.
    */
    for (const id of ['K-40', 'K-41']) {
      expect(PRODUCT_KNOWLEDGE.find((e) => e.id === id)?.mark).toBe('VERIFIED');
    }
  });
});

describe('B5-D · K-25 — surface-qualified, because parity was disproved', () => {
  const k25 = PRODUCT_KNOWLEDGE.find((e) => e.id === 'K-25');

  it('names the DESKTOP map, rather than claiming both surfaces', () => {
    /*
      SOURCE-CARD-ASK-AI-MOBILE-PARITY-1 = FAIL, measured in this tree:

        SourceCard.tsx:98    onAskAbout?: (id: string) => void     OPTIONAL
        SourceCard.tsx:267   {onAskAbout && (                      CONDITIONAL
        EvidenceSelectionCard.tsx:961  passes it                   desktop map
        MobileSpatialShell.tsx:1013    does NOT                    phone
        SourcesReporting.tsx:654       does NOT                    analysis frame

      The phone receives the LABELS (`askAbout`, `askAiShort`) but no handler, so
      the control is never rendered there. R2.1 read "both label call sites" as
      "both surfaces"; the label landed on both, the action did not.

      Behaviour was NOT changed to match the copy. The accepted card anatomy
      names ONE trailing affordance and records Ask AI as a DECLARED DEVIATION
      for the desktop map; no mobile rationale and no equivalent mobile
      affordance exist in the tree. With design authority ambiguous, the ruling
      is to leave mobile alone and qualify the sentence — so the copy now
      describes only what is implemented.
    */
    expect(k25?.body.en).toMatch(/on the desktop map/i);
    expect(k25?.body.pl).toMatch(/na komputerze/i);
  });

  it('and states what the compact layout actually shows', () => {
    expect(k25?.body.en).toMatch(/compact phone layout .* arrow only/i);
    expect(k25?.body.pl).toMatch(/telefonie .* tylko strza/i);
  });

  it('claims cross-device parity nowhere', () => {
    for (const locale of locales) {
      expect(k25?.body[locale]).not.toMatch(/every device|any device|both surfaces|każdym urządzeniu/i);
    }
  });

  it('and its grounding records that R2.1 fact 6 was withdrawn', () => {
    expect(k25?.grounding).toMatch(/WITHDRAWN/);
  });

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

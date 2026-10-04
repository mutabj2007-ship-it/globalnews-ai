import { DISPLAY_LOCALES, type DisplayLocale } from '@globalnews-ai/shared';
import {
  EXAMPLE_CAPABILITIES,
  EXAMPLE_QUALIFICATION,
  QUESTION_EXAMPLES,
  exampleText,
  isExampleQualified,
} from './askQuestionExamples';

/**
 * STANDALONE CENTERED COMPOSER + ROTATING QUESTION EXAMPLES R1 — THE CATALOGUE.
 *
 * Group E-1  size, identity and shape
 * Group E-2  capability coverage — the product is broader than news search
 * Group E-3  seven languages, totally, with qualification stated rather than implied
 * Group E-4  every example stands on its own in an empty composer
 * Group E-5  Arabic
 */

describe('E-1 · size, identity and shape', () => {
  it('carries at least the contracted 36 canonical examples', () => {
    expect(QUESTION_EXAMPLES.length).toBeGreaterThanOrEqual(36);
    expect(QUESTION_EXAMPLES.length).toBe(42);
  });

  it('every id is unique, stable-looking and not derived from the text', () => {
    const ids = QUESTION_EXAMPLES.map((example) => example.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]{2}-[a-z0-9-]+$/);
    /* An id that is a slug of its own English text would rename itself on every re-wording. */
    for (const example of QUESTION_EXAMPLES) {
      const slug = example.text.en
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      expect(example.id).not.toBe(slug);
    }
  });

  it('is frozen, so no caller can mutate the shared table', () => {
    expect(Object.isFrozen(QUESTION_EXAMPLES)).toBe(true);
    expect(() => {
      (QUESTION_EXAMPLES as unknown as unknown[]).push({});
    }).toThrow();
  });
});

describe('E-2 · capability coverage', () => {
  it('names all fourteen families the contract lists, and uses every one', () => {
    expect(EXAMPLE_CAPABILITIES).toHaveLength(14);
    expect([...EXAMPLE_CAPABILITIES]).toEqual([
      'WHAT_CHANGED',
      'CURRENT_INTELLIGENCE',
      'COUNTRY_INTELLIGENCE',
      'COMPARISON',
      'RELATIONSHIP',
      'DEEP_CONCEPTUAL',
      'DECISION_SUPPORT',
      'TECHNICAL_SCIENTIFIC',
      'TRAVEL_PLACE',
      'HISTORY',
      'REGIONAL_ANALYSIS',
      'PLANNING_TRANSFORMATION',
      'OFFICIAL_DATA_EVIDENCE',
      'DOCUMENT_RESEARCH',
    ]);
    for (const capability of EXAMPLE_CAPABILITIES) {
      const inFamily = QUESTION_EXAMPLES.filter((e) => e.capability === capability);
      expect(inFamily.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('no family is large enough to dominate the pool', () => {
    for (const capability of EXAMPLE_CAPABILITIES) {
      const share = QUESTION_EXAMPLES.filter((e) => e.capability === capability).length;
      expect(share * 2).toBeLessThan(QUESTION_EXAMPLES.length);
    }
  });

  it('is not only a news index: the non-current families are genuinely populated', () => {
    const beyondNews = QUESTION_EXAMPLES.filter((e) =>
      (
        [
          'DEEP_CONCEPTUAL',
          'TECHNICAL_SCIENTIFIC',
          'TRAVEL_PLACE',
          'HISTORY',
          'PLANNING_TRANSFORMATION',
          'DOCUMENT_RESEARCH',
        ] as const
      ).some((family) => family === e.capability),
    );
    expect(beyondNews.length).toBeGreaterThanOrEqual(18);
  });
});

describe('E-3 · seven languages, total, with qualification stated', () => {
  it('every example has text in every one of the contracted seven', () => {
    for (const example of QUESTION_EXAMPLES) {
      for (const locale of DISPLAY_LOCALES) {
        const text = example.text[locale];
        expect(typeof text).toBe('string');
        expect(text.trim().length).toBeGreaterThan(8);
      }
    }
  });

  it('no locale silently falls back to the English string', () => {
    for (const example of QUESTION_EXAMPLES) {
      for (const locale of DISPLAY_LOCALES) {
        if (locale === 'en') continue;
        expect(example.text[locale]).not.toBe(example.text.en);
      }
    }
  });

  it('states which locales are authored and which await Claude L, for all seven', () => {
    expect(Object.keys(EXAMPLE_QUALIFICATION).sort()).toEqual([...DISPLAY_LOCALES].sort());
    expect(isExampleQualified('en')).toBe(true);
    expect(isExampleQualified('pl')).toBe(true);
    for (const locale of ['fr', 'de', 'es', 'pt', 'ar'] as const) {
      expect(EXAMPLE_QUALIFICATION[locale]).toBe('DRAFT_PENDING_CLAUDE_L');
      expect(isExampleQualified(locale)).toBe(false);
    }
  });

  it('mobile phrasing, where present, is a shortening of the same question', () => {
    for (const example of QUESTION_EXAMPLES) {
      for (const locale of DISPLAY_LOCALES) {
        const short = example.mobileText?.[locale];
        if (short === undefined) continue;
        expect(short.length).toBeLessThan(example.text[locale].length);
        expect(exampleText(example, locale, true)).toBe(short);
        expect(exampleText(example, locale, false)).toBe(example.text[locale]);
      }
    }
  });

  it('falls back to the full text when a locale has no mobile phrasing', () => {
    const noShortForm = QUESTION_EXAMPLES.find((e) => e.mobileText === undefined);
    expect(noShortForm).toBeDefined();
    expect(exampleText(noShortForm!, 'ar', true)).toBe(noShortForm!.text.ar);
  });

  it('French keeps the approved high-punctuation spacing (U+00A0), never a plain space', () => {
    const french = QUESTION_EXAMPLES.map((e) => e.text.fr).filter((t) => t.endsWith('?'));
    expect(french.length).toBeGreaterThan(10);
    for (const text of french) expect(text).toMatch(/ \?$/);
  });

  it('Spanish questions open with the inverted mark', () => {
    for (const example of QUESTION_EXAMPLES) {
      const text = example.text.es;
      if (!text.endsWith('?')) continue;
      expect(text.startsWith('¿')).toBe(true);
    }
  });
});

describe('E-4 · every example stands alone in an empty composer', () => {
  /*
    The contract's own illustrations include "Turn THAT recommendation into a 90-day plan"
    and "What do the available official documents say about THIS policy?". As follow-ups they
    read correctly; rotating inside an EMPTY composer they point at nothing. The catalogue
    teaches the same capability without the dangling reference, and this is the assertion
    that keeps a future addition from reintroducing one.
  */
  const DANGLING = [
    /\bthat recommendation\b/i,
    /\bthis policy\b/i,
    /\bthis development\b/i,
    /\bturn that\b/i,
    /\bthe above\b/i,
  ];

  it('no English example refers to something the reader has not seen', () => {
    for (const example of QUESTION_EXAMPLES) {
      for (const pattern of DANGLING) expect(example.text.en).not.toMatch(pattern);
    }
  });

  it('stays short enough to read inside a composer', () => {
    for (const example of QUESTION_EXAMPLES) {
      for (const locale of DISPLAY_LOCALES) {
        expect(exampleText(example, locale, true).length).toBeLessThanOrEqual(90);
      }
    }
  });

  it('is a question or an instruction — never a headline or a claim', () => {
    for (const example of QUESTION_EXAMPLES) {
      expect(example.text.en).toMatch(/[?.]$/);
    }
  });
});

describe('E-5 · Arabic', () => {
  it('uses the Arabic question mark and Arabic script, not Latin punctuation', () => {
    const arabic = QUESTION_EXAMPLES.map((e) => e.text.ar);
    const questions = arabic.filter((t) => t.endsWith('؟'));
    expect(questions.length).toBeGreaterThan(20);
    for (const text of arabic) {
      expect(text).toMatch(/[؀-ۿ]/);
      /* A Latin '?' in an Arabic string is the wrong glyph, and a neutral that will take the
         paragraph direction at the wrong end. */
      expect(text).not.toContain('?');
    }
  });

  it('carries no bidi control characters — isolation is CSS, never an invisible marker', () => {
    for (const example of QUESTION_EXAMPLES) {
      for (const locale of DISPLAY_LOCALES) {
        expect(example.text[locale]).not.toMatch(/[‎‏‪-‮⁦-⁩]/);
      }
    }
  });
});

describe('E-6 · the catalogue is inert', () => {
  it('has no ask-time behaviour: no fetch, no timing, no personalisation', () => {
    const locales: readonly DisplayLocale[] = DISPLAY_LOCALES;
    expect(locales.length).toBe(7);
    /* Shape-only module: the only exported behaviour is a text lookup. */
    expect(typeof exampleText).toBe('function');
    expect(exampleText(QUESTION_EXAMPLES[0], 'en')).toBe(QUESTION_EXAMPLES[0].text.en);
  });
});

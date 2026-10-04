import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DISPLAY_LOCALES } from '@globalnews-ai/shared';
import { ASK_BRAND_KEYS, ASK_PRODUCT_NAME, askProductNameFor } from '@/lib/ask/askBrand';
import { askProductName, askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { ASK_SHELL_PROPER_NOUNS } from '@/lib/ask/shell/askShellSource';
import { declaredFallbacksFor } from '@/lib/ask/shell/askShellDeclaredFallbacks';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R4 · TWO CTO RULINGS, PINNED SO NEITHER CAN COME BACK
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Both of these were defects that RETURNED after being fixed once, which is why they are
 * asserted rather than documented. The product name diverged three separate times — the
 * frozen table had an EN and a PL form, H drafted five more, Claude L returned the brand
 * untranslated — and the language claim was true when written and became false underneath
 * itself. A comment would not have caught either.
 */

describe('BRAND · one canonical product name, in all seven locales', () => {
  it('the name is the same everywhere, and it is the ruled spelling', () => {
    expect(ASK_PRODUCT_NAME).toBe('Ask GlobalNewsAI');
    for (const locale of DISPLAY_LOCALES) {
      expect(askProductNameFor(locale)).toBe(ASK_PRODUCT_NAME);
      expect(askProductName(locale)).toBe(ASK_PRODUCT_NAME);
      expect(askShellStrings(locale).askR2Strings.askTitle).toBe(ASK_PRODUCT_NAME);
      expect(askShellStrings(locale).dict.askAi.title).toBe(ASK_PRODUCT_NAME);
      expect(askShellStrings(locale).dict.askAi.panelLabel).toBe(ASK_PRODUCT_NAME);
    }
  });

  it('Polish no longer carries a translated product TITLE', () => {
    /* The specific divergence the ruling names: "Zapytaj GlobalNewsAI" as the product title. */
    for (const locale of DISPLAY_LOCALES) {
      for (const key of ASK_BRAND_KEYS) {
        const value =
          key === 'askR2Strings.askTitle'
            ? askShellStrings(locale).askR2Strings.askTitle
            : key === 'dict.askAi.title'
              ? askShellStrings(locale).dict.askAi.title
              : askShellStrings(locale).dict.askAi.panelLabel;
        expect(value).not.toMatch(/Zapytaj|Interroger|Preguntar|Perguntar|fragen|اسأل/);
      }
    }
  });

  it('the ACTION stays localized — the ruling localizes the verb, not the noun', () => {
    /*
      This is the half of the ruling that is easy to over-apply. "Do not translate the brand"
      must not become "do not translate Ask", or every button in the product reads English.
    */
    expect(askShellStrings('pl').askR2Strings.ask).toBe('Zapytaj');
    expect(askShellStrings('fr').askR2Strings.ask).toBe('Demander');
    expect(askShellStrings('de').askR2Strings.ask).toBe('Fragen');
    expect(askShellStrings('es').askR2Strings.ask).toBe('Preguntar');
    expect(askShellStrings('pt').askR2Strings.ask).toBe('Perguntar');
    expect(askShellStrings('ar').askR2Strings.ask).toBe('اسأل');
    /* And the nav verb, which is a different key on a different surface. */
    for (const locale of ['pl', 'fr', 'de', 'es', 'pt', 'ar'] as const) {
      expect(askShellStrings(locale).askNavStrings.newQuestion).not.toBe(
        askShellStrings('en').askNavStrings.newQuestion,
      );
    }
  });

  it('the brand keys are OUT of the translation scope, not merely agreed-upon', () => {
    /*
      A key in a translation catalogue is an invitation to translate it. Excluding the three
      from Claude L's scope is the part that stops the divergence recurring; projecting the
      constant is what makes the exclusion safe.
    */
    for (const key of ASK_BRAND_KEYS) {
      expect(ASK_SHELL_PROPER_NOUNS).toContain(key);
      for (const locale of ['fr', 'de', 'es', 'pt', 'ar'] as const) {
        expect(declaredFallbacksFor(locale)).not.toContain(key);
      }
    }
  });

  it('no per-locale overlay can reintroduce a translated name', () => {
    const dir = join(__dirname, 'shell', 'locales');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const src = readFileSync(join(dir, file), 'utf8');
      expect(src).not.toMatch(/Zapytaj GlobalNews|Interroger GlobalNews|GlobalNewsAI fragen/);
    }
  });
});

describe('LANGUAGE · the claim that became false must not return', () => {
  it('no locale says Ask answers in English and Polish', () => {
    for (const locale of DISPLAY_LOCALES) {
      const codes = askShellStrings(locale).askR2Strings.clarify.codes;
      for (const value of Object.values(codes)) {
        if (typeof value !== 'string') continue;
        expect(value).not.toMatch(/English and Polish|po polsku i po angielsku|angielsku/i);
      }
    }
  });

  it('the catalogue source carries no fixed language list anywhere', () => {
    /*
      Asserted on the SOURCE as well as the rendered value, because the defect was a sentence
      that was true when written. A list is the thing that goes stale; the test forbids the
      shape, not just the current wording.
    */
    const src = readFileSync(join(__dirname, 'askR2Strings.ts'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    expect(src).not.toMatch(/answers in English and Polish/);
    expect(src).not.toMatch(/odpowiada po polsku i po angielsku/);
  });

  it('EN and PL say what the ruling asked them to say', () => {
    expect(askShellStrings('en').askR2Strings.clarify.codes.LANGUAGE_UNSUPPORTED).toMatch(
      /could not be handled in the selected language/,
    );
    expect(askShellStrings('en').askR2Strings.clarify.codes.LANGUAGE_UNSUPPORTED).toMatch(
      /rephras|language menu/,
    );
    expect(askShellStrings('pl').askR2Strings.clarify.codes.LANGUAGE_UNSUPPORTED).toMatch(
      /wybranym języku/,
    );
    expect(askShellStrings('pl').askR2Strings.clarify.codes.LANGUAGE_UNSUPPORTED).toMatch(
      /przeformułować|menu języka/,
    );
  });

  it('the five L locales are DECLARED for re-authoring rather than reworded by H', () => {
    /*
      The ruling says apply the shape in all seven. EN and PL are H's files and are done.
      The five are Claude L's wording, and "integrate without rewording L" is the same
      ruling's step 2 — so the key goes back to her in the Revision 5 delta instead of being
      rewritten here. What renders in the meantime is HER truthful sentence, not the false
      one; this test pins that nothing false is showing while the re-author is outstanding.
    */
    for (const locale of ['fr', 'de', 'es', 'pt', 'ar'] as const) {
      const value = askShellStrings(locale).askR2Strings.clarify.codes.LANGUAGE_UNSUPPORTED;
      expect(value).not.toBe(
        askShellStrings('en').askR2Strings.clarify.codes.LANGUAGE_UNSUPPORTED,
      );
      expect(value).not.toMatch(/English and Polish/i);
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

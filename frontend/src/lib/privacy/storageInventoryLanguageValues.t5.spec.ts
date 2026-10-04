import { DISPLAY_LOCALES } from '@globalnews-ai/shared';
import { STORAGE_INVENTORY } from './storageInventory';

/**
 * STAGE 2 · T5 PART A — TRUTHFULNESS: the Cookies page must describe what the language
 * preference ACTUALLY stores. `persistLanguageSelection` (lib/i18n/languages.ts) accepts any
 * display locale and writes it verbatim to the cookie and the localStorage mirror, so the
 * disclosure must name every one of them — it previously said “en” or “pl” only.
 */
describe('T5 · the language preference disclosure names every value the code can write', () => {
  const languageItems = STORAGE_INVENTORY.filter((i) =>
    ['globalnews-ai-language', 'globalnews-ai:language'].includes(i.name),
  );

  it('both language items are disclosed', () => {
    expect(languageItems.map((i) => i.name).sort()).toEqual([
      'globalnews-ai-language',
      'globalnews-ai:language',
    ]);
  });

  it.each(DISPLAY_LOCALES.map((l) => [l]))('“%s” is named in EN and PL', (locale) => {
    for (const item of languageItems) {
      expect(item.data.en).toContain(`“${locale}”`);
      expect(item.data.pl).toContain(`„${locale}”`);
    }
  });
});

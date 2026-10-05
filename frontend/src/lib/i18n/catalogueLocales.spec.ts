import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { completeLocalesOf } from '@/qualification/i18n/catalogueCoverage';
import { SUPPORT_AUTOMATIC_ANSWER_LOCALES, dictionaryNamespaceLocales, endonymList } from './catalogueLocales';
import { en } from './dictionaries/en';
import { pl } from './dictionaries/pl';

/**
 * T2 · copy that STATES which languages something is available in must be true — derived, or
 * pinned to the authority it describes.
 */
const ROOT = join(__dirname, '..', '..', '..', '..');

describe('T2 · the cheap language views agree with the measured registry', () => {
  it.each(['admin', 'support', 'map', 'navBar'])('dictionaryNamespaceLocales(%s) equals completeLocalesOf(dict:%s)', (ns) => {
    expect(dictionaryNamespaceLocales(ns)).toEqual(completeLocalesOf(`dict:${ns}`));
  });

  it("the admin Settings 'Admin languages' value is derived and byte-identical to the retired literal today", () => {
    expect(endonymList(dictionaryNamespaceLocales('admin'))).toBe('English, Polski');
    const screen = readFileSync(join(__dirname, '..', '..', 'components', 'admin', 'screens', 'SettingsScreen.tsx'), 'utf8');
    expect(screen).toContain('value={endonymList(dictionaryNamespaceLocales(\'admin\'))}');
    expect(screen).not.toContain('adminLanguagesValue');
  });
});

describe('T2 · Support automatic-answer language copy is truthful (stale "English and Polish only" retired)', () => {
  it('the frontend list mirrors the backend Support DTO', () => {
    const dto = readFileSync(join(ROOT, 'backend', 'src', 'modules', 'support', 'dto', 'support.dto.ts'), 'utf8');
    const match = dto.match(/@IsIn\(\[([^\]]*)\]\)\s*\n\s*language\?/);
    expect(match).not.toBeNull();
    const backend = (match as RegExpMatchArray)[1].split(',').map((v) => v.trim().replace(/'/g, ''));
    expect(backend).toEqual([...SUPPORT_AUTOMATIC_ANSWER_LOCALES]);
  });

  it('the out-of-scope copy is scoped to Support answers, names exactly those languages, and no longer says "only"', () => {
    const enCopy = en.support.conversation.locale.outOfScope;
    const plCopy = pl.support.conversation.locale.outOfScope;
    expect(enCopy).toMatch(/^Automatic answers in Support /);
    expect(enCopy).toContain('English and Polish');
    expect(enCopy).toContain('your display language does not change this');
    expect(enCopy).not.toMatch(/\bonly\b/);
    expect(plCopy).toContain('po angielsku i po polsku');
    expect(plCopy).not.toMatch(/wyłącznie/);
  });
});

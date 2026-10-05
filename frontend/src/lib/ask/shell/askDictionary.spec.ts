import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { fr, de, es, pt, ar } from '@/lib/i18n/recovered/recoveredCatalogue';
import { askDictionary } from './askDictionary';
import { askShellStrings } from './askShellCatalogue';
import { ASK_SHELL_DICTIONARY_NAMESPACES } from './askShellSource';
import { ASK_DICTIONARY_ADDITIONS, C55_REUSE_ENGLISH } from './askDictionaryAdditions';
import {
  ASK_COMPARISON_COVERAGE_L_R6,
  ASK_DICTIONARY_ADDITIONS_L_R6,
  ASK_DICTIONARY_CANONICAL_ALIASES,
} from './askDictionaryAdditionsL';
import { askRelativeTime } from '../askRelativeTime';
import { askCountryName } from '../askCountryName';
import { localisedCountryName } from '@/lib/map/geography/displayName';

/**
 * R4 · CTO LOCALIZATION CONVERGENCE — the Ask locale authority, structurally.
 * (The rendered-surface acceptance specs prove what a reader SEES; these prove the wiring.)
 */
const NEW: readonly Exclude<DisplayLocale, 'en' | 'pl'>[] = ['fr', 'de', 'es', 'pt', 'ar'];
const C55: Record<string, unknown> = { fr, de, es, pt, ar };
const at = (t: unknown, p: string): unknown =>
  p
    .split('.')
    .reduce<unknown>(
      (n, k) =>
        n !== null && typeof n === 'object' ? (n as Record<string, unknown>)[k] : undefined,
      t,
    );

describe('askDictionary — one locale authority for the reachable Ask surfaces', () => {
  it('EN and PL are the released catalogues, byte-identical', () => {
    expect(askDictionary('en')).toBe(getDictionary('en'));
    expect(askDictionary('pl')).toBe(getDictionary('pl'));
  });

  it.each(NEW)(
    '%s: every shell-governed namespace is the SAME value the Ask shell renders (L overlay)',
    (locale) => {
      const shell = askShellStrings(locale).dict as Record<string, unknown>;
      const dict = askDictionary(locale) as unknown as Record<string, unknown>;
      for (const ns of ASK_SHELL_DICTIONARY_NAMESPACES) expect(dict[ns]).toEqual(shell[ns]);
    },
  );

  it('C55 reuse: every reused value is L’s own C55 wording, verbatim, for an UNCHANGED English source', () => {
    const en = getDictionary('en');
    for (const [key, english] of Object.entries(C55_REUSE_ENGLISH)) {
      /* today's English is still exactly what L translated — else the value goes back to L */
      expect(at(en, key)).toBe(english);
      for (const locale of NEW) {
        const value = at(ASK_DICTIONARY_ADDITIONS[locale], key);
        expect(value).toBe(at(C55[locale], key));
        expect(at(askDictionary(locale), key)).toBe(value);
      }
    }
  });

  it('nothing in the additions is authored here: every value is C55 reuse (L_RETURNED values arrive with L’s hash)', () => {
    const leaves = (t: unknown, p: string, out: string[] = []): string[] => {
      if (typeof t === 'string') out.push(p);
      else if (t !== null && typeof t === 'object')
        for (const [k, v] of Object.entries(t)) leaves(v, p === '' ? k : `${p}.${k}`, out);
      return out;
    };
    for (const locale of NEW)
      expect(leaves(ASK_DICTIONARY_ADDITIONS[locale], '').sort()).toEqual(
        Object.keys(C55_REUSE_ENGLISH).sort(),
      );
  });
});

describe('category B — localized data formatters keyed by the reader’s DisplayLocale', () => {
  it('country names: identical to the released formatter for en/pl/fr/es/ar, and real names for de/pt', () => {
    for (const iso3 of ['KEN', 'POL', 'RWA', 'DEU', 'BRA', 'EGY']) {
      for (const locale of ['en', 'pl', 'fr', 'es', 'ar'] as const)
        expect(askCountryName(iso3, locale)).toBe(localisedCountryName(iso3, locale));
    }
    expect(askCountryName('DEU', 'de')).toBe('Deutschland');
    expect(askCountryName('POL', 'pt')).toBe('Polônia');
  });

  it('relative time in each language’s own order (never "5 il y a"; CLDR2019s own idioms such as "vorgestern" are kept)', () => {
    const now = Date.parse('2026-10-05T12:00:00Z');
    expect(askRelativeTime('2026-10-05T11:55:00Z', 'fr', now)).toBe('il y a 5 minutes');
    expect(askRelativeTime('2026-10-02T12:00:00Z', 'de', now)).toBe('vor 3 Tagen');
    expect(askRelativeTime('2026-10-02T12:00:00Z', 'pt', now)).toBe('há 3 dias');
    expect(askRelativeTime('2026-10-05T09:00:00Z', 'es', now)).toBe('hace 3 horas');
    expect(askRelativeTime('2026-10-05T11:55:00Z', 'ar', now)).toMatch(/[؀-ۿ]/);
  });
});

describe('askLocaleForLegacyCatalogue — every remaining caller is classified (CTO §5)', () => {
  /*
    A  UI copy            → migrated to the Ask locale authority (none may remain)
    B  data formatter     → migrated to a DisplayLocale formatter (none may remain on the Ask path)
    C  boundary / by design — listed here with the reason; nothing user-visible reads it
  */
  const CATEGORY_C: Record<string, string> = {
    'components/ask-frame/AskR2TurnView.tsx':
      'the `language` prop of AskCompactResult is a LanguageCode boundary kept for props that still take one; every label on the card reads `locale`',
    'components/ask/AskAiDock.tsx':
      'the platform dock (not the standalone Ask path): out of scope by the CTO ruling, unchanged',
  };
  const SRC = join(__dirname, '..', '..', '..');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return files(path);
      return /\.(ts|tsx)$/.test(name) && !/\.spec\.tsx?$/.test(name) ? [path] : [];
    });
  it('no caller outside the classified boundary list', () => {
    const callers = files(SRC)
      .filter((f) => /askLocaleForLegacyCatalogue\(/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f).replace(/\\/g, '/'))
      .filter((f) => f !== 'lib/ask/askLocale.ts');
    expect(callers.sort()).toEqual(Object.keys(CATEGORY_C).sort());
  });
});

describe('L R6 — the additive 50, integrated as L delivered them (one authority per string)', () => {
  const leafKeys = (t: unknown, p = '', out: string[] = []): string[] => {
    if (typeof t === 'string') out.push(p);
    else if (t !== null && typeof t === 'object')
      for (const [k, v] of Object.entries(t)) leafKeys(v, p === '' ? k : `${p}.${k}`, out);
    return out;
  };

  it('35 dictionary keys + 8 comparison templates per locale, none blank; 7 resolved as aliases', () => {
    for (const locale of NEW) {
      const keys = leafKeys(ASK_DICTIONARY_ADDITIONS_L_R6[locale]);
      expect(keys).toHaveLength(35);
      for (const k of keys)
        expect(String(at(ASK_DICTIONARY_ADDITIONS_L_R6[locale], k)).trim()).not.toBe('');
      expect(Object.keys(ASK_COMPARISON_COVERAGE_L_R6[locale]).sort()).toEqual([
        'gap',
        'line',
        'liveUnavailable',
        'localityNotEstablished',
        'qualifying',
        'rateLimited',
        'retained',
        'timedOut',
      ]);
    }
    expect(Object.keys(ASK_DICTIONARY_CANONICAL_ALIASES)).toHaveLength(7);
    /* 35 + 7 + 8 = the 50 L qualified */
  });

  it('the 7 aliases are NOT copies: each reads the already-qualified shell key, whose English is identical', () => {
    const enShell = askShellStrings('en');
    for (const [key, shellKey] of Object.entries(ASK_DICTIONARY_CANONICAL_ALIASES)) {
      expect(at(getDictionary('en'), key)).toBe(at(enShell, shellKey));
      for (const locale of NEW) {
        expect(at(askDictionary(locale), key)).toBe(at(askShellStrings(locale), shellKey));
        expect(at(ASK_DICTIONARY_ADDITIONS_L_R6[locale], key)).toBeUndefined();
      }
    }
  });

  it('every L R6 key reaches the reader through askDictionary', () => {
    for (const locale of NEW)
      for (const key of leafKeys(ASK_DICTIONARY_ADDITIONS_L_R6[locale]))
        expect(at(askDictionary(locale), key)).toBe(at(ASK_DICTIONARY_ADDITIONS_L_R6[locale], key));
  });

  it('evidence semantics: no "proof" word anywhere in L’s 50', () => {
    const all = NEW.flatMap((l) => [
      ...leafKeys(ASK_DICTIONARY_ADDITIONS_L_R6[l]).map((k) =>
        String(at(ASK_DICTIONARY_ADDITIONS_L_R6[l], k)),
      ),
      ...Object.values(ASK_COMPARISON_COVERAGE_L_R6[l]),
    ]);
    expect(all.filter((v) => /\b(?:preuves?|Beweis\w*|pruebas?|provas?)\b/iu.test(v))).toEqual([]);
  });
});

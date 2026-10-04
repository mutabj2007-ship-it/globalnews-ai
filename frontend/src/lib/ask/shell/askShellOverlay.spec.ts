import {
  SHELL_LOCALES,
  SHELL_TEMPLATE_SUFFIX,
  isShellTemplate,
  isShellTemplatePath,
  mergeShell,
  renderShellTemplate,
  shellFallbacks,
  shellKeyPaths,
  shellPathWithoutMarker,
  type ShellLocaleOverlay,
} from '@/lib/ask/shell/askShellOverlay';
import { DISPLAY_LOCALES } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R4 · PHASE B · B-1 — THE OVERLAY MECHANISM ITSELF
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The CTO's rule is that a missing catalogue key must FAIL A TEST rather than silently
 * display English. That rule is only as good as the enumerator behind it, so this spec
 * tests the enumerator before anything is wired to it — and it pins the defect that the
 * first version of the scaffold had: ten function-valued members that `shellKeyPaths` did
 * not emit, which `shellFallbacks` therefore could not report, which would have let a
 * locale be declared complete with ten English sentences still in it.
 */

/* A miniature of the real catalogue shape: nested records, an array, and both template kinds. */
const source = {
  title: 'Ask GlobalNewsAI',
  nested: { answer: 'Answer', sources: 'Sources' },
  stages: ['Reading', 'Checking'] as readonly string[],
  sourcesLabel: (n: number) => `${n} ${n === 1 ? 'source' : 'sources'}`,
  savedAs: (v: number) => `Saved as briefing · version ${v}`,
  choiceFor: (question: string, objective: string) => `${question} — for ${objective}?`,
  broadening: (items: readonly string[], withSuggestion: boolean) =>
    `${items.join(', ')}${withSuggestion ? ' — suggested' : ''}`,
};

describe('B-1 · the enumerator sees every localizable leaf', () => {
  it('emits strings, array members and FUNCTIONS', () => {
    expect(shellKeyPaths(source)).toEqual([
      'title',
      'nested.answer',
      'nested.sources',
      'stages[0]',
      'stages[1]',
      'sourcesLabel()',
      'savedAs()',
      'choiceFor()',
      'broadening()',
    ]);
  });

  it('REGRESSION — a function-valued member is never silently skipped', () => {
    /*
      THE MEASURED DEFECT. The first scaffold fell through on a function, so these four
      paths did not exist and nothing downstream could report them. Asserted by COUNT as
      well as by name, so a future enumerator that drops one fails here rather than in a
      reader's browser.
    */
    const paths = shellKeyPaths(source);
    const templates = paths.filter(isShellTemplatePath);
    expect(templates).toHaveLength(4);
    for (const name of ['sourcesLabel', 'savedAs', 'choiceFor', 'broadening']) {
      expect(paths).toContain(`${name}${SHELL_TEMPLATE_SUFFIX}`);
      expect(shellPathWithoutMarker(`${name}${SHELL_TEMPLATE_SUFFIX}`)).toBe(name);
    }
  });

  it('a tree with no localizable leaf yields no paths', () => {
    expect(shellKeyPaths({ n: 1, b: true, nothing: null })).toEqual([]);
  });
});

describe('B-2 · an overlay can only replace a leaf the source already has', () => {
  it('replaces strings and leaves the rest English', () => {
    const merged = mergeShell(source, { data: { nested: { answer: 'Réponse' } } }, 'fr');
    expect(merged.nested.answer).toBe('Réponse');
    expect(merged.nested.sources).toBe('Sources');
    expect(merged.title).toBe('Ask GlobalNewsAI');
  });

  it('cannot add a key', () => {
    const merged = mergeShell(source, { data: { invented: 'nope' } }, 'fr') as Record<
      string,
      unknown
    >;
    expect(merged.invented).toBeUndefined();
    expect(Object.keys(merged)).toEqual(Object.keys(source));
  });

  it('cannot change a shape — a malformed overlay degrades to English', () => {
    const merged = mergeShell(
      source,
      { data: { title: { not: 'a string' }, nested: 'not an object' } },
      'fr',
    );
    expect(merged.title).toBe('Ask GlobalNewsAI');
    expect(merged.nested.answer).toBe('Answer');
  });

  it('replaces array members by index without changing the length', () => {
    const merged = mergeShell(source, { data: { stages: ['Lecture'] } }, 'fr');
    expect(merged.stages).toEqual(['Lecture', 'Checking']);
  });

  it('REGRESSION — an array may also be overlaid as an INDEX-KEYED OBJECT', () => {
    /*
      THE BUG THIS PINS WAS INVISIBLE TO THE ACCOUNTING, which is what makes it worth a test
      of its own. A JSON delivery and a dotted key path both produce `{ "0": …, "1": … }`
      rather than a JSON array — Claude L's `dict.loadingStages[0..3]` arrive that way. The
      merge checked `Array.isArray` and ignored the object, so English survived; meanwhile
      `shellFallbacks` resolves `[0]` to `.0`, found the key, and reported the locale
      COMPLETE. Four qualified French strings rendered English with a passing coverage test.

      Both shapes must work, and the fallback report must agree with the merge — asserted
      together here, because either one alone would have passed while the defect was live.
    */
    const overlay = { data: { stages: { '0': 'Lecture', '1': 'Vérification' } } };
    expect(mergeShell(source, overlay, 'fr').stages).toEqual(['Lecture', 'Vérification']);
    expect(shellFallbacks(source, overlay).filter((p) => p.startsWith('stages'))).toEqual([]);
  });
});

describe('B-3 · a template is localized as data and keeps the source signature', () => {
  it('a pattern substitutes positionally', () => {
    const merged = mergeShell(
      source,
      { data: { choiceFor: { kind: 'pattern', pattern: '{0} — pour {1} ?' } } },
      'fr',
    );
    expect(merged.choiceFor('Que dit le texte', 'le climat')).toBe(
      'Que dit le texte — pour le climat ?',
    );
  });

  it('a plural form is selected by the LOCALE rules, not by n === 1', () => {
    /*
      Polish has four categories and already needed a hand-written three-way rule for
      `sourcesLabel`. The point of selecting through `Intl.PluralRules` is that 2 and 5
      differ in Polish and do not in French, with no per-language branch in our code.
    */
    const pl = mergeShell(
      source,
      {
        data: {
          sourcesLabel: {
            kind: 'plural',
            forms: { one: '1 źródło', few: '{0} źródła', many: '{0} źródeł', other: '{0} źródła' },
          },
        },
      },
      'pl',
    );
    expect(pl.sourcesLabel(1)).toBe('1 źródło');
    expect(pl.sourcesLabel(3)).toBe('3 źródła');
    expect(pl.sourcesLabel(7)).toBe('7 źródeł');

    const fr = mergeShell(
      source,
      { data: { sourcesLabel: { kind: 'plural', forms: { one: '{0} source', other: '{0} sources' } } } },
      'fr',
    );
    expect(fr.sourcesLabel(1)).toBe('1 source');
    expect(fr.sourcesLabel(7)).toBe('7 sources');
  });

  it('Arabic selects among its six categories and renders its own numerals', () => {
    const ar = mergeShell(
      source,
      {
        data: {
          sourcesLabel: {
            kind: 'plural',
            forms: {
              zero: 'لا مصادر',
              one: 'مصدر واحد',
              two: 'مصدران',
              few: '{0} مصادر',
              many: '{0} مصدرًا',
              other: '{0} مصدر',
            },
          },
        },
      },
      'ar',
    );
    expect(ar.sourcesLabel(1)).toBe('مصدر واحد');
    expect(ar.sourcesLabel(2)).toBe('مصدران');
    /* ٣ — the locale's own numerals, because the count goes through Intl.NumberFormat. */
    expect(ar.sourcesLabel(3)).toBe('٣ مصادر');
    expect(ar.sourcesLabel(11)).toBe('١١ مصدرًا');
  });

  it('a missing plural category falls back to `other`, which CLDR guarantees exists', () => {
    const fr = mergeShell(
      source,
      { data: { savedAs: { kind: 'plural', forms: { other: 'Version {0}' } } } },
      'fr',
    );
    expect(fr.savedAs(1)).toBe('Version 1');
    expect(fr.savedAs(9)).toBe('Version 9');
  });

  it('an unresolvable placeholder stays VISIBLE rather than rendering undefined', () => {
    const fr = mergeShell(
      source,
      { data: { choiceFor: { kind: 'pattern', pattern: '{0} / {1} / {2}' } } },
      'fr',
    );
    expect(fr.choiceFor('a', 'b')).toBe('a / b / {2}');
  });

  it('a structural declaration alone does NOT replace the function', () => {
    const merged = mergeShell(source, { data: { broadening: { kind: 'structural' } } }, 'fr');
    expect(merged.broadening(['a'], true)).toBe('a — suggested');
  });

  it('a structural template is localized by a supplied function', () => {
    const merged = mergeShell(
      source,
      {
        data: { broadening: { kind: 'structural' } },
        functions: {
          broadening: ((items: readonly string[], withSuggestion: boolean) =>
            `${items.map((i) => `« ${i} »`).join(' et ')}${
              withSuggestion ? ' — proposition' : ''
            }`) as never,
        },
      },
      'fr',
    );
    expect(merged.broadening(['Pologne', 'Ukraine'], true)).toBe(
      '« Pologne » et « Ukraine » — proposition',
    );
  });

  it('recognises the three template kinds and rejects anything else', () => {
    expect(isShellTemplate({ kind: 'pattern', pattern: 'x' })).toBe(true);
    expect(isShellTemplate({ kind: 'plural', forms: { other: 'x' } })).toBe(true);
    expect(isShellTemplate({ kind: 'structural' })).toBe(true);
    expect(isShellTemplate({ kind: 'pattern' })).toBe(false);
    expect(isShellTemplate({ kind: 'plural', forms: { one: 'x' } })).toBe(false);
    expect(isShellTemplate({ kind: 'nonsense' })).toBe(false);
    expect(isShellTemplate('x')).toBe(false);
    expect(isShellTemplate(null)).toBe(false);
  });

  it('renderShellTemplate is usable on its own and formats numbers for the locale', () => {
    const render = renderShellTemplate({ kind: 'pattern', pattern: '{0} reports' }, 'ar');
    expect(render(12)).toBe('١٢ reports');
  });
});

describe('B-4 · fallback accounting — nothing falls through quietly', () => {
  it('an empty overlay reports EVERY key, templates included', () => {
    const all = shellKeyPaths(source);
    expect(shellFallbacks(source, undefined)).toEqual(all);
    expect(shellFallbacks(source, {})).toEqual(all);
  });

  it('a covered key disappears from the report', () => {
    const overlay: ShellLocaleOverlay = {
      data: {
        title: 'Titre',
        nested: { answer: 'Réponse', sources: 'Sources' },
        stages: ['Lecture', 'Vérification'],
        sourcesLabel: { kind: 'plural', forms: { one: '{0} source', other: '{0} sources' } },
        savedAs: { kind: 'pattern', pattern: 'Version {0}' },
        choiceFor: { kind: 'pattern', pattern: '{0} — {1} ?' },
        broadening: { kind: 'structural' },
      },
      functions: { broadening: ((i: readonly string[]) => i.join(' et ')) as never },
    };
    expect(shellFallbacks(source, overlay)).toEqual([]);
  });

  it('a structural template with NO function is still reported', () => {
    const fallbacks = shellFallbacks(source, { data: { broadening: { kind: 'structural' } } });
    expect(fallbacks).toContain('broadening()');
  });

  it('REGRESSION — an untranslated template is reported, not counted as covered', () => {
    /*
      This is the assertion the earlier scaffold could not make. With templates invisible to
      the enumerator, an overlay covering only the strings reported ZERO fallbacks and the
      locale looked complete.
    */
    const stringsOnly: ShellLocaleOverlay = {
      data: {
        title: 'Titre',
        nested: { answer: 'Réponse', sources: 'Sources' },
        stages: ['Lecture', 'Vérification'],
      },
    };
    expect(shellFallbacks(source, stringsOnly)).toEqual([
      'sourcesLabel()',
      'savedAs()',
      'choiceFor()',
      'broadening()',
    ]);
  });

  it('a malformed template is reported rather than accepted', () => {
    const fallbacks = shellFallbacks(source, {
      data: { sourcesLabel: { kind: 'plural', forms: { one: 'only one' } } },
    });
    expect(fallbacks).toContain('sourcesLabel()');
  });
});

describe('B-5 · the locale set is the shared contract, never a second list', () => {
  it('SHELL_LOCALES is DISPLAY_LOCALES', () => {
    expect(SHELL_LOCALES).toEqual(DISPLAY_LOCALES);
    expect(SHELL_LOCALES).toHaveLength(7);
    expect([...SHELL_LOCALES]).toEqual(['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar']);
  });

  it('the module declares no locale list of its own', () => {
    const src = require('fs')
      .readFileSync(require('path').join(__dirname, 'askShellOverlay.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    /* No hand-written array of locale codes, and no per-language branch. */
    expect(src).not.toMatch(/\[\s*'en'\s*,\s*'pl'/);
    expect(src).not.toMatch(/locale\s*===\s*'(fr|de|es|pt|ar)'/);
  });
});

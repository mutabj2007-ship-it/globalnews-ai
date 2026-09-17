import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

import {
  assertDocumentLanguageDescribesRenderedContent,
  documentLanguageOf,
  persistedPreferenceOf,
  resolveContentLocale,
  type DisplayLocale,
} from '@globalnews-ai/shared';

/**
 * LANG-OFFLINE-PWA-1 — OFFLINE REQUESTED / EFFECTIVE LOCALE INTEGRITY.
 *
 * MAIN-LANG-MEASURE-1 measured the defect: `offline.html` took `lang` and `dir`
 * from the REQUESTED locale while its content fell back to a block that exists,
 * so a cookie of `ar` produced `lang="ar" dir="rtl"` around English prose.
 *
 * WHY THIS FILE EXECUTES THE PAGE INSTEAD OF GREPPING IT. The sibling static
 * assertions in serviceWorkerContract.spec.ts can only say that particular lines
 * are present. They cannot say what the page DOES, and the previous version of
 * one of them pinned the defect in place — a grep is exactly as wrong as the
 * string it is given. So this file runs offline.html's real inline script,
 * verbatim, and checks the document it produces.
 *
 * WHY THE ORACLE IS THE SHARED CONTRACT. Expected locale values are not
 * hand-written here; they come from `resolveContentLocale` / `documentLanguageOf`
 * in shared/src/language — the accepted contract. offline.html is a static file
 * with no bundler and cannot import that module, so it re-implements the rule;
 * this test is what stops the copy drifting from the contract.
 *
 * THREE FACTS ARE KEPT DISTINCT THROUGHOUT, because collapsing any two of them
 * is how the original defect happened:
 *
 *   requestedDisplayLocale   what the reader asked for; the persisted preference
 *   effectiveContentLocale   the locale whose content is actually rendered
 *   noticeLocale             the language the fallback NOTICE is written in —
 *                            a third catalogue, and now genuinely different from
 *                            the other two for five of the seven locales
 */

const publicDir = join(__dirname, '..', '..', '..', 'public');
const offlineSource = readFileSync(join(publicDir, 'offline.html'), 'utf-8');
const inlineScript = (offlineSource.match(/<script>([\s\S]*?)<\/script>/) ?? ['', ''])[1];

/**
 * L-LANG-OFFLINE-COPY-1 — the authored SHORT notices, transcribed from
 * 02-OFFLINE-NOTICE-TABLE.json in the package hashed
 * b8e91b9d6a418a611e478af711380343ae560c626bef4b337a1e8796029c46ae.
 *
 * Duplicated here on purpose: this is the pin. If offline.html's catalogue is
 * edited by anyone other than L, these comparisons fail loudly instead of the
 * change reaching readers in seven languages unnoticed.
 */
const L_SHORT: Record<string, string> = {
  en: 'This page is shown in English. Your language choice has not changed.',
  pl: 'Ta strona jest wyświetlana po angielsku. Twój wybór języka nie zmienił się.',
  fr: 'Cette page est affichée en anglais. Votre choix de langue n\'a pas changé.',
  de: 'Diese Seite wird auf Englisch angezeigt. Ihre Sprachwahl wurde nicht geändert.',
  es: 'Esta página se muestra en inglés. Su elección de idioma no ha cambiado.',
  pt: 'Esta página é exibida em inglês. A sua escolha de idioma não mudou.',
  ar: 'تُعرض هذه الصفحة بالإنجليزية. ولم يتغيّر اختيارك للغة.',
};

/** L's own declared direction per notice locale — cross-checked against the page's DIRECTION map. */
const L_DIR: Record<string, string> = { en: 'ltr', pl: 'ltr', fr: 'ltr', de: 'ltr', es: 'ltr', pt: 'ltr', ar: 'rtl' };

/** Locale blocks, read off the document itself — including which declares the fallback. */
const BLOCKS = [...offlineSource.matchAll(/<div ([^>]*data-language="[a-z-]+"[^>]*)>/g)].map(
  (m) => ({
    locale: (m[1].match(/data-language="([a-z-]+)"/) as RegExpMatchArray)[1] as DisplayLocale,
    declaresFallback: m[1].includes('data-offline-fallback'),
  }),
);
const RENDERABLE = BLOCKS.map((b) => b.locale);
const DECLARED_FALLBACK = BLOCKS.filter((b) => b.declaresFallback).map((b) => b.locale);

/**
 * The page's own NOTICE_CATALOGUE, obtained by EVALUATING the declaration rather
 * than pattern-matching it. A regex over string literals would have to re-derive
 * JavaScript's escaping rules — and the French notice contains an apostrophe,
 * which is exactly where a hand-rolled parser goes wrong and silently reports
 * the wrong copy as correct.
 */
const PAGE_CATALOGUE: Record<string, string> = (() => {
  const decl = (inlineScript.match(
    /var NOTICE_CATALOGUE = \{[\s\S]*?\n {8}\};/,
  ) as RegExpMatchArray)[0];
  const sandbox: { NOTICE_CATALOGUE?: Record<string, string> } = {};
  runInContext(decl, createContext(sandbox));
  return sandbox.NOTICE_CATALOGUE as Record<string, string>;
})();

const NOTICE_LAST_RESORT = (inlineScript.match(
  /var NOTICE_LAST_RESORT = '([a-z-]+)';/,
) as RegExpMatchArray)[1];

interface FakeElement {
  hidden: boolean;
  textContent: string;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  addEventListener(type: string, fn: () => void): void;
}

function element(attrs: Record<string, string>): FakeElement {
  const own: Record<string, string> = { ...attrs };
  return {
    hidden: false,
    textContent: '',
    getAttribute: (name) => (name in own ? own[name] : null),
    setAttribute: (name, value) => {
      own[name] = value;
    },
    addEventListener: () => undefined,
  };
}

interface RunResult {
  lang: string;
  dir: string;
  requestedAttribute: string | null;
  contentAttribute: string | null;
  fellBackAttribute: string | null;
  visibleBlocks: string[];
  noteHidden: boolean;
  noteText: string;
  noteLang: string | null;
  noteDir: string | null;
  noteLocale: string | null;
  cookieAfter: string;
}

/** Execute offline.html's inline script against a document built from its own markup. */
function render(
  script: string,
  cookie: string | undefined,
  blockOrder: typeof BLOCKS = BLOCKS,
): RunResult {
  const blocks = blockOrder.map((b) =>
    element(
      b.declaresFallback
        ? { 'data-language': b.locale, 'data-offline-fallback': '' }
        : { 'data-language': b.locale },
    ),
  );
  const note = element({ 'data-fallback-note': '' });
  note.hidden = true;
  const retry = element({ 'data-retry': '' });

  const documentElement = element({});
  (documentElement as unknown as { lang: string }).lang = '';
  (documentElement as unknown as { dir: string }).dir = '';

  let cookieJar = cookie === undefined ? '' : `globalnews-ai-language=${cookie}`;

  const document = {
    documentElement,
    get cookie() {
      return cookieJar;
    },
    set cookie(value: string) {
      cookieJar = value;
    },
    querySelectorAll: (selector: string) => {
      if (selector === '[data-language]') return blocks;
      if (selector === '[data-retry]') return [retry];
      return [];
    },
    querySelector: (selector: string) => {
      if (selector === '[data-fallback-note]') return note;
      if (selector === '[data-offline-fallback][data-language]') {
        return blocks.find((b) => b.getAttribute('data-offline-fallback') !== null) ?? null;
      }
      return null;
    },
    addEventListener: () => undefined,
    visibilityState: 'visible',
  };

  const context = createContext({
    document,
    window: { addEventListener: () => undefined, location: { reload: () => undefined } },
    navigator: { onLine: false },
    console,
  });
  runInContext(script, context, { filename: 'offline.html<script>' });

  return {
    lang: (documentElement as unknown as { lang: string }).lang,
    dir: (documentElement as unknown as { dir: string }).dir,
    requestedAttribute: documentElement.getAttribute('data-requested-locale'),
    contentAttribute: documentElement.getAttribute('data-content-locale'),
    fellBackAttribute: documentElement.getAttribute('data-fell-back'),
    visibleBlocks: blocks
      .filter((b) => !b.hidden)
      .map((b) => b.getAttribute('data-language') as string),
    noteHidden: note.hidden,
    noteText: note.textContent,
    noteLang: note.getAttribute('lang'),
    noteDir: note.getAttribute('dir'),
    noteLocale: note.getAttribute('data-notice-locale'),
    cookieAfter: cookieJar,
  };
}

/* Locales a reader can request that this page cannot render. 'ar' is the case
   the defect was measured on and the only one where the wrong answer also
   changes DIRECTION; fr, de, pt, es are LTR, so a direction-only check would
   pass them while still lying about `lang`. */
const FALLBACK_REQUESTS: DisplayLocale[] = ['ar', 'fr', 'de', 'pt', 'es'];
const ALL_REQUESTS: DisplayLocale[] = [...FALLBACK_REQUESTS, 'en', 'pl'];
const SEVEN = ['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar'];

describe('LANG-OFFLINE-PWA-1 — the shared contract resolves before anything is trusted', () => {
  /*
    Ordered self-test. Every locale expectation below is computed by the shared
    contract, so a suite that could not actually resolve it would still "pass" on
    the assertions that do not use it — a green run that proves nothing. This
    fails first and unmistakably if the import is not live.
  */
  it('@globalnews-ai/shared is imported and executing, not merely type-resolved', () => {
    expect(typeof resolveContentLocale).toBe('function');
    expect(typeof documentLanguageOf).toBe('function');
    expect(typeof persistedPreferenceOf).toBe('function');
    expect(typeof assertDocumentLanguageDescribesRenderedContent).toBe('function');

    const r = resolveContentLocale('ar', ['en', 'pl']);
    expect(r).toEqual({
      requestedDisplayLocale: 'ar',
      effectiveContentLocale: 'en',
      fellBack: true,
    });
    expect(documentLanguageOf(r)).toEqual({ lang: 'en', dir: 'ltr' });
    expect(persistedPreferenceOf(r)).toBe('ar');
    expect(() => resolveContentLocale('en', [])).toThrow(/LANG-RESOLVE-1/);
    // and it really does reject the defect, so using it as an oracle means something
    expect(() =>
      assertDocumentLanguageDescribesRenderedContent({ lang: 'ar', dir: 'rtl' }, r),
    ).toThrow(/LANG-RESOLVE-2/);
  });
});

describe('LANG-OFFLINE-PWA-1 — the offline document describes what it renders', () => {
  it('renders at least one locale, so the contract can be applied at all', () => {
    expect(RENDERABLE.length).toBeGreaterThan(0);
  });

  it.each(ALL_REQUESTS)(
    'requested %s — lang/dir describe the EFFECTIVE locale, per the shared contract',
    (requested) => {
      const resolution = resolveContentLocale(requested, RENDERABLE);
      const expected = documentLanguageOf(resolution);
      const result = render(inlineScript, requested);

      expect(() =>
        assertDocumentLanguageDescribesRenderedContent(
          { lang: result.lang as DisplayLocale, dir: result.dir as 'ltr' | 'rtl' },
          resolution,
        ),
      ).not.toThrow();

      expect(result.lang).toBe(expected.lang);
      expect(result.dir).toBe(expected.dir);
      expect(result.visibleBlocks).toEqual([resolution.effectiveContentLocale]);
    },
  );

  it('requested ar → effective en: lang="en", dir="ltr", English content, ar preserved', () => {
    const result = render(inlineScript, 'ar');
    expect(result.lang).toBe('en');
    expect(result.dir).toBe('ltr');
    expect(result.visibleBlocks).toEqual(['en']);
    expect(result.requestedAttribute).toBe('ar');
    expect(result.contentAttribute).toBe('en');
    expect(result.fellBackAttribute).toBe('true');
    expect(result.lang).not.toBe('ar');
    expect(result.dir).not.toBe('rtl');
  });

  it.each(['fr', 'de', 'es', 'pt'] as DisplayLocale[])(
    'requested %s → effective en: an LTR fallback still corrects lang, preference preserved',
    (requested) => {
      const result = render(inlineScript, requested);
      expect(result.lang).toBe('en');
      expect(result.dir).toBe('ltr');
      expect(result.lang).not.toBe(requested);
      expect(result.requestedAttribute).toBe(requested);
      expect(result.visibleBlocks).toEqual(['en']);
    },
  );

  it('en and pl do not fall back, and behave as before', () => {
    for (const locale of ['en', 'pl'] as DisplayLocale[]) {
      const result = render(inlineScript, locale);
      expect(result.lang).toBe(locale);
      expect(result.dir).toBe('ltr');
      expect(result.visibleBlocks).toEqual([locale]);
      expect(result.fellBackAttribute).toBe('false');
      expect(result.noteHidden).toBe(true);
      expect(result.noteText).toBe('');
      expect(result.noteLang).toBeNull();
    }
  });

  it.each(FALLBACK_REQUESTS)(
    'requested %s — the preference is preserved, never rewritten to the served locale',
    (requested) => {
      const result = render(inlineScript, requested);
      const resolution = resolveContentLocale(requested, RENDERABLE);
      expect(result.cookieAfter).toBe(`globalnews-ai-language=${requested}`);
      expect(result.requestedAttribute).toBe(persistedPreferenceOf(resolution));
      expect(result.contentAttribute).not.toBe(requested);
    },
  );

  it('an absent or unknown cookie is treated as a request for English', () => {
    expect(render(inlineScript, undefined).lang).toBe('en');
    expect(render(inlineScript, 'zz').lang).toBe('en');
    expect(render(inlineScript, undefined).fellBackAttribute).toBe('false');
  });
});

describe('LANG-OFFLINE-PWA-1 — the notice catalogue is L-LANG-OFFLINE-COPY-1, verbatim', () => {
  it('carries exactly the seven display locales', () => {
    expect(Object.keys(PAGE_CATALOGUE).sort()).toEqual([...SEVEN].sort());
  });

  it.each(SEVEN)('%s — the page string is character-identical to L authority', (locale) => {
    expect(PAGE_CATALOGUE[locale]).toBe(L_SHORT[locale]);
  });

  it('no notice carries an interpolation token — the codes cannot reach a reader', () => {
    /*
      This is the mechanism the earlier revision used to put "ar" and "en" in
      front of readers. Checking for the TOKENS rather than scanning prose for
      locale codes is deliberate: French, Spanish and Portuguese all contain the
      standalone word "de", so a code-scan over prose would fire on correct copy
      and teach everyone to ignore it.
    */
    for (const locale of SEVEN) {
      expect(PAGE_CATALOGUE[locale]).not.toMatch(/\{[a-zA-Z]+\}/);
    }
  });

  it('every notice is two sentences — the substitution, then the denial', () => {
    /*
      Named for what it actually measures. L's authority is that each notice
      carries two meanings — the page is shown in English, and the preference is
      unchanged — and that they are authored as two sentences. A test here can
      check the SHAPE (two sentences, both non-empty, in the notice's own
      script); it cannot check the MEANING of Polish or Arabic prose, and
      pretending otherwise would be the more dangerous kind of green tick.
      Meaning is L's to certify; this guards against a truncated or half-copied
      string reaching the page.
    */
    for (const locale of SEVEN) {
      const sentences = PAGE_CATALOGUE[locale]
        .split(/[.。]\s+/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      expect(sentences).toHaveLength(2);
      expect(sentences[0].length).toBeGreaterThan(10);
      expect(sentences[1].length).toBeGreaterThan(10);
    }
  });

  it("the last-resort notice locale exists in the catalogue", () => {
    expect(Object.keys(PAGE_CATALOGUE)).toContain(NOTICE_LAST_RESORT);
  });
});

describe('LANG-OFFLINE-PWA-1 — the rendered notice, seven languages', () => {
  it.each(FALLBACK_REQUESTS)(
    'requested %s — the notice is in the REQUESTED language and says so',
    (requested) => {
      const result = render(inlineScript, requested);

      expect(result.noteHidden).toBe(false);
      expect(result.noteLocale).toBe(requested);
      expect(result.noteLang).toBe(requested);
      expect(result.noteDir).toBe(L_DIR[requested]);

      // Character-identical to the authored string. This is the proof that the
      // retained .replace() injected nothing: rendered === catalogue entry.
      expect(result.noteText).toBe(L_SHORT[requested]);

      // And the page itself did not move.
      expect(result.lang).toBe('en');
      expect(result.contentAttribute).toBe('en');
      expect(result.requestedAttribute).toBe(requested);
    },
  );

  it('requested ar — the notice is Arabic, RTL, inside a page that stays English LTR', () => {
    const result = render(inlineScript, 'ar');
    expect(result.noteLocale).toBe('ar');
    expect(result.noteLang).toBe('ar');
    expect(result.noteDir).toBe('rtl');
    expect(result.noteText).toBe(L_SHORT.ar);
    // The Arabic sentence contains no Latin characters at all, so it needs no
    // bidi isolation inside the LTR page — asserted, not assumed.
    expect(result.noteText).not.toMatch(/[A-Za-z]/);

    expect(result.lang).toBe('en');
    expect(result.dir).toBe('ltr');
    expect(result.visibleBlocks).toEqual(['en']);
  });

  it('no rendered notice ever shows a raw locale code where a language name belongs', () => {
    /*
      Stated as identity rather than substring: the rendered text equals a string
      a human authored, and that string contains no token. Any interpolation of
      `ar`/`en`/… would break the equality immediately.
    */
    for (const requested of FALLBACK_REQUESTS) {
      const result = render(inlineScript, requested);
      expect(result.noteText).toBe(PAGE_CATALOGUE[requested]);
      expect(result.noteText).toBe(L_SHORT[requested]);
      expect(result.noteText).not.toMatch(/\{|\}/);
    }
  });

  it('AMB-OFF-1 — only the SHORT notice ships; no second diagnostic row was added', () => {
    // The CTO ruling for this release. The label pairs stay reserved content
    // authority; nothing in the page renders them.
    for (const label of ['Requested language:', 'Shown in:', 'Wybrany język:', 'اللغة المطلوبة:']) {
      expect(offlineSource).not.toContain(label);
    }
    expect(offlineSource).not.toContain('white-space: pre-line');
    expect(offlineSource.match(/data-fallback-note/g) ?? []).toHaveLength(2); // markup + selector
  });

  it('en and pl notices exist but are unreachable today, and that is stated not assumed', () => {
    /*
      Honesty about coverage: en and pl are renderable, so they never fall back
      and their notices never render. They are in the catalogue for the
      last-resort path and for the day either stops being renderable.
    */
    expect(PAGE_CATALOGUE.en).toBeDefined();
    expect(PAGE_CATALOGUE.pl).toBeDefined();
    expect(render(inlineScript, 'en').noteHidden).toBe(true);
    expect(render(inlineScript, 'pl').noteHidden).toBe(true);
  });
});

describe('LANG-OFFLINE-PWA-1 — the fallback locale is declared, not inferred from ordering', () => {
  it('exactly one block declares itself the offline fallback, and it is renderable', () => {
    expect(DECLARED_FALLBACK).toHaveLength(1);
    expect(RENDERABLE).toContain(DECLARED_FALLBACK[0]);
  });

  it.each(FALLBACK_REQUESTS)(
    'requested %s — the effective locale is the DECLARED fallback, and equals the contract result',
    (requested) => {
      const result = render(inlineScript, requested);
      expect(result.contentAttribute).toBe(DECLARED_FALLBACK[0]);
      expect(result.lang).toBe(DECLARED_FALLBACK[0]);
      expect(resolveContentLocale(requested, RENDERABLE).effectiveContentLocale).toBe(
        DECLARED_FALLBACK[0],
      );
    },
  );

  it('ordering is not the authority — the declaration survives a reordered document', () => {
    expect(RENDERABLE[0]).toBe(DECLARED_FALLBACK[0]); // the coincidence being removed
    const reversed = [...BLOCKS].reverse();
    expect(reversed[0].locale).not.toBe(DECLARED_FALLBACK[0]); // index now says otherwise

    const result = render(inlineScript, 'ar', reversed);
    expect(result.contentAttribute).toBe(DECLARED_FALLBACK[0]);
    expect(result.lang).toBe(DECLARED_FALLBACK[0]);
    expect(result.visibleBlocks).toEqual([DECLARED_FALLBACK[0]]);
    expect(result.contentAttribute).not.toBe(reversed[0].locale);
  });

  it('NEGATIVE CONTROL — an index-based fallback DOES move when the document is reordered', () => {
    const indexBased = inlineScript.replace(
      /var FALLBACK_LOCALE = \(function \(\) \{[\s\S]*?\}\)\(\);/,
      'var FALLBACK_LOCALE = ACTIVE[0];',
    );
    expect(indexBased).not.toBe(inlineScript);

    const reversed = [...BLOCKS].reverse();
    const result = render(indexBased, 'ar', reversed);
    expect(result.contentAttribute).toBe(reversed[0].locale);
    expect(result.contentAttribute).not.toBe(DECLARED_FALLBACK[0]);
  });
});

describe('LANG-OFFLINE-PWA-1 — negative controls', () => {
  it('NEGATIVE CONTROL — the pre-fix derivation is caught by this harness', () => {
    const defective = inlineScript
      .replace(
        'document.documentElement.lang = effectiveContentLocale;',
        'document.documentElement.lang = requestedDisplayLocale;',
      )
      .replace(
        'document.documentElement.dir = DIRECTION[effectiveContentLocale] ||',
        'document.documentElement.dir = DIRECTION[requestedDisplayLocale] ||',
      );
    expect(defective).not.toBe(inlineScript);

    const result = render(defective, 'ar');
    expect(result.lang).toBe('ar');
    expect(result.dir).toBe('rtl');
    expect(result.visibleBlocks).toEqual(['en']); // Arabic metadata, English content

    expect(() =>
      assertDocumentLanguageDescribesRenderedContent(
        { lang: result.lang as DisplayLocale, dir: result.dir as 'ltr' | 'rtl' },
        resolveContentLocale('ar', RENDERABLE),
      ),
    ).toThrow(/LANG-RESOLVE-2/);
  });

  it('NEGATIVE CONTROL — an LTR fallback defect is caught too, not just the RTL one', () => {
    const defective = inlineScript.replace(
      'document.documentElement.lang = effectiveContentLocale;',
      'document.documentElement.lang = requestedDisplayLocale;',
    );
    const result = render(defective, 'fr');
    expect(result.lang).toBe('fr');
    expect(result.dir).toBe('ltr'); // direction alone would NOT have revealed this
    expect(() =>
      assertDocumentLanguageDescribesRenderedContent(
        { lang: result.lang as DisplayLocale, dir: result.dir as 'ltr' | 'rtl' },
        resolveContentLocale('fr', RENDERABLE),
      ),
    ).toThrow(/LANG-RESOLVE-2/);
  });

  it('NEGATIVE CONTROL — mislabelling the notice language is caught', () => {
    // An Arabic sentence marked lang="en" would be announced as English prose.
    const defective = inlineScript.replace(
      "note.setAttribute('lang', noticeLocale);",
      "note.setAttribute('lang', effectiveContentLocale);",
    );
    expect(defective).not.toBe(inlineScript);

    const result = render(defective, 'ar');
    expect(result.noteLocale).toBe('ar'); // the text really is Arabic
    expect(result.noteText).toBe(L_SHORT.ar);
    expect(result.noteLang).toBe('en'); // but it now claims English
    expect(result.noteLang).not.toBe(result.noteLocale);
  });

  it('NEGATIVE CONTROL — effective-only notice selection loses the requested language', () => {
    /*
      The behaviour L's authority and this revision replace: with all seven
      notices authored, effective-only selection still delivers English to a
      reader who asked for Arabic — the sentence for them exists and is not used.
    */
    const effectiveOnly = inlineScript.replace(
      /var noticeLocale = NOTICE_CATALOGUE\[requestedDisplayLocale\][\s\S]*?: NOTICE_LAST_RESORT;/,
      'var noticeLocale = NOTICE_CATALOGUE[effectiveContentLocale] ? effectiveContentLocale : NOTICE_LAST_RESORT;',
    );
    expect(effectiveOnly).not.toBe(inlineScript);

    expect(render(effectiveOnly, 'ar').noteLocale).toBe('en'); // the regression
    expect(render(effectiveOnly, 'ar').noteText).toBe(L_SHORT.en);
    expect(render(inlineScript, 'ar').noteLocale).toBe('ar'); // the shipped behaviour
  });

  it('NEGATIVE CONTROL — the L-copy pin actually fails on tampered copy', () => {
    /*
      Asserting that two different strings differ proves nothing about the pin.
      This runs the REAL comparison the suite uses and requires it to throw —
      truncating the French notice must fail, not merely look different.
    */
    const truncated = 'Cette page est affichée en anglais.';
    expect(() => expect(truncated).toBe(L_SHORT.fr)).toThrow();
    // and the shape check above must reject it too, for the same string
    const sentences = truncated.split(/[.。]\s+/).map((s2) => s2.trim()).filter(Boolean);
    expect(sentences).toHaveLength(1);
    // while the shipped copy passes both
    expect(() => expect(PAGE_CATALOGUE.fr).toBe(L_SHORT.fr)).not.toThrow();
  });
});

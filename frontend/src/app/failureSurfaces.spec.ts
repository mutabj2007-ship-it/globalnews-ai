import { readFileSync } from 'fs';
import { join } from 'path';
import { getFailureCopy } from '@/lib/i18n/failureCopy';

/**
 * MVP FAILURE FLOOR — THE CONTRACTS THE THREE SURFACES MUST HOLD.
 *
 * A DEDICATED FILE, DELIBERATELY. F owns the append region at the end of
 * `dictionaries/index.spec.ts` for the GEO-PRECISION-1 block; adding to it
 * would put two lanes on the same anchor and conflict on the merge. Nothing
 * here touches that file.
 *
 * Source-string assertions, the method this repository already uses for the
 * frontend lanes: there is no jsdom here, and the things that matter most on a
 * failure page — that `global-error.tsx` depends on NO stylesheet, that the
 * error message never reaches the DOM — are absences, which a source guard
 * proves and a render test cannot.
 */
const APP = __dirname;
const SRC = join(__dirname, '..');

const read = (path: string): string => readFileSync(path, 'utf-8');

/** Every negative guard runs against comment-stripped source. */
const codeOnly = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const errorSource = read(join(APP, 'error.tsx'));
const notFoundSource = read(join(APP, 'not-found.tsx'));
const globalErrorSource = read(join(APP, 'global-error.tsx'));
const surfaceSource = read(join(SRC, 'components', 'layout', 'FailureSurface.tsx'));
const copySource = read(join(SRC, 'lib', 'i18n', 'failureCopy.ts'));
const layoutSource = read(join(APP, 'layout.tsx'));
const tailwindSource = read(join(SRC, '..', 'tailwind.config.ts'));

const errorCode = codeOnly(errorSource);
const notFoundCode = codeOnly(notFoundSource);
const globalErrorCode = codeOnly(globalErrorSource);
const surfaceCode = codeOnly(surfaceSource);
const copyCode = codeOnly(copySource);

describe('Failure floor — all three App Router surfaces exist and are wired', () => {
  it('exports a default component from each of the three required files', () => {
    expect(errorCode).toMatch(/export default function RouteError\(/);
    expect(notFoundCode).toMatch(/export default function NotFound\(/);
    expect(globalErrorCode).toMatch(/export default function GlobalError\(/);
  });

  it('marks the two error boundaries as Client Components, as Next requires', () => {
    expect(errorSource.startsWith("'use client';")).toBe(true);
    expect(globalErrorSource.startsWith("'use client';")).toBe(true);
  });

  it('keeps not-found a SERVER component, so its language is right on the first paint', () => {
    // Comment-stripped: not-found.tsx's own header EXPLAINS why it has no
    // directive, and the prose must not be able to fail the guard.
    expect(notFoundCode).not.toMatch(/'use client'/);
    expect(notFoundCode).toMatch(/import \{ cookies \} from 'next\/headers'/);
  });

  it('accepts the error and reset props Next actually passes', () => {
    for (const code of [errorCode, globalErrorCode]) {
      expect(code).toMatch(/error: Error & \{ digest\?: string \}/);
      expect(code).toMatch(/reset: \(\) => void/);
    }
  });
});

describe('Failure floor — every surface offers a way back to /', () => {
  it('gives error.tsx and not-found.tsx the shared surface, which links to the front page', () => {
    expect(errorCode).toMatch(/<FailureSurface/);
    expect(notFoundCode).toMatch(/<FailureSurface/);
    expect(surfaceCode).toMatch(/<Link\s+href="\/"/);
  });

  it('gives global-error.tsx a PLAIN anchor, because the router is part of what failed', () => {
    expect(globalErrorCode).toMatch(/<a href="\/"/);
    expect(globalErrorCode).not.toMatch(/next\/link|<Link/);
  });

  it('offers a retry only where there is something to retry', () => {
    expect(errorCode).toMatch(/onRetry=\{reset\}/);
    expect(globalErrorCode).toMatch(/onClick=\{reset\}/);
    // A wrong address cannot be retried, so not-found passes no retry at all.
    expect(notFoundCode).not.toMatch(/onRetry|retryLabel/);
    // And nothing anywhere is a disabled stand-in.
    expect(surfaceCode).not.toMatch(/disabled/);
    expect(globalErrorCode).not.toMatch(/disabled/);
  });

  it('makes every control a real 44px target with a visible focus treatment', () => {
    expect(surfaceCode).toMatch(/min-h-\[44px\]/);
    expect(globalErrorCode).toMatch(/minHeight: '44px'/);
    // The canvas focus rule (.cd-canvas :focus-visible) covers the shared
    // surface; global-error keeps the browser default, which it must, because
    // it has no stylesheet.
    expect(surfaceCode).toMatch(/<PageCanvas>/);
  });
});

describe('Failure floor — global-error.tsx depends on NOTHING that can fail with the app', () => {
  it('renders its own document shell', () => {
    expect(globalErrorCode).toMatch(/<html lang=\{language\}>/);
    expect(globalErrorCode).toMatch(/<body style=\{PAGE\}>/);
  });

  it('uses no Tailwind class, no stylesheet import and none of the app shell', () => {
    expect(globalErrorCode).not.toMatch(/className=/);
    expect(globalErrorCode).not.toMatch(/\.css/);
    expect(globalErrorCode).not.toMatch(/PageCanvas|FailureSurface|NavBar|Footer/);
  });

  it('imports only what is erased or trivially small', () => {
    const imports = globalErrorSource.match(/^import .*$/gm) ?? [];
    for (const line of imports) {
      expect(line).toMatch(/from 'react'|@globalnews-ai\/shared|failureCopy|i18n\/languages/);
    }
    // The heavy dictionary is exactly what must NOT be pulled in here.
    expect(globalErrorCode).not.toMatch(/getDictionary|dictionaries/);
  });

  it('quotes RELEASED Claude Design values rather than inventing a failure palette', () => {
    /*
      Each hex below is asserted to exist in tailwind.config.ts, so an inline
      transcription cannot drift away from the token it copies.
    */
    for (const hex of ['#04060c', '#e8f1ff', '#a7c0d8', '#7dd3fc', '#22d3ee', '#9db8d2', '#5b7fa6']) {
      expect(globalErrorCode).toContain(hex);
      expect(tailwindSource).toContain(hex);
    }
    // And NOT ONE hex that the design system does not know about.
    const used = [...new Set(globalErrorCode.match(/#[0-9a-f]{6}/g) ?? [])];
    const unknown = used.filter((hex) => !tailwindSource.includes(hex));
    expect(unknown).toEqual([]);
    expect(used.length).toBeGreaterThanOrEqual(7);
  });
});

describe('Failure floor — the error object never reaches the page', () => {
  it('renders the digest and nothing else from the error', () => {
    for (const code of [errorCode, globalErrorCode]) {
      expect(code).toMatch(/error\.digest/);
      expect(code).not.toMatch(/\{error\.message\}|error\.stack|JSON\.stringify\(error/);
    }
    expect(surfaceCode).toMatch(/\{referenceLabel\} \{reference\}/);
  });

  it('does not log the error to the console or ship it anywhere', () => {
    for (const code of [errorCode, globalErrorCode]) {
      expect(code).not.toMatch(/console\.|fetch\(|sendBeacon/);
    }
  });
});

describe('Failure floor — language', () => {
  it('reuses the RELEASED cookie reader rather than parsing document.cookie again', () => {
    for (const code of [errorCode, globalErrorCode]) {
      expect(code).toMatch(/import \{ readLanguageCookie \} from '@\/lib\/i18n\/languages'/);
      expect(code).not.toMatch(/document\.cookie/);
    }
  });

  it('starts both boundaries at English so the client cannot disagree with the server', () => {
    for (const code of [errorCode, globalErrorCode]) {
      expect(code).toMatch(/useState<LanguageCode>\('en'\)/);
      expect(code).toMatch(/useEffect\(\(\) => \{\s*setLanguage\(readLanguageCookie\(\) \?\? 'en'\);\s*\}, \[\]\);/);
    }
  });

  it('resolves not-found on the server exactly the way layout.tsx does', () => {
    const rule =
      /const language = languageCookie && isActiveLanguageCode\(languageCookie\) \? languageCookie : 'en';/;
    expect(notFoundCode).toMatch(rule);
    expect(codeOnly(layoutSource)).toMatch(rule);
    expect(notFoundCode).toMatch(/cookies\(\)\.get\(LANGUAGE_COOKIE_NAME\)\?\.value/);
  });

  it('hardcodes no English chrome in any of the three surfaces', () => {
    for (const code of [errorCode, notFoundCode, globalErrorCode, surfaceCode]) {
      expect(code).not.toMatch(/Go to the front page|Try again|does not exist|could not start/);
    }
  });
});

describe('Failure floor — the copy module follows the dictionary’s own rules', () => {
  const en = getFailureCopy('en');
  const pl = getFailureCopy('pl');

  it('falls back to English for a language with no real translation', () => {
    expect(getFailureCopy('sw')).toBe(en);
    expect(getFailureCopy('rw').error.heading).toBe(en.error.heading);
  });

  it('carries every key in BOTH languages, non-empty and really translated', () => {
    for (const section of ['error', 'notFound', 'globalError'] as const) {
      const enKeys = Object.keys(en[section]).sort();
      expect(Object.keys(pl[section]).sort()).toEqual(enKeys);
      for (const key of enKeys) {
        const enValue = (en[section] as unknown as Record<string, string>)[key];
        const plValue = (pl[section] as unknown as Record<string, string>)[key];
        expect(plValue.length).toBeGreaterThan(0);
        expect(plValue).not.toBe(enValue);
      }
    }
    expect(pl.referenceLabel).not.toBe(en.referenceLabel);
  });

  it('gives not-found no retry key, because the shape itself denies one', () => {
    expect(Object.keys(en.notFound)).not.toContain('retry');
    expect(Object.keys(pl.notFound)).not.toContain('retry');
  });

  it('promises nothing the system cannot deliver', () => {
    const all = [en, pl]
      .flatMap((copy) => [copy.error, copy.notFound, copy.globalError, { r: copy.referenceLabel }])
      .flatMap((section) => Object.values(section))
      .join(' ')
      .toLowerCase();
    for (const claim of [
      'has been saved',
      'we have been notified',
      'our team',
      'powiadomiliśmy',
      'zespół',
      'support has been',
      'will be fixed',
      'shortly',
    ]) {
      expect(all).not.toContain(claim);
    }
  });

  it('tells a 404 reader that nothing is broken, in both languages', () => {
    expect(en.notFound.body.toLowerCase()).toContain('nothing has gone wrong');
    expect(pl.notFound.body.toLowerCase()).toContain('nic się nie zepsuło');
    // And the 404 heading never calls itself an error.
    expect(en.notFound.heading.toLowerCase()).not.toContain('error');
    expect(pl.notFound.heading.toLowerCase()).not.toContain('błąd');
  });

  it('imports nothing but the erased LanguageCode type', () => {
    const imports = copySource.match(/^import .*$/gm) ?? [];
    expect(imports).toHaveLength(1);
    expect(imports[0]).toBe("import type { LanguageCode } from '@globalnews-ai/shared';");
    expect(copyCode).not.toMatch(/getDictionary|'\.\/dictionaries/);
  });
});

describe('Failure floor — it changes nothing that already shipped', () => {
  it('leaves the root layout untouched by these surfaces', () => {
    expect(layoutSource).not.toMatch(/FailureSurface|failureCopy|global-error/);
  });

  it('adds no dependency — every import resolves inside this repository or react/next', () => {
    const imports = [errorSource, notFoundSource, globalErrorSource, surfaceSource, copySource]
      .flatMap((source) => source.match(/from '([^']+)'/g) ?? [])
      .map((line) => line.replace(/^from '|'$/g, ''));
    for (const specifier of imports) {
      expect(specifier).toMatch(/^(react|next\/[a-z]+|@\/|@globalnews-ai\/shared)/);
    }
  });
});

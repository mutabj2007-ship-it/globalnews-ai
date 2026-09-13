import type { LanguageCode } from '@globalnews-ai/shared';

/**
 * MVP FAILURE FLOOR — THE COPY FOR THE THREE APP ROUTER FAILURE SURFACES.
 *
 * ── WHY THIS IS A SEPARATE MODULE AND NOT A SECTION OF `en.ts` ────────────
 *
 * `global-error.tsx` is the reason. It replaces the ROOT LAYOUT — it renders
 * its own <html> and <body> — and it runs precisely when the root layout
 * itself failed to render. Reaching for the main dictionary there would pull
 * the whole ~58 KB en.ts + pl.ts graph, and every module either of them
 * imports, into the one code path that must work when everything else did not.
 * A last-resort boundary that depends on the largest module in the application
 * is not a last-resort boundary.
 *
 * So the failure copy is small, standalone, and has exactly one import: the
 * shared `LanguageCode` type, which is erased at compile time. Nothing here
 * can fail to load.
 *
 * ── IT IS NOT A SECOND LOCALIZATION SYSTEM, AND THE SPEC ENFORCES THAT ────
 *
 * The rules are the dictionary's rules, deliberately: the same `LanguageCode`
 * from `@globalnews-ai/shared`, the same "unimplemented language falls back to
 * English" behaviour `getDictionary` applies, the same key-parity requirement
 * between the two languages, and the same prohibition on hardcoded English in
 * a component. `failureSurfaces.spec.ts` asserts every one of those, so this
 * module cannot quietly drift into a private dialect.
 *
 * ── WHAT THE COPY IS ALLOWED TO CLAIM ─────────────────────────────────────
 *
 * A failure surface is the easiest place in a product to lie. It must not
 * promise that work was saved, that the fault is temporary, that support has
 * been notified, or that anyone is looking at it — none of which this system
 * can currently support. What it CAN say is true and useful: which of the two
 * failures happened, that the front page is still reachable, and — for a
 * server-side fault — the digest, which is the only handle a reader could give
 * someone that identifies their specific failure.
 */

/** A surface the reader can retry in place. */
export interface RecoverableFailureCopy {
  eyebrow: string;
  heading: string;
  body: string;
  retry: string;
  home: string;
}

/** A surface with nothing to retry — the address was simply wrong. */
export interface NavigableFailureCopy {
  eyebrow: string;
  heading: string;
  body: string;
  home: string;
}

export interface FailureCopy {
  /** `app/error.tsx` — a route segment threw; the shell is intact. */
  error: RecoverableFailureCopy;
  /** `app/not-found.tsx` — no route matched. Not a fault. */
  notFound: NavigableFailureCopy;
  /** `app/global-error.tsx` — the root layout itself failed. */
  globalError: RecoverableFailureCopy;
  /** Label for the error digest, the reader's only handle on their own failure. */
  referenceLabel: string;
}

const en: FailureCopy = {
  error: {
    eyebrow: 'Error',
    heading: 'This page could not be displayed.',
    body: 'Something went wrong on our side while building this page. Trying again often works. If it does not, the front page is still available.',
    retry: 'Try again',
    home: 'Go to the front page',
  },
  /*
    DELIBERATELY NOT AN ERROR. A 404 is an answer, not a fault, and telling the
    reader that something broke would be false as well as alarming.
  */
  notFound: {
    eyebrow: 'Not found',
    heading: 'That page does not exist.',
    body: 'The address may be mistyped, or the page may have moved. Nothing has gone wrong \u2014 there is simply no page at this address.',
    home: 'Go to the front page',
  },
  globalError: {
    eyebrow: 'Error',
    heading: 'GlobalNews AI could not start.',
    body: 'A fault stopped the application before it could load. Reloading often works. If it does not, please try again in a little while.',
    retry: 'Reload',
    home: 'Go to the front page',
  },
  referenceLabel: 'Reference',
};

const pl: FailureCopy = {
  error: {
    eyebrow: 'B\u0142\u0105d',
    heading: 'Nie uda\u0142o si\u0119 wy\u015bwietli\u0107 tej strony.',
    body: 'Co\u015b posz\u0142o nie tak po naszej stronie podczas budowania tej strony. Ponowna pr\u00f3ba zwykle pomaga. Je\u015bli nie, strona g\u0142\u00f3wna jest nadal dost\u0119pna.',
    retry: 'Spr\u00f3buj ponownie',
    home: 'Przejd\u017a na stron\u0119 g\u0142\u00f3wn\u0105',
  },
  notFound: {
    eyebrow: 'Nie znaleziono',
    heading: 'Taka strona nie istnieje.',
    body: 'Adres mo\u017ce zawiera\u0107 liter\u00f3wk\u0119 albo strona zosta\u0142a przeniesiona. Nic si\u0119 nie zepsu\u0142o \u2014 pod tym adresem po prostu nie ma strony.',
    home: 'Przejd\u017a na stron\u0119 g\u0142\u00f3wn\u0105',
  },
  globalError: {
    eyebrow: 'B\u0142\u0105d',
    heading: 'Nie uda\u0142o si\u0119 uruchomi\u0107 GlobalNews AI.',
    body: 'Awaria zatrzyma\u0142a aplikacj\u0119, zanim zd\u0105\u017cy\u0142a si\u0119 wczyta\u0107. Ponowne wczytanie zwykle pomaga. Je\u015bli nie, spr\u00f3buj ponownie za jaki\u015b czas.',
    retry: 'Wczytaj ponownie',
    home: 'Przejd\u017a na stron\u0119 g\u0142\u00f3wn\u0105',
  },
  referenceLabel: 'Identyfikator',
};

/**
 * The SAME fallback rule `getDictionary` applies, for the same reason: a
 * LanguageCode without a real translation here is, by construction, not in
 * ACTIVE_LANGUAGES and cannot be selected in the UI. English is a defensive
 * default, never a claim that another language is translated.
 */
const FAILURE_COPY: Partial<Record<LanguageCode, FailureCopy>> = { en, pl };

export function getFailureCopy(language: LanguageCode): FailureCopy {
  return FAILURE_COPY[language] ?? en;
}

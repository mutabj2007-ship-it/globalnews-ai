import type { DisplayLocale } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * STAGE 2 · T5 PART B — PRE-LOGIN GUEST-DATA / CONSENT COPY (CATALOGUE NAMESPACE `consent`)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * EVERY VALUE HERE IS A DRAFT: `PENDING_PO_LEGAL_APPROVAL` (see CONSENT_KEY_STATES). English and
 * Polish are engineering drafts that describe only what the code measurably does
 * (docs/convergence/stage2/T5-CONSENT-GUEST-TRIAL.md §1.1). French, German, Spanish, Portuguese
 * and Arabic are deliberately ABSENT — no machine translation, no invented legal wording. The T2
 * coverage measurement (qualification/i18n/catalogueCoverage.ts, namespace `consent`) therefore
 * counts every key as a gap in fr/de/es/pt/ar, and every surface using this namespace renders the
 * declared English fallback with the T2 notice (`DisplayLocaleNotice`) in those locales.
 *
 * NUMBERS ARE NEVER LITERALS. `{allowance}`, `{lifetimeDays}`, `{purgeGraceH}`, `{expiresAt}`,
 * `{purgeAfter}`, `{remaining}`, `{cooldownUntil}` are filled from `GET /ask-v2/guest/status`
 * (`policy`, `session`) by `fillConsent`. Before status is known (server render, Ask V2 off, no
 * network) the components fill them from GUEST_POLICY_BOUNDS — the hard CODE bounds (3 answers is
 * a constant; the lifetime is capped at 168 h; the grace at 72 h) — and the sentences are worded
 * "at most" / "within" so they are true for every valid configuration.
 *
 * THERE IS NO CONSENT BANNER AND NO "ACCEPT ALL": the product sets no optional storage (Part A
 * §3.1, §4.1), so there is nothing to consent to. These are notices, not consent prompts.
 */

export type ConsentLocale = 'en' | 'pl';
export const CONSENT_LOCALES: readonly ConsentLocale[] = ['en', 'pl'];

const en = {
  footer: {
    cookies: 'Cookies',
  },
  guest: {
    heading: 'Your guest data',
    intro:
      'You can use Ask without an account. This is exactly what happens to what you send as a guest.',
    questions:
      'Without signing in you can get {allowance} answers. A question we cannot answer does not use one of them.',
    cookie:
      'Your first guest question sets a guest cookie (gna_guest) and a security cookie (gna_csrf). The guest session lasts at most {lifetimeDays} days from that moment and is never extended — not by using Ask and not by signing in.',
    storage:
      'Your guest questions and answers are stored on our servers, not only in your browser, until the guest session ends. They are then deleted automatically within about {purgeGraceH} hours. This guest clean-up runs whenever the service is running and does not depend on any other setting.',
    claim:
      '“Sign in to continue” moves all guest conversations from this browser to your account, not only the one you were in. Guest answers you have left do not carry over.',
    plainSignIn:
      'Signing in any other way moves nothing. Guest conversations stay with this browser, are not added to your account, and are visible again in this browser after you sign out, until they are deleted. On a shared device, delete them before you leave.',
    deleteNow:
      'You can delete your guest conversations from this browser at any time with “Delete my guest data now”. It deletes them from our servers immediately and removes both guest cookies. The daily network counters that limit abuse of free questions hold no questions or answers and are kept for their own period.',
  },
  panel: {
    loading: 'Checking this browser for guest data…',
    unavailable: 'Guest information for this browser cannot be shown right now.',
    signedIn:
      'You are signed in, so guest controls are not shown. If you used Ask as a guest in this browser before signing in, sign out to see or delete that guest data.',
    none: 'This browser has no active guest session. An ended guest session is deleted automatically within about {purgeGraceH} hours.',
    active:
      'This browser has a guest session. It ends on {expiresAt}; its conversations are deleted automatically from {purgeAfter}.',
  },
  quota: {
    remaining: '{remaining} of {allowance} guest answers left',
    exhausted: 'All {allowance} guest answers used',
    cooldown: 'Guest questions are paused until {cooldownUntil}',
  },
  forget: {
    action: 'Delete my guest data now',
    confirm: 'Delete every guest conversation from this browser? This cannot be undone.',
    confirmAction: 'Yes, delete',
    cancel: 'Cancel',
    working: 'Deleting…',
    done: 'Your guest data was deleted from our servers and the guest cookies were removed.',
    nothing: 'There was no guest data to delete for this browser.',
    busy: 'An answer is still being prepared. Try again in a minute.',
    failed: 'The deletion did not go through and nothing was changed. Please try again.',
  },
} as const;

type Shape<T> = { readonly [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };
export type ConsentStrings = Shape<typeof en>;

const pl: ConsentStrings = {
  footer: {
    cookies: 'Pliki cookie',
  },
  guest: {
    heading: 'Twoje dane gościa',
    intro:
      'Z Ask możesz korzystać bez konta. Oto dokładnie, co dzieje się z tym, co wysyłasz jako gość.',
    questions:
      'Bez logowania możesz otrzymać {allowance} odpowiedzi. Pytanie, na które nie potrafimy odpowiedzieć, nie zużywa żadnej z nich.',
    cookie:
      'Pierwsze pytanie gościa ustawia plik cookie gościa (gna_guest) i plik cookie zabezpieczający (gna_csrf). Sesja gościa trwa najwyżej {lifetimeDays} dni od tej chwili i nigdy nie jest przedłużana — ani przez korzystanie z Ask, ani przez zalogowanie.',
    storage:
      'Pytania i odpowiedzi gościa są przechowywane na naszych serwerach, a nie tylko w Twojej przeglądarce, do końca sesji gościa. Następnie są automatycznie usuwane w ciągu około {purgeGraceH} godzin. To czyszczenie danych gości działa zawsze, gdy działa usługa, i nie zależy od żadnego innego ustawienia.',
    claim:
      '„Zaloguj się, aby kontynuować” przenosi na Twoje konto wszystkie rozmowy gościa z tej przeglądarki, a nie tylko tę, w której byłeś. Pozostałe odpowiedzi gościa nie przechodzą na konto.',
    plainSignIn:
      'Zalogowanie w inny sposób niczego nie przenosi. Rozmowy gościa zostają w tej przeglądarce, nie są dodawane do Twojego konta i po wylogowaniu znów są w niej widoczne, dopóki nie zostaną usunięte. Na wspólnym urządzeniu usuń je przed odejściem.',
    deleteNow:
      'Rozmowy gościa z tej przeglądarki możesz w każdej chwili usunąć przyciskiem „Usuń teraz moje dane gościa”. Usuwa je to natychmiast z naszych serwerów i usuwa oba pliki cookie gościa. Dzienne liczniki sieciowe ograniczające nadużycia darmowych pytań nie zawierają pytań ani odpowiedzi i są przechowywane przez własny okres.',
  },
  panel: {
    loading: 'Sprawdzamy, czy ta przeglądarka ma dane gościa…',
    unavailable: 'Nie można teraz wyświetlić informacji o danych gościa dla tej przeglądarki.',
    signedIn:
      'Jesteś zalogowany, więc ustawienia gościa nie są wyświetlane. Jeśli przed zalogowaniem korzystałeś z Ask jako gość w tej przeglądarce, wyloguj się, aby zobaczyć lub usunąć te dane gościa.',
    none: 'Ta przeglądarka nie ma aktywnej sesji gościa. Zakończona sesja gościa jest automatycznie usuwana w ciągu około {purgeGraceH} godzin.',
    active:
      'Ta przeglądarka ma sesję gościa. Kończy się {expiresAt}; jej rozmowy są automatycznie usuwane od {purgeAfter}.',
  },
  quota: {
    remaining: 'Pozostało {remaining} z {allowance} odpowiedzi gościa',
    exhausted: 'Wykorzystano wszystkie {allowance} odpowiedzi gościa',
    cooldown: 'Pytania gościa są wstrzymane do {cooldownUntil}',
  },
  forget: {
    action: 'Usuń teraz moje dane gościa',
    confirm: 'Usunąć wszystkie rozmowy gościa z tej przeglądarki? Tego nie można cofnąć.',
    confirmAction: 'Tak, usuń',
    cancel: 'Anuluj',
    working: 'Usuwanie…',
    done: 'Twoje dane gościa zostały usunięte z naszych serwerów, a pliki cookie gościa usunięte.',
    nothing: 'Dla tej przeglądarki nie było danych gościa do usunięcia.',
    busy: 'Odpowiedź jest jeszcze przygotowywana. Spróbuj ponownie za minutę.',
    failed: 'Usuwanie nie powiodło się i nic nie zostało zmienione. Spróbuj ponownie.',
  },
};

export const CONSENT_STRINGS: Readonly<Record<ConsentLocale, ConsentStrings>> = { en, pl };

/** The authored catalogue for a display locale — `undefined` where no approved draft exists. */
export function authoredConsentStrings(locale: DisplayLocale): ConsentStrings | undefined {
  return (CONSENT_STRINGS as Partial<Record<DisplayLocale, ConsentStrings>>)[locale];
}

/** Copy for an EFFECTIVE (T2-resolved) en/pl locale. */
export function consentStrings(locale: ConsentLocale): ConsentStrings {
  return CONSENT_STRINGS[locale];
}

/**
 * Footer link labels this catalogue owns (T5 Part B, D10). Not in `dict.footer.linkLabels`:
 * `dict.footer` is projected into H's protected Ask-shell catalogue, so a new key there would
 * make the fr–ar Ask catalogues incomplete and break H's manifest equality.
 */
export function consentFooterLinkLabels(locale: ConsentLocale): Readonly<Record<string, string>> {
  return { '/cookies': CONSENT_STRINGS[locale].footer.cookies };
}

/**
 * The hard code bounds used before the server's configured policy is known. Each is a CEILING
 * the backend enforces (guest-trial.config.ts), so a sentence filled with it stays true for every
 * valid configuration: GUEST_ANSWER_ALLOWANCE = 3 (a constant), GUEST_SESSION_MAX_LIFETIME_H =
 * 168, ASK_GUEST_PURGE_GRACE_H max 72.
 */
export const GUEST_POLICY_BOUNDS = {
  allowance: 3,
  sessionLifetimeH: 168,
  purgeGraceH: 72,
} as const;

/** Replace `{name}` placeholders; an unknown placeholder is left visible (never silently empty). */
export function fillConsent(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : whole,
  );
}

/* ─────────────────────────── approval metadata ─────────────────────────── */

export type LegalApprovalState = 'PENDING_PO_LEGAL_APPROVAL';

function leafPaths(tree: unknown, prefix = ''): string[] {
  if (tree === null || typeof tree !== 'object') return [prefix];
  return Object.entries(tree as Record<string, unknown>).flatMap(([k, v]) =>
    leafPaths(v, prefix === '' ? k : `${prefix}.${k}`),
  );
}

/** Every `consent` key, en and pl: a draft awaiting Product Owner / legal approval. */
export const CONSENT_KEY_STATES: Readonly<Record<string, LegalApprovalState>> = Object.freeze(
  Object.fromEntries(leafPaths(en).map((key) => [key, 'PENDING_PO_LEGAL_APPROVAL' as const])),
);

/**
 * Legal sentences OUTSIDE this namespace that T5 Part B changed (the Privacy Notice lives in the
 * main dictionary, `privacyPage`). Each stays a draft until the Product Owner / legal approve it;
 * the dossier (T5 §Part B) lists the same entries.
 */
export const LEGAL_COPY_PENDING_APPROVAL: ReadonlyArray<{
  readonly catalogue: string;
  readonly key: string;
  readonly locales: readonly ConsentLocale[];
  readonly state: LegalApprovalState;
  readonly reason: string;
}> = Object.freeze([
  {
    catalogue: 'frontend/src/lib/i18n/dictionaries/{en,pl}.ts',
    key: 'privacyPage.lastUpdatedDate',
    locales: ['en', 'pl'],
    state: 'PENDING_PO_LEGAL_APPROVAL',
    reason: 'The notice text changed (T5 Part B).',
  },
  {
    catalogue: 'frontend/src/lib/i18n/dictionaries/{en,pl}.ts',
    key: 'privacyPage.sections[Using Ask without an account].body',
    locales: ['en', 'pl'],
    state: 'PENDING_PO_LEGAL_APPROVAL',
    reason:
      'D6 (several guest conversations, not one), D8 (plain sign-in moves nothing), the guest delete action, and the network-identifier deletion now stated as dependent on the retention clean-up.',
  },
  {
    catalogue: 'frontend/src/lib/i18n/dictionaries/{en,pl}.ts',
    key: 'privacyPage.sections[Your choices].body',
    locales: ['en', 'pl'],
    state: 'PENDING_PO_LEGAL_APPROVAL',
    reason: 'Adds the guest delete action.',
  },
  {
    catalogue: 'frontend/src/lib/i18n/dictionaries/{en,pl}.ts',
    key: 'privacyPage.sections[How long information is kept].body',
    locales: ['en', 'pl'],
    state: 'PENDING_PO_LEGAL_APPROVAL',
    reason:
      'D2: separates what the always-on guest clean-up guarantees from the periods that need the scheduled retention clean-up (RETENTION_SWEEP_ENABLED, off by default).',
  },
]);

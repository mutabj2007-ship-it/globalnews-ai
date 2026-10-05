import { FailureSurface } from '@/components/layout/FailureSurface';
import { getFailureCopy } from '@/lib/i18n/failureCopy';
import { surfaceLocale } from '@/lib/i18n/displayLocale.server';

/**
 * MVP FAILURE FLOOR — NO ROUTE MATCHED.
 *
 * ── THIS ONE IS A SERVER COMPONENT, AND THAT IS THE WHOLE POINT ───────────
 *
 * Unlike the two error boundaries, a 404 is not a fault: nothing threw, so
 * this file has no `reset` to hold and needs no `'use client'`. That buys the
 * thing the boundaries cannot have — `cookies()` — so the correct language is
 * chosen on the SERVER and the reader never sees an English frame first.
 *
 * T2 — the language comes from the one display-locale authority
 * (`surfaceLocale('failure')`): the stored choice validated against the seven
 * display locales and resolved by the effective-locale rule, the same rule
 * `app/layout.tsx` uses for <html lang>. Surfaces that disagreed about the
 * locale would be a bug nobody would find quickly.
 *
 * ── AND IT DOES NOT APOLOGIZE ─────────────────────────────────────────────
 *
 * There is NO retry control, because there is nothing to retry — the address
 * is simply not one we have. The copy says exactly that and explicitly denies
 * that anything is broken, because a reader who mistypes a URL should not be
 * told the product failed. The only action offered is the way home.
 */
export default function NotFound(): JSX.Element {
  const language = surfaceLocale('failure').language;

  const copy = getFailureCopy(language);

  return (
    <FailureSurface
      eyebrow={copy.notFound.eyebrow}
      heading={copy.notFound.heading}
      body={copy.notFound.body}
      homeLabel={copy.notFound.home}
      referenceLabel={copy.referenceLabel}
    />
  );
}

import type { Metadata } from 'next';
import type { JSX } from 'react';
import { cookies } from 'next/headers';
import { ScriptRun } from '@/lib/typography/runBoundary';
import { LANGUAGE_COOKIE_NAME, SELECTABLE_LOCALES, isActiveLanguageCode } from '@/lib/i18n/languages';
import { ElectionPreviewScreen } from '@/components/election/ElectionPreviewScreen';
import type { ElectionLocale } from '@/lib/election/electionStrings';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ELECTION INTELLIGENCE — PROVIDER-FREE PREVIEW, COMPACT. NOT `/election`.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * **`/election`, not `/kenya-elections`.** The route is named for the DOMAIN —
 * `SpecialistDomainId.ELECTION` — and **Kenya is the first reference
 * implementation, not the domain**, which is Master Authority verbatim. A route
 * named for the country would bake the reference implementation into the
 * address.
 *
 * **`/election` is not opened in this round and may not be**, and the reason is
 * recorded in code beside the four conditions, in
 * `lib/election/electionPreview.ts` — `ELECTION_LIVE_ROUTE_GATE`. The blocker
 * is rights, not availability.
 *
 * **NOINDEX UNCONDITIONALLY.** Preview routes are `noindex` whatever activation
 * rules later say about the live route.
 *
 * ── ZERO PROVIDER, ZERO MODEL, ZERO TILE ─────────────────────────────────
 *
 * The module graph reachable from this file performs no fetch. It reads one
 * cookie on the server and renders. No GNews, no OpenAI, no IEBC, no map tile
 * and no geometry of any kind — on load or on any interaction this page offers.
 *
 * ── AND NOTHING KENYAN IS BOUND ──────────────────────────────────────────
 *
 * No Kenyan subject, no real candidate, no real party, no real figure. *"A
 * screenshot of a preview election surface carrying real Kenyan names and
 * fixture numbers is an invented election result, and it will outlive the
 * explanation attached to it."*
 *
 * **This module is DELETED when `/election` opens. It is not inherited by it.**
 *
 * ── THE SAME FOUR REGIONS, IN THE SAME ORDER ─────────────────────────────
 *
 * This route renders the SAME component as the desktop route with `compact`
 * set. There is no second region list, so compact cannot drop or reorder a
 * region — and *"a status qualifier or a denominator is not an optional element
 * a narrow viewport may shed."*
 *
 * **D-1 · no chrome is added here.** `COMPACT_CHROME_HARD_MAX` is the sum of
 * the top bar and the change strip, derived in code, so the budget is spent by
 * construction. Everything this route adds is content and it scrolls.
 */
export const metadata: Metadata = {
  title: 'Election Intelligence — provider-free preview (compact)',
  robots: { index: false, follow: false },
};

/** The platform locale mechanism, not a second one. EN/PL, the established baseline. */
function electionLocale(): ElectionLocale {
  const cookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const active = cookie && isActiveLanguageCode(cookie) ? cookie : 'en';
  const selectable = SELECTABLE_LOCALES.find((l) => l === active) ?? 'en';
  return selectable === 'pl' ? 'pl' : 'en';
}

export default function ElectionVisualPreviewCompactPage(): JSX.Element {
  const locale = electionLocale();
  return (
    <ScriptRun locale={locale} step="wrapping" as="div">
      <main style={{ minHeight: '100vh' }}>
        <ElectionPreviewScreen locale={locale} compact={true} />
      </main>
    </ScriptRun>
  );
}

import type { Metadata } from 'next';
import type { JSX } from 'react';
import { cookies } from 'next/headers';
import { ScriptRun } from '@/lib/typography/runBoundary';
import { LANGUAGE_COOKIE_NAME, SELECTABLE_LOCALES, isActiveLanguageCode } from '@/lib/i18n/languages';
import { DeliveryPreviewScreen } from '@/components/delivery/DeliveryPreviewScreen';
import type { DeliveryLocale } from '@/lib/delivery/deliveryStrings';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * DELIVERY INTELLIGENCE — PROVIDER-FREE PREVIEW, COMPACT. NOT `/delivery`.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * **`/delivery`, not `/imihigo`.** The domain is `DELIVERY`; **Imihigo is
 * Rwanda's first reference implementation of it, not the domain** — Master
 * Authority, verbatim. A route named `/imihigo` would bake the reference
 * implementation into the address and would have to be renamed the day a second
 * country's delivery programme arrives.
 *
 * **`/delivery` is not opened in this round and may not be until two conditions
 * hold** — `DISTRICT` producible, and a governed sensitive-class registry.
 * Both are recorded in code at `DELIVERY_LIVE_ROUTE_GATE`, where the next
 * person will find them.
 *
 * **NOINDEX UNCONDITIONALLY.**
 *
 * ── ZERO PROVIDER, ZERO MODEL, ZERO TILE ─────────────────────────────────
 *
 * The module graph reachable from this file performs no fetch and imports no
 * map. No geometry is drawn, because none is held.
 *
 * **This module is DELETED when `/delivery` opens. It is not inherited by it.**
 *
 * ── THE SAME FOUR REGIONS, IN THE SAME ORDER ─────────────────────────────
 *
 * This route renders the SAME component as the desktop route with `compact`
 * set, so there is no second region list that could drop or reorder one.
 *
 * **D-1 · no chrome is added here.** The compact budget is spent by
 * construction; everything this route adds is content and it scrolls.
 */
export const metadata: Metadata = {
  title: 'Delivery Intelligence — provider-free preview (compact)',
  robots: { index: false, follow: false },
};

function deliveryLocale(): DeliveryLocale {
  const cookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const active = cookie && isActiveLanguageCode(cookie) ? cookie : 'en';
  const selectable = SELECTABLE_LOCALES.find((l) => l === active) ?? 'en';
  return selectable === 'pl' ? 'pl' : 'en';
}

export default function DeliveryVisualPreviewCompactPage(): JSX.Element {
  const locale = deliveryLocale();
  return (
    <ScriptRun locale={locale} step="wrapping" as="div">
      <main style={{ minHeight: '100vh' }}>
        <DeliveryPreviewScreen locale={locale} compact={true} />
      </main>
    </ScriptRun>
  );
}

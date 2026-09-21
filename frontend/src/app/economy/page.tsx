import type { Metadata } from 'next';
import { BetaCategoryPage } from '@/components/beta/BetaCategoryPage';

/**
 * BETA-SIMPLE-ASK-SAND-1 §15/§17/§21 — the public /economy route.
 *
 * §17 asks for ONE reusable template, not five category frontends, so
 * this file is deliberately a thin route shell: metadata plus a call
 * to the shared BetaCategoryPage. Any change to how a category
 * surface looks or behaves belongs in that component, where it
 * applies to all five at once.
 *
 * Indexable, unlike /ask (§21): this is stored public intelligence
 * with a stable URL, which is exactly what §21 lists as a real public
 * route.
 */
export const metadata: Metadata = {
  title: 'Economy — GlobalNews AI',
  description:
    'Current economy developments, drawn from retrieved and cited sources.',
};

/**
 * ?country= scopes the surface to one geography, reusing the same
 * parameter name the map already uses so a link between the two
 * carries geography without translation.
 */
export default async function EconomyPage({
  searchParams,
}: {
  searchParams?: { country?: string };
}): Promise<JSX.Element> {
  return <BetaCategoryPage category="economy" countryCode={searchParams?.country} />;
}

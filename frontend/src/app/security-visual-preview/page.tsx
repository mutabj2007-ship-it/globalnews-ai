import { DomainEvidenceStatus } from '@/components/evidence/DomainEvidenceStatus';
import type { Metadata } from 'next';
import type { JSX } from 'react';
import { cookies } from 'next/headers';
import { ScriptRun } from '@/lib/typography/runBoundary';
import { LANGUAGE_COOKIE_NAME, SELECTABLE_LOCALES, isActiveLanguageCode } from '@/lib/i18n/languages';
import type { SecLocale } from '@/lib/security/securityStrings';
import { SecurityScreen } from '@/components/security/SecurityScreen';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * SECURITY — ALPHA PRODUCT OWNER VISUAL PREVIEW. NOT A GOVERNED ROUTE.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Main's zone authority names this address and its terms: `noindex`, **no
 * `intelligenceModules.ts` home card** because *"a card on the home surface asserts the
 * product exists"*, and *"reuses the eventual Part IX components — the preview is the
 * component tree with `SEC_NOT_ASSESSED` passed in. Deleting the preview route deletes
 * nothing the product needs. There is no second dashboard, and no component exists only for
 * the preview."*
 *
 * That last clause is the design constraint that shaped the component tree: every component
 * `SecurityScreen` mounts is one the governed route will mount, and none of them takes a
 * "preview" flag. The preview is an address, not a mode.
 *
 * ── THE TRIPWIRE ──────────────────────────────────────────────────────────
 *
 * Main: *"a spec asserting `frontend/src/app/security` does not exist. Measured today on
 * both candidate branches: `app/security` = 0. The tripwire is satisfied on arrival and its
 * job is to stay that way until a governed route is authorized."*
 *
 * `securityVisualFrame.spec.ts` carries it, alongside the assertion that this preview is
 * noindex and absent from the module registry.
 *
 * ── ZERO PROVIDERS, ZERO METERED AI ───────────────────────────────────────
 *
 * The module graph reachable from here performs no fetch. One cookie is read on the server
 * and the page renders. Main's rule 5 is stricter than "no calls on load" and this frame
 * meets it: *"zero metered AI anywhere in the frame — on load, hover, pan, sort, filter,
 * tab, selection, resize, popup, drawer or detent. Controls render; they do not invoke."*
 * Every control on the surface is an `aria-disabled` button with no handler.
 */
export const metadata: Metadata = {
  title: 'Security Intelligence — Alpha visual preview',
  robots: { index: false, follow: false },
};

function securityLocale(): SecLocale {
  const cookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const active = cookie && isActiveLanguageCode(cookie) ? cookie : 'en';
  return SELECTABLE_LOCALES.find((l) => l === active) ?? 'en';
}

export default function SecurityVisualPreviewPage(): JSX.Element {
  const locale = securityLocale();
  return (
    <ScriptRun locale={locale} step="wrapping" as="div">
      <div className="min-h-screen bg-sp-bg">
        <DomainEvidenceStatus domain="security" locale={locale}><SecurityScreen locale={locale} /></DomainEvidenceStatus>
      </div>
    </ScriptRun>
  );
}

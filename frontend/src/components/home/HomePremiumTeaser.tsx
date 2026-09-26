import type { JSX } from 'react';
import { Crown } from 'lucide-react';

import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { PREMIUM_TEASER_SHELL, PREMIUM_TEASER_CTA } from '@/components/home/homePresentation';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * GO FURTHER — THE COMPACT PREMIUM TEASER, BELOW `lg`
 * ════════════════════════════════════════════════════════════════════════════
 *
 * C10, as ruled:
 *
 *   "Do not force the desktop premium card beside/over the phone globe.
 *    Preserve the R4.1/R5.1 phone Hero hierarchy ... `Go further with
 *    GlobalNewsAI` must still exist on phone, but as a compact full-width
 *    premium teaser lower in the Home flow, not competing with the phone Hero.
 *    Place it: after Explore by topic and before How It Works."
 *
 * ── WHY THIS IS A SEPARATE COMPONENT AND NOT THE SAME CARD RESTYLED ─────
 *
 * Because it is a different thing. The hero card is a four-line capability
 * list; this is one sentence and a control. Rendering the same component twice
 * with responsive visibility would put `id="beta-premium-heading"` in the
 * document twice, which is an accessibility defect whatever CSS says about
 * which copy is painted. Two components, two ids, one visible at any width.
 *
 * ── VIOLET, NOT GOLD, AND WHY THAT IS NOT A DRIFT ───────────────────────
 *
 * The same ruling: "Premium remains violet/tier language; do not turn it into
 * a gold-payment motif." The hero card keeps the gold the Product Owner
 * prototype draws at desktop, because that prototype is the controlling
 * desktop composition. Below `lg` there is no prototype gold to preserve, and
 * the instruction is explicit, so the teaser is the product's tier violet.
 *
 * ── WHAT IT CANNOT DO ───────────────────────────────────────────────────
 *
 * "No price, checkout, credit balance or active paid claim."
 *
 * There is no plans route in this product, so the control is a real
 * `<button disabled>` whose own label says it is not open yet — the browser
 * refuses the press, it is out of the tab order, and `cursor-not-allowed`
 * reports the same fact to the pointer. Nothing here can start a purchase,
 * because there is nothing here to press. The closing note is the governed
 * string that already tells the reader this page charges them nothing.
 */
interface HomePremiumTeaserProps {
  language?: LanguageCode;
}

export function HomePremiumTeaser({ language = 'en' }: HomePremiumTeaserProps): JSX.Element {
  const t = getDictionary(language).betaHome;

  return (
    <aside
      aria-labelledby="beta-premium-teaser-heading"
      className={`${PREMIUM_TEASER_SHELL} relative overflow-hidden p-[17px] lg:hidden`}
    >
      {/* The tier bloom, in violet rather than the desktop card's gold. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_72%_62%_at_6%_2%,rgba(139,110,255,0.22),transparent_64%)]"
      />

      <div className="relative flex items-start gap-3">
        <Crown
          size={26}
          strokeWidth={1.9}
          aria-hidden="true"
          className="mt-[1px] shrink-0 text-[#c4b5fd] drop-shadow-[0_0_12px_rgba(167,139,250,0.7)]"
        />
        <div className="min-w-0">
          <h2
            id="beta-premium-teaser-heading"
            className="text-[16px] font-bold leading-[1.2] text-white"
          >
            {t.premiumTitle}
          </h2>
          {/*
            One short line instead of the hero card's four. It is the first
            capability string, which is governed copy in both languages, so the
            teaser cannot say anything the full card does not also say.
          */}
          <p className="mt-[5px] text-[13px] leading-[1.4] text-[#b3aee0]">{t.premiumCap1}</p>
        </div>
      </div>

      <div className="relative mt-4">
        <button type="button" disabled aria-disabled="true" tabIndex={-1} className={PREMIUM_TEASER_CTA}>
          {t.premiumCta}
        </button>
      </div>

      <p className="relative mt-3 text-[11.5px] leading-snug text-[#8b86bb]">{t.premiumNote}</p>
    </aside>
  );
}

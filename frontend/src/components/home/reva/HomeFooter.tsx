import type { JSX } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { footerLinkGroups } from '@/lib/homeContent';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * HOME REV A — THE FOOTER (legal / support layer; CTO §4, REV_A_DELTA row 9).
 *
 * One quiet row beside the rail: identity, the legal/support links, and the
 * Beta mark. Links come from the ONE existing list (`footerLinkGroups`) with
 * the existing localized labels, so Home and every other page link the same
 * real routes. The shared `Footer` is unchanged on every other page; Home uses
 * this lighter row because the Rev A footer sits in the content column beside
 * the product rail, where the shared footer's full-width composition squeezes.
 *
 * About and Methodology are in the Rev A list but have no route yet. They are
 * NOT invented here (reported as a gap); the Trust section's methodology link
 * goes to the Source Policy page, which is where the methodology is written.
 */
export function HomeFooter({ language }: { language: LanguageCode }): JSX.Element {
  const t = getDictionary(language).footer;
  const links = footerLinkGroups.flatMap((group) => group.links);
  return (
    <footer data-home-footer="" className="mx-auto w-full max-w-[1600px] px-4 pb-28 md:px-10 lg:pb-10 gn-xl:px-12">
      <div className="flex flex-col gap-3 border-t border-[#0f2a45] pt-6 md:flex-row md:flex-wrap md:items-center md:gap-x-8">
        <span className="font-display text-[15px] font-bold text-white">GlobalNews AI</span>
        <nav aria-label={t.navigationAriaLabel} className="min-w-0 flex-1">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {links.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="inline-flex min-h-[44px] items-center text-[13px] text-[#a8bdd3] hover:text-white md:min-h-[32px]">
                  {t.linkLabels[link.href] ?? link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <span className="text-[12.5px] text-[#7890a9]">GlobalNews AI Beta · © {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}

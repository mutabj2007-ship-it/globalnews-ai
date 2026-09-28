import type { JSX } from 'react';
import { ArrowRight, Clock, FileText, Link2, Sparkles, Users, type LucideIcon } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * HOME REV A — HOW IT WORKS + BUILT ON TRUST (CTO §13).
 *
 * Both stay REAL Home body sections before the footer (never folded into the
 * rail or footer) and carry crawlable text. Copy avoids the contract's
 * unsupported claims (all sources, always live, complete coverage,
 * continuously updated, perfectly neutral) — which is also why the retired
 * Trust principle "Live updates" is gone.
 *
 * Methodology: there is no /methodology route; the existing Source Policy
 * page is the methodology (where information comes from, how sources are
 * compared, how AI analysis is marked and checked), so the link goes there.
 */
export const METHODOLOGY_HREF = '/source-policy';

const TRUST_ICONS: readonly LucideIcon[] = [Link2, Users, Sparkles, Clock, FileText];

export function HomeHowItWorks({ language }: { language: LanguageCode }): JSX.Element {
  const t = getDictionary(language).homeReva.how;
  return (
    <section id="how-it-works" aria-labelledby="home-how-heading" data-home-how="" className="scroll-mt-24">
      <h2 id="home-how-heading" className="font-display text-[22px] font-bold text-white md:text-[26px]">
        {t.title}
      </h2>
      <ol className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {t.steps.map((step, index) => (
          <li key={step.title} className="flex items-start gap-3 rounded-[12px] border border-[#15314f] bg-[#061527] p-4">
            <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#2f6ea8] text-[13px] font-bold text-[#8fd3ff]">
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold text-white">{step.title}</span>
              <span className="mt-1 block text-[13px] leading-snug text-[#93a9c2]">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HomeBuiltOnTrust({ language }: { language: LanguageCode }): JSX.Element {
  const t = getDictionary(language).homeReva.trust;
  return (
    <section id="built-on-trust" aria-labelledby="home-trust-heading" data-home-trust="" className="scroll-mt-24 rounded-[14px] border border-[#15314f] bg-[#061527] p-5 md:p-6">
      <h2 id="home-trust-heading" className="font-display text-[22px] font-bold text-white md:text-[26px]">
        {t.title}
      </h2>
      <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-[#c2d3e6]">{t.intro}</p>
      <ul className="mt-5 grid grid-cols-2 gap-x-5 gap-y-5 md:grid-cols-3 lg:grid-cols-5">
        {t.principles.map((principle, index) => {
          const Icon = TRUST_ICONS[index] ?? FileText;
          return (
            <li key={principle.title} className="min-w-0">
              <Icon aria-hidden="true" className="h-5 w-5 text-[#5abff5]" />
              <span className="mt-2 block text-[14px] font-bold text-white">{principle.title}</span>
              <span className="mt-1 block text-[12.5px] leading-snug text-[#93a9c2]">{principle.body}</span>
            </li>
          );
        })}
      </ul>
      <a
        href={METHODOLOGY_HREF}
        className="mt-5 inline-flex min-h-[44px] items-center gap-2 text-[14px] font-semibold text-[#5abff5] hover:text-[#8fd3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5]"
      >
        {t.methodology}
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </a>
    </section>
  );
}

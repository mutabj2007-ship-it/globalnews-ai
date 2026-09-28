import type { JSX } from 'react';
import {
  ArrowRight,
  Building2,
  CandlestickChart,
  Globe2,
  HeartHandshake,
  Landmark,
  LineChart,
  Shield,
  Vote,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { RESOLVED_DOMAINS, SPECIALIST_LINKS, type ExploreDomainKey } from './homeRevaModel';

/**
 * HOME REV A — EXPLORE INTELLIGENCE (CTO §9, CARD_ARROW_RULE.md).
 *
 * Seven PRODUCT cards, each a whole-card link whose text is its name and its
 * one crawlable line. Every card carries its OWN circular arrow in its
 * lower-right corner: 40 px on tablet/desktop, a 26 px outline arrow on phone;
 * domain-accent border and icon on #041426; visible without hover; no
 * animation; aria-hidden (the link text already describes the destination).
 *
 * Layout: 7 columns when the content column is ≥1000 px, else 4 + 3
 * (container query); phone: a horizontal rail of 150 px tiles.
 * "Preview" is shown only while a domain has just a *-visual-preview route.
 * No KPI, count or live state is invented. The What's-happening story rail's
 * Previous/Next controls are a different system and never mix with these.
 */
const ICONS: Record<ExploreDomainKey, LucideIcon> = {
  world: Globe2,
  politics: Landmark,
  economy: LineChart,
  energy: Zap,
  security: Shield,
  humanitarian: HeartHandshake,
  markets: CandlestickChart,
};

export function ExploreIntelligence({ language }: { language: LanguageCode }): JSX.Element {
  const t = getDictionary(language).homeReva.explore;

  return (
    <section id="intelligence-modules" aria-labelledby="home-explore-heading" data-home-explore="" className="scroll-mt-24 [container-type:inline-size]">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="home-explore-heading" className="font-display text-[22px] font-bold text-white md:text-[26px]">
          {t.title}
        </h2>
        <p className="text-[13.5px] text-[#8ca3bd]">{t.note}</p>
      </div>

      <ul className="-mx-4 mt-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [mask-image:linear-gradient(90deg,#000_88%,transparent)] [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 md:[mask-image:none] [&::-webkit-scrollbar]:hidden [@container(min-width:1000px)]:grid-cols-7">
        {RESOLVED_DOMAINS.map((domain) => {
          if (domain.href === null) return null;
          const Icon = ICONS[domain.key];
          const copy = t.domains[domain.key];
          return (
            <li key={domain.key} className="w-[150px] shrink-0 snap-start md:w-auto">
              <a
                href={domain.href}
                data-home-explore-card={domain.key}
                className="relative flex h-[118px] flex-col rounded-[12px] border border-[#15314f] bg-[#061527] p-3 pb-9 transition-colors hover:border-[#2a5a8c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5] motion-reduce:transition-none md:h-full md:min-h-[124px] md:pb-[58px]"
              >
                <span className="flex items-start justify-between gap-2">
                  <Icon aria-hidden="true" className="h-5 w-5 shrink-0" style={{ color: domain.accent }} />
                  {domain.preview ? (
                    <span className="rounded-[4px] border border-[#3a3326] px-1.5 py-[1px] text-[10px] font-semibold text-[#c9ae86]">{t.preview}</span>
                  ) : null}
                </span>
                <span className="mt-2 block text-[15px] font-bold leading-tight text-white">{copy.name}</span>
                <span className="mt-1 line-clamp-2 block text-[12px] leading-[1.35] text-[#93a9c2]">{copy.line}</span>
                <span
                  aria-hidden="true"
                  data-home-explore-arrow=""
                  className="absolute bottom-[10px] right-[10px] inline-flex h-[26px] w-[26px] items-center justify-center rounded-full border md:h-10 md:w-10"
                  style={{ borderColor: domain.accent, color: domain.accent, backgroundColor: '#041426' }}
                >
                  <ArrowRight className="h-[14px] w-[14px] md:h-5 md:w-5" strokeWidth={2.2} />
                </span>
              </a>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]" data-home-specialists="">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#56708e]">{t.specialists}</span>
        <a href={SPECIALIST_LINKS.elections.href} className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-[#8fd3ff] hover:text-white md:min-h-[32px]">
          <Vote aria-hidden="true" className="h-4 w-4" />
          {t.elections}
          <span className="rounded-[4px] border border-[#3a3326] px-1.5 py-[1px] text-[10px] font-semibold text-[#c9ae86]">{t.preview}</span>
        </a>
        <a href={SPECIALIST_LINKS.imihigo.href} className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-[#8fd3ff] hover:text-white md:min-h-[32px]">
          <Building2 aria-hidden="true" className="h-4 w-4" />
          {t.imihigo} · {t.rwanda}
        </a>
      </p>
    </section>
  );
}

import type { JSX } from 'react';
import { Brain } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * HOME REV A — DEEP INTELLIGENCE, LOW PROMINENCE (CTO §12, D6).
 *
 * A neutral row, not a hero premium card. Truthful status "Not in Beta", with
 * the ONE restrained violet tier-boundary edge on its tag (VISUAL_SPEC colour
 * semantics). No price, no credits, no plans link, no gold styling, no CTA.
 * It replaces the retired "Go further with GlobalNewsAI / Plans coming soon"
 * card and the phone premium teaser.
 */
export function DeepIntelligenceRow({ language }: { language: LanguageCode }): JSX.Element {
  const t = getDictionary(language).homeReva.deep;
  return (
    <section aria-labelledby="home-deep-heading" data-home-deep="" className="flex items-start gap-3 rounded-[12px] border border-[#15314f] bg-[#061527] px-4 py-3.5 md:items-center md:px-5">
      <Brain aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#8fa6c0] md:mt-0" />
      <div className="min-w-0 flex-1">
        <h2 id="home-deep-heading" className="text-[15px] font-bold text-white">
          {t.title}
        </h2>
        <p className="mt-0.5 text-[13px] leading-snug text-[#93a9c2]">{t.body}</p>
      </div>
      <span className="shrink-0 rounded-[6px] border border-[#8C86EE] px-2 py-[3px] text-[11.5px] font-semibold text-[#d6d3fb]">{t.tag}</span>
    </section>
  );
}

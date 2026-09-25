import type { JSX } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { ASK_CARD_SHELL, ASK_ROW } from '@/components/home/homePresentation';
import { HomepageSituationMap } from '@/components/home/HomepageSituationMap';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * H5 · THE HOME SIDE RAIL
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Issue #29 increment H5, H0 zones Z17, Z18 and Z20. The approved R4.1 Home
 * carries a right-hand rail beside the editorial column — frames
 * `1440x900_01` and `1440x900_03`: a sign-in card for a new reader, the World
 * Pulse map gateway, and an "Ask AI about today" suggestion card.
 *
 * ── WHAT IS HERE, AND WHAT IS DELIBERATELY HELD ─────────────────────────
 *
 * Built: the three zones that are true for every reader and need no account
 * state. Held: Z16 "For you" and Z19 Following chips, which are signed-in
 * surfaces driven by `/api/users/me` and `/api/follows/countries`. Those
 * endpoints are unreachable in the local evidence environment, so building
 * them here would ship a surface whose only states I could not verify. The
 * contract's H8 says to verify account behaviour "against a real backend
 * environment where possible", and Alpha is that environment — so they follow
 * the Product Owner's Alpha review rather than precede it.
 *
 * ── THE SUGGESTIONS ARE REAL PRODUCT COPY, NOT THE FRAMES' SAMPLES ──────
 *
 * The R4.1 frames show "What changed in Poland this week?" and similar. Those
 * are illustrative, and §6 forbids shipping illustrative content as live
 * product. The prompts here are the existing governed `hero.exampleQuestions`
 * catalogue, which already ships in EN and PL.
 *
 * ── AND THEY SPEND NOTHING ──────────────────────────────────────────────
 *
 * Each is a link to `/ask?q=…`, where `AskFrameScreen` stages the value as a
 * draft and runs only on Send — which is what lets the card state, truthfully,
 * that "Nothing runs until you press Send". No client boundary, no handler.
 *
 * ── WORLD PULSE IS EXPLANATORY, NEVER LIVE EVIDENCE ─────────────────────
 *
 * SPEC §7 requires country positions and counts to come from `WorldMap` +
 * `countryStoryCounts` before anything may be presented as coverage. This rail
 * makes no such claim: it shows the same explanatory geography the hero uses,
 * with the approved note directing the reader to `/map` for real country
 * coverage and sources. No sample incident marks, no prototype geography.
 */

interface HomeSideRailProps {
  language?: LanguageCode;
}

export function HomeSideRail({ language = 'en' }: HomeSideRailProps): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.betaHome;
  /* Existing governed product copy — not the review frames' sample prompts. */
  const prompts = dict.hero.exampleQuestions.slice(0, 3);

  return (
    <aside aria-label={t.sideRailAria} className="flex flex-col gap-[13px]">
      {/*
        ── Z5 · THE GLOBAL SITUATION MAP LEADS THE RAIL ─────────────────────
        The Product Owner's desktop prototype puts the map card at the TOP of
        the right column, beside the story rail, with the Ask card beneath it.
        The previous composition had the map in the LEFT column below the
        stories, which is why the band read as one tall editorial column with a
        thin rail beside it rather than as the prototype's two balanced columns.

        The component itself is unchanged. It already reuses /map's own
        `WorldMap` through `next/dynamic({ ssr: false })`, so MapLibre stays out
        of the initial bundle, and it already performs ZERO provider-capable
        country reads on mount or on selection — exploring geography from Home
        still cannot spend quota. Only where it is mounted has changed.

        `pulseTitle`, `pulseNote` and the retired thumbnail treatment stay in
        the dictionary and in git.
      */}
      <HomepageSituationMap language={language} variant="rail" />

      {/* ASK SUGGESTIONS — prefill links, zero spend. */}
      {/*
        §7 — the Ask rail, rebuilt on the sampled surface. Its fill samples
        `#031428`, deliberately DARKER than the map card above it, and its
        prompt rows sample `#12263f` with a `#122840` border — a border one
        step from its own fill, which is what "fewer hard borders" means when
        it is measured rather than judged.
      */}
      <section aria-labelledby="beta-suggested-heading" className={`${ASK_CARD_SHELL} p-[14px]`}>
        <div className="flex items-start gap-2.5">
          <Sparkles
            size={22}
            strokeWidth={1.9}
            aria-hidden="true"
            className="mt-[1px] shrink-0 text-[#a78bfa] drop-shadow-[0_0_10px_rgba(167,139,250,0.55)]"
          />
          <div className="min-w-0">
            <h2 id="beta-suggested-heading" className="text-[15px] font-bold leading-tight text-white">
              {t.suggestedTitle}
            </h2>
            {/* The prototype puts this line directly under the title, not at
                the foot of the card. Same governed string, better placed. */}
            <p className="mt-[3px] text-[12px] leading-[1.35] text-[#8ca3bd]">{t.suggestedNote}</p>
          </div>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {prompts.map((prompt) => (
            <li key={prompt}>
              <a
                href={`/ask?q=${encodeURIComponent(prompt)}`}
                className={`flex min-h-[44px] items-center gap-2 px-[11px] py-2 text-left text-[12.5px] text-white/95 lg:min-h-[32px] ${ASK_ROW} transition-colors hover:bg-[#17304e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none`}
              >
                <span className="line-clamp-1 flex-1">{prompt}</span>
                <ArrowRight size={15} strokeWidth={2} aria-hidden="true" className="shrink-0 text-white/60" />
              </a>
            </li>
          ))}
        </ul>
      </section>

    </aside>
  );
}

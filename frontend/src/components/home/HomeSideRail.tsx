import type { JSX } from 'react';
import { Sparkles, PenLine } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
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
    <aside aria-label={t.sideRailAria} className="flex flex-col gap-4">
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
      <section aria-labelledby="beta-suggested-heading" className="rounded-[18px] border-[1.5px] border-white/[0.13] bg-gradient-to-b from-[#0e1a2a] to-[#080f1b] p-4 shadow-[0_14px_34px_-22px_rgba(0,0,0,0.95)]">
        <h2 id="beta-suggested-heading" className="flex items-center gap-2 text-[15px] font-semibold text-ink-primary">
          <Sparkles size={18} strokeWidth={1.75} aria-hidden="true" className="text-violet-300" />
          {t.suggestedTitle}
        </h2>
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {prompts.map((prompt) => (
            <li key={prompt}>
              <a
                href={`/ask?q=${encodeURIComponent(prompt)}`}
                className="flex min-h-[44px] items-center gap-2 rounded-[11px] border border-white/[0.11] bg-white/[0.045] px-3 py-2 text-left text-[13px] text-ink-primary transition-colors hover:border-cyan-300/50 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none"
              >
                <span className="line-clamp-1 flex-1">{prompt}</span>
                <PenLine size={15} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-ink-tertiary" />
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-[11px] leading-snug text-ink-tertiary">{t.suggestedNote}</p>
      </section>

    </aside>
  );
}

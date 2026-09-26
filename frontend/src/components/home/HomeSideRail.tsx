import type { JSX } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import type { NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { SixtySecondBrief } from '@/components/home/SixtySecondBrief';
import { ASK_CARD_SHELL, ASK_ROW } from '@/components/home/homePresentation';

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
  /** The one `getHomeFeed()` response's latest-updates role. No second fetch. */
  briefUpdates?: NewsArticle[];
  language?: LanguageCode;
}

export function HomeSideRail({ language = 'en', briefUpdates = [] }: HomeSideRailProps): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.betaHome;
  /* Existing governed product copy — not the review frames' sample prompts. */
  const prompts = dict.hero.exampleQuestions.slice(0, 3);

  return (
    <aside aria-label={t.sideRailAria} className="flex flex-col gap-4 lg:gap-[13px]">
      {/*
        ══════════════════════════════════════════════════════════════════════
        THE GLOBAL SITUATION MAP IS NO LONGER ON HOME
        ══════════════════════════════════════════════════════════════════════

        Product Owner simplification ruling:

          "The `Global Situation Map` is no longer required on Home. Remove it
           from the Home composition at all responsive breakpoints. This does
           not remove the Map product or `/map`. `Open Map` remains a prominent
           Hero action and is the correct gateway to the full geographic
           intelligence experience."

        So the card is unmounted from Home at every width — not hidden at some
        of them. `HomepageSituationMap.tsx` stays on disk unimported by Home,
        which is the convention this repository already applies to Hero,
        GlobalDevelopments, LiveStatusStrip and the engine section: a retired
        surface keeps its file and its history rather than being deleted.

        Nothing about /map changed. The Hero's "Open Map" action still links
        there, and the map's own route renders the same component it always
        did — this file simply no longer mounts a second copy of it on Home.
      */}


      {/*
        COMPLETION RULING item 1 and item 7: the right rail is an intelligence
        stack — Global Situation Map, then Your world in 60 seconds, then Ask
        GlobalNewsAI.

        This is the DESKTOP equivalent of the behaviour the approved phone
        design already demonstrates, in the compact list form item 1 asks for
        rather than the phone's tall card. `lg:block` only: below `lg` the
        phone's own larger treatment renders from the hero, which item 1 says
        to preserve, so the two never appear at once and the heading id is
        unique in the document at every width.

        It reads `briefUpdates` — a role of the same single `getHomeFeed()`
        response the rest of Home already has. No second fetch, no poll, no AI.
      */}
      {/*
        The rail's primary intelligence card. `lg:block` only: below `lg` the
        phone's own larger treatment renders from the hero, which the ruling
        says to preserve ("Phone was intentionally optimized as an
        information-first surface"), so the two never appear at once and the
        heading id stays unique in the document at every width.

        It reads `briefUpdates` — a role of the single `getHomeFeed()` response
        the page already has. No second fetch, no poll, no AI.
      */}
      <div className="hidden lg:block">
        <SixtySecondBrief
          items={briefUpdates}
          language={language}
          variant="rail"
          headingId="beta-brief-rail-heading"
        />
      </div>

      {/*
        ASK GLOBALNEWSAI — prefill links only, zero spend.

        The quota contract the ruling requires is preserved exactly, and it is
        preserved STRUCTURALLY rather than by wording: every control in this
        card is an ordinary link that carries a question into the /ask
        composer as a draft. Nothing here submits. Reading and browsing are not
        paywalled, opening Home runs no AI, and the first metered moment is
        still the reader pressing Send on /ask.

        No price, no balance, no checkout — there is nothing here to buy. Sand
        stays the metered-compute signal and violet the tier signal; this card
        is neither, so it carries the product's own Ask violet on the icon and
        nothing that could read as billing.
      */}
      <section aria-labelledby="beta-suggested-heading" className={`${ASK_CARD_SHELL} p-4 lg:p-[14px]`}>
        <div className="flex items-start gap-2.5">
          <Sparkles
            size={22}
            strokeWidth={1.9}
            aria-hidden="true"
            className="mt-[1px] shrink-0 text-[#a78bfa] drop-shadow-[0_0_10px_rgba(167,139,250,0.55)]"
          />
          <div className="min-w-0">
            {/*
              POLISH item 5: "restore `Ask GlobalNewsAI` as the primary
              heading, with the suggestion prompts underneath."

              The string is `betaHome.askToday`, which already IS "Ask
              GlobalNewsAI" in both languages — it is what the hero's Ask tile
              prints. Reusing it rather than adding a key means the rail and the
              hero can never disagree about the product's own name.

              `suggestedTitle` ("Suggested questions") is not discarded: it
              moves down to label the list it actually describes, which is what
              it was always for.
            */}
            <h2 id="beta-suggested-heading" className="text-[16px] font-bold leading-tight text-white">
              {t.askToday}
            </h2>
            {/* The prototype puts this line directly under the title, not at
                the foot of the card. Same governed string, better placed. */}
            {/* The ruled supporting line. */}
            <p className="mt-[3px] text-[12.5px] leading-[1.38] text-[#a8c0da]">{t.askRailSubtitle}</p>
          </div>
        </div>
        <p className="mt-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7e93ad]">
          {t.suggestedTitle}
        </p>
        <ul className="mt-2 flex flex-col gap-2">
          {prompts.map((prompt) => (
            <li key={prompt}>
              <a
                href={`/ask?q=${encodeURIComponent(prompt)}`}
                className={`flex min-h-[44px] items-center gap-2 px-[13px] py-2.5 text-left text-[14px] text-white/95 xl:min-h-[32px] xl:px-[11px] xl:py-2 xl:text-[12.5px] ${ASK_ROW} transition-colors hover:bg-[#17304e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none`}
              >
                <span className="line-clamp-1 flex-1">{prompt}</span>
                <ArrowRight size={15} strokeWidth={2} aria-hidden="true" className="shrink-0 text-white/60" />
              </a>
            </li>
          ))}
        </ul>

        {/*
          The Ask entry point. A plain link to the composer: it opens /ask
          idle, with no question staged and nothing submitted.
        */}
        <a
          href="/ask"
          className="mt-3 flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] border border-[#3a2f74] bg-[linear-gradient(180deg,#2c2470_0%,#1d1850_100%)] px-4 text-[13.5px] font-bold text-[#e4dcff] transition-colors hover:border-[#5544a8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 motion-reduce:transition-none xl:min-h-[38px] xl:text-[13px]"
        >
          <Sparkles size={15} strokeWidth={2} aria-hidden="true" />
          {t.askToday}
        </a>

        {/*
          The no-AI-on-browse guarantee. It is fine print by size, not by
          importance: it is the sentence that tells the reader that none of the
          above has cost them anything.
        */}
        <p className="mt-2.5 text-[11px] leading-snug text-[#7e93ad]">{t.suggestedNote}</p>
      </section>

    </aside>
  );
}

import type { JSX } from 'react';
import { Sparkles, PenLine } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

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
        THE SIGN-IN CARD. Rendered for everyone: it invites, it does not claim
        anything about the reader's state, so it needs no account call and
        cannot be wrong. Signing in is a real route.
      */}
      <section className="rounded-2xl border border-border-strong bg-void/60 p-4">
        <p className="text-sm leading-relaxed text-ink-primary">{t.firstVisit}</p>
        <a
          href="/auth/google"
          className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 motion-reduce:transition-none"
        >
          {t.signInToFollow}
        </a>
      </section>

      {/*
        ── C3 · WORLD PULSE IS SUPERSEDED BY THE REAL MAP, NOT DELETED ───────
        This card was a decorative thumbnail of `HeroWorldVisual` plus an
        "Open World Map" link — a gateway standing in for a map the Home did
        not have. C3 restores `HomepageSituationMap`, which is the real thing:
        actual MapLibre geometry, a real country selection, its own "Open full
        map" action, and the four-module legend. Keeping both would have put
        two world maps on one page, the smaller of which explains nothing the
        larger does not.

        So the zone moves rather than disappears. `pulseTitle`, `pulseNote` and
        the capped-thumbnail treatment stay in the dictionary and in git, and
        the rail keeps the two cards that are genuinely rail-shaped — sign-in
        and the Ask suggestions. That is also the composition the contract's
        narrative order describes: "Global Situation Map / Ask rail".
      */}

      {/* ASK SUGGESTIONS — prefill links, zero spend. */}
      <section aria-labelledby="beta-suggested-heading" className="rounded-2xl border border-border-strong bg-void/60 p-4">
        <h2 id="beta-suggested-heading" className="flex items-center gap-2 text-base font-semibold text-ink-primary">
          <Sparkles size={18} strokeWidth={1.75} aria-hidden="true" className="text-violet-300" />
          {t.suggestedTitle}
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {prompts.map((prompt) => (
            <li key={prompt}>
              <a
                href={`/ask?q=${encodeURIComponent(prompt)}`}
                className="flex min-h-[44px] items-center gap-2 rounded-xl border border-border-strong bg-void/70 px-3 py-2 text-left text-sm text-ink-primary transition-colors hover:border-cyan-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none"
              >
                <span className="flex-1">{prompt}</span>
                <PenLine size={15} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-ink-tertiary" />
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-ink-tertiary">{t.suggestedNote}</p>
      </section>
    </aside>
  );
}

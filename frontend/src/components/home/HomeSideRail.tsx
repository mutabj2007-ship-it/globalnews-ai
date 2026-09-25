import type { JSX } from 'react';
import { Sparkles, PenLine } from 'lucide-react';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { HomeAccountPanel } from '@/components/home/HomeAccountPanel';
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
  /**
   * C7 — the stories the page already holds, forwarded to the account panel so
   * "For you" can be derived without a second request. The rail itself does
   * not render them.
   */
  articles: NewsArticle[];
  language?: LanguageCode;
}

export function HomeSideRail({ articles, language = 'en' }: HomeSideRailProps): JSX.Element {
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

      {/*
        ── C7 · THE ACCOUNT CARD, NOW BELOW THE PROTOTYPE'S TWO RAIL CARDS ──
        It keeps its state-awareness — signed out it invites, signed in it
        renders For you, Following and Manage, and it never shows "Sign in" to
        someone already signed in. What changed is only its position: the
        Product Owner's prototype rail is map-then-Ask, so the account card can
        no longer occupy the slot the map card needs. It follows them instead of
        displacing them, and nothing about its behaviour moved.

        It remains the rail's only client boundary; this file stays a Server
        Component.
      */}
      {/*
        (original C7 note, retained)
        H5 rendered a sign-in invitation to EVERY reader, on the grounds that an
        invitation claims nothing about the reader's state and so cannot be
        wrong. It can: R2 forbids showing "Sign in" to someone already signed
        in, and that is exactly what it did, on every load, for an authenticated
        reader.

        `HomeAccountPanel` takes over the slot. Signed out it renders the same
        card with the same copy; signed in it renders For you, Following and
        Manage. It is the rail's only client boundary, and it exists because
        session state lives in an httpOnly cookie the server cannot read.

        This file stays a Server Component: the panel is a child, and the Ask
        suggestions below it are still server-rendered links.
      */}
      <HomeAccountPanel articles={articles} language={language} />

    </aside>
  );
}

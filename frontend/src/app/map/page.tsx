import { ConflictDashboard } from '@/components/conflict/ConflictDashboard';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { NavBar } from '@/components/navigation/NavBar';
import { Footer } from '@/components/layout/Footer';
import { MapPageClient } from '@/components/map/MapPageClient';
/* CHECKPOINT I — the released language reconciliation, now on this route too. */
import { LanguageSync } from '@/components/i18n/LanguageSync';
/* CHECKPOINT I — restores the map state the sign-in redirect may not carry. */
import { MapSignInReturn } from '@/components/map/MapSignInReturn';
import { LANGUAGE_COOKIE_NAME, isActiveLanguageCode } from '@/lib/i18n/languages';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { mapShellVariant } from '@/lib/map/mapShellFlag';

/**
 * Milestone #49 (World Map EN/PL integration) — Next.js's static
 * `metadata` export cannot read cookies (it has no request context at
 * all); only the async `generateMetadata()` function can. This is the
 * established, safe mechanism for language-aware metadata without a
 * parallel i18n system — it reuses the exact same cookie/dictionary
 * architecture as the rest of the page, just through the one API
 * surface Next.js actually provides for this.
 */
export async function generateMetadata(): Promise<Metadata> {
  const languageCookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const language = languageCookie && isActiveLanguageCode(languageCookie) ? languageCookie : 'en';
  const t = getDictionary(language).map;

  /*
    ALPHA-SEO-FOUNDATION-1 — the same two dictionary strings, now carrying
    the canonical, robots and social facts that belong with them. The
    language already resolved above is reused; no second mechanism.
  */
  return buildPageMetadata({
    path: '/map',
    title: t.metaTitle,
    description: t.metaDescription,
    language,
  });
}

/**
 * Milestone #49 — mirrors the homepage's own cookie-based language
 * resolution (frontend/src/app/page.tsx) exactly: reads the SAME
 * cookie persistLanguageSelection() writes, validates against the SAME
 * ACTIVE_LANGUAGES set, and always resolves to a concrete 'en'/'pl' —
 * never `undefined` — matching the Milestone #48 Blocker 1 fix that
 * closed the equivalent gap on the homepage feed. No second language
 * persistence mechanism is introduced.
 */
export default function MapPage({ searchParams }: { searchParams?: { from?: string; domain?: string; observation?: string; cam?: string } }): JSX.Element {
  const languageCookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const language = languageCookie && isActiveLanguageCode(languageCookie) ? languageCookie : 'en';

  // Explicit Part V handoff: retained-only spatial lens, never a Country retrieval.
  if (searchParams?.from === 'conflict' && searchParams.domain === 'conflict') {
    return <><LanguageSync /><ConflictDashboard language={language} spatialView /></>;
  }

  /*
    ══ SPATIAL M2 OWNS THE VIEWPORT ═════════════════════════════════════════

    CTO ruling, 2026-09-01: "if the Claude Design Spatial composition provides
    its own brand/top intelligence bar, the old general World Map/NavBar must
    not remain as an additional layer consuming viewport space."

    The authoritative composition is `position: fixed; inset: 0` with
    `grid-template-rows: 44px 1fr`, and its own 44 px bar carries
    `● GLOBALNEWS AI · SPATIAL INTELLIGENCE`. A second 64 px product bar above
    it duplicates the brand and costs the map a tenth of a 1080 px screen.

    ── WHY `lg:hidden` AND NOT A REMOVAL ───────────────────────────────────

    Because this route has THREE renderings and the ruling concerns exactly
    one of them:

      FLAG OFF, any width   the accepted legacy World Map page. The NavBar is
                            part of that page and the rollback must stay a flag
                            flip, so this branch is not reached at all.
      FLAG ON, below 1024   the accepted non-map fallback — search plus the
                            country panel. It is an ordinary product page and
                            KEEPS the NavBar; M6 owns the tablet drawer and the
                            mobile sheet that will eventually replace it.
      FLAG ON, 1024 and up  the Spatial workspace. Design's composition, and
                            the only place the ruling applies.

    So the NavBar is hidden at `lg` and above, on this route, only when the
    shell is the variant being rendered. Nothing about the component, the
    global navigation, or any other route changes — every other page mounts
    its own `<NavBar>` exactly as before.

    THE FOOTER CLAIM THAT USED TO BE HERE WAS EMPIRICALLY FALSE — see the
    DEFECT B block below the flag read. It said the footer "sits below the fold
    and consumes no visible height". On compact Spatial it does both of the
    things that sentence denies.
  */
  const spatial = mapShellVariant() === 'shell';

  /*
    ── MOBILE SPATIAL MVP · THE SAME RULING, NOW AT EVERY WIDTH ────────────

    C-O settled this for desktop: "if the Claude Design Spatial composition
    provides its own brand/top intelligence bar, the old general World Map
    NavBar must not remain as an additional layer consuming viewport space."
    The clause names the composition, not the breakpoint.

    Until now the phone had no Spatial composition, so the NavBar was correct
    below 861 px and was deliberately kept there. It now has one, and the same
    sentence applies: a 100 dvh map under a ~100 px bar is not a full-screen
    map, it is a map plus a scrollbar, and a page that scrolls vertically under
    a drag gesture is a map you cannot pan.

    So on the shell variant the NavBar is gone at EVERY width, and the mobile
    shell carries its own brand-mark exit — the same minimal affordance, and
    the same visual treatment, that C-O accepted on desktop. The flag-off
    rollback still mounts the NavBar unchanged, as does every other route.
  */
  /*
    RELEASE-LINE RECONCILIATION (MAIN-CONVERGED-ALPHA-POST-AUTH-1-R3).

    C55 wraps this subtree in `<ScriptRun locale={language} step="wrapping">`
    — the LANG-UI-7 Arabic run boundary. THAT WRAPPER IS NOT ROUTE WIRING and
    it is NOT CARRIED HERE, for a measured reason: C55's `ScriptRun` reads
    `DISPLAY_LOCALE_META` and the `DisplayLocale` union from its shared
    `language/` module, which this lineage deliberately does not carry. The
    release line's `@/lib/typography/runBoundary` therefore exports only
    `MachineReadable`, and that trim is the accepted Spatial production
    decoupling, recorded in `@/lib/i18n/sourceLanguage`.

    Importing it would mean pulling C55's shared language machinery forward —
    functional expansion this candidate is explicitly scoped against. So the
    release line's existing fragment is kept, and the ONLY change to this file
    is the flag read plus the conditional NavBar, which is the whole of the
    route wiring the ruling asks for.

    The Arabic run boundary on this route remains OPEN, and is recorded as such
    rather than silently dropped.
  */
  /*
    ══ H-C907 DEFECT B · THE COMPACT SPATIAL WORKSPACE OWNS THE VIEWPORT ════

    MEASURED BY THE PRODUCT OWNER ON THE RAILWAY ALPHA: while the compact sheet
    was in use the global footer entered the viewport, the map disappeared, and
    the fixed Ask AI affordance collided with the footer.

    ── THE ARITHMETIC, WHICH IS THE WHOLE DEFECT ───────────────────────────

    `MobileSpatialShell` is `h-[100dvh]`. `main` was `min-h-screen`, and the
    footer was an unconditional sibling BELOW it. So the document was one full
    viewport of map PLUS a footer — taller than the screen by exactly the
    footer's height — and the outer document scrolled. A drag on the map that
    the engine did not consume scrolled that document, which is how a map you
    cannot pan and a footer over the sheet are the same bug.

    ── THE CORRECTION, AND ITS EXACT SCOPE ─────────────────────────────────

    Below 861 px on the SHELL VARIANT ONLY:

      main    is the viewport, not a minimum: `h-[100dvh]`, `overflow-hidden`,
              so the document has nothing to scroll and `window.scrollY`
              cannot leave 0. `overscroll-none` stops a gesture the map did
              not consume from chaining out to the document.
      footer  does not render into the compact workspace.

    At 861 px and above every one of those yields to the released desktop
    behaviour — `spatial:h-auto spatial:min-h-screen spatial:overflow-visible
    spatial:overscroll-auto` and a visible footer — so desktop Spatial is
    unchanged.

    WHAT IS DELIBERATELY NOT TOUCHED. `Footer` itself: not one byte, because
    the defect is where it is MOUNTED on one route at one width, not what it
    is. The flag-off legacy map and every other route keep the unconditional
    `<main className="min-h-screen">` + `<Footer>` pair they already render —
    that branch below is the rollback and must stay a flag flip.

    THE FOOTER IS NOT LOST ON A PHONE. It is absent from the compact SPATIAL
    workspace, which is a full-screen application surface; the ordinary
    document routes that carry the footer are unaffected at every width.
  */
  return (
    <>
      {/*
        CHECKPOINT I — LANGUAGE-PERSISTENCE-ON-REFRESH.

        This route reads the language cookie server-side and falls back to
        English. When the cookie alone is missing — cleared, or never written
        because the reader arrived here first with a Polish browser — that
        fallback was permanent: refreshing re-read the same absent cookie, and
        only a detour through the homepage repaired it.

        Renders nothing; it reconciles the two stores and refreshes once.
      */}
      <LanguageSync />
      <MapSignInReturn />
      {spatial ? null : <NavBar language={language} />}
      <main
        data-gn="map-route-main"
        className={
          spatial
            ? 'h-[100dvh] overflow-hidden overscroll-none bg-void spatial:h-auto spatial:min-h-screen spatial:overflow-visible spatial:overscroll-auto'
            : 'min-h-screen bg-void'
        }
      >
        <MapPageClient language={language} />
      </main>
      {spatial ? (
        <div data-gn="map-route-footer" className="hidden spatial:block">
          <Footer language={language} />
        </div>
      ) : (
        <Footer language={language} />
      )}
    </>
  );
}

import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { NavBar } from '@/components/navigation/NavBar';
import { Footer } from '@/components/layout/Footer';
import { MapPageClient } from '@/components/map/MapPageClient';
import { LANGUAGE_COOKIE_NAME, isActiveLanguageCode } from '@/lib/i18n/languages';
import { getDictionary } from '@/lib/i18n/dictionaries';
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

  return {
    title: t.metaTitle,
    description: t.metaDescription,
  };
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
export default function MapPage(): JSX.Element {
  const languageCookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const language = languageCookie && isActiveLanguageCode(languageCookie) ? languageCookie : 'en';

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

    THE FOOTER IS UNTOUCHED. It already sits below the fold and consumes no
    visible height; the ruling names the bar above, and removing a second
    element would be a change nobody asked for.
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
  return (
    <>
      {spatial ? null : <NavBar language={language} />}
      <main className="min-h-screen bg-void">
        <MapPageClient language={language} />
      </main>
      <Footer language={language} />
    </>
  );
}

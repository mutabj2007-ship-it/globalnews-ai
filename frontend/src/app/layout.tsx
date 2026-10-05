import type { Metadata, Viewport } from 'next';
import {
  Space_Grotesk,
  Inter,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Outfit,
  JetBrains_Mono,
} from 'next/font/google';
import type { LanguageCode } from '@globalnews-ai/shared';
import { documentSurfaceLocale } from '@/lib/i18n/documentLocale.server';
import { DisplayLocaleNotice } from '@/components/i18n/DisplayLocaleNotice';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { buildRootMetadataBase } from '@/lib/seo/metadata';
import { ServiceWorkerRegistrar } from '@/components/pwa/ServiceWorkerRegistrar';
import { AskAiDock } from '@/components/ask/AskAiDock';
import { standaloneAskRoot } from '@/lib/ask/standaloneRoot';
import { homeR1Gates, releaseGatesMeta } from '@/lib/platform/homeR1Gates';
import { ReturnDepthTracker } from '@/components/navigation/ReturnDepthTracker';
import { SCHEDULE_BOOT_SCRIPT } from '@/lib/theme/themeSchedule';
import './globals.css';

/**
 * M66.1 — GN-CD-301 §I.1 FONT WIRING, FULLY ADDITIVE.
 *
 * Six font declarations, in two groups that never touch each other.
 *
 * WHY THE LEGACY THREE ARE BYTE-IDENTICAL, INCLUDING THEIR WEIGHT LISTS.
 * Adding a weight to an existing family is NOT inert. A weight utility that
 * currently requests a face the family does not carry falls back to the nearest
 * loaded weight; load the real face and that text suddenly renders at the
 * weight it always asked for. That is a visual change, and it would have landed
 * on routes with no released design:
 *
 *   `font-mono font-semibold` (600) is used by 7 files outside the homepage —
 *   map/CountryContextShelf, map/CoverageMetrics, map/MapTooltip,
 *   search/AnalysisModeBadge, search/RetrievalContextStatus, search/TrustBadge
 *   and ui/DataModeLabel. IBM Plex Mono is loaded at 400/500 today, so all
 *   seven currently fall back. Adding 600 to `--font-mono` would have made
 *   /map and /search render heavier mono text as a side effect of building the
 *   homepage foundation — exactly what CTO authorization §15 prohibits.
 *
 * So the released weights go on NEW families instead. `--font-display`,
 * `--font-body` and `--font-mono` keep their exact pre-M66.1 declarations, and
 * every route that has not been redesigned renders precisely as it did before.
 * `claudeDesignFoundation.spec.ts` asserts all three verbatim.
 *
 * COST, stated plainly: two families are now declared twice, at overlapping
 * weights. Because the Claude Design faces carry `preload: false` and nothing
 * consumes `font-cd-display` or `font-cd-mono` yet, no route fetches a byte it
 * does not render — each route still downloads only the faces it actually uses.
 * The duplication collapses to three declarations when the last section
 * milestone migrates off the legacy utilities and Inter is dropped.
 */

// ── Legacy families — UNCHANGED. Consumed by every route in the product. ─────
const displayFont = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-display',
});

const bodyFont = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
});

const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

/**
 * ── Claude Design families — GN-CD-301 §I.1, at the exact released weights.
 *
 * Display `'Space Grotesk',sans-serif` at 400/500/600/700 · Body
 * `'IBM Plex Sans',system-ui,sans-serif` at 400/500/600 · Mono
 * `'IBM Plex Mono',monospace` at 400/500/600.
 *
 * Made AVAILABLE, not imposed: reachable only through the additive
 * `font-cd-display` / `font-cd-body` / `font-cd-mono` utilities, so they render
 * exactly where a Claude Design surface asks for them and nowhere else.
 *
 * `preload: false` on all three is deliberate. The default emits a
 * `<link rel=preload>` on every route, which would make six routes that never
 * render a glyph of these faces pay for them. Without the hint each face is
 * fetched on demand by the first surface that uses it. GN-CD-301 §U requires
 * `display=swap`, which `next/font` applies by default, so the swap-in
 * behaviour is the authored one. Flip these to `true` in the milestone that
 * makes the Claude Design faces primary.
 */
const claudeDesignDisplayFont = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cd-display',
  preload: false,
});

const claudeDesignBodyFont = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-cd-body',
  preload: false,
});

const claudeDesignMonoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-cd-mono',
  preload: false,
});

/**
 * ── H2B · Analysis Workspace families — GN-CD-ANALYSIS-WORKSPACE
 * 01-MASTER-DESIGN-SPEC §3, at the exact released weights.
 *
 * "Two families only. Outfit — all prose, titles, entity names, values.
 * JetBrains Mono — all HUD labels, counters, metadata, states, legends."
 * The mono/sans split is itself semantic in that specification, which is why
 * these are two families rather than two weights of one.
 *
 * NEITHER FAMILY EXISTS IN THE PRODUCT TODAY. The legacy trio is Space
 * Grotesk / Inter / IBM Plex Mono and the cd-* trio is Space Grotesk /
 * IBM Plex Sans / IBM Plex Mono, so nothing here widens a family already in
 * use — the hazard M66.1 documented at length does not arise. Both are
 * Google fonts reached through the existing next/font/google import, so no
 * npm dependency is added.
 *
 * `preload: false` for the same reason M66.1 gave: only /search renders a
 * glyph of these faces, and the default preload hint would make every other
 * route pay for them. GN-CD-301 §U's `display=swap` is next/font's default.
 * Flip to true when the workspace becomes the primary analysis surface.
 */
const analysisWorkspaceDisplayFont = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-gn-display',
  preload: false,
});

const analysisWorkspaceMonoFont = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-gn-mono',
  preload: false,
});

/**
 * PWA — Next 14 requires `themeColor` in its own `viewport` export; leaving it
 * inside Metadata is deprecated and emits a build warning. Placed above the
 * M66.13 block below so that block stays attached to the function it documents.
 *
 * `#080b12` is the tailwind `void` token — the exact value
 * <body className="bg-void"> already renders — so the browser chrome and the
 * installed app's splash screen match the application surface rather than
 * approximating it.
 *
 * WHAT IS DELIBERATELY ABSENT, AND WHY. Next also offers a UA-scheme field
 * here. It is not set. M66.11 made the `:root` declaration in globals.css the
 * single source of truth for that, and nativeControlScheme.spec.ts asserts that
 * no competing mechanism exists in this file — naming a Next metadata field as
 * exactly the thing it forbids. That test caught this on the first native run.
 * The declaration in globals.css already covers every route, so the field would
 * have bought nothing and cost a second source of truth.
 */
export const viewport: Viewport = {
  themeColor: '#080b12',
  width: 'device-width',
  initialScale: 1,
};

/**
 * M66.13 — the root metadata is now request-aware, so it localizes.
 *
 * THE DEFECT. `export const metadata` is evaluated WITHOUT request context, so
 * it can never read the language cookie. Both strings were therefore English on
 * every route, in every language — visible in the browser tab, in bookmarks, in
 * history and in link previews. This file already knew the constraint: the
 * comment below RootLayout has said since M65 that "only the async
 * generateMetadata() function can" read request context.
 *
 * THE PATTERN IS NOT NEW. app/search/page.tsx already does exactly this, reading
 * searchMetaTitle / searchMetaDescription from the dictionary. /search localized
 * its metadata and the root layout did not; this closes that gap using the SAME
 * mechanism — no second localization path, no new dependency.
 *
 * The English values are byte-identical to what shipped, so English output does
 * not change. Only a Polish surface is added.
 */
export async function generateMetadata(): Promise<Metadata> {
  /* T2 — the metadata describes the surface's EFFECTIVE locale, like <html lang>. */
  const t = getDictionary(documentSurfaceLocale().language);
  const gatesMeta = releaseGatesMeta(homeR1Gates());

  return {
    // Brand name, not prose — Logo.tsx already renders this identical wordmark
    // in both languages. Every localizable string below still comes from the
    // dictionary, exactly as M66.13 established.
    applicationName: 'GlobalNews AI',
    /*
      ALPHA-SEO-FOUNDATION-1 — `metadataBase` and NOTHING ELSE here.

      It is what lets Next resolve a relative metadata URL into an
      absolute one, and it belongs at the root because it is a property
      of the site rather than of a page. It resolves to `{}` when no
      origin is configured, so this object is byte-identical to what
      shipped in that case.

      Canonical, robots and social metadata are deliberately NOT set
      here. They are per-page facts, and a root-level default is how a
      private surface ends up inheriting a public page's canonical.
    */
    ...buildRootMetadataBase(),
    title: t.homeMetaTitle,
    description: t.homeMetaDescription,
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: 'GlobalNews', statusBarStyle: 'black-translucent' },
    /*
      HOME, DISCUSSIONS, ALERTS & PAID R1 · STAGE A — the server-read release gates for client
      islands (the dock, My Intelligence): emitted ONLY when a gate is on, so with every gate
      OFF this object is exactly what shipped. Names of ON gates only; see homeR1Gates.
    */
    ...(gatesMeta === null ? {} : { other: gatesMeta }),
  };
}

/**
 * M65 — <html lang> now reflects the user's real, persisted language
 * choice instead of a static "en".
 *
 * It reads the SAME cookie persistLanguageSelection() writes. T2: it is
 * validated against the seven DISPLAY_LOCALES by the one display-locale
 * authority and resolved per surface by the effective-locale rule (see
 * lib/i18n/surfaceLocale.ts) — one language mechanism, not a second one.
 * Because this is the root layout, every route inherits the correct
 * document language, which also retires the previous client-side
 * workaround where the search page patched document.documentElement.lang
 * imperatively after mount (a fix that only ever applied while a user was
 * on that one page).
 *
 * Reading cookies here opts the tree into dynamic rendering. That is not
 * a new cost in practice: the homepage and the map route already call
 * cookies() for exactly this value, and the search route is inherently
 * request-dependent.
 *
 * M66.1 note: the <body> class list is UNCHANGED. It still resolves to the
 * existing `void` / `font-body` / `ink-primary` tokens, so no route's baseline
 * rendering moves. The three new font variables are declarations only — a CSS
 * custom property on <html> renders nothing until a utility asks for it. The
 * Claude Design canvas is opt-in per page; see components/layout/PageCanvas.tsx.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): JSX.Element {
  /*
    T2 · GLOBAL LANGUAGE FOUNDATION — <html lang> AND <html dir> FROM THE EFFECTIVE LOCALE.

    This was the EN/PL source-language gate (cookie ∈ ACTIVE_LANGUAGES, else 'en'), so a reader who
    selected fr–ar was given lang="en" and NO dir at all, and Arabic was RTL only inside the Ask
    frame. The surface this request renders is resolved from the path (middleware header) by the
    same effective-locale rule the page itself uses, so the document describes exactly what is on
    the page: the selected locale when every catalogue the surface uses is complete for it, or
    English (ltr) with a declared notice in the selected language when it is not. Arabic, when it
    is the effective locale, makes the WHOLE document dir="rtl".
  */
  const surface = documentSurfaceLocale();
  /*
    R4 + EAST AFRICA CONVERGENCE — the document is T2's (lang/dir/notice above), and the Ask dock's
    R4 inputs come from the SAME authority decision instead of a second cookie read:
      displayLocale  the reader's requested DisplayLocale (surface.requested — the cookie validated
                     against the seven, English when absent: what resolveAskLocale(cookie) returned)
      language       the platform's two-catalogue code the dock's dictionary takes: Polish stays
                     Polish, every other reader arrives as 'en' (R4's dock contract, unchanged)
    so an effective-Arabic document and an Arabic dock agree (CTO RTL ruling).
  */
  const language: LanguageCode = surface.requested === 'pl' ? 'pl' : 'en';

  const fontVariables = [
    displayFont.variable,
    bodyFont.variable,
    monoFont.variable,
    claudeDesignDisplayFont.variable,
    claudeDesignBodyFont.variable,
    claudeDesignMonoFont.variable,
    analysisWorkspaceDisplayFont.variable,
    analysisWorkspaceMonoFont.variable,
  ].join(' ');

  return (
    <html lang={surface.document.lang} dir={surface.document.dir} className={fontVariables}>
      <head>
        {/*
          TRUST & CONVERSATIONAL EXPERIENCE R1 — Scheduled day/night theme. A self-contained,
          pre-paint script: it reads the one first-party theme cookie and, only when it says
          Scheduled, sets <html data-gna-schedule> from the device clock. It requests nothing.
          Every other theme preference is resolved by CSS alone (lib/theme/themeSchedule.ts).
        */}
        <script dangerouslySetInnerHTML={{ __html: SCHEDULE_BOOT_SCRIPT }} />
      </head>
      <body className="bg-void font-body text-ink-primary antialiased">
        {/*
          PWA — ServiceWorkerRegistrar returns null, so it contributes no
          element, no text node and no class to the document. The <body> class
          list above is unchanged and the Claude Design tree below it is
          untouched; this is a side effect mounted in the tree, not a wrapper
          around it.
        */}
        <ServiceWorkerRegistrar />
        <DisplayLocaleNotice locale={surface} />
        {children}
        {/*
          ASK AI — PHASE 1. Mounted here, as its own element, exactly the way
          ServiceWorkerRegistrar is: additive, removable in one line, and
          touching NO released GN-CD geometry. It is deliberately NOT an item
          in the NavBar's accepted item row — that row is released design and
          Ask AI's own chrome/geometry reconciliation is still held.

          It issues no request on mount and none on open; see AskAiDock.
        */}
        {/*
          ALPHA MAJOR CONVERGENCE R1 — the in-app navigation counter for the
          shared return control. Mounted here for the same reason AskAiDock is:
          it must exist on every route, exactly once. It renders NULL — no
          element, no text node, no class — so it adds nothing to the document
          and cannot move any frozen geometry or chrome budget. It issues no
          request on mount and none on navigation.
        */}
        <ReturnDepthTracker />
        <AskAiDock
          language={language}
          displayLocale={surface.requested}
          standaloneRoot={standaloneAskRoot()}
        />
      </body>
    </html>
  );
}

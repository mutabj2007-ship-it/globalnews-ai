import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { Space_Grotesk, Inter, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { LANGUAGE_COOKIE_NAME, isActiveLanguageCode } from '@/lib/i18n/languages';
import { getDictionary } from '@/lib/i18n/dictionaries';
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
  const languageCookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const language = languageCookie && isActiveLanguageCode(languageCookie) ? languageCookie : 'en';
  const t = getDictionary(language);

  return {
    title: t.homeMetaTitle,
    description: t.homeMetaDescription,
  };
}

/**
 * M65 — <html lang> now reflects the user's real, persisted language
 * choice instead of a static "en".
 *
 * It reads the SAME cookie persistLanguageSelection() writes and
 * validates it against the SAME ACTIVE_LANGUAGES set page.tsx and
 * map/page.tsx already use — one language mechanism, not a second one.
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
  const languageCookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const language = languageCookie && isActiveLanguageCode(languageCookie) ? languageCookie : 'en';

  const fontVariables = [
    displayFont.variable,
    bodyFont.variable,
    monoFont.variable,
    claudeDesignDisplayFont.variable,
    claudeDesignBodyFont.variable,
    claudeDesignMonoFont.variable,
  ].join(' ');

  return (
    <html lang={language} className={fontVariables}>
      <body className="bg-void font-body text-ink-primary antialiased">{children}</body>
    </html>
  );
}

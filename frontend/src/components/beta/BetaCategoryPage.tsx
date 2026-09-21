import Link from 'next/link';
import { MessageSquare, Map as MapIcon, Sparkles } from 'lucide-react';
import type { BetaCategory, BetaCategoryView } from '@globalnews-ai/shared';
import { NavBar } from '@/components/navigation/NavBar';
import { Footer } from '@/components/layout/Footer';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { fetchCategoryView } from '@/lib/api/betaApi';
import { buildContextualHref, captureAskContext } from '@/lib/ask/askNavigationContext';

/**
 * BETA-SIMPLE-ASK-SAND-1 §17 — THE reusable category template.
 *
 * §17: "This should be a reusable template. Do not implement five
 * unrelated category frontends unless domain requirements truly
 * differ."
 *
 * They do not differ, so there is exactly one component and the five
 * routes are five one-line files that call it. That is the whole
 * design: a per-category component would guarantee the five surfaces
 * drift apart, and §18's specialist handoff is where genuine domain
 * difference belongs — the full Part XI Energy workspace, reached
 * FROM here, not built INTO here.
 *
 * §18: this is the PUBLIC entry surface. It deliberately does not
 * attempt to render any frozen specialist dashboard, and nothing here
 * is reconstructed from a screenshot. The frozen Claude Design
 * package remains authoritative for those, under separate
 * authorization.
 *
 * §16: rendering this page runs no AI. The data comes from
 * GET /beta/categories/:category, which reads only stored articles.
 * Every action offered below is a LINK — the user has to choose to
 * spend anything.
 */

/** Per-category lede. The one thing that legitimately varies per category. */
const CATEGORY_DESCRIPTIONS: Record<BetaCategory, string> = {
  world: 'Current developments worldwide, drawn from retrieved and cited sources.',
  economy: 'Inflation, trade, currencies, budgets and markets, as currently reported.',
  energy: 'Power, fuel, grids and the energy transition, as currently reported.',
  security: 'Conflict, defence, borders and stability, as currently reported.',
  humanitarian: 'Displacement, aid, health emergencies and relief, as currently reported.',
};

export async function BetaCategoryPage({
  category,
  countryCode,
}: {
  category: BetaCategory;
  countryCode?: string;
}): Promise<JSX.Element> {
  const view = await fetchCategoryView({ category, countryCode });

  // §4 — the context a user carries when they leave this surface for
  // Ask, so Ask can render "← Energy" and keep the geography.
  const askContext = captureAskContext({
    pathname: `/${category}`,
    label: view?.title ?? category,
    module: category,
    countryCode: view?.countryCode,
    countryName: view?.countryName,
  });

  const askHref = buildContextualHref('/ask', askContext);

  return (
    <>
      <NavBar />

      <main className="min-h-screen bg-void">
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <header>
            <h1 className="font-display text-3xl text-ink-primary sm:text-4xl">
              {view?.title ?? category}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary">
              {CATEGORY_DESCRIPTIONS[category]}
            </p>

            {/* §17 — freshness and evidence counts. Rendered only when
                real, never as a placeholder zero dressed up as data. */}
            {view && view.evidenceCount > 0 && (
              <p className="mt-4 font-mono text-xs text-ink-tertiary">
                {view.evidenceCount} development{view.evidenceCount === 1 ? '' : 's'} ·{' '}
                {view.distinctSourceCount} source{view.distinctSourceCount === 1 ? '' : 's'}
                {view.lastUpdatedAt && <> · updated {formatRelativeTime(view.lastUpdatedAt)}</>}
              </p>
            )}
          </header>

          {/* §17 — the entry points. Every one is a link: nothing on
              this page spends anything without an explicit choice. */}
          <nav aria-label={`${view?.title ?? category} actions`} className="mt-6 flex flex-wrap gap-3">
            <Link
              href={askHref}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-signal px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-signal-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
            >
              <MessageSquare aria-hidden="true" className="h-4 w-4" />
              Ask GlobalNews AI
            </Link>

            <Link
              href="/search"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink-secondary transition-colors hover:border-border-strong hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
            >
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              Analysis
            </Link>

            {view && view.mapCountryCodes.length > 0 && (
              <Link
                href="/map"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink-secondary transition-colors hover:border-border-strong hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              >
                <MapIcon aria-hidden="true" className="h-4 w-4" />
                Open Map
              </Link>
            )}
          </nav>

          <section aria-label="Current developments" className="mt-10">
            {!view || view.developments.length === 0 ? (
              /*
               * §17's honest empty state. It says what is true —
               * nothing current is stored for this subject — rather
               * than spinning forever or offering to "generate" a
               * view, which would be the §16 violation.
               */
              <p className="rounded-2xl border border-border bg-surface p-6 text-sm leading-relaxed text-ink-secondary">
                No current developments are stored for this subject yet. Ask a question to have
                GlobalNews AI retrieve and analyse sources directly.
              </p>
            ) : (
              <ul className="space-y-4">
                {view.developments.map((development) => (
                  <li
                    key={development.id}
                    className="rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-border-strong"
                  >
                    <a
                      href={development.url}
                      target="_blank"
                      // noopener is the one that matters (it prevents
                      // the opened page reaching back via
                      // window.opener); noreferrer is included because
                      // an outbound link to a third-party publisher
                      // should not leak the reader's exact in-app path.
                      rel="noopener noreferrer"
                      className="font-display text-base text-ink-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
                    >
                      {development.title}
                    </a>

                    <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                      {development.summary}
                    </p>

                    <p className="mt-3 font-mono text-xs text-ink-tertiary">
                      {development.sourceName}
                      {development.countryName && <> · {development.countryName}</>} ·{' '}
                      {formatRelativeTime(development.publishedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}

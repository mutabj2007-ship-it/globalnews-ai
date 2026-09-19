import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { NavBar } from '@/components/navigation/NavBar';
import { Footer } from '@/components/layout/Footer';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { LANGUAGE_COOKIE_NAME, isActiveLanguageCode } from '@/lib/i18n/languages';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { THIRD_PARTY_NOTICES } from '@/lib/legal/thirdPartyNotices.generated';

/**
 * ══ THIRD-PARTY NOTICES — R2-B §9 ═════════════════════════════════════════
 *
 * CTO rights ruling, 2026-09-19:
 *
 *   "provide an accessible Third-Party Notices surface using the exact
 *    upstream license texts from the installed package versions, not
 *    hand-written summaries ... The goal is that recipients/users can reach
 *    the required third-party notices without relying on hidden node_modules
 *    or build-artifact files."
 *
 * ── THE ONE RULE THIS PAGE EXISTS TO KEEP ─────────────────────────────────
 *
 * THE LICENCE BODIES ARE NEVER TRANSLATED AND NEVER EDITED. Headings around
 * them are product copy and are localised; every `<pre>` below renders
 * `notice.text` exactly as it was read from the installed package. The ruling
 * says so, and the reason is the same one the map's attribution comment
 * already gives: a notice that has been reworded is not the notice the licence
 * asked for.
 *
 * `thirdPartyNotices.generated.ts` is produced by
 * `scripts/build-third-party-notices.mjs` from `node_modules`, and
 * `thirdPartyNotices.spec.ts` re-reads those files and asserts the committed
 * text still matches byte for byte. So the page ships committed text — no
 * node_modules read at request time, nothing to fail in a build sandbox — and
 * the suite is what proves the text is exact.
 *
 * ── WHY MAPLIBRE'S ONE FILE COVERS FOUR NOTICES ───────────────────────────
 *
 * `maplibre-gl`'s LICENSE.txt already embeds the notices it is required to
 * pass on: mapbox-gl-js v1.13, glfx.js and d3-color. Reproducing that file
 * verbatim discharges "any directly implicated bundled map dependency already
 * required by that upstream notice" without this product deciding which those
 * are — which is the same reason the text is copied rather than summarised.
 *
 * ── WHAT IS LISTED BUT NOT REPRODUCED, AND WHY THAT IS NOT A PASTE ────────
 *
 * The gazetteer's upstream DATA packages are not installed in this repository;
 * they were consumed by the backend gazetteer build, which records them in its
 * own manifest. The ruling asks for EXACT upstream texts, so this page does
 * not invent an MIT notice with a guessed copyright holder for a package it
 * cannot read. They are named with their declared licences and the product's
 * own published attribution string, and the gap is recorded as an open item.
 *
 * ── NOT A SETTINGS SYSTEM ─────────────────────────────────────────────────
 *
 * A plain async server component. No 'use client', no state, no fetch, no
 * preference, no new contract — the same architecture `/privacy`, `/terms` and
 * `/source-policy` use, deliberately reused line for line rather than
 * abstracted, for the reason `/source-policy` already records.
 */
export async function generateMetadata(): Promise<Metadata> {
  const languageCookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const language = languageCookie && isActiveLanguageCode(languageCookie) ? languageCookie : 'en';
  const t = getDictionary(language).thirdPartyNoticesPage;

  return buildPageMetadata({
    path: '/third-party-notices',
    title: `${t.title} — GlobalNews AI`,
    description: t.intro,
    language,
  });
}

export default async function ThirdPartyNoticesPage(): Promise<JSX.Element> {
  const languageCookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const language = languageCookie && isActiveLanguageCode(languageCookie) ? languageCookie : 'en';
  const t = getDictionary(language).thirdPartyNoticesPage;

  return (
    <div className="flex min-h-screen flex-col bg-void">
      <NavBar language={language} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:py-14">
        <h1 className="text-2xl font-semibold text-ink-primary sm:text-3xl">{t.title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-secondary">{t.intro}</p>

        {/* ── SOFTWARE ─────────────────────────────────────────────────── */}
        <section className="mt-10" data-gn="notices-software">
          <h2 className="text-lg font-semibold text-ink-primary">{t.softwareHeading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{t.softwareIntro}</p>

          <div className="mt-6 flex flex-col gap-8">
            {THIRD_PARTY_NOTICES.map((notice) => (
              <article key={notice.id} data-gn="notice" data-gn-package={notice.id}>
                <h3 className="font-mono text-sm text-ink-primary">
                  {notice.name} {notice.version}
                </h3>
                <p className="mt-1 font-mono text-xs text-ink-tertiary">
                  {t.licenceLabel}: {notice.license ?? t.licenceUnstated}
                </p>
                {/*
                  VERBATIM, AND IN A PRE.

                  `whitespace-pre-wrap` keeps the upstream line breaks — a BSD
                  disclaimer reflowed into a paragraph is a different document —
                  while still wrapping on a phone rather than forcing a
                  horizontal scroll. `lang="en"` marks it as English inside a
                  Polish page so a screen reader does not read an English
                  licence with Polish phonetics, and `translate="no"` asks a
                  browser's page translator to leave it alone. Both are the same
                  instruction as the ruling's "license bodies remain exact",
                  addressed to the two systems that would otherwise change it.
                */}
                <pre
                  data-gn="notice-text"
                  lang="en"
                  translate="no"
                  className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded border border-edge-subtle bg-black/20 p-4 font-mono text-[11px] leading-[1.6] text-ink-secondary"
                >
                  {notice.text}
                </pre>
              </article>
            ))}
          </div>
        </section>

        {/* ── MAP AND GEOGRAPHY DATA ───────────────────────────────────── */}
        <section className="mt-12" data-gn="notices-data">
          <h2 className="text-lg font-semibold text-ink-primary">{t.dataHeading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{t.dataIntro}</p>

          {/*
            THE PUBLISHED ATTRIBUTION STRING, VERBATIM — the same one the map
            renders. Not re-typed here: it is the upstream notice, and the CC BY
            4.0 URI it carries is the part §9 found missing and restored.
          */}
          <p
            data-gn="notice-data-attribution"
            lang="en"
            translate="no"
            className="mt-4 rounded border border-edge-subtle bg-black/20 p-4 font-mono text-[11px] leading-[1.6] text-ink-secondary"
          >
            {t.dataAttribution}
          </p>

          <dl className="mt-6 flex flex-col gap-4">
            {t.dataSources.map((source) => (
              <div key={source.name} data-gn="notice-data-source">
                <dt className="font-mono text-sm text-ink-primary">
                  {source.name} — {source.licence}
                </dt>
                <dd className="mt-1 text-sm leading-relaxed text-ink-secondary">{source.note}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <Footer language={language} />
    </div>
  );
}

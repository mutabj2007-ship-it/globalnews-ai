'use client';

import { useState } from 'react';
import type { AnalysisRetrievalContext, LanguageCode } from '@globalnews-ai/shared';
import type { InsufficientEvidenceModel } from '../search/analysisDimensions';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { CompactMap } from './CompactMap';
import { EvidenceMap, EvidenceMapLegend } from './EvidenceMap';
import type { EvidenceGeographyModel } from './evidenceGeography';
import { buildGeographicEvidenceState, formatPlace } from './geographicEvidenceState';
import { EvidenceGeographyExpanded } from './EvidenceGeographyExpanded';

/**
 * P-08 — row 2, column 3.
 *
 * PAF-R1.2 (P1) — TWO STATEMENTS, NEVER ONE.
 *
 * R1 rendered a single block headed `RESOLVED LOCATION → Kigali`, which
 * labelled a RETRIEVAL TARGET as a resolution. The rail now states the two
 * things separately, because the contract holds them separately:
 *
 *   QUERY TARGET        retrievalContext.city — what the QUESTION named and
 *                       retrieval aimed at. Never a precision claim.
 *   EVIDENCE GEOGRAPHY  retrievalContext.countryName/countryCode — the level
 *                       the retained reporting actually supports, because
 *                       CountryNewsService filtered that pool at
 *                       `isRelevant >= 35`.
 *
 * When the question named a locality the evidence does not reach, the rail
 * says so in words rather than letting the target stand as a finding.
 *
 * RULING 1 STILL HOLDS: no report-count basis is rendered. `AnalysisSourceRef`
 * carries no geographic field and no per-article cluster identity is exposed,
 * so `3 OF 5` and the per-source audit rules remain omitted rather than
 * fabricated. The ceiling is stated in words instead.
 *
 * RULING 3 STILL HOLDS: the model-emitted place list is not rendered here.
 * The spec asserts both absences against this file's source text, which is
 * why neither identifier is written out.
 *
 * WHAT YIELDS WHEN THE RAIL IS SHORT (PAF-R1.2). Expanding the sources dock
 * shortens row 2, and row 2 is where this component lives. The four evidence
 * statements — query target, evidence geography, the map, the precision
 * ceiling — are all `flex-shrink-0` and are GUARANTEED; open questions is the
 * single elastic block. The yield order is therefore:
 *
 *   1. open questions scrolls inside itself;
 *   2. `dense` shortens the MAP — the one element whose content is also
 *      stated in words directly above and below it, so nothing is lost;
 *   3. the rail itself scrolls (`overflow-y-auto` on the root).
 *
 * Step 3 exists so that a longer language can never clip a sentence through
 * the middle of a glyph. A truncated precision statement would read as a
 * shorter claim than the one being made, which is the failure mode this
 * whole revision is about.
 */
export interface LocationDetailProps {
  retrievalContext: AnalysisRetrievalContext | undefined;
  /**
   * R4.1 — the countries the RETAINED REPORTING supports, aggregated from
   * `articles[].countryCode`. Omitted keeps the pre-R4.1 single-country
   * map, so a caller that has no article set cannot accidentally render an
   * evidence claim it cannot substantiate.
   */
  evidence?: EvidenceGeographyModel;
  /** ISO3 of the currently selected evidence country, if any. */
  activeIso3?: string | null;
  insufficientEvidence: InsufficientEvidenceModel | null;
  compressed?: boolean;
  /**
   * PAF-R1.2 — set while the rail's row is SHORT (today: the sources dock
   * is expanded). See the yield order in this file's header comment. It
   * shortens the map; it never removes a statement.
   */
  dense?: boolean;
  language?: LanguageCode;
}

export function LocationDetail({
  retrievalContext,
  evidence,
  activeIso3 = null,
  insufficientEvidence,
  compressed = false,
  dense = false,
  language = 'en',
}: LocationDetailProps): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.analysisFrame;
  /* ITEM E — overlay state is local to this rail. Nothing about the
     evidence contract changes; only whether a larger view of the
     SAME drawing is currently on screen. */
  const [expanded, setExpanded] = useState(false);
  const geo = dict.analysisWorkspace.geography;

  const state = buildGeographicEvidenceState(retrievalContext);
  const noOpenQuestions = `${dict.analysisWorkspace.dimensions.insufficientEvidence} · 0`.toUpperCase();

  // The accepted geography strings, reused rather than re-authored. The
  // convergence gives `precision.city` and `precision.country` the SAME tag,
  // `RETRIEVED FOR`, because the tag states how the evidence was looked for,
  // never how precisely the place is known — granularity is carried by the
  // place name rendered beside it. The branch below therefore selects which
  // dictionary entry is read, not how precise the answer is; precision is
  // decided once, in `buildGeographicEvidenceState`, and nowhere else.
  /*
   * R4.1 — THE RAIL AND THE MAP MUST NOT DISAGREE.
   *
   * `state` reads `retrievalContext`, which carries a country only on the
   * country-aware path. With the evidence map mounted, a story opened as
   * `?q=…&articleId=…` produced a rail that said "No geographic resolution
   * in evidence" directly above a map filling two countries from the
   * articles' own resolved codes. Both were rendered from real data and
   * they contradicted each other, which is worse than either alone.
   *
   * Per-record article evidence is the stronger basis, so it answers this
   * statement when it exists. When it does not, the pre-R4.1 behaviour is
   * unchanged — which is why the accepted unresolved assertions, whose
   * fixtures carry no article country, still hold.
   */
  const articleEvidence = evidence?.countries.filter((c) => c.basis === 'article-evidence') ?? [];
  const hasArticleEvidence = articleEvidence.length > 0;

  const evidencePlaceLabel = hasArticleEvidence
    ? articleEvidence.map((c) => c.name).join(' · ')
    : (state.evidenceCountryName ?? geo.noResolution);

  const evidencePrecisionLabel = hasArticleEvidence
    ? geo.precision.country
    : state.evidencePrecision === 'city'
      ? geo.precision.city
      : state.evidencePrecision === 'country'
        ? geo.precision.country
        : geo.precision.unresolved;

  return (
    <div
      data-paf="location-detail"
      data-dense={dense ? 'true' : 'false'}
      className="flex h-full min-h-0 flex-col overflow-y-auto"
    >
      {/* ── QUERY TARGET — what the question named. ───────────────────── */}
      {state.queryTargetCity !== null ? (
        <div data-paf="query-target" className="flex-shrink-0 px-4 pb-2">
          <p className="font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.16em] text-[#54687f]">
            {t.queryTarget}
          </p>
          <p className="mt-[2px] font-gn-sans text-[13px] font-semibold leading-tight text-[#a9bccf]">
            {formatPlace(state.queryTargetCity)}
          </p>
          <p className="mt-[2px] font-gn-mono text-[12px] md:text-[11px] uppercase leading-[1.4] tracking-[0.1em] text-[#4b7f8c]">
            {geo.precision.city}
          </p>
          {state.targetExceedsEvidence ? (
            <p
              data-paf="target-not-established"
              className="mt-[3px] font-gn-sans text-[12px] md:text-[11px] leading-[1.45] text-[#54687f]"
            >
              {t.targetNotEstablished}
            </p>
          ) : null}
          {state.matchedFrom !== null && state.canonicalLocation !== null ? (
            <p
              data-paf="fuzzy-disclosure"
              className="mt-[4px] font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.1em] text-[#54687f]"
            >
              {dict.retrievalContextStatus.interpretedAs} &ldquo;{state.matchedFrom}&rdquo;{' '}
              {dict.retrievalContextStatus.interpretedAsMiddle} {state.canonicalLocation}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ── EVIDENCE GEOGRAPHY — what the reporting supports. ─────────── */}
      <div data-paf="evidence-geography" className="flex-shrink-0 border-t border-[#101923] px-4 py-2">
        <p className="font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.16em] text-[#67e8f9]">
          {t.evidenceGeography}
        </p>
        <p
          data-paf="evidence-place"
          className="mt-[2px] font-gn-sans text-[14px] font-semibold leading-tight text-[#eaf6fa]"
        >
          {evidencePlaceLabel}
        </p>
        <p
          data-paf="evidence-precision"
          className="mt-[3px] font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#67e8f9]"
        >
          {evidencePrecisionLabel}
        </p>
      </div>

      {/*
        R4.1 — THE MAP NOW ANSWERS "WHAT DOES THE EVIDENCE SUPPORT?"

        `CompactMap` draws one country, taken from `retrievalContext`. That
        is the QUERY TARGET, and `analysis.service.ts` only populates it on
        the country-aware path — so a story opened as `?q=…&articleId=…`
        drew nothing at all while every retrieved article carried its own
        resolved country.

        When the caller supplies the aggregated evidence model, the
        evidence map replaces it: several countries may be filled, the
        query target is outlined without a fill, and a disagreement between
        the two is stated below rather than resolved silently.

        `CompactMap` remains the fallback for callers that legitimately
        have no article set. It is not deleted and its tests still pass.
      */}
      <div className="flex-shrink-0 px-4 pb-2">
        {evidence === undefined ? (
          <CompactMap
            evidenceCountryCode={state.evidenceCountryCode}
            evidenceCountryName={state.evidenceCountryName}
            evidencePrecision={state.evidencePrecision}
            compressed={compressed || dense}
            language={language}
          />
        ) : (
          <>
            <EvidenceMap
              model={evidence}
              activeIso3={activeIso3}
              compressed={compressed || dense}
              language={language}
            />
            <EvidenceMapLegend model={evidence} activeIso3={activeIso3} language={language} />

            {/*
              H-ALPHA-VISUAL-1 ITEM E — the one control that opens the
              expanded view.

              DISABLED WHEN THERE IS NOTHING TO INSPECT. `evidence.empty`
              means no country resolved; an expand affordance on an empty
              map would imply there is something to look at, which is the
              precise misreading this lane exists to prevent.
            */}
            {evidence.empty ? null : (
              <button
                type="button"
                data-paf="geo-expand"
                onClick={() => setExpanded(true)}
                className="mt-[6px] inline-flex min-h-[44px] items-center gap-[6px] font-gn-mono text-[12px] uppercase tracking-[0.14em] text-[#67e8f9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus md:text-[11px]"
              >
                {t.geoExpand}
                <span aria-hidden="true">&#8599;</span>
              </button>
            )}

            {expanded ? (
              <EvidenceGeographyExpanded
                model={evidence}
                precisionLabel={
                  evidence.precisionCeiling === 'country' ? t.mapCountryLevel : t.mapLegendUnresolved
                }
                onClose={() => setExpanded(false)}
                language={language}
              />
            ) : null}

            {/* Every country the reporting supports, named. */}
            {evidence.countries.length === 0 ? null : (
              <ul data-paf="evidence-country-list" className="mt-[6px] flex flex-col gap-[2px]">
                {evidence.countries.map((c) => (
                  <li
                    key={c.iso2}
                    data-paf="evidence-country-row"
                    data-iso2={c.iso2}
                    className="flex items-baseline justify-between gap-2"
                  >
                    <span className="font-gn-sans text-[12px] leading-tight text-[#eaf6fa]">
                      {c.name}
                    </span>
                    <span
                      data-paf="evidence-basis"
                      data-basis={c.basis}
                      className="shrink-0 font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.1em] text-[#4b7f8c]"
                    >
                      {/* A retrieval-filter country is supported by the
                          POOL, not by N resolved records. Printing a count
                          there would invent a per-record measurement the
                          basis does not carry. */}
                      {c.basis === 'article-evidence'
                        ? `${c.articleCount} ${t.mapReportsSuffix}`
                        : t.mapBasisRetrievalFilter}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* §4.5 — the route asked about one place and the reporting
                supports another. Stated, never reconciled by preferring
                the route. */}
            {evidence.targetDisagreesWithEvidence ? (
              <p
                data-paf="target-not-supported"
                className="mt-[5px] font-gn-sans text-[12px] md:text-[11px] leading-[1.45] text-[#e0a33d]"
              >
                {t.mapTargetNotSupported}
              </p>
            ) : null}

            {/* Reports that resolved to no country at all. */}
            {evidence.unresolvedArticleCount > 0 &&
            evidence.countries.some((c) => c.basis === 'article-evidence') ? (
              <p
                data-paf="unresolved-reports"
                className="mt-[4px] font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.1em] text-[#4b7f8c]"
              >
                {t.mapUnresolvedArticles} · {evidence.unresolvedArticleCount}
              </p>
            ) : null}

            {evidence.countries.length === 0 ? (
              <p
                data-paf="evidence-unresolved"
                className="mt-[5px] font-gn-sans text-[12px] md:text-[11px] leading-[1.45] text-[#54687f]"
              >
                {t.mapUnresolvedEvidence}
              </p>
            ) : null}
          </>
        )}
      </div>

      {/* The precision CEILING, in words. No report count — RULING 1. */}
      <div data-paf="precision-panel" className="flex-shrink-0 px-4 pb-2">
        <p className="font-gn-mono text-[12px] md:text-[11px] uppercase leading-[1.5] tracking-[0.1em] text-[#4b7f8c]">
          {/* Same reconciliation: a country resolved from the articles is
              still a country, so the ceiling statement is "no SUBNATIONAL
              precision", not "no resolution at all". */}
          {hasArticleEvidence || state.evidencePrecision !== 'unresolved'
            ? geo.noSubnationalPrecision
            : geo.noResolution}
        </p>
      </div>


      {/* Open questions. Controlled internal vertical scrolling — the rail
          absorbs length rather than the workspace expanding (CTO R1.2). */}
      <div
        data-paf="open-questions"
        className="min-h-0 flex-1 overflow-auto border-t border-[#101923] px-4 py-2"
      >
        <p className="font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#a9bccf]">
          {t.openQuestions} · {insufficientEvidence?.totalCount ?? 0}
        </p>
        {insufficientEvidence !== null && insufficientEvidence.totalCount > 0 ? (
          <ul className="mt-2 flex flex-col gap-2">
            {insufficientEvidence.citedUncertainties.map((entry, index) => (
              <li key={`cited-${index}`} className="font-gn-sans text-[12px] leading-[1.5] text-[#d5e1ee]">
                {entry.description}
              </li>
            ))}
            {insufficientEvidence.uncitedUnknowns.map((text, index) => (
              <li key={`uncited-${index}`} className="font-gn-sans text-[12px] leading-[1.5] text-[#d5e1ee]">
                {text}
                <span className="ml-2 font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.12em] text-[#4a5c73]">
                  {t.uncited}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p
            data-paf="no-open-questions"
            className="mt-2 font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.12em] text-[#4a5c73]"
          >
            {noOpenQuestions}
          </p>
        )}
      </div>
    </div>
  );
}

'use client';

import type { JSX } from 'react';
import { COUNTRIES, getLocalizedCountryName, type DisplayLocale, type PoliticsEsDevelopmentView, type PoliticsEsReadModelV1 } from '@globalnews-ai/shared';
import type { PolLocale } from '@/lib/politics/politicsStrings';
import { esCode, resolveEarlySignalStrings, type EarlySignalStrings } from '@/lib/politics/earlySignalStrings';
import { esTime, type PoliticsEsPublicRead } from '@/lib/politics/earlySignalRead';
import { POL_MICRO, Panel, Region } from './PolParts';

/**
 * MASTER CTO R66 · #90 — the Politics early-signal panel over contract `politics-early-signal/v1`.
 *
 * The public read is DISABLED today (no route, no cleared source), so the reader sees one honest notice
 * and nothing else. A read model is rendered only by EarlySignalModelView, which follows the contract's
 * render / never-render table field by field:
 *   - absence is always NAMED (no check run / no match / not available to us / could not complete);
 *   - withheld items are counted, never treated as absent;
 *   - independence is chains, not outlets; unestablished items are never added to the chain count;
 *   - three separate clocks; an event time that is not established says so;
 *   - impact is qualitative (domain, mechanism, other explanations, what would disprove it), never a
 *     percentage, score or forecast; the next check is "worth re-checking after", never a schedule;
 *   - corrections and retractions stay in the history; a dispute shows both accounts.
 * Nothing here fetches, polls, follows, notifies or counts down.
 */

export function EarlySignalPanel({ locale, read }: { locale: PolLocale; read: PoliticsEsPublicRead }): JSX.Element {
  const { strings: s } = resolveEarlySignalStrings(locale);
  return (
    <Region title={s.title}>
      {read.status === 'OK' ? (
        <EarlySignalModelView locale={locale} model={read.model} />
      ) : (
        <Panel className="flex flex-col gap-[6px] p-[12px]">
          <p data-es="public-state" data-es-status={read.status} className="text-[13px] leading-[1.5] text-sp-ink-2">
            {read.status === 'DISABLED' ? s.disabled : s.refused}
          </p>
          {read.status === 'DISABLED' && (
            <p data-es="public-reason" className="text-[12px] leading-[1.5] text-sp-ink-3">
              {s.disabledReasons[read.reason]}
            </p>
          )}
        </Panel>
      )}
    </Region>
  );
}

export function EarlySignalModelView({
  locale,
  model,
  preview = false,
}: {
  locale: PolLocale;
  model: PoliticsEsReadModelV1;
  /** Development preview only: stamps the panel as synthetic. Never set on a reader page. */
  preview?: boolean;
}): JSX.Element {
  const { strings: s, fellBack } = resolveEarlySignalStrings(locale);
  const t = (iso: string | null | undefined) => esTime(iso, locale);
  const last = t(model.evaluation.lastEvaluatedAt);
  const attemptAt = t(model.evaluation.lastAttempt.at);
  const attemptDiffers =
    model.evaluation.lastAttempt.at !== model.evaluation.lastEvaluatedAt && attemptAt !== null;

  return (
    <div data-es="model" data-es-origin={model.dataOrigin} className="flex min-w-0 flex-col gap-[10px]">
      {preview && (
        <p data-es="preview-stamp" className={`${POL_MICRO} border border-sp-amber/40 px-[8px] py-[4px] text-sp-amber`}>
          {s.preview}
        </p>
      )}
      {fellBack && (
        <p data-es="locale-fallback" className={`${POL_MICRO} text-sp-ink-3`}>
          {s.localeFallback}
        </p>
      )}
      {/* "Last checked" is the last COMPLETED evaluation; a failed attempt never moves it */}
      <p data-es="last-checked" className="text-[12px] text-sp-ink-2">
        {last === null ? s.notCheckedYet : s.lastChecked(last)}
      </p>
      {attemptDiffers && (
        <p data-es="last-attempt" className="text-[12px] text-sp-ink-3">
          {s.lastAttempt(attemptAt, s.access[model.evaluation.lastAttempt.access] ?? s.notDescribed)}
        </p>
      )}
      {model.absence !== null && (
        <p data-es="absence" data-es-state={model.absence.state} className="text-[13px] leading-[1.5] text-sp-ink">
          {s.absence[model.absence.wordingCode] ?? s.notDescribed}
        </p>
      )}
      {model.withheld.count !== 0 && (
        <p data-es="withheld" className="text-[12px] leading-[1.5] text-sp-ink-2">
          {s.withheld(model.withheld.count)}
          {Object.entries(model.withheld.reasons).length !== 0 && (
            <span className="text-sp-ink-3">
              {' · '}
              {Object.entries(model.withheld.reasons)
                .map(([reason, n]) => `${s.withheldReasons[reason] ?? s.notDescribed} (${n})`)
                .join(', ')}
            </span>
          )}
        </p>
      )}
      {model.developments.map((d) => (
        <DevelopmentCard key={d.developmentKey} d={d} s={s} locale={locale} last={last} />
      ))}
    </div>
  );
}

function DevelopmentCard({
  d,
  s,
  locale,
  last,
}: {
  d: PoliticsEsDevelopmentView;
  s: EarlySignalStrings;
  locale: PolLocale;
  last: string | null;
}): JSX.Element {
  const t = (iso: string | null | undefined) => esTime(iso, locale);
  const current = d.claims.find((c) => c.status === 'CURRENT') ?? d.claims[0];
  const country = d.country.iso3 === null ? null : countryName(d.country.iso3, locale);
  const place =
    d.country.basis === 'NOT_ESTABLISHED' || country === null
      ? s.placeNotEstablished
      : d.country.basis === 'ATTRIBUTED_BY_PUBLISHER'
        ? s.placeReported(country)
        : s.placeObserved(country);
  const event = d.timeline.eventTime;
  const eventText =
    event.basis === 'NOT_ESTABLISHED' || t(event.from) === null
      ? s.notEstablished
      : t(event.to) !== null && event.to !== event.from
        ? `${t(event.from)} – ${t(event.to)}`
        : (t(event.from) as string);

  return (
    <Panel className="flex min-w-0 flex-col gap-[10px] p-[12px]">
      <article data-es="development" data-es-key={d.developmentKey} className="flex min-w-0 flex-col gap-[8px]">
        <div className="flex flex-wrap items-center gap-[6px]">
          <span data-es="status" data-es-status={d.statementStatus} className={`${POL_MICRO} border border-sp-line px-[7px] py-[3px] text-sp-ink-2`}>
            {d.statementStatus === 'CORROBORATED'
              ? s.corroborated(d.sourceChainCount)
              : s.attributed(current?.attribution.publisherId ?? s.notDescribed)}
          </span>
          {d.change !== null && (
            <span data-es="change" data-es-change={d.change} className={`${POL_MICRO} border border-sp-cyan/45 px-[7px] py-[3px] text-sp-cyan`}>
              {s.change[d.change](last ?? s.notEstablished)}
            </span>
          )}
          {d.corrected && (
            <span data-es="corrected" className={`${POL_MICRO} border border-sp-line px-[7px] py-[3px] text-sp-ink-2`}>
              {s.corrected}
            </span>
          )}
          {d.retracted && (
            <span data-es="retracted" className={`${POL_MICRO} border border-sp-amber/40 px-[7px] py-[3px] text-sp-amber`}>
              {s.retracted}
            </span>
          )}
        </div>

        {current !== undefined && (
          <p data-es="claim" className="text-[14px] leading-[1.5] text-sp-ink">
            {s.predicate[current.predicate] ?? s.notDescribed}
          </p>
        )}

        <p data-es="place" className="text-[12px] text-sp-ink-2">
          {place}
          {d.country.basis !== 'NOT_ESTABLISHED' && country !== null && (
            <span className="text-sp-ink-3"> · {s.precision[d.country.precision] ?? s.notDescribed}</span>
          )}
          {s.regionalReview[d.regionalReview] ? <span className="text-sp-ink-3"> · {s.regionalReview[d.regionalReview]}</span> : null}
        </p>

        {d.unestablishedChainItems !== 0 && (
          <p data-es="unestablished" className="text-[12px] text-sp-ink-3">
            {s.unestablished(d.unestablishedChainItems)}
          </p>
        )}

        {d.requiresHumanReview && (
          <p data-es="human-review" className="text-[12px] text-sp-amber">
            {s.requiresHumanReview}
          </p>
        )}

        <dl data-es="timeline" className="grid gap-[2px_12px] text-[12px] [grid-template-columns:auto_1fr]">
          <dt className="text-sp-ink-3">{s.times.published}</dt>
          <dd className="text-sp-ink-2">{t(d.timeline.earliestPublishedAt) ?? s.notEstablished}</dd>
          <dt className="text-sp-ink-3">{s.times.firstSeen}</dt>
          <dd className="text-sp-ink-2">{t(d.timeline.earliestFirstSeenAt) ?? s.notEstablished}</dd>
          <dt className="text-sp-ink-3">{s.times.event}</dt>
          <dd data-es="event-time" className="text-sp-ink-2">{eventText}</dd>
        </dl>

        {d.disputed.length !== 0 && (
          <div data-es="disputed" className="flex flex-col gap-[4px]">
            <p className={`${POL_MICRO} text-sp-ink-2`}>{s.disputedTitle}</p>
            {d.disputed.map((dispute) => (
              <div key={dispute.claimKeys.join('|')} className="grid gap-[8px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
                {dispute.claimKeys.map((key) => {
                  const claim = d.claims.find((c) => c.claimKey === key);
                  return (
                    <p key={key} data-es="disputed-account" className="border border-sp-line p-[8px] text-[12px] text-sp-ink-2">
                      {claim === undefined
                        ? s.notDescribed
                        : `${s.attributed(claim.attribution.publisherId)}: ${s.predicate[claim.predicate] ?? s.notDescribed}`}
                    </p>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <section data-es="impact" data-es-class={d.impact.evidenceClass} className="flex flex-col gap-[6px]">
          <p className={`${POL_MICRO} text-sp-ink-2`}>{s.impactTitle}</p>
          {s.codesInEnglishNote !== null && d.impact.hypotheses.length !== 0 && (
            <p data-es="codes-in-english" className="text-[11px] text-sp-ink-3">{s.codesInEnglishNote}</p>
          )}
          <p className="text-[12px] text-sp-ink-2">{s.evidenceClass[d.impact.evidenceClass] ?? s.notDescribed}</p>
          {d.impact.hypotheses.map((h, i) => (
            <div key={`${h.domain}-${h.mechanismCode}-${i}`} data-es="hypothesis" data-es-domain={h.domain} className="flex flex-col gap-[3px] border-l border-sp-line pl-[10px]">
              <p className="text-[12.5px] text-sp-ink">
                {s.domain[h.domain] ?? s.notDescribed}: {esCode(s, h.mechanismCode)}
                <span className="text-sp-ink-3"> · {s.horizon[h.horizon] ?? s.notDescribed}</span>
              </p>
              {h.competingHypothesisCodes.length !== 0 && (
                <p className="text-[12px] text-sp-ink-3">
                  {s.competing}: {h.competingHypothesisCodes.map((c) => esCode(s, c)).join('; ')}
                </p>
              )}
              {h.disconfirmerCodes.length !== 0 && (
                <p className="text-[12px] text-sp-ink-3">
                  {s.disconfirmers}: {h.disconfirmerCodes.map((c) => esCode(s, c)).join('; ')}
                </p>
              )}
              <p data-es="next-check" className="text-[12px] text-sp-ink-2">
                {t(h.nextCheck.notBefore) === null
                  ? s.nextCheckNoTime(esCode(s, h.nextCheck.conditionCode))
                  : s.nextCheck(t(h.nextCheck.notBefore) as string, esCode(s, h.nextCheck.conditionCode))}
              </p>
            </div>
          ))}
        </section>

        {d.claims.slice(1).length !== 0 && (
          <details data-es="history" className="text-[12px]">
            <summary className="min-h-[44px] cursor-pointer py-[10px] text-sp-ink-2">{s.history}</summary>
            <ol className="flex flex-col gap-[4px]">
              {d.claims.map((c) => (
                <li key={c.claimKey} data-es="history-claim" data-es-claim-status={c.status} className="text-sp-ink-3">
                  {s.attributed(c.attribution.publisherId)}: {s.predicate[c.predicate] ?? s.notDescribed} ·{' '}
                  {s.claimStatus[c.status] ?? s.notDescribed}
                </li>
              ))}
            </ol>
          </details>
        )}
      </article>
    </Panel>
  );
}

/**
 * The context-rail line (Politics Phase 1 §4: nothing else is permanently resident). Today it states the
 * DISABLED public read; when a public read is ever OK it offers one control that opens the full view in
 * the screen's existing drawer. Nothing is fetched or run by rendering it.
 */
export function EarlySignalStatusLine({
  locale,
  read,
  onOpen,
}: {
  locale: PolLocale;
  read: PoliticsEsPublicRead;
  onOpen: () => void;
}): JSX.Element {
  const { strings: s } = resolveEarlySignalStrings(locale);
  if (read.status === 'OK') {
    return (
      <button type="button" data-es="open" onClick={onOpen}
        className={`${POL_MICRO} min-h-[44px] self-start border border-sp-line px-[12px] text-sp-ink-2`}>
        {s.title} →
      </button>
    );
  }
  return (
    <span data-es="public-state" data-es-status={read.status} className="text-[12px] leading-[1.45] text-sp-ink-3">
      {read.status === 'DISABLED' ? `${s.disabled} ${s.disabledReasons[read.reason]}` : s.refused}
    </span>
  );
}

/** The country in the reader's own locale, from the shared country table (no lane outside Politics). */
function countryName(iso3: string, locale: PolLocale): string {
  const meta = COUNTRIES.find((c) => c.iso3 === iso3);
  return (meta === undefined ? undefined : getLocalizedCountryName(meta.iso2, locale as DisplayLocale)) ?? iso3;
}

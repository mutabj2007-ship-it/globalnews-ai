import type { EconomyLocale } from '@/lib/economy/strings';
import { economyStrings } from '@/lib/economy/strings';
import type {
  CompetingReadingSet, EconomyWatchScope, FigureSlot, LifecycleEvent,
  TimelineEntry, TransmissionLink,
} from '@/lib/economy/types';
import { EconomyFigure, FigureAxesLine, SupersededFigure, figureText } from './FigureTags';
import { economyFigure, figureObservation, figureSemantics, gapReason, slotPeriodLabel } from '@/lib/economy/economyAdapters';
import { ECON_INK, ECON_LINE, ECON_MONO, ECON_SURFACE } from './econTokens';
import type { EconomyAiConfig, WatchRuntimeCapability } from '@/lib/economy/economyConfig';
import { meteredActionCost } from '@/lib/economy/economyConfig';

const micro = {
  fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.1em * var(--ar-ls-mul, 1))',
  textTransform: 'uppercase' as const, color: ECON_INK.primary,
};
const metaLine = {
  fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.07em * var(--ar-ls-mul, 1))', color: ECON_INK.label,
};

/**
 * ECON-UI-1 — REVISION TRACK (desktop 03).
 *
 * A revision is intelligence, not a correction. The track preserves three things: the
 * original release, each revision, and — the reason revisions are first-class — THE
 * ASSESSMENT CHANGE EACH ONE PRODUCED. The superseded value is retained and shown struck,
 * never deleted and never overwritten.
 */
export function RevisionTrack({
  vintages, locale, assessmentEffects,
}: {
  vintages: readonly FigureSlot[];
  locale: EconomyLocale;
  assessmentEffects: Readonly<Record<string, string>>;
}): JSX.Element {
  const last = vintages.length - 1;
  return (
    <div data-econ="revision-track">
      {vintages.map((slot, i) => {
        const superseded = i < last;
        const o = figureObservation(slot);
        const key = `${slotPeriodLabel(slot)}-${o?.vintage ?? 'gap'}-${i}`;
        return (
          <div
            key={key}
            data-econ="revision-row"
            data-superseded={superseded ? 'true' : 'false'}
            style={{
              display: 'grid', gridTemplateColumns: '104px 1fr',
              borderBottom: `1px solid ${ECON_LINE.hairline}`,
              background: i === last ? ECON_SURFACE.raised : 'transparent',
            }}
          >
            <div style={{ padding: '15px 16px', borderRight: `1px solid ${ECON_LINE.hairline}`, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 11px)', color: ECON_INK.secondary }}>{o?.vintage ?? '—'}</span>
              <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.09em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.label }}>
                {o?.vintage ?? (gapReason(slot) ?? '')}
              </span>
            </div>
            <div style={{ padding: '15px 16px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              {superseded && o
                ? <SupersededFigure observation={o} />
                : <EconomyFigure slot={slot} sizePx={22} />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontSize: 'max(var(--ar-fs-min, 0px), 13px)', lineHeight: 'var(--ar-lh, 1.5)', color: ECON_INK.primary }}>
                  {(o ? assessmentEffects[`${o.seriesId}:${o.vintage}`] : undefined) ?? ''}
                </span>
                {figureSemantics(slot) && (
                  <FigureAxesLine
                    axes={figureSemantics(slot)!}
                    locale={locale}
                    extra={slotPeriodLabel(slot)}
                    sizePx={11}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * ECON-UI-1 — COMPETING READINGS (desktop 04, compact M7).
 *
 * NEITHER FIGURE IS PROMOTED. Both cards use the identical class chip and identical
 * figure styling, because the disagreement here is forecast versus forecast, not
 * statistic versus interpretation — and that is the whole content of the state. There is
 * no `primary` styling branch in this component to reach for.
 */
export function CompetingReadings({
  set, locale, ai, onCompare,
}: {
  set: CompetingReadingSet;
  locale: EconomyLocale;
  ai: EconomyAiConfig;
  onCompare?: () => void;
}): JSX.Element {
  const t = economyStrings(locale);
  const cost = meteredActionCost(ai, 'COMPARE_FORECASTS');

  return (
    <div data-econ="competing-readings">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: ECON_LINE.hairline }}>
        {set.readings.map((r) => (
          <article key={r.id} data-econ="reading-card" style={{ background: ECON_SURFACE.panel, padding: '17px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span
              data-econ="source-class"
              style={{
                fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.09em * var(--ar-ls-mul, 1))', textTransform: 'uppercase',
                color: ECON_INK.primary, border: `1px solid ${ECON_LINE.border}`, padding: '3px 7px', alignSelf: 'flex-start',
              }}
            >
              {t.sourceClass[r.source.sourceClass]}
            </span>
            <span style={{ fontSize: 'max(var(--ar-fs-min, 0px), 14px)', fontWeight: 600, color: ECON_INK.primary }}>{r.source.publisher}</span>
            <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 30px)', fontWeight: 500, color: ECON_INK.primary }}>
              {figureText(economyFigure({
                seriesId: r.source.id,
                periodId: r.vintage,
                vintage: r.vintage,
                value: r.value,
                unit: r.unit,
                semantics: { releaseStatus: null, valueKind: 'FORECAST', freshness: 'FRESH' },
                provenance: { sourceType: 'NEWS_PROVIDER' },
              }))}
            </span>
            <p style={{ margin: 0, fontSize: 'max(var(--ar-fs-min, 0px), 13px)', lineHeight: 'var(--ar-lh, 1.6)', color: ECON_INK.tertiary }}>{r.claim}</p>
            <div style={{ paddingTop: '10px', borderTop: `1px solid ${ECON_LINE.hairline}`, display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={metaLine}>PUBLISHED {r.source.publishedAt}</span>
              <span style={metaLine}>{r.evidenceCount} SOURCES · {r.officialStatisticalCount} OFFICIAL STATISTICAL</span>
              <span style={metaLine}>VINTAGE {r.vintage}</span>
            </div>
          </article>
        ))}
      </div>

      <div style={{ padding: '15px 18px', borderTop: `1px solid ${ECON_LINE.hairline}`, display: 'flex', flexDirection: 'column', gap: '11px' }}>
        <span style={micro}>{t.sharedObservationBase}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {set.sharedObservationBase.map((o) => (
            <span key={o} style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.07em * var(--ar-ls-mul, 1))', color: ECON_INK.tertiary, border: `1px solid ${ECON_LINE.border}`, padding: '4px 8px' }}>
              {o}
            </span>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 'max(var(--ar-fs-min, 0px), 12px)', lineHeight: 'var(--ar-lh, 1.65)', color: ECON_INK.label }}>{set.assessment}</p>
        <span style={metaLine}>
          {t.confidence[set.confidence]} · {set.disputedObservationCount} DISPUTED OBSERVATIONS
        </span>
        {cost !== null && (
          <div style={{ paddingTop: '10px', borderTop: `1px solid ${ECON_LINE.hairline}` }}>
            {/*
              The ONLY metered affordance in this drawer. Cost in the label AND on the
              button, taken from configuration — never the word METERED, never a literal.
            */}
            <button
              type="button"
              data-econ="metered-action"
              data-sand-cost={cost}
              onClick={onCompare}
              style={{
                fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.07em * var(--ar-ls-mul, 1))', textTransform: 'uppercase',
                color: ECON_INK.primary, border: `1px solid ${ECON_LINE.emphasis}`, background: ECON_SURFACE.selected,
                padding: '9px 12px', cursor: 'pointer',
              }}
            >
              Compare forecasts · {cost} sand
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ECON-UI-1 — TRANSMISSION CHAIN (desktop 05/13, compact M9).
 *
 * A continuous visual chain must never imply stronger causality than its weakest
 * supported link. Weak links stay VISIBLE and stay WEAK: dotted node, thinned connector,
 * de-emphasised title. The relation word comes from the closed set — the type will not
 * accept anything else.
 */
export function TransmissionChain({
  links, locale,
}: {
  links: readonly TransmissionLink[];
  locale: EconomyLocale;
}): JSX.Element {
  const t = economyStrings(locale);
  return (
    <div data-econ="transmission-chain" style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: '20px 1fr', gap: '12px' }}>
      {links.map((l, i) => (
        <div key={l.id} style={{ display: 'contents' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span
              data-econ="chain-node"
              data-supported={l.supported ? 'true' : 'false'}
              style={{
                width: '9px', height: '9px', marginTop: '5px',
                border: l.supported ? `1px solid ${ECON_INK.tertiary}` : `1px dotted ${ECON_INK.reduced}`,
              }}
            />
            {i < links.length - 1 && (
              <span style={{ width: '1px', flex: 1, minHeight: '10px', background: l.supported ? ECON_LINE.border : ECON_LINE.hairline }} />
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingBottom: '14px' }}>
            <span style={{ fontSize: 'max(var(--ar-fs-min, 0px), 14px)', fontWeight: 500, color: l.supported ? ECON_INK.primary : ECON_INK.tertiary }}>{l.title}</span>
            <span style={{ fontSize: 'max(var(--ar-fs-min, 0px), 12px)', color: ECON_INK.label, fontStyle: 'italic' }}>
              {t.relation[l.relation]}{l.relationDetail ? ` ${l.relationDetail}` : ''}
            </span>
            <span style={metaLine}>
              {l.crossDomain ? `${l.crossDomain} · SHARED EVIDENCE · ` : ''}
              {l.evidenceCount} SOURCES · {t.confidence[l.confidence].toUpperCase()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * ECON-UI-1 — WATCH CONFIGURATION (desktop 10, compact M5).
 *
 * A country economy is a CONFIGURED BASKET, ALWAYS SHOWN DECOMPOSED. There is no
 * aggregate figure in this component and no field to compute one from — the design is
 * emphatic that a single "economy score" would be an invented number.
 *
 * DEP-3: NEW_RELEASE and REVISED are lifecycle triggers the SHARED Watch runtime must
 * accept. When it cannot yet receive them the binding is DISABLED and said so, rather
 * than emulated locally. Economy builds no monitor.
 */
export function WatchConfiguration({
  scope, locale, runtime, onToggleMember,
}: {
  scope: EconomyWatchScope;
  locale: EconomyLocale;
  runtime: WatchRuntimeCapability;
  onToggleMember?: (subjectId: string) => void;
}): JSX.Element {
  const t = economyStrings(locale);
  return (
    <div data-econ="watch-config" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
      <span style={micro}>{scope.label}</span>

      <div data-econ="watch-basket" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {scope.members.map((m) => (
          <button
            key={m.subjectId}
            type="button"
            data-econ="basket-member"
            data-enabled={m.enabled ? 'true' : 'false'}
            aria-pressed={m.enabled}
            onClick={() => onToggleMember?.(m.subjectId)}
            style={{
              fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.07em * var(--ar-ls-mul, 1))', padding: '4px 8px', cursor: 'pointer',
              ...(m.enabled
                ? { color: ECON_INK.primary, border: `1px solid ${ECON_LINE.emphasis}`, background: ECON_SURFACE.selected }
                : { color: ECON_INK.label, border: `1px solid ${ECON_LINE.border}`, background: 'transparent' }),
            }}
          >
            {m.label} · {m.enabled ? t.on : t.off}
          </button>
        ))}
      </div>

      <p style={{ margin: 0, fontSize: 'max(var(--ar-fs-min, 0px), 12px)', lineHeight: 'var(--ar-lh, 1.65)', color: ECON_INK.label }}>{t.basketNote}</p>

      <div style={{ paddingTop: '9px', borderTop: `1px solid ${ECON_LINE.hairline}`, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ ...metaLine, textTransform: 'uppercase' }}>{t.notifyOn}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {scope.triggers.map((tr) => {
            const bound = runtime.acceptsLifecycleTriggers && runtime.supportedTriggers.includes(tr);
            return (
              <span
                key={tr}
                data-econ="watch-trigger"
                data-bound={bound ? 'true' : 'false'}
                style={{
                  fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.07em * var(--ar-ls-mul, 1))', padding: '4px 8px',
                  color: bound ? ECON_INK.primary : ECON_INK.reduced,
                  border: `1px solid ${bound ? ECON_LINE.emphasis : ECON_LINE.border}`,
                }}
              >
                {t.watchTrigger[tr]}
              </span>
            );
          })}
        </div>
        {!runtime.acceptsLifecycleTriggers && (
          /*
            Feature-gated and stated, not silently inert. DEP-3 is an integration
            dependency on the shared Watch service, not something Economy can close.
          */
          <span data-econ="watch-binding-gated" style={{ ...metaLine, lineHeight: 'var(--ar-lh, 1.6)' }}>
            TRIGGER BINDING NOT ACTIVE — SHARED WATCH RUNTIME DOES NOT YET ACCEPT LIFECYCLE TRIGGERS (DEP-3)
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * ECON-UI-1 — TIMELINE (desktop 14). Data + evidence + the assessment that resulted.
 * Superseded observations stay reachable, marked superseded. Reading it costs nothing.
 */
export function EconomyTimeline({ entries }: { entries: readonly TimelineEntry[] }): JSX.Element {
  return (
    <div data-econ="timeline" style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: ECON_LINE.hairline, margin: '16px 18px', border: `1px solid ${ECON_LINE.hairline}` }}>
      {entries.map((e) => (
        <div
          key={e.id}
          data-econ="timeline-entry"
          data-current={e.isCurrent ? 'true' : 'false'}
          style={{
            background: e.isCurrent ? ECON_SURFACE.selected : ECON_SURFACE.raised,
            borderLeft: e.isCurrent ? `2px solid ${ECON_LINE.accentLine}` : '2px solid transparent',
            padding: '11px 13px', display: 'grid', gridTemplateColumns: '76px 1fr', gap: '12px', alignItems: 'baseline',
          }}
        >
          <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.08em * var(--ar-ls-mul, 1))', color: e.isCurrent ? ECON_INK.secondary : ECON_INK.label }}>
            {e.dateLabel}
          </span>
          <span style={{ fontSize: 'max(var(--ar-fs-min, 0px), 13px)', lineHeight: 'var(--ar-lh, 1.5)', color: ECON_INK.primary }}>
            {e.body} <span style={{ color: ECON_INK.label }}>[{e.meta}]</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Policy-event detail (desktop 09): the statement and the expectation it defied. */
export function PolicyEventDetail({ events, locale }: { events: readonly LifecycleEvent[]; locale: EconomyLocale }): JSX.Element {
  const t = economyStrings(locale);
  return (
    <div data-econ="policy-event" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '11px' }}>
      {events.map((e) => (
        <div key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingBottom: '11px', borderBottom: `1px solid ${ECON_LINE.hairline}` }}>
          <span style={{ ...metaLine, textTransform: 'uppercase' }}>{t.watchTrigger.POLICY_RESPONSE} · {e.occurredAt}</span>
          <span style={{ fontSize: 'max(var(--ar-fs-min, 0px), 13px)', lineHeight: 'var(--ar-lh, 1.5)', color: ECON_INK.primary }}>{e.label}</span>
        </div>
      ))}
    </div>
  );
}

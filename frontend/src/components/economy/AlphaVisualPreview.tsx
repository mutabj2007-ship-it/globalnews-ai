import { retainedEconomyStrings } from '@/lib/economy/strings';
import type { JSX } from 'react';
import type { EconomyLocale } from '@/lib/economy/strings';
import { resolveEconomyStrings } from '@/lib/economy/strings';
import { ECON_INK, ECON_LINE, ECON_MONO, ECON_SURFACE } from './econTokens';
import { ALPHA_PREVIEW_VISUAL_SCOPE } from '@/lib/specialist/previewScope';

/**
 * THE MARKER THAT SAYS WHAT THIS SURFACE IS.
 *
 * The activation requires the Economy visual preview to *"clearly be an Alpha Product
 * Owner visual-preview surface"*. It also requires that missing data must not dominate the
 * page, and the two pull against each other: the obvious way to make a surface declare
 * itself is the fixture banner — a bordered block with a title and a sentence — and that
 * is a second panel competing with the dashboard the Product Owner came to look at.
 *
 * So this is one line of the same height as the platform's locale-fallback strip: a rule,
 * eight pixels of padding, and a mono label. It sits above the frame, it is not
 * dismissible, and it is the first thing in the document so a screen reader meets it
 * before the dashboard.
 *
 * ── WHY IT IS NOT A FIXTURE BANNER, AND MUST NOT BECOME ONE ───────────────
 *
 * `FixtureBanner` denotes invented illustrative figures. This preview instead binds an
 * internal retained read: admitted displayable observations may populate it; otherwise
 * the accepted absence frame renders. It never falls back to fixtures.
 *
 * The marker identifies the noindex preview route, not the availability of figures.
 * Its display copy uses the authored locale catalogue. Observed scope follows retained
 * evidence; the planned visual scope is only a fallback when no observation is available.
 * Source-language metadata stays separate from display-language selection.
 */
/**
 * Planned scope is presentation metadata from the shared preview registry. It never
 * changes the production subject. When retained data is bound, observedGeography takes
 * precedence so preview navigation cannot mislabel the observation's actual geography.
 */

export function AlphaVisualPreviewMarker({
  locale,
  observedGeography,
}: {
  locale: EconomyLocale;
  observedGeography?: string;
}): JSX.Element {
  const res = resolveEconomyStrings(locale);
  return (
    <div
      data-econ="alpha-visual-preview"
      data-preview-locale={res.requested}
      data-preview-locale-resolved={res.resolved}
      data-preview-locale-fellback={String(res.fellBack)}
      data-preview-visual-scope={observedGeography ?? ALPHA_PREVIEW_VISUAL_SCOPE.geo}
      data-preview-scope-kind={observedGeography ? 'observed' : 'planned'}
      role="note"
      style={{
        flex: '0 0 auto', padding: '8px 20px',
        background: ECON_SURFACE.raised, borderBottom: `1px solid ${ECON_LINE.structure}`,
        fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)',
        letterSpacing: 'calc(0.1em * var(--ar-ls-mul, 1))', textTransform: 'uppercase',
        color: ECON_INK.tertiary,
        display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'baseline',
      }}
    >
      <span>{retainedEconomyStrings(locale).preview}</span>
      <span style={{ color: ECON_INK.label }}>
        {res.fellBack ? `${res.requested} → ${res.resolved}` : res.resolved}
      </span>
      {/*
        The ruling, rendered. `Planned visual scope` is the qualifier doing the work: it
        keeps the line a statement of intent, so it cannot be read as the subject having
        acquired a geography. It sits in the marker's own tertiary/label pairing rather
        than in a colour or weight of its own, because a plan should not out-rank the
        dashboard it introduces.
      */}
      {observedGeography ? (
        <span>
          {retainedEconomyStrings(locale).observedScope}{' '}
          <span style={{ color: ECON_INK.label }}>{observedGeography}</span>
        </span>
      ) : (
        <span>
          {retainedEconomyStrings(locale).plannedScope}{' '}
          <span style={{ color: ECON_INK.label }}>
            {ALPHA_PREVIEW_VISUAL_SCOPE.label} ({ALPHA_PREVIEW_VISUAL_SCOPE.geo})
          </span>
        </span>
      )}
    </div>
  );
}

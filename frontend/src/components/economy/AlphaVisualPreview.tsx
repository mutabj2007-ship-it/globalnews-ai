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
 * `FixtureBanner` declares that the FIGURES ON SCREEN ARE INVENTED. Nothing on this
 * surface is invented — there are no figures at all, because the capability passed to the
 * frame is the measured `NO_OBSERVATION_SOURCE` and not `FIXTURE`. Borrowing the fixture
 * banner here would tell a reader the opposite of what is true and would make the real
 * fixture declaration mean less wherever it genuinely applies.
 *
 * What this marker declares is narrower and is about the ROUTE, not the data: that the
 * governed `/economy` route is not open, and that this address exists so a layout can be
 * inspected before it is.
 *
 * ── WHY IT IS IN ENGLISH ONLY, DELIBERATELY ───────────────────────────────
 *
 * Every other string on this page comes from `economyStrings`, which the localisation lane
 * authored across all seven display locales, and this lane authors no translation. This
 * marker has no authored source and is not sent to one, because it is not reader copy: it
 * addresses the Product Owner inspecting an unrouted address, and it disappears with the
 * preview the moment `/economy` opens. Translating a surface that exists to be deleted
 * would put a permanent string in the catalogue for a temporary address.
 *
 * The locale still reaches the marker, and it is used for something real: the resolution's
 * `fellBack` flag is reported beside the label, so an inspector reading the Polish capture
 * can tell at a glance whether the frame below is genuinely Polish or English standing in.
 * For Economy today it is genuinely Polish, and the marker is where that is verifiable
 * rather than assumed.
 */
/**
 * ── THE PLANNED ALPHA VISUAL SCOPE — A PRESENTATION LABEL, NOT A BINDING ──
 *
 * Product Owner ruling: *"visual scope = Poland. Show Poland as the planned Alpha visual
 * scope in the preview chrome/header."* This is the ruling §9 of the delivery asked for and
 * deliberately declined to make — *"that is a one-line change to an accepted module and
 * should be a ruling, not my decision."* Declining was right. The ruling is made now, and
 * it is applied HERE rather than in the accepted module, which is the whole point.
 *
 * The same ruling forbids the obvious implementation: *"Do not mutate or falsely bind the
 * production Economy subject (`economyIso2: ZZ`) merely to make the label appear."*
 * Writing `Poland` into `PRODUCTION_SHAPED_SUBJECT` would print `Poland` beside a subject
 * bound to no economy — a claim the accepted module deliberately does not make, and one
 * that would still be sitting there the day `/economy` opens, over data never collected
 * for Poland.
 *
 * So the scope lives in the PREVIEW MARKER and nowhere else. Three consequences follow,
 * and each is what makes this honest rather than merely convenient:
 *
 *   1. It is scoped to the preview. The marker renders on `/economy-visual-preview` and
 *      its compact twin and on no other surface, so the label cannot reach a reader who
 *      is not the Product Owner inspecting a layout.
 *   2. It disappears with the preview. When `/economy` opens this component is deleted and
 *      the scope goes with it — there is no migration step at which a presentation label
 *      could be mistaken for a bound subject.
 *   3. It is worded as a PLAN. `Planned visual scope` states what Alpha intends to show,
 *      not what is bound or observed. The frame forty pixels below still reads
 *      `No subject bound`, and the two are consistent precisely because this one does not
 *      claim otherwise.
 *
 * **The eventual live route must derive geography from the actual bound subject.** That is
 * the ruling's closing requirement, and it is why this constant is not exported to, nor
 * read by, anything that renders `/economy`. `previewScopeRuling.spec.ts` asserts the
 * production subject still carries `ZZ` and `No subject bound`, so the day someone tries
 * to satisfy a header by editing the subject instead, that guard fails first.
 *
 * ── WHY THE VALUE IS IMPORTED AND NOT WRITTEN HERE ────────────────────────
 *
 * It was written here first, and `ECON-UI-1 · fixtures are illustrative, never production
 * facts` rejected it: that accepted guard forbids `Rwanda|Mombasa|Kigali|Poland|NISR|GUS`
 * in every non-fixture file under `components/economy`, because those are the design's
 * illustrative economies and the guard keeps them inside `fixtures.ts`.
 *
 * The guard was not weakened, edited or suppressed — it was right. A planned presentation
 * scope is not Economy domain data, so it lives in `lib/specialist/previewScope.ts` with
 * the rest of this preview's own machinery, and the Economy component tree still contains
 * no country name. The reasoning is written out in full at that module.
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

'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * R7 — THE SHARED PRESENTATION RIBBON. ONE COMPONENT, TWO CONSUMERS.
 *
 * Implemented from `10-PRESENTATIONRIBBON-IMPLEMENTATION-SPEC.md` (R7, FINAL).
 * Section references below are to that document.
 *
 * ── WHY THIS FILE EXISTS AT ALL ───────────────────────────────────────────
 *
 * R7 §0: "If the seven steps are implemented twice they will drift and the
 * language stops being a language." Before creating it I inspected every ref in
 * the repository — 26703ebd, 9aca0cd, 498237d2, 68c9094, 537782c, 8247414 — and
 * no PresentationRibbon exists on any of them. So this is the first
 * implementation, written as the neutral shared primitive R7 §9 authorises,
 * with NO Today-specific orchestration inside it.
 *
 * ── WHAT A CALLER MAY AND MAY NOT DO ──────────────────────────────────────
 *
 * The component owns the labels, the hues, the order and the icons (§1.1). A
 * caller supplies content and nothing else: it cannot reorder a step, relabel
 * one, recolour one, or add a sixth. `cells` is a fixed 5-tuple in the fixed
 * order, and TypeScript enforces the arity.
 *
 * ── UNCERTAIN IS A TREATMENT, NOT A CELL (§0, §6.4, T-02) ─────────────────
 *
 * There is no UNCERTAIN cell and no code path that could produce one. Limited
 * or contested evidence changes the EVIDENCE cell's tick hue, ground and border
 * — nothing else, anywhere, ever.
 *
 * ── SOLID AMBER = ACTION. TINTED AMBER = UNCERTAINTY (§0, §9.3, T-14) ─────
 *
 * `ACTION_AMBER` and `UNCERTAIN_AMBER` are deliberately two constants holding
 * the same hex, because R7 §5 requires them to remain separate tokens: one
 * token invites a solid uncertainty fill. Solid amber appears here in exactly
 * one place — the DEEP ANALYSIS control. The evidence meter's filled segment is
 * 13×4px, which §9.3 explicitly permits as a MARK rather than a surface.
 *
 * ── COLOUR VALUES ARE TRANSCRIBED, NOT INVENTED ──────────────────────────
 *
 * Every hex below is quoted from R7 §5 / §6.4 / §9 / §14. All but three are
 * already released values in `tailwind.config.ts`, and the spec asserts that
 * cross-check so a transcription cannot drift. The three that are not
 * (`#141d29`, `#7dc0ff`, `#d97706` — the sources active state, the sources
 * focus ring and the deep-analysis active state) come from R7 §14 and are
 * listed explicitly in the spec's allowlist rather than being silently new.
 *
 * They are written as Tailwind arbitrary values rather than added to
 * `tailwind.config.ts`, DELIBERATELY: the `gn-*` block is H's, and this lane's
 * standing rule is that it is consumed as classes and never edited. Adding
 * tokens there would be an H/G file intersection, and R7 §9 requires me to
 * report one before making it rather than make it.
 *
 * ── LAYOUT IS THE HOST'S, AND THIS COMPONENT MUST NOT BREAK IT (§10, T-22) ─
 *
 * No viewport unit, no fixed position, no height that exceeds the container,
 * and no media query: the column count comes from `auto-fit` over a 162px
 * minimum and NOTHING else (§2, T-05), so the same instance reflows in Today's
 * centre column and in the wider workspace without caching a count.
 */

/* ── R7 §5 — tokens. Two amber constants, one hex, by requirement. ───────── */
const AI = '#60a5fa';
const GEO = '#22d3ee';
const SIGNIFICANCE = '#a78bfa';
const VERIFIED = '#34d399';
const UNCERTAIN_AMBER = '#f59e0b';
const ACTION_AMBER = '#f59e0b';
const UNKNOWN = '#4a5c73';

export type RibbonDensity = 'card' | 'workspace' | 'mobile';

export type CellProvenance =
  | 'evidence-resolved'
  | 'retrieved-for'
  | 'ai-interpreted'
  | 'unresolved';

export interface EvidenceSupport {
  bars: 0 | 1 | 2 | 3;
  word: 'LIMITED' | 'MODERATE' | 'STRONG';
  contested?: boolean;
}

export interface RibbonCell {
  kind: 'what' | 'where' | 'why' | 'who' | 'evidence';
  /**
   * The supported value. `null` renders the §8 unavailable state IN PLACE —
   * the cell keeps its slot and its position. It is never omitted (T-03).
   */
  value: string | null;
  basisNote?: string;
  /** §7 — WHERE and WHO only. Four classes, four visual cues. */
  provenance?: CellProvenance;
  /** §6.4 — EVIDENCE only. */
  evidence?: EvidenceSupport;
}

export interface PresentationRibbonProps {
  /** Exactly five, in the fixed order. The tuple type is the enforcement. */
  cells: readonly [RibbonCell, RibbonCell, RibbonCell, RibbonCell, RibbonCell];
  sources: { count: number; expanded: boolean; onToggle: () => void; labelVariant?: 'view' | 'show' };
  /** §9.2 — omitted means the action is ABSENT. It is never disabled. */
  deepAnalysis?: { onOpen: () => void };
  density: RibbonDensity;
  /** §1 — the host's own control, e.g. Today's watch toggle. Wraps last. */
  hostSlot?: React.ReactNode;
  language?: LanguageCode;
}

/* §5 — the hue each step's tick and label carry. Owned here, never passed in. */
const STEP_HUE: Record<RibbonCell['kind'], string> = {
  what: AI,
  where: GEO,
  why: SIGNIFICANCE,
  who: GEO,
  evidence: VERIFIED,
};

/**
 * §1 — the order is FIXED. The tuple type fixes the arity; this fixes the
 * identity, so a caller cannot hand over five cells in the wrong sequence and
 * get a silently reordered language. A mismatch is a programming error and is
 * thrown rather than rendered (T-01).
 */
const ORDER: ReadonlyArray<RibbonCell['kind']> = ['what', 'where', 'why', 'who', 'evidence'];

function assertOrder(cells: ReadonlyArray<RibbonCell>): void {
  cells.forEach((cell, index) => {
    if (cell.kind !== ORDER[index]) {
      throw new Error(
        `PresentationRibbon: cell ${index} must be '${ORDER[index]}', received '${cell.kind}'.`,
      );
    }
  });
}

/* §11 — a value past roughly forty words scrolls inside the cell rather than
   growing it. The cell never exceeds 132px of value. */
const LONG_VALUE_WORDS = 40;

function isLong(value: string): boolean {
  return value.trim().split(/\s+/).length > LONG_VALUE_WORDS;
}

/* §6.4 — the EVIDENCE cell is the only cell with a variable treatment. */
function evidenceTreatment(evidence: EvidenceSupport | undefined): {
  hue: string;
  ground: string;
  border: string;
} {
  if (evidence === undefined) return { hue: VERIFIED, ground: '#080d14', border: 'transparent' };
  if (evidence.contested === true) {
    return { hue: UNCERTAIN_AMBER, ground: 'rgba(245,158,11,.05)', border: 'rgba(245,158,11,.4)' };
  }
  if (evidence.bars <= 1) {
    return { hue: UNCERTAIN_AMBER, ground: 'rgba(245,158,11,.05)', border: 'rgba(245,158,11,.28)' };
  }
  return { hue: VERIFIED, ground: '#080d14', border: 'transparent' };
}

/* §6.5, §8 — unresolved WHERE is NEUTRAL and UNTINTED. Tinting it amber would
   state uncertainty about the evidence rather than about the location (T-21). */
function cellHue(cell: RibbonCell): string {
  if (cell.value === null) return UNKNOWN;
  if (cell.kind === 'evidence') return evidenceTreatment(cell.evidence).hue;
  if (cell.provenance === 'unresolved' || cell.provenance === 'ai-interpreted') return UNKNOWN;
  return STEP_HUE[cell.kind];
}

/* §6.4 — three 13×4 bars. The WORD always accompanies them; the meter is never
   the sole carrier of support (T-20). */
function EvidenceMeter({ evidence, label }: { evidence: EvidenceSupport; label: string }): JSX.Element {
  /* §6.4 — contested leaves the bar COUNT unchanged; only the treatment and the
     basis wording carry the contradiction. */
  const filled = evidence.bars;
  const fill =
    evidence.contested === true || evidence.bars <= 1
      ? UNCERTAIN_AMBER
      : evidence.bars === 2
        ? '#6ee7b7'
        : VERIFIED;
  return (
    <span className="mt-[5px] flex items-center gap-[7px]">
      <span role="img" aria-label={label} className="flex items-center gap-[2px]">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            aria-hidden="true"
            className="h-[4px] w-[13px] rounded-[2px]"
            style={{ backgroundColor: index < filled ? fill : '#1b2634' }}
          />
        ))}
      </span>
      <span
        className="font-gn-mono text-[7.5px] font-bold uppercase tracking-[.10em]"
        style={{ color: fill }}
      >
        {evidence.word}
      </span>
    </span>
  );
}

export function PresentationRibbon({
  cells,
  sources,
  deepAnalysis,
  density,
  hostSlot,
  language = 'en',
}: PresentationRibbonProps): JSX.Element {
  assertOrder(cells);
  const t = getDictionary(language).presentationRibbon;

  const valueSize = density === 'workspace' ? '13.5px' : '12.5px';
  const valueLeading = density === 'workspace' ? 1.5 : 1.45;
  const valueCap = density === 'workspace' ? '56ch' : '48ch';

  /* §13 — at mobile density ④ WHO moves BELOW the action row as one inline
     line. It is not dropped: all five steps remain present and ordered (T-27). */
  const inlineWho = density === 'mobile';
  const gridCells = cells.filter((cell) => !(inlineWho && cell.kind === 'who'));
  const whoCell = cells[3];

  const renderCell = (cell: RibbonCell): JSX.Element => {
    const hue = cellHue(cell);
    const unavailable = cell.value === null;
    const treatment = cell.kind === 'evidence' ? evidenceTreatment(cell.evidence) : null;
    const basisId = `ribbon-basis-${cell.kind}`;
    const tinted = treatment !== null && treatment.border !== 'transparent';

    return (
      <div
        key={cell.kind}
        className="px-[13px] py-[11px]"
        style={{
          background: treatment !== null ? treatment.ground : '#080d14',
          border: tinted ? `1px solid ${treatment.border}` : undefined,
        }}
      >
        <dt className="flex items-center gap-[6px]" style={{ opacity: unavailable ? 0.55 : 1 }}>
          {/* §4 — step tick: a 5×5 square in the step hue, beside its own text. */}
          <span
            aria-hidden="true"
            className="h-[5px] w-[5px] shrink-0 rounded-[1px]"
            style={{ backgroundColor: hue }}
          />
          {/* §3 — labels are verbatim caps, nowrap, and NEVER truncate: the grid
              drops a column instead (T-04). */}
          <span
            className="whitespace-nowrap font-gn-mono text-[7.5px] font-bold uppercase tracking-[.10em]"
            style={{ color: hue, lineHeight: 1 }}
          >
            {t.labels[cell.kind]}
          </span>
        </dt>

        <dd className="mt-[6px]" aria-describedby={tinted ? basisId : undefined}>
          {unavailable ? (
            /* §8 — the unavailable state. No tint, no border, no basis note. */
            <span
              className="italic"
              style={{ color: UNKNOWN, fontSize: valueSize, lineHeight: valueLeading }}
            >
              {t.unavailable}
            </span>
          ) : (
            <span
              className="block font-gn-display"
              style={{
                color: '#dbe6f2',
                fontSize: valueSize,
                lineHeight: valueLeading,
                maxWidth: valueCap,
                textWrap: 'pretty',
                ...(isLong(cell.value ?? '')
                  ? { maxHeight: '132px', overflowY: 'auto', overflowX: 'hidden' }
                  : {}),
              }}
            >
              {cell.value}
            </span>
          )}

          {cell.kind === 'evidence' && cell.evidence !== undefined && !unavailable && (
            <EvidenceMeter
              evidence={cell.evidence}
              label={`${t.evidenceSupport}: ${cell.evidence.word}, ${cell.evidence.bars} ${t.ofThree}`}
            />
          )}

          {/* §7 — provenance carries TEXT, not just colour, and the dot's fill
              differs per class so the four are separable in greyscale (T-16). */}
          {!unavailable && cell.basisNote !== undefined && (
            <span
              id={basisId}
              className="mt-[5px] flex items-center gap-[5px] font-gn-mono text-[7.5px] uppercase tracking-[.06em]"
              style={{ color: UNKNOWN, lineHeight: 1.5 }}
            >
              {cell.provenance !== undefined && (
                <span
                  aria-hidden="true"
                  className="h-[5px] w-[5px] shrink-0 rounded-full"
                  style={
                    cell.provenance === 'evidence-resolved'
                      ? { backgroundColor: GEO }
                      : cell.provenance === 'retrieved-for'
                        ? { border: `1px solid ${GEO}` }
                        : cell.provenance === 'ai-interpreted'
                          ? { backgroundColor: UNKNOWN }
                          : { border: `1px solid ${UNKNOWN}` }
                  }
                />
              )}
              <span className="basis">{cell.basisNote}</span>
            </span>
          )}
        </dd>
      </div>
    );
  };

  const sourcesLabel = `${sources.expanded ? '▾' : '▸'} ${
    sources.labelVariant === 'show' ? t.showSources : t.viewSources
  } (${sources.count})`;

  return (
    <div
      /* §2 — ribbon ground and top border. No viewport unit, no fixed
         position, no height (T-22). */
      className="border-t"
      style={{ background: '#070c12', borderTopColor: '#16202e' }}
    >
      {/* §15 — a definition list is the honest semantic for ordered
          question/answer pairs, and gives the label with every value (T-29). */}
      <dl
        className="grid gap-px"
        style={{
          background: '#101923',
          gridTemplateColumns: inlineWho
            ? '1fr'
            : 'repeat(auto-fit, minmax(162px, 1fr))',
        }}
      >
        {gridCells.map(renderCell)}
      </dl>

      <div
        className="flex flex-wrap items-center gap-[9px] border-t px-[13px] py-[11px]"
        style={{ borderTopColor: '#101923', rowGap: '8px' }}
      >
        {/* §9.1 — the count is ALWAYS in the label. Never a bare chevron. */}
        <button
          type="button"
          aria-expanded={sources.expanded}
          onClick={sources.onToggle}
          className={`inline-flex min-h-[44px] items-center gap-[8px] rounded-[7px] border px-[13px] font-gn-mono text-[9.5px] font-bold uppercase tracking-[.08em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
            density === 'mobile' ? 'w-full justify-center' : ''
          }`}
          style={{
            background: sources.expanded ? '#22303f' : '#1b2634',
            borderColor: sources.expanded ? '#3c526a' : '#2a3a4d',
            color: '#94a3b8',
            outlineColor: '#7dc0ff',
          }}
        >
          <span
            aria-hidden="true"
            className="h-[13px] w-[13px] shrink-0 rounded-[2px]"
            style={{ border: '1.5px solid currentColor' }}
          />
          {sourcesLabel}
        </button>

        {/* §9.2 — ABSENT, never disabled, where there is no analysis to open. */}
        {deepAnalysis !== undefined && (
          <button
            type="button"
            onClick={deepAnalysis.onOpen}
            className={`inline-flex min-h-[44px] items-center gap-[8px] rounded-[7px] px-[13px] font-gn-mono text-[9.5px] font-bold uppercase tracking-[.08em] hover:bg-[#fbbf24] active:bg-[#d97706] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fbbf24] ${
              density === 'mobile' ? 'w-full justify-center' : ''
            }`}
            style={{ background: ACTION_AMBER, color: '#05080d' }}
          >
            {density === 'workspace' && (
              <span
                aria-hidden="true"
                className="h-[9px] w-[9px] shrink-0 rotate-45"
                style={{ border: '1.5px solid #05080d' }}
              />
            )}
            {t.deepAnalysis}
            <span aria-hidden="true" className="text-[11px] font-bold">
              &rarr;
            </span>
          </button>
        )}

        {/* §11 — the host slot wraps last; it is the only optional element. */}
        {hostSlot}
      </div>

      {/* §13 — ④ WHO, inline, below the actions, at mobile density only. */}
      {inlineWho && (
        <p className="flex flex-wrap items-baseline gap-[6px] px-[13px] pb-[11px]">
          <span
            className="font-gn-mono text-[8.5px] font-medium uppercase tracking-[.08em]"
            style={{ color: GEO }}
          >
            {t.labels.who}
          </span>
          <span style={{ color: whoCell.value === null ? UNKNOWN : '#dbe6f2', fontSize: '12px' }}>
            {whoCell.value ?? t.unavailable}
          </span>
        </p>
      )}
    </div>
  );
}

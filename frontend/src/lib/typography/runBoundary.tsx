import type { CSSProperties, ReactNode } from 'react';
import { DISPLAY_LOCALE_META, type DisplayLocale } from '@globalnews-ai/shared';

/**
 * LANG-UI-7 — THE RUN / SCRIPT BOUNDARY.
 *
 * Authority: Design AR Typography R2, AR Microtype A1, R3-FINAL §6.1 / §7,
 * Addendum A1 §B, Addendum A2.
 *
 * WHY THIS IS ONE COMPONENT AND NOT THREE MECHANISMS.
 *
 * A run is either Arabic-human-readable or Latin-machine-readable, and that one
 * fact decides family, weight, tracking, case, size floor, line-height and
 * direction together. Splitting them produced the defect that was withdrawn:
 * a page-wide `:root[lang="ar"] :where(*)` tracking reset stripped tracking
 * from the very Latin islands AR-T-07 requires to keep it, and left the
 * guarantee depending on stylesheet declaration order.
 *
 * HOW IT REACHES AN ELEMENT THAT DECLARES ITS OWN TYPOGRAPHY.
 *
 * It does not out-specify the element. It supplies the OPERAND its own
 * declaration reads. Every Latin typography utility is emitted by
 * `arabic-policy-plugin.js` as `max(var(--ar-fs-min, 0px), 7.5px)`,
 * `calc(.10em * var(--ar-ls-mul, 1))`, `var(--ar-tt, uppercase)` and so on, so
 * setting the policy variables here changes what the element's OWN declaration
 * computes to. There is no cascade contest to win, which is why the result
 * cannot depend on source order (Phase 0: 0 of 128 values change under full
 * rule reversal).
 *
 * The island is the exact mirror: it sets every policy variable to `initial`,
 * the guaranteed-invalid value, so each `var()` falls through to its own Latin
 * fallback. It therefore restores family, size, weight, case and tracking
 * WITHOUT KNOWING which utilities the element carries — which is what makes
 * the exemption expressible for values that do not exist yet.
 */

/** The entry-point declaration the boundary owns. Inline, so it never competes
 *  in the stylesheet cascade with a descendant's own utility. */
const RUN_ENTRY_STYLE: CSSProperties = {
  /*
   * D7-AR-ADOPTION — the family is declared here for exactly the reason the
   * island below declares six properties, and it is the same correction.
   *
   * The island's own note records why resetting `--ar-*` was not enough: it
   * "restores nothing for an element that declares no typography and merely
   * INHERITS a computed value from an ancestor", and the variable reset alone
   * "failed every case where [the marker] did not [sit on the utility-bearing
   * element], which is the majority of real call sites."
   *
   * The run side had that same unfixed half. Setting `--ar-family` only reaches
   * a descendant that DECLARES a family, and almost none does — body text
   * inherits its computed family from an ancestor ABOVE the run, so the variable
   * was never read. Measured on the production build: 238 Arabic nodes inside a
   * correctly marked run, 0 of them in an Arabic face.
   *
   * This reads `--ar-family`, the value the accepted base layer already sets,
   * exactly as the island reads `--latin-family`. No policy, variable, selector
   * or plugin changes, and outside Arabic `ScriptRun` emits no marker and no
   * style at all, so no Latin surface is touched by construction.
   */
  fontFamily: 'var(--ar-family, inherit)',
  fontSize: 'max(var(--ar-fs-min, 0px), 1em)',
  lineHeight: 'var(--ar-lh, normal)',
};

/**
 * THE ISLAND'S OWN DECLARATIONS — and why resetting the policy variables is not enough.
 *
 * Setting `--ar-*` to `initial` restores an element's OWN declaration, because that
 * declaration is a `var()` which then falls through to its own Latin fallback. It
 * restores nothing for an element that declares no typography and merely INHERITS a
 * computed Arabic value from an ancestor: inheritance passes a computed value, and
 * there is no declaration left to re-evaluate.
 *
 * That is the ordinary production shape — a reference id sits inside a paragraph whose
 * utilities are on the paragraph — so the island re-declares from the `--latin-*`
 * capture variables the policy plugin sets alongside every utility. Those inherit, so
 * the island reconstructs the Latin value whether the utility is on itself or on any
 * ancestor, and still without naming a single utility.
 *
 * Declared INLINE, so there is no stylesheet-cascade contest to lose or to win by
 * source order. Measured: 0 of 80 computed values change when all 2451 production
 * rules are re-emitted in reverse.
 *
 * A regression test found this. The variable reset alone passed every case where the
 * marker sat on the utility-bearing element and failed every case where it did not,
 * which is the majority of real call sites.
 */
const ISLAND_STYLE: CSSProperties = {
  fontFamily: 'var(--latin-family, inherit)',
  fontSize: 'var(--latin-fs, 1em)',
  lineHeight: 'var(--latin-lh, normal)',
  fontWeight: 'var(--latin-fw, inherit)' as CSSProperties['fontWeight'],
  textTransform: 'var(--latin-tt, none)' as CSSProperties['textTransform'],
  letterSpacing: 'var(--latin-ls, normal)',
};

export type ArabicRunStep = 'chrome' | 'wrapping';

interface ArabicRunProps {
  locale: DisplayLocale;
  /**
   * AR-MICROTYPE-1 line-height step. `chrome` is single-line (1.35);
   * `wrapping` is running text (1.55 minimum). The marker selects the step;
   * the step declares the policy. Values are per-step, never per-element.
   */
  step?: ArabicRunStep;
  as?: 'span' | 'div' | 'p';
  className?: string;
  children: ReactNode;
}

/**
 * Marks human-readable content in the resolved locale.
 *
 * For a non-Arabic locale this renders a plain element with NO marker and no
 * policy variables, so every Latin locale is byte-identical to today. The
 * component is safe to place unconditionally; it is inert outside Arabic.
 */
export function ScriptRun({
  locale,
  step = 'chrome',
  as: Tag = 'span',
  className,
  children,
}: ArabicRunProps): JSX.Element {
  if (DISPLAY_LOCALE_META[locale].direction !== 'rtl') {
    return <Tag className={className}>{children}</Tag>;
  }
  return (
    <Tag
      data-run={step === 'wrapping' ? 'ar-human-wrap' : 'ar-human'}
      style={RUN_ENTRY_STYLE}
      className={className}
    >
      {children}
    </Tag>
  );
}

/**
 * A machine-readable Latin value inside any run.
 *
 * SEMANTICS — the escape is EXPLICIT and never inferred. A component marks an
 * island because the VALUE is machine-readable: geographyId, SituationId, ISO
 * codes, coordinates and bbox tuples, evidence and provenance refs, version
 * strings, hashes, URLs, timestamps, non-localized codes, symbol-form units.
 * There is no content sniffing and no "looks like Latin" heuristic, because a
 * heuristic would be wrong for the first value nobody anticipated.
 *
 * Spelled localized units and short human prose are NOT islands: they take the
 * Arabic floor and policy like any other human text.
 *
 * THE STORED VALUE IS NEVER ALTERED. `dir="ltr"` plus `unicode-bidi: isolate`
 * change rendering only. This is correctness, not cosmetics: unisolated Latin
 * inside an RTL run reorders punctuation and adjacent digits, so a copied
 * identifier round-trips WRONG. Before LANG-UI-7 the product had zero bidi
 * isolation of any kind.
 */
export function MachineReadable({
  as: Tag = 'span',
  className,
  children,
}: {
  as?: 'span' | 'div' | 'code';
  className?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <Tag data-run="latin-mr" dir="ltr" style={ISLAND_STYLE} className={className}>
      {children}
    </Tag>
  );
}

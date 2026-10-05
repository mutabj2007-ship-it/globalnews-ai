import {
  directionFor,
  formattingProfileFor,
  type DisplayLocale,
  type TextDirection,
} from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK DIRECTION AND FORMATTING — ARABIC RTL, AND Intl INSTEAD OF HAND-ROLLING
 * ════════════════════════════════════════════════════════════════════════════
 *
 * R4 · CLAUDE H. Arabic is the only RTL member of the contracted seven, and the shared
 * contract already decided both facts this module needs — `directionFor('ar') === 'rtl'`
 * and `formattingProfileFor('ar') === 'ar-u-nu-arab-ca-gregory'` (Eastern-Arabic numerals,
 * Gregorian calendar, no regional variant). Nothing here re-decides them; a component that
 * computed its own direction would be the second authority the shared contract exists to
 * prevent.
 *
 * ── THE FOUR BIDI DEFECTS THIS CLOSES ────────────────────────────────────
 *
 * 1. **`dir` at the wrong scope.** Setting `dir="rtl"` on `<html>` flips the whole product
 *    chrome; setting it per text node loses paragraph direction. `askDirectionProps`
 *    returns the pair for ONE content scope, so a surface puts it on the Ask tree and the
 *    bidi algorithm has the paragraph it needs.
 *
 * 2. **A URL inside an RTL paragraph reorders.** `https://example.com/a/b` in an Arabic
 *    sentence renders with its segments visually rearranged, because the slashes are
 *    neutral characters taking the paragraph's direction. A reader cannot tell which host
 *    they are about to visit. `isolatedLtr` wraps such a run in `dir="ltr"` with
 *    `unicode-bidi: isolate`, which is the fix — not `&lrm;` marks, which do not isolate.
 *
 * 3. **Trailing punctuation jumps.** A source chip like `Reuters — 3 reports.` ends with
 *    neutrals that attach to whichever run follows. Chips therefore isolate too, which is
 *    why `askChipProps` exists rather than components styling chips ad hoc.
 *
 * 4. **Hand-rolled dates and numbers.** `askR2View.formatUtc` carried two hard-coded
 *    month-name arrays (`['sty','lut',…]` / `['Jan','Feb',…]`) and `padStart` clock
 *    arithmetic — correct for two locales and wrong for five, and incapable of
 *    Eastern-Arabic numerals. Everything here goes through `Intl` with the locale's own
 *    formatting profile.
 *
 * NOTHING HERE IS PER-LANGUAGE. There is no `if (locale === 'ar')` in this file: direction
 * comes from the shared table, and every formatter is constructed from the profile. Arabic
 * works because the data says it is RTL, not because a branch names it.
 */

export type { TextDirection };

/** The attribute pair a content scope may honestly declare. */
export interface AskDirectionProps {
  readonly lang: DisplayLocale;
  readonly dir: TextDirection;
}

/**
 * The `lang`/`dir` pair for ONE Ask content scope.
 *
 * It takes the locale whose content is actually rendered. A caller holding a requested
 * locale that it cannot render must resolve it first (`resolveAskInterfaceLocale`), because
 * `lang` describes what is on the page — the rule `assertDocumentLanguageDescribesRenderedContent`
 * states, and the defect measured in `offline.html`.
 */
export function askDirectionProps(renderedLocale: DisplayLocale): AskDirectionProps {
  return { lang: renderedLocale, dir: directionFor(renderedLocale) };
}

export function askIsRtl(locale: DisplayLocale): boolean {
  return directionFor(locale) === 'rtl';
}

/**
 * R4 · CTO RTL RULING — the glyph of a BACK control points toward where the reader came from:
 * left in a left-to-right layout, right in a right-to-left one. Decided by the locale's
 * direction (the shared direction table), never by a language-specific string. The glyph is
 * decoration: callers render it aria-hidden and keep their own localized accessible label.
 */
export function askBackGlyph(locale: DisplayLocale): '←' | '→' {
  return askIsRtl(locale) ? '→' : '←';
}

/**
 * Props for a run that is ALWAYS left-to-right regardless of the paragraph: a URL, a host,
 * an email, an identifier, a version, a bare ISO timestamp.
 *
 * `unicode-bidi: isolate` is load-bearing and `embed` is not a substitute: embed leaves the
 * run's neutral characters able to interact with the surrounding text, which is how a
 * trailing slash ends up at the wrong end of a host name.
 */
export interface IsolatedRunProps {
  readonly dir: 'ltr';
  readonly style: { readonly unicodeBidi: 'isolate'; readonly direction: 'ltr' };
}

export function isolatedLtr(): IsolatedRunProps {
  return { dir: 'ltr', style: { unicodeBidi: 'isolate', direction: 'ltr' } };
}

/**
 * Props for a run whose direction should be INHERITED but whose boundaries must not leak.
 *
 * This is the right isolation for publisher prose, story titles and chip labels: their
 * direction is whatever the surrounding scope resolves to — a Latin publisher inside an
 * Arabic thread, or Arabic reporting inside a Latin one — but their leading and trailing
 * neutrals (quotes, dashes, periods, brackets) must not join the neighbouring run.
 *
 * It takes no locale ON PURPOSE. A component that asked for the locale in order to isolate
 * would be deciding direction a second time; `isolate` with no `dir` lets the scope decide
 * and only bounds the run.
 */
/**
 * CENTERED COMPOSER R1 — the auto-isolation shape, NAMED so a caller can type a prop with it
 * rather than re-describing it. Deliberately carries NO `dir`: a run that inherits its
 * direction must not declare one, or it becomes a second direction authority inside a
 * paragraph that already has one.
 */
export interface IsolatedAutoProps {
  readonly style: { readonly unicodeBidi: 'isolate' };
}

export function isolatedAuto(): IsolatedAutoProps {
  return { style: { unicodeBidi: 'isolate' } };
}

/**
 * Props for a source/evidence chip.
 *
 * A chip is a self-contained run whose punctuation must not leak into the paragraph, so it
 * isolates in its OWN direction rather than in LTR — a chip of Arabic publisher text stays
 * RTL, a chip containing a URL uses `isolatedLtr` for that part.
 */
export interface ChipProps {
  readonly dir: TextDirection;
  readonly style: { readonly unicodeBidi: 'isolate' };
}

export function askChipProps(locale: DisplayLocale): ChipProps {
  return { dir: directionFor(locale), style: { unicodeBidi: 'isolate' } };
}

/**
 * Props for a run of copy that is NOT in the scope's language.
 *
 * MEASURED, IN THE ARABIC SCREENSHOT. Chrome that still comes from the EN/PL catalogues
 * renders inside the RTL Ask scope, and its trailing punctuation moves to the wrong end:
 * "…about what has not been assessed." was drawn as ".about what has not been assessed".
 * The period is a NEUTRAL character, so the bidi algorithm gives it the paragraph's
 * direction, not the sentence's.
 *
 * The fix is to isolate the run in ITS OWN direction. `fallbackIsRtl` is false here because
 * every catalogue this applies to is EN or PL, both left-to-right; the parameter exists so a
 * future RTL fallback does not need a second helper. Returns `undefined` when the scope and
 * the copy already agree, so a left-to-right reader's markup is untouched.
 */
export function askForeignCopyProps(
  scopeLocale: DisplayLocale,
  copyIsLtr = true,
): IsolatedRunProps | undefined {
  if (!askIsRtl(scopeLocale)) return undefined;
  return copyIsLtr ? isolatedLtr() : undefined;
}

/**
 * Logical-direction alignment. `start`/`end` rather than `left`/`right`, so one value is
 * correct in both directions and no component carries a mirrored copy of a layout.
 */
export function askTextAlignStart(): 'start' {
  return 'start';
}

export function askTextAlignEnd(): 'end' {
  return 'end';
}

/* ────────────────────────────────────────────────────────────────────────────
   Intl FORMATTING — ONE FORMATTER PER (LOCALE, SHAPE), BUILT FROM THE PROFILE
   ──────────────────────────────────────────────────────────────────────────── */

const dateTimeCache = new Map<string, Intl.DateTimeFormat>();
const numberCache = new Map<string, Intl.NumberFormat>();

function dateTimeFormatter(
  locale: DisplayLocale,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}\u0000${JSON.stringify(options)}`;
  const cached = dateTimeCache.get(key);
  if (cached !== undefined) return cached;
  const made = new Intl.DateTimeFormat(formattingProfileFor(locale), options);
  dateTimeCache.set(key, made);
  return made;
}

function numberFormatter(
  locale: DisplayLocale,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale}\u0000${JSON.stringify(options)}`;
  const cached = numberCache.get(key);
  if (cached !== undefined) return cached;
  const made = new Intl.NumberFormat(formattingProfileFor(locale), options);
  numberCache.set(key, made);
  return made;
}

/**
 * A UTC instant, in the reader's locale, with the zone named.
 *
 * ── WHY THE PARTS ARE REASSEMBLED INSTEAD OF USING `format()` ─────────────
 *
 * The ORDER is the product's — day, month, year, then the clock — and it is frozen: Ask has
 * rendered `28 Sep 2026, 04:52 UTC` since D25 and several accepted specs assert that exact
 * string. `Intl.DateTimeFormat('en').format` returns `Sep 28, 2026, 04:52`, so calling it
 * directly would have silently re-ordered every English and Polish timestamp in Ask — a
 * change this contract explicitly forbids.
 *
 * `formatToParts` separates the two concerns properly. The locale decides the month's NAME,
 * the digits' NUMERALS and the hour's padding — which is what the five new locales and
 * Arabic's Eastern-Arabic digits need — and the product decides the arrangement. EN and PL
 * come out byte-identical to the hand-written tables this replaced, which is asserted rather
 * than assumed.
 *
 * `timeZone: 'UTC'` is explicit and the suffix stays literal: Ask states retrieval and
 * publication instants in UTC deliberately, so rendering them in the reader's local zone
 * would change what the timestamp means. Returns `null` for an absent or unparseable value —
 * the shape `formatUtc` already had, so callers do not change.
 */
export function askFormatUtcInstant(
  iso: string | undefined | null,
  locale: DisplayLocale,
): string | null {
  if (iso === undefined || iso === null) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const parts = dateTimeFormatter(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(t));
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  const day = part('day');
  const month = part('month');
  const year = part('year');
  const hour = part('hour');
  const minute = part('minute');
  if (day === '' || month === '' || year === '' || hour === '' || minute === '') return null;
  return `${day} ${month} ${year}, ${hour}:${minute} UTC`;
}

/** A calendar date with no clock, for list grouping and report dates. */
export function askFormatDate(
  iso: string | undefined | null,
  locale: DisplayLocale,
): string | null {
  if (iso === undefined || iso === null) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const parts = dateTimeFormatter(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(new Date(t));
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  const day = part('day');
  const month = part('month');
  const year = part('year');
  if (day === '' || month === '' || year === '') return null;
  return `${day} ${month} ${year}`;
}

/**
 * A count, in the locale's own numerals.
 *
 * This is why Arabic needs `Intl` rather than string interpolation: `ar-u-nu-arab` renders
 * 12 as ١٢, and a template literal renders it as 12 inside an Arabic sentence.
 */
export function askFormatCount(value: number, locale: DisplayLocale): string {
  if (!Number.isFinite(value)) return '';
  return numberFormatter(locale, { maximumFractionDigits: 0 }).format(value);
}

/**
 * Plural category for a count, from the locale's own rules.
 *
 * Arabic has six categories and Polish has four; a `n === 1 ? x : y` branch is wrong in
 * both. Returns the category so a catalogue entry can select its own form, which is the
 * shape `PluralForms` in the shared contract already declares.
 */
export function askPluralCategory(value: number, locale: DisplayLocale): Intl.LDMLPluralRule {
  return new Intl.PluralRules(formattingProfileFor(locale)).select(value);
}

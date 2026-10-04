import { DISPLAY_LOCALES, formattingProfileFor, isDisplayLocale, type DisplayLocale } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R4 · PHASE B — THE SEVEN-LANGUAGE ASK SHELL, AS AN OVERLAY OVER ONE SOURCE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── THE DEFECT ────────────────────────────────────────────────────────────
 *
 * The Product Owner's live Alpha proof shows a French hero over an English application.
 * Measured: `AskR2Locale = 'en' | 'pl'` — a hard two-locale type behind the ENTIRE Ask
 * shell — so selecting French changed the strings that came from the seven-language
 * catalogue and nothing else. A reader got a mixed-language interface, which is worse than
 * either language alone.
 *
 * ── WHY AN OVERLAY AND NOT FIVE FULL CATALOGUES ───────────────────────────
 *
 * Five hand-copied catalogues drift: a key added to English is silently absent everywhere
 * else, and the absence shows up as English text in front of a French reader — exactly the
 * defect being fixed. So there is ONE source of truth (the English catalogue) and each
 * locale supplies an OVERLAY of the keys it has translated.
 *
 * THE RULE THAT MAKES THIS SAFE, AND IT IS THE CTO'S: *"Missing catalogue keys must fail
 * tests rather than silently displaying English."* A key that falls through to English is
 * not forbidden — it is REPORTED. `shellFallbacks()` returns every key that fell through for
 * a locale, and the spec asserts that set equals the DECLARED pending-L manifest exactly.
 * So:
 *
 *   · a key nobody has translated yet and that IS declared  → passes, and is visibly pending;
 *   · a key that silently started falling back               → FAILS, because it is undeclared;
 *   · a key L delivers                                       → removed from the manifest, and
 *                                                              the test tightens by itself.
 *
 * Nothing can fall back quietly. That is the whole requirement.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * THE CORRECTION THIS REVISION MAKES — TEN KEYS THE SCAFFOLD COULD NOT SEE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The first version of this module walked strings, arrays and nested objects and FELL
 * THROUGH on a member whose value is a function. Ten Ask-shell members are functions:
 *
 *     askR2Strings.freshness.corroboratedAsOf   (reports: number) => string
 *     askR2Strings.r3.relationshipScope         (a, b, relations: readonly string[]) => string
 *     askR2Strings.r3.choiceFor                 (question, objective) => string
 *     askR2Strings.clarify.broadening           (notApplied: readonly string[], withSuggestion) => string
 *     askR2Strings.guest.remaining              (n: number) => string
 *     askR2Strings.sourcesLabel                 (n: number) => string
 *     briefingStrings.savedAs                   (version: number) => string
 *     briefingStrings.latest                    (version: number, asOf: string) => string
 *     briefingStrings.version                   (n: number) => string
 *     briefingStrings.superseded                (newer: number) => string
 *
 * Every one of them is reader-visible wording. Because `shellKeyPaths` did not emit them,
 * `shellFallbacks` could not report them either: the accounting would have declared a
 * locale COMPLETE while ten English sentences were still being rendered to it. That is the
 * precise failure mode the CTO's rule exists to prevent, reintroduced by an enumerator bug.
 *
 * The measured inventory on the finalisation base `5699eb7` is therefore **479** keys, not
 * the 469 reported earlier, and Claude L's scope is **450**, not 413. The manifest was
 * reissued as Revision 3 rather than quietly corrected.
 *
 * ── WHY A TEMPLATE IS LOCALIZED AS DATA AND NOT AS CODE ───────────────────
 *
 * A translator returns words, not functions. So a function-valued member is localized by
 * DATA — a pattern, or a set of plural forms — which `renderShellTemplate` turns back into a
 * function with the source's own signature. Two kinds cover eight of the ten:
 *
 *   `pattern`  positional substitution: `'{0} — pour {1} ?'`
 *   `plural`   one pattern per CLDR category, selected by `Intl.PluralRules` for the
 *              locale, because `n === 1 ? a : b` is wrong in Polish (four categories) and
 *              wrong in Arabic (six). Polish already needed a hand-written three-way rule
 *              for `sourcesLabel`; no further language will need one.
 *
 * ── AND WHY TWO OF THEM ARE DECLARED STRUCTURAL INSTEAD ───────────────────
 *
 * `r3.relationshipScope` and `clarify.broadening` are not substitution. The first appends an
 * optional tail and joins a list; the second branches on a boolean and quotes the reader's
 * own words with a conjunction and quotation marks that differ per language (EN `“a” and
 * “b”`, PL `„a” i „b”`). Inventing a mini-template-language with optional segments and list
 * joins would be a second, weaker `Intl` — so these two are declared `structural` and
 * localized by a small per-locale FUNCTION supplied alongside the data overlay, written from
 * L's returned wording. They are not exempt from the accounting: a structural template with
 * neither a function nor a declaration is a fallback like any other key.
 *
 * ── AUTHORSHIP ────────────────────────────────────────────────────────────
 *
 * The CTO ruled that H owns the architecture and **Claude L owns native-quality wording** for
 * fr / de / es / pt-BR / ar, and that H's own strings must never be labelled as qualified.
 * Every string H authored carries its locale+key in the pending-L declaration, and
 * `askShellQualification()` reports it. H drafts are excluded from linguistic acceptance.
 */

/** A nested record of strings — the shape every Ask catalogue has. */
export type ShellTree = { readonly [key: string]: string | readonly string[] | ShellTree };

export type ShellOverlay = { readonly [key: string]: unknown };

/* ────────────────────────────────────────────────────────────────────────────
   TEMPLATES — a function-valued member, localized as data
   ──────────────────────────────────────────────────────────────────────────── */

/** Positional substitution. `{0}`, `{1}`, … are the source function's own arguments. */
export interface ShellPatternTemplate {
  readonly kind: 'pattern';
  readonly pattern: string;
}

/**
 * One pattern per CLDR plural category, selected for the locale.
 *
 * `countArg` names which argument carries the count (default the first). `other` is required
 * because CLDR guarantees it for every language; the rest are supplied only where the
 * language uses them.
 */
export interface ShellPluralTemplate {
  readonly kind: 'plural';
  readonly countArg?: number;
  readonly forms: { readonly other: string } & Partial<Record<Intl.LDMLPluralRule, string>>;
}

/**
 * A template whose shape is not substitution — an optional segment, a list join, a branch on
 * something other than a count. Localized by a function, declared here so the accounting can
 * still see the key.
 */
export interface ShellStructuralTemplate {
  readonly kind: 'structural';
}

export type ShellTemplate = ShellPatternTemplate | ShellPluralTemplate | ShellStructuralTemplate;

export function isShellTemplate(value: unknown): value is ShellTemplate {
  if (value === null || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  if (kind === 'pattern') return typeof (value as ShellPatternTemplate).pattern === 'string';
  if (kind === 'structural') return true;
  if (kind !== 'plural') return false;
  const forms = (value as ShellPluralTemplate).forms;
  return forms !== null && typeof forms === 'object' && typeof forms.other === 'string';
}

/** The marker a key path carries in `shellKeyPaths` output when its leaf is a function. */
export const SHELL_TEMPLATE_SUFFIX = '()';

/**
 * Turn a template back into a function with the source's signature.
 *
 * A pattern or form whose placeholder does not exist in the arguments is left as written
 * rather than rendered as `undefined`: a visible `{3}` in a draft locale is a defect a
 * reviewer can see, and `undefined` is one they cannot.
 */
export function renderShellTemplate(
  template: ShellPatternTemplate | ShellPluralTemplate,
  locale: DisplayLocale,
): (...args: readonly unknown[]) => string {
  return (...args: readonly unknown[]): string => {
    let pattern = template.kind === 'pattern' ? template.pattern : '';
    if (template.kind === 'plural') {
      const index = template.countArg ?? 0;
      const raw = args[index];
      const count = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
      const category = new Intl.PluralRules(formattingProfileFor(locale)).select(count);
      pattern = template.forms[category] ?? template.forms.other;
    }
    return pattern.replace(/\{(\d+)\}/g, (whole, digits: string) => {
      const value = args[Number(digits)];
      if (typeof value === 'string') return value;
      if (typeof value === 'number' && Number.isFinite(value)) {
        return new Intl.NumberFormat(formattingProfileFor(locale), {
          maximumFractionDigits: 0,
        }).format(value);
      }
      return whole;
    });
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   KEY PATHS
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Every key path in a tree, in `a.b.c` form (arrays as `a[0]`, functions as `a.b()`).
 *
 * The `()` suffix is what the earlier version was missing. It is part of the path rather
 * than a separate list so that one enumeration answers "what is localizable here" and a
 * caller cannot consult a partial view of it.
 */
export function shellKeyPaths(tree: unknown, prefix = ''): readonly string[] {
  if (typeof tree === 'string') return [prefix];
  if (typeof tree === 'function') return [`${prefix}${SHELL_TEMPLATE_SUFFIX}`];
  if (Array.isArray(tree)) {
    return tree.flatMap((value, index) => shellKeyPaths(value, `${prefix}[${index}]`));
  }
  if (tree !== null && typeof tree === 'object') {
    return Object.entries(tree as Record<string, unknown>).flatMap(([key, value]) =>
      shellKeyPaths(value, prefix === '' ? key : `${prefix}.${key}`),
    );
  }
  return [];
}

/** True when a path from `shellKeyPaths` names a function-valued member. */
export function isShellTemplatePath(path: string): boolean {
  return path.endsWith(SHELL_TEMPLATE_SUFFIX);
}

/** A key path without its template marker — the form an overlay and a manifest use. */
export function shellPathWithoutMarker(path: string): string {
  return isShellTemplatePath(path) ? path.slice(0, -SHELL_TEMPLATE_SUFFIX.length) : path;
}

function readPath(source: unknown, path: string): unknown {
  return shellPathWithoutMarker(path)
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc !== null && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
      source,
    );
}

/* ────────────────────────────────────────────────────────────────────────────
   MERGE
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * One locale's contribution: the data a translator returned, plus the few functions a
 * structural template needs.
 *
 * `functions` is keyed by the same unmarked key path the manifest uses, so a structural
 * template's wording and its declaration cannot drift apart.
 */
export interface ShellLocaleOverlay {
  readonly data?: ShellOverlay;
  readonly functions?: Readonly<Record<string, (...args: never[]) => string>>;
}

/**
 * Merge an overlay over the English source, structurally.
 *
 * Returns a value of exactly the source's type: the overlay can only REPLACE a leaf the
 * source already has. It cannot add a key, change a shape, or turn a string into an object —
 * so a malformed overlay degrades to English rather than breaking a surface. A function-valued
 * leaf is replaced by a rendered template or by a supplied function, and by nothing else.
 */
export function mergeShell<T>(
  source: T,
  overlay: ShellLocaleOverlay | undefined,
  locale: DisplayLocale,
): T {
  if (overlay === undefined) return source;
  const functions = overlay.functions ?? {};
  const walk = (node: unknown, over: unknown, path: string): unknown => {
    if (typeof node === 'string') return typeof over === 'string' ? over : node;
    if (typeof node === 'function') {
      const supplied = functions[path];
      if (typeof supplied === 'function') return supplied;
      if (isShellTemplate(over) && over.kind !== 'structural') {
        return renderShellTemplate(over, locale);
      }
      return node;
    }
    if (Array.isArray(node)) {
      /*
        AN OVERLAY MAY EXPRESS AN ARRAY AS AN INDEX-KEYED OBJECT, and it must, because that
        is what a JSON delivery and a dotted key path naturally produce: Claude L's
        `dict.loadingStages[0..3]` arrive as `{ "0": …, "1": … }`, not as a JSON array.

        This read `Array.isArray(over)` alone, so an index-keyed object was silently ignored —
        the merge kept English while `shellFallbacks` (which resolves `[0]` to `.0` and found
        the key) counted it as covered. Four qualified French strings rendered English with
        the accounting reporting zero gap, which is exactly the failure the whole declared-
        fallback mechanism exists to make impossible. A1 in this spec pins it.
      */
      const member = (index: number): unknown => {
        if (Array.isArray(over)) return (over as unknown[])[index];
        if (over !== null && typeof over === 'object') {
          return (over as Record<string, unknown>)[String(index)];
        }
        return undefined;
      };
      return node.map((item, index) => walk(item, member(index), `${path}[${index}]`));
    }
    if (node !== null && typeof node === 'object') {
      const o = over !== null && typeof over === 'object' ? (over as Record<string, unknown>) : {};
      return Object.fromEntries(
        Object.entries(node as Record<string, unknown>).map(([key, value]) => [
          key,
          walk(value, o[key], path === '' ? key : `${path}.${key}`),
        ]),
      );
    }
    return node;
  };
  return walk(source, overlay.data, '') as T;
}

/* ────────────────────────────────────────────────────────────────────────────
   FALLBACK ACCOUNTING — the thing the tests assert on
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The key paths that fell through to English for this overlay.
 *
 * A string leaf is covered by a string. A function leaf is covered by a supplied function or
 * by a `pattern`/`plural` template — a bare `structural` declaration is NOT coverage, because
 * declaring a template's shape says nothing about its words.
 */
export function shellFallbacks(
  source: unknown,
  overlay: ShellLocaleOverlay | undefined,
): readonly string[] {
  const data = overlay?.data ?? {};
  const functions = overlay?.functions ?? {};
  return shellKeyPaths(source).filter((path) => {
    if (isShellTemplatePath(path)) {
      if (typeof functions[shellPathWithoutMarker(path)] === 'function') return false;
      const over = readPath(data, path);
      return !(isShellTemplate(over) && over.kind !== 'structural');
    }
    return typeof readPath(data, path) !== 'string';
  });
}

export type ShellQualification = 'SOURCE' | 'CLAUDE_L_QUALIFIED' | 'DRAFT_PENDING_CLAUDE_L';

/** The seven the product exposes. Derived from the shared contract; never a second list. */
export const SHELL_LOCALES: readonly DisplayLocale[] = DISPLAY_LOCALES;

export function isShellLocale(value: unknown): value is DisplayLocale {
  return isDisplayLocale(value);
}

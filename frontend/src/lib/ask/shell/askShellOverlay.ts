import { DISPLAY_LOCALES, isDisplayLocale, type DisplayLocale } from '@globalnews-ai/shared';

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
 * Five hand-copied 394-key catalogues drift: a key added to English is silently absent
 * everywhere else, and the absence shows up as English text in front of a French reader —
 * exactly the defect being fixed. So there is ONE source of truth (the English catalogue)
 * and each locale supplies an OVERLAY of the keys it has translated.
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
 * ── AUTHORSHIP ────────────────────────────────────────────────────────────
 *
 * The CTO ruled that H owns the architecture and **Claude L owns native-quality wording** for
 * fr / de / es / pt-BR / ar, and that H's own strings must never be labelled as qualified.
 * Every string H authored carries its locale+key in `H_DRAFT_PENDING_CLAUDE_L`, and
 * `askShellQualification()` reports it. H drafts are excluded from linguistic acceptance.
 */

/** A nested record of strings — the shape every Ask catalogue has. */
export type ShellTree = { readonly [key: string]: string | readonly string[] | ShellTree };

export type ShellOverlay = { readonly [key: string]: unknown };

/** Every key path in a tree, in `a.b.c` form (arrays as `a[0]`). */
export function shellKeyPaths(tree: unknown, prefix = ''): readonly string[] {
  if (typeof tree === 'string') return [prefix];
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

function readPath(source: unknown, path: string): unknown {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc !== null && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
      source,
    );
}

/**
 * Merge an overlay over the English source, structurally.
 *
 * Returns a value of exactly the source's type: the overlay can only REPLACE a leaf the
 * source already has. It cannot add a key, change a shape, or turn a string into an object —
 * so a malformed overlay degrades to English rather than breaking a surface.
 */
export function mergeShell<T>(source: T, overlay: ShellOverlay | undefined): T {
  if (overlay === undefined) return source;
  const walk = (node: unknown, over: unknown): unknown => {
    if (typeof node === 'string') return typeof over === 'string' ? over : node;
    if (Array.isArray(node)) {
      return node.map((item, index) =>
        walk(item, Array.isArray(over) ? (over as unknown[])[index] : undefined),
      );
    }
    if (node !== null && typeof node === 'object') {
      const o = over !== null && typeof over === 'object' ? (over as Record<string, unknown>) : {};
      return Object.fromEntries(
        Object.entries(node as Record<string, unknown>).map(([key, value]) => [
          key,
          walk(value, o[key]),
        ]),
      );
    }
    return node;
  };
  return walk(source, overlay) as T;
}

/** The key paths that fell through to English for this overlay — the thing tests assert on. */
export function shellFallbacks(source: unknown, overlay: ShellOverlay | undefined): readonly string[] {
  return shellKeyPaths(source).filter((path) => typeof readPath(overlay ?? {}, path) !== 'string');
}

export type ShellQualification = 'SOURCE' | 'CLAUDE_L_QUALIFIED' | 'DRAFT_PENDING_CLAUDE_L';

/** The seven the product exposes. Derived from the shared contract; never a second list. */
export const SHELL_LOCALES: readonly DisplayLocale[] = DISPLAY_LOCALES;

export function isShellLocale(value: unknown): value is DisplayLocale {
  return isDisplayLocale(value);
}

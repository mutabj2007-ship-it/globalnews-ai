/**
 * ════════════════════════════════════════════════════════════════════════════
 * TRUST & CONVERSATIONAL EXPERIENCE R1 — RECOVERED LOCALE CATALOGUES (DORMANT)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Contract §11: recover the existing language work, never re-author it. The French, German,
 * Spanish, Portuguese and Arabic catalogues below are the localisation lane's APPROVED strings
 * (L-LANG-CATALOG-1 / LANG-UI-7, each file's own header cites its catalogue), recovered verbatim
 * from the canonical C55 snapshot `3db5a09` (worktree alpha-convergence-2; its history does not
 * connect to this line, so the files were copied with `git show`, not merged).
 *
 * DORMANT BY CONSTRUCTION. Nothing here is imported by `dictionaries/index.ts`, and
 * `ACTIVE_LANGUAGES` stays ['en', 'pl']: a recovered catalogue makes a locale MEASURABLE, never
 * selectable. The C55 key set predates Ask R2, Home R1, My Intelligence and Humanitarian, so these
 * catalogues are typed loosely and their coverage of today's English is MEASURED by
 * `languageReadiness.spec.ts`, which also writes the per-language readiness matrix.
 */
export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
export type PluralForms = Partial<Record<PluralCategory, string>> & { other: string };

/** A recovered catalogue: the C55 shape, measured (not trusted) against today's English. */
export type RecoveredCatalogue = { readonly [key: string]: unknown };

export { fr } from './c55-fr';
export { de } from './c55-de';
export { es } from './c55-es';
export { pt } from './c55-pt';
export { ar } from './c55-ar';

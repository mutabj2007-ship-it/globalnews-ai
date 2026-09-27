/**
 * ARTICLE METADATA HYGIENE R1 — UNRESOLVED CMS TEMPLATE PLACEHOLDERS.
 *
 * THE DEFECT. Some publisher CMSes (WordPress SEO plugins are the common case)
 * emit their meta-description TEMPLATE instead of the rendered value when a
 * variable fails to resolve, e.g.
 *
 *   "%%title%% %%sep%% %%primary_category%% %%sep%% %%sitename%% Real prose..."
 *
 * A provider forwards that string as the article description, it becomes
 * NewsArticle.summary, and every surface that reads summary — Home cards,
 * Search, Ask evidence, Map panels — shows it verbatim. It is not a percentage,
 * a score or anything GlobalNewsAI computed; it is broken upstream metadata.
 *
 * THE GOVERNED PATTERN, AND WHY IT IS THIS NARROW. A placeholder is `%%`, an
 * identifier (lowercase letter, then lowercase letters, digits or `_`), `%%`,
 * not glued to a preceding letter or digit (so "50%%" stays intact). Nothing containing a space, an uppercase letter or a single `%` can match, so
 * "Inflation rose 5%", "100% renewable", "50%%", "a%20b" and "x % y" are never
 * touched. The identifier is not a closed vocabulary because the plugins allow
 * custom variables (%%cf_field%%, %%ct_tax%%); the shape itself is the signal.
 *
 * WHAT IT DOES:
 *   - removes only placeholder tokens (plus separator punctuation left
 *     dangling at the very start or end by that removal);
 *   - collapses the resulting whitespace;
 *   - returns '' when no letter or digit survives — never a replacement text.
 *
 * WHAT IT NEVER DOES: modify a string that contains no placeholder. That input
 * is returned as the same string, byte for byte, including its whitespace.
 */

const TEMPLATE_PLACEHOLDER = /(?<![\p{L}\p{N}])%%[a-z][a-z0-9_]{0,63}%%/gu;

/** Separator punctuation a template leaves behind at an edge once its variables are gone. */
const DANGLING_EDGE_SEPARATORS = /^[\s\-–—|:·•»«/,;]+|[\s\-–—|:·•»«/,;]+$/g;

const HAS_PROSE = /[\p{L}\p{N}]/u;

export function containsUnresolvedTemplatePlaceholder(text: string): boolean {
  TEMPLATE_PLACEHOLDER.lastIndex = 0;
  const found = TEMPLATE_PLACEHOLDER.test(text);
  TEMPLATE_PLACEHOLDER.lastIndex = 0;

  return found;
}

export function stripUnresolvedTemplatePlaceholders(text: string): string {
  if (!text || !containsUnresolvedTemplatePlaceholder(text)) return text;

  const cleaned = text
    .replace(TEMPLATE_PLACEHOLDER, ' ')
    .replace(/\s+/g, ' ')
    .replace(DANGLING_EDGE_SEPARATORS, '')
    .trim();

  return HAS_PROSE.test(cleaned) ? cleaned : '';
}

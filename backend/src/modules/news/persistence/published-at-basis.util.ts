import type { PublishedAtBasis } from '@globalnews-ai/shared';

/**
 * R4 GDELT — VALIDATING A TIMESTAMP BASIS READ BACK OUT OF THE DATABASE.
 *
 * `Article.publishedAtBasis` is a Postgres TEXT column, chosen over an enum
 * because a Postgres enum cannot gain a value and use it inside one
 * transaction — a sharp edge to accept for a two-member set that may grow.
 * The cost of that choice is that the column can hold ANY string: a typo
 * from a future migration, a value written by a tool that is not this
 * application, a member some later version added and this one does not know.
 *
 * THE RULE, AND IT ONLY GOES ONE WAY. A recognized value is returned. An
 * UNRECOGNIZED value returns `undefined`, which the contract defines as
 * UNPROVEN — not as 'publisher'.
 *
 * That direction is the whole point. Defaulting an unknown string to
 * 'publisher' would be the exact failure this field exists to prevent: it
 * would take a value we cannot vouch for and turn it into a positive claim
 * that an outlet asserted this publication time. Returning undefined instead
 * makes the downstream behaviour fail closed on its own — identity rung 3
 * refuses to corroborate on an unproven basis, and the UI renders the plain
 * relative time, which asserts nothing about which kind of time it is.
 *
 * So a corrupt or unknown basis costs a duplicate that might have merged.
 * A wrongly-trusted basis costs a false statement to the reader. The first
 * is recoverable and visible; the second is neither.
 */
export const PUBLISHED_AT_BASIS_VALUES: readonly PublishedAtBasis[] = Object.freeze([
  'publisher',
  'observed',
]);

/**
 * The stored value, or undefined when it is absent, blank or unrecognized.
 *
 * Deliberately NOT case-insensitive and deliberately not trimmed beyond an
 * exact match: this column is written by exactly one code path in this
 * application, so a value that differs in case or whitespace did not come
 * from that path and has not earned the benefit of the doubt.
 */
export function readPublishedAtBasis(stored: unknown): PublishedAtBasis | undefined {
  if (typeof stored !== 'string') return undefined;

  return (PUBLISHED_AT_BASIS_VALUES as readonly string[]).includes(stored)
    ? (stored as PublishedAtBasis)
    : undefined;
}

/**
 * The value to WRITE for an article, as a column value.
 *
 * An article with no basis is stored as 'publisher'. That is not a guess: it
 * mirrors the column default and is true of every writer that existed before
 * this field did — GNews reports the outlet's own publication time and now
 * states so explicitly. A provider that reports observation times must say
 * so, and GdeltDocProvider does.
 *
 * The asymmetry with `readPublishedAtBasis` is intentional and worth stating
 * plainly, because on the face of it they disagree about what absence means.
 * On WRITE, absence comes from this application's own article pipeline,
 * whose only unlabelled producers are publisher-basis. On READ, absence or
 * an unknown string may have come from anywhere, so it earns nothing.
 */
export function writePublishedAtBasis(basis: PublishedAtBasis | undefined): PublishedAtBasis {
  return basis === 'observed' ? 'observed' : 'publisher';
}

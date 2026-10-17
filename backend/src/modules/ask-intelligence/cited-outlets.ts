/**
 * R143 / E1 R135 addendum 02 — outlet NAMES from UCDP citation pieces. Each piece is
 * "outlet,date,headline"; only the first field is the outlet (UCDP's own datum, E1 R135 Q1). The
 * date and the publisher's headline are dropped (UCDP's CC BY 4.0 does not license that expression),
 * as are social handles. De-duplicated, order kept. Shared by the Conflict contribution and the
 * briefing fingerprint so a saved baseline and a new read compare on the same names.
 */
export function outletNamesOf(pieces: readonly string[]): string[] {
  const names = pieces
    .map((piece) => piece.split(',')[0]?.trim() ?? '')
    .filter((name) => name.length > 0 && !name.startsWith('@') && !/\bon X\b/i.test(name));
  return Array.from(new Set(names));
}

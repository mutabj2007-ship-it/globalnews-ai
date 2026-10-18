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

/**
 * R143 / E1-CONF-1 shape of ONE Conflict (`cfl:`) observation: no recorded headline (label, detail.headline) and
 * outlet names only in `citedOutlets`. Any other record is returned unchanged. Pure; tolerant of stored JSON.
 * Used by the briefing fingerprint and, CTO R150 / PD-1, at READ time for answers and briefing versions stored
 * before the containment, so an old stored shape never reaches a reader (the stored row is not rewritten).
 */
export function containedConflictObservation<
  T extends { readonly reference: string; readonly label: string | null; readonly detail?: unknown },
>(o: T): T {
  if (typeof o?.reference !== 'string' || !o.reference.startsWith('cfl:')) return o;
  const detail = o.detail as { headline?: unknown; citedOutlets?: unknown } | null | undefined;
  return {
    ...o,
    label: null,
    ...(detail && typeof detail === 'object'
      ? {
          detail: {
            ...detail,
            headline: null,
            citedOutlets: Array.isArray(detail.citedOutlets)
              ? outletNamesOf(detail.citedOutlets.filter((x): x is string => typeof x === 'string'))
              : [],
          },
        }
      : {}),
  };
}

/**
 * CTO R150 / PD-1 — a stored `intelligence` block (an answer payload's, or a briefing version's) with every Conflict
 * observation in the contained shape. Non-object input and unknown shapes pass through untouched.
 */
export function containedStoredIntelligence(intelligence: unknown): unknown {
  if (!intelligence || typeof intelligence !== 'object' || Array.isArray(intelligence)) return intelligence;
  const intel = intelligence as { contributions?: unknown };
  if (!Array.isArray(intel.contributions)) return intelligence;
  return {
    ...intel,
    contributions: intel.contributions.map((c: unknown) => {
      if (!c || typeof c !== 'object' || !Array.isArray((c as { observations?: unknown }).observations)) return c;
      const contribution = c as { observations: unknown[] };
      return {
        ...contribution,
        observations: contribution.observations.map((o) =>
          o && typeof o === 'object' && typeof (o as { reference?: unknown }).reference === 'string'
            ? containedConflictObservation(o as { reference: string; label: string | null; detail?: unknown })
            : o,
        ),
      };
    }),
  };
}

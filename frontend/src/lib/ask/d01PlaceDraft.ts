/**
 * ASK D0.1 PO ACCEPTANCE R1 · V-02 — the Ask DRAFT staged by Choose a place › "Research new changes".
 *
 * The draft was `askDiscoverStrings(locale).draftRegion + name` ("What changed this week in Congo -
 * Kinshasa"). Ask's router refuses the "this week" window for every place (BROADENING_OFFERED /
 * CONSTRAINT_UNTRANSPORTABLE; regions: CAPABILITY_UNAVAILABLE), so the PO's explicit Send ran no
 * search at all. Measured at Alpha backend 737c42f with the real `routeAskR2` (record:
 * RETRIEVAL-R1/ASK-D0-1-IMPLEMENTATION/po-acceptance-r1/): the shapes below are CURRENT_REPORTING /
 * EXECUTABLE in EN and PL for every country and the three regions, and keep the chosen country's
 * identity (Congo - Kinshasa → COD, Congo - Brazzaville → COG). No period is named, so nothing claims
 * a specific week was checked.
 *
 * Engineering-owned, not part of the generated D0.1 copy deck (d01Strings.ts), and separate from the
 * welcome cue's `draftRegion`, whose own accepted contract is untouched. FR/DE/ES/PT/AR are drafts
 * pending Claude L: Ask answers in EN/PL, and at 737c42f a non-EN/PL request is not routed to current
 * reporting whatever its wording (ledger D-27), so only EN/PL are claimed executable.
 */
const PLACE_DRAFT: Readonly<Record<string, string>> = {
  en: 'What are the latest developments in {place}?',
  /* nominative first: Polish place names are not declined here ("w Polska" would be wrong) */
  pl: '{place}: jakie są najnowsze wydarzenia?',
  fr: '{place} : quelles sont les dernières évolutions ?',
  de: '{place}: Was sind die neuesten Entwicklungen?',
  es: '{place}: ¿cuáles son los últimos acontecimientos?',
  pt: '{place}: quais são os desenvolvimentos mais recentes?',
  ar: 'ما آخر التطورات في {place}؟',
};

/** The place's own name only: a label's descriptive suffix ("European Union · 27 member states") is not part of the question. */
export function placeDraftName(label: string): string {
  return label.split(' · ')[0].trim();
}

export function placeResearchDraft(locale: string, label: string): string {
  return (PLACE_DRAFT[locale] ?? PLACE_DRAFT.en).replace('{place}', placeDraftName(label));
}

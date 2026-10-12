/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK D0.1 — THE PUBLISHER-CONTENT GATE FOR THE STORY PICKER (D1) AND CHOOSE A PLACE (D2)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * D0.1 action/API matrix G2-2, G2-6, G1-2, G1-4: "E1 HOLD: title, publisher, summary, image
 * visibility not cleared". `HomeStoryCard` carries no per-row permitted-use field, so the
 * decision is one switch for the whole new surface, and it is E1's to make — not Design's, not
 * the CTO's, not Code's.
 *
 *   HOLD     (default) the picker and the place view never request /stories/search or the
 *            signed-in feed, so no publisher title, summary or image URL reaches the browser
 *            through these surfaces. They show the accepted RIGHTS_HOLD notices (S03).
 *   CLEARED  only after a written E1 per-use clearance names this surface. Rows then render
 *            title, publisher and date basis — never a summary and never an image (D04, U-1).
 *
 * A literal in source, not an environment variable, on purpose: flipping it is a reviewable diff
 * with the E1 reference in the commit, and a spec pins the default.
 */
export type PickerPublisherContent = 'HOLD' | 'CLEARED';

export const PICKER_PUBLISHER_CONTENT: PickerPublisherContent = 'HOLD';

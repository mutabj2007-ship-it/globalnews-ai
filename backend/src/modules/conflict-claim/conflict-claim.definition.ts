import {
  questionKind,
  registeredSpecialistDomainId,
  type QuestionKind,
  type RegisteredSpecialistDomainId,
  type SpecialistClaimDefinition,
} from '@globalnews-ai/shared';

/**
 * CONFLICT — THE §16 CLAIM ROW, AS DATA.
 *
 *     baseline   C16  225A1E3EA122AFF019D96517BB12EAFC520FCF7DC9C655DE67F00B3A775E98D8  (953)
 *     authority  Shared Specialist Intelligence Addendum v1.0 R1 §16
 *                50b4b882576e76722eb57044de80289a5559b64dc0b6832ba838605902b90acd
 *     semantics  Part V Conflict Intelligence v1.0 R2 — SPEC
 *                b8425fa996fa5cfc6415df8b938ee4dd5ac118257e5c62d41bd161fce141c1d2
 *                Part V Conflict Intelligence v1.0 R2 — visual
 *                711443b6e4832ad630ee736059863aa9ded144148a9bd0a49069776f57a93d8c
 *     rulings    CTO, 2026-09-04, on H's P4 proposal
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS FILE IS, AND THE FOUR THINGS IT IS NOT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * It is one row of §16's table, expressed in P2's contract types. Nothing else.
 *
 *   NOT a recognizer.       There is no mapping from user text to a kind, here or
 *                           anywhere in this module. §16: "a domain claims question
 *                           KINDS, NOT KEYWORDS", and routing rule 5 keeps intent
 *                           classification out of the claim boundary entirely.
 *   NOT assessment logic.   This names an owner. It cannot answer a question, and
 *                           there is no path from it to evidence, to an assessment,
 *                           or to any provider.
 *   NOT data.               No conflict object, situation, incident or figure exists
 *                           in this module. Registration is not content.
 *   NOT a foreign domain.   Election, Delivery and Humanitarian are neither
 *                           registered nor defined here. Their vocabularies are
 *                           theirs.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE AUTHORITY FIELD — RULED
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `SpecialistClaimDefinition` carries ONE `authoritySha256`, and Conflict's claim
 * rests on three accepted documents. My P4 proposal put the choice up; the CTO
 * ruled the R1 §16 hash, because the field is P2's ROUTING-authority field and §16
 * is the routing table. Part V R2 remains the semantic authority for what each kind
 * MEANS — cited above, and cited per-kind below — but it is not what this field is
 * for.
 */

export const CONFLICT_DOMAIN_ID: RegisteredSpecialistDomainId =
  registeredSpecialistDomainId('CONFLICT');

/**
 * THE THREE KINDS CONFLICT OWNS.
 *
 * §16's CONFLICT row states four phrases. Three become owned routing kinds; the
 * fourth does not — see `DISPLACEMENT` below, which is the more important comment
 * in this file.
 *
 *   HOSTILITY_SEVERITY      "How serious is this hostility."
 *                           Part V §04: severity is one of four independent axes,
 *                           C·1 ratified — LOW / MODERATE / HIGH / CRITICAL, carried
 *                           typographically, with red rationed to CRITICAL alone.
 *
 *   HOSTILITY_PARTICIPANTS  "Who is fighting."
 *                           Part V §02 `participants[]`; §14 justifies the promoted
 *                           entity as "a first-class object with evidenced roles".
 *
 *   HOSTILITY_ESCALATION    "Is it escalating."
 *                           Part V §06's seven OBSERVED indicators — rung 3 of the
 *                           four-rung ladder. Rung 4, scenario and forecast, is
 *                           deferred and "not designed, not stubbed, not simulated",
 *                           so this kind asks whether escalation IS OBSERVED, never
 *                           whether it WILL happen.
 *
 * Three, and not eleven. Part V's rail also shows incidents, fronts, corridors,
 * infrastructure exposure, cessation state and spillover — and none of those becomes
 * a claimed kind, because a claimed kind is a ROUTING assertion about which rail a
 * question opens, not an inventory of what a rail displays once open. Minting kinds
 * from drawn surfaces would invent vocabulary the design does not claim, which is the
 * restraint P2 already applies to itself: "inventing a vocabulary would be
 * fabricating design."
 */
export const HOSTILITY_SEVERITY: QuestionKind = questionKind('HOSTILITY_SEVERITY');
export const HOSTILITY_PARTICIPANTS: QuestionKind = questionKind('HOSTILITY_PARTICIPANTS');
export const HOSTILITY_ESCALATION: QuestionKind = questionKind('HOSTILITY_ESCALATION');

export const CONFLICT_CLAIMED_KINDS: readonly QuestionKind[] = [
  HOSTILITY_SEVERITY,
  HOSTILITY_PARTICIPANTS,
  HOSTILITY_ESCALATION,
];

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DISPLACEMENT — CLAIMED IN THE PROPOSAL, REFUSED BY RULING, AND WHY THAT IS RIGHT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * §16's fourth CONFLICT phrase is "Where are people moving." My P4 proposal put it
 * forward as `DISPLACEMENT_MOVEMENT` and flagged the collision: §16 reserves a
 * HUMANITARIAN slot, and Part V's own §01 lens table gives Humanitarian "Who is
 * affected? Displacement, access, casualties where evidenced."
 *
 * Under routing rule 2 the FIRST REGISTRATION WINS A KIND — so registering it here
 * would have let REGISTRATION ORDER decide a precedence question, which is exactly
 * what §16 says must be "resolved by ruling, not by code".
 *
 * CTO RULING: the canonical kind is RESERVED FOR FUTURE HUMANITARIAN OWNERSHIP.
 * Conflict may represent displacement as related evidence and context — Part V §02's
 * `humanConsequence`, §06's displacement-reporting indicator, §13's competing
 * readings — but it DOES NOT OWN ITS ROUTING KIND.
 *
 * THE DISTINCTION IS EXACT AND WORTH HOLDING ONTO: a Conflict rail may DISPLAY
 * displacement, because display follows from owning the situation object. What it
 * may not do is WIN a displacement question at the router and thereby answer it as
 * a conflict question. Those are different powers, and only the second is a claim.
 *
 * So no `DISPLACEMENT_MOVEMENT` constant is declared anywhere in this module. Not
 * declared-and-unclaimed, not commented-out, not in `refusedKinds` — ABSENT. A
 * declared constant is a name looking for a claim, and the next person to read this
 * file should find nothing to promote.
 */

/**
 * REFUSED KINDS — EMPTY, BY RULING.
 *
 * §16's DOES NOT CLAIM column for Conflict reads "Election results in a
 * conflict-affected country. Aid-delivery performance." My proposal offered to make
 * that executable by naming `ELECTION_RESULT` and `DELIVERY_PERFORMANCE` here, and
 * stated the limit honestly: a refusal only bites if the eventual owner picks the
 * same name, so it could become an inert entry that reads as protection.
 *
 * CTO RULING: `refusedKinds` REMAINS EMPTY UNTIL FOREIGN CANONICAL KINDS ARE
 * THEMSELVES RATIFIED. Conflict does not name vocabulary it does not own.
 *
 * The boundary still holds without it, and by a stronger mechanism: routing rule 2
 * gives each kind EXACTLY ONE owner, so Conflict can never win an election or
 * delivery kind simply by not claiming it. The refusal would have added protection
 * only against a mistaken future edit to Conflict's own claimed list — and the
 * `claimedKinds.length === 3` guard in the spec covers that without borrowing
 * another domain's words.
 */
export const CONFLICT_REFUSED_KINDS: readonly QuestionKind[] = [];

/**
 * LANDS THE USER ON — §16: "Conflict Assessment rail for the situation object."
 */
export const CONFLICT_RAIL_ID = 'conflict-assessment';
export const CONFLICT_LANDING_OBJECT_TYPE = 'situation';

/**
 * OWNED OBJECT TYPES — the routing rule 3 tiebreak input.
 *
 * SEVEN of Part V §14's eight object subtypes. `displacement` is deliberately
 * absent — see the note below, which is the reason this list is not simply §14's.
 *
 * ── `contest` AND `commitment` ARE ABSENT, AND THAT ABSENCE IS LOAD-BEARING ──
 *
 * §16's precedence row: "Is the Nakuru result disputed, and is that dangerous?"
 * wins for ELECTION, split "ON OBJECT, NOT ON SENTIMENT". If a request ever carries
 * both an election kind and `HOSTILITY_SEVERITY`, P2's resolver reaches rule 3 and
 * decides on the object type:
 *
 *     objectType 'contest'    Election owns it, Conflict does not  -> Election
 *     objectType 'situation'  Conflict owns it, Election does not  -> Conflict
 *     objectType undefined    tie stands -> EQUAL_CLAIM -> rule 6 -> Country
 *
 * That works ONLY while Conflict does not own `contest`. Adding it — for the
 * plausible-sounding reason that conflict objects exist near elections — would make
 * both domains owners, narrow the tiebreak to two, and turn a question §16 says
 * Election wins into a fallback to Country Intelligence. The CTO's ruling preserves
 * this guard by name, and `conflict-claim.spec.ts` asserts it in two lines.
 */
export const CONFLICT_OWNED_OBJECT_TYPES: readonly string[] = [
  'situation',
  'incident',
  'front',
  'corridor',
  'exposure',
  'cessation',
  'spillover',
];

/**
 * The row itself. Pure data — no Nest, no DI, no I/O, no clock, no model call —
 * so that routing rule 7 ("routing is deterministic and costs no user AI") stays
 * true by construction on this side of the boundary too.
 *
 * ── R1 · WHY `displacement` IS NOT AN OWNED OBJECT TYPE EITHER ────────────
 *
 * The first cut of this file kept `displacement` here and argued that owning an
 * OBJECT TYPE is a tiebreak input while owning a QUESTION KIND is a claim, so
 * Conflict could hold the first without the second.
 *
 * That argument was wrong, and CTO review caught it. `ownsObjectTypes` PARTICIPATES
 * IN P2's RESOLUTION — it is the rule 3 tiebreak — so listing `displacement` gave
 * Conflict a SECOND OWNERSHIP PATH over displacement routing even with
 * `DISPLACEMENT_MOVEMENT` correctly absent. Concretely: a request carrying a
 * displacement kind and a hostility kind, on `objectType: 'displacement'`, would have
 * narrowed to Conflict on the tiebreak and taken precedence from the kind's real
 * owner. The reservation would have held in the vocabulary and leaked in the
 * resolution.
 *
 * The ruling is that Conflict does not own displacement ROUTING SEMANTICS. An
 * object-ownership entry is routing semantics. So it is removed.
 *
 * WHAT IS EXPLICITLY PRESERVED: Conflict may still REPRESENT displacement — Part V
 * §02's `humanConsequence`, §06's displacement-reporting indicator, §13's competing
 * readings, and anything a later Conflict intelligence or evidence model needs.
 * Nothing here removes or prohibits that. Display follows from owning the SITUATION,
 * which Conflict does own. What is gone is the ability to WIN a displacement object
 * at the router, which was never the ruling's intent and is not needed to show one.
 */
export const CONFLICT_CLAIM_DEFINITION: SpecialistClaimDefinition = {
  domainId: CONFLICT_DOMAIN_ID,
  authorityRef: 'Shared Specialist Intelligence Addendum v1.0 R1 - §16 domain claim and routing table',
  authoritySha256: '50b4b882576e76722eb57044de80289a5559b64dc0b6832ba838605902b90acd',
  claimedKinds: CONFLICT_CLAIMED_KINDS,
  refusedKinds: CONFLICT_REFUSED_KINDS,
  landsOn: { railId: CONFLICT_RAIL_ID, objectType: CONFLICT_LANDING_OBJECT_TYPE },
  ownsObjectTypes: CONFLICT_OWNED_OBJECT_TYPES,
};

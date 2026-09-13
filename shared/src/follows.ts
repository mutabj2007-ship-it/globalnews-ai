/**
 * R1/T3 — the country-follow contract.
 *
 * Canonical here rather than backend-local so a later frontend surface
 * consumes the same declarations the backend produces, with no second
 * copy to drift. These are RESPONSE shapes only: no request DTO lives in
 * `shared/`, and none of these types is an input contract.
 *
 * WHAT IS ABSENT IS THE POINT. There is no `userId` and no `id` in any
 * shape below. Ownership comes from the session on every request and is
 * never expressible as input; the row identifier is an implementation
 * detail the client has no use for, because a follow is addressed by its
 * country code.
 *
 * `shared/src/news.ts` is E1's file and is NOT touched by this milestone.
 */
/** One followed country, as its owner sees it. */
export interface CountryFollowView {
  /** ISO-3166 alpha-3, always canonical upper case. */
  countryCode: string;
  /** ISO-8601. */
  createdAt: string;
}

/** The caller's own followed countries. */
export interface CountryFollowListResponse {
  follows: CountryFollowView[];
  /**
   * The server-side resource ceiling, echoed so a surface can show
   * remaining capacity without hard-coding the number.
   *
   * A RESOURCE SAFETY CEILING, NOT A PLAN ENTITLEMENT. There is no tier,
   * no subscription and no upgrade path anywhere in this contract.
   */
  maxFollows: number;
}

/**
 * The maximum number of countries one account may follow.
 *
 * RESOURCE SAFETY CEILING ONLY (CTO decision). It exists so a single
 * account cannot grow an unbounded owned table, and for no other reason.
 * It is NOT a Free/Pro/Premium entitlement and must not become one
 * without an explicit decision — `follows.constants.ts` in the backend
 * repeats that statement where the enforcement lives.
 */
export const MAX_FOLLOWED_COUNTRIES = 50;

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE D — REFERENCE PROVIDERS, EVIDENCE ROLES,
 * ANSWER STATES (CTO contract §6, §7; Main R1.1 SQ-22, QQ-9, PB-8)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * REFERENCE IS NOT OFFICIAL — AND THE TYPE SAYS SO.
 *
 * SQ-22: "Disjointness must be enforced by the type, not by a convention." So a
 * `ReferenceProviderEntry` is not an `OfficialSourceEntry` and cannot be mistaken for one:
 *
 *   - it carries `kind: 'REFERENCE_PROVIDER'` and `role: 'REFERENCE'` as literal types;
 *   - it DECLARES `authorityClass`, `ingestionMethod` and `rights` as `never`, so it can
 *     never be given an `OfficialSourceClass`, and an object literal carrying one fails to
 *     compile;
 *   - it lacks `authorityClass`/`ingestionMethod`/`rights` values, so it is not assignable
 *     to `OfficialSourceEntry`, and cannot be pushed into `OFFICIAL_SOURCES`.
 *
 * A spec holds all three with `@ts-expect-error`, and a compile-time assertion below
 * fails the build if either type ever becomes assignable to the other.
 *
 * Wikipedia is registered here as DATA; it is not activated here or anywhere. Activation
 * requires technical qualification (QQ-9 live probes), Product/Legal attribution and
 * licensing (PB-8) and the D-1 scope ruling (PC-11 / PB-6) — none of which is code.
 */

import type { OfficialSourceEntry } from '../officialSources';

/* ── §7 · EVIDENCE ROLES ─────────────────────────────────────────────────── */

/**
 * The seven Ask evidence roles. Named `AskEvidenceRole` because `EvidenceRole` already
 * exists in `source-provenance.ts` with a different, record-level meaning (REPORTING /
 * PRIMARY_RECORD / REFERENCE_DATA / CONTEXT); the two are not merged.
 *
 * Model memory is NOT a role: it is non-citable background (frozen C
 * `REFERENCE_BACKGROUND_NOT_CITABLE`), and nothing here can make it a citation.
 */
export const ASK_EVIDENCE_ROLES = [
  'REFERENCE',
  'OFFICIAL',
  'REPORTING',
  'SPECIALIST',
  'PERSONAL',
  /** Reserved. No upload exists (contract §18); the role is declared so absence is named. */
  'USER_FILE',
  'COMPUTED',
] as const;
export type AskEvidenceRole = (typeof ASK_EVIDENCE_ROLES)[number];

/** Roles that exist but can never be satisfied in this candidate. */
export const RESERVED_INACTIVE_ROLES: readonly AskEvidenceRole[] = ['USER_FILE'];

/* ── §7 · ANSWER STATES ──────────────────────────────────────────────────── */

export const ASK_ANSWER_STATES = [
  'REFERENCE_BACKGROUND',
  'CURRENTLY_VERIFIED',
  'CURRENT_REPORTING',
  'PARTIAL',
  'INSUFFICIENT',
  'CLARIFICATION_REQUIRED',
  'CAPABILITY_UNAVAILABLE',
  /* ASK INTELLIGENCE BINDING LIVE ACCEPTANCE REPAIR R1 — a governed retained record (or its
     stated absence) answered with zero model calls. Never current, never verified. */
  'RETAINED_RECORD',
  /* ASK TECHNICAL / SCIENTIFIC REASONING CONVERGENCE R1 — a deterministic computation over the
     reader's own stated values: zero model calls, zero sources, never current, never verified. */
  'COMPUTED_RESULT',
  /* CURRENT-REPORTING TRUTH R1 (B1) — an AI answer supported ONLY by retained / previously
     retrieved reporting (served after a provider failure, or from the store). AI ran; the
     reporting is real and dated; it is not current. Never CURRENT_REPORTING, never verified. */
  'RETAINED_REPORTING',
] as const;
export type AskAnswerState = (typeof ASK_ANSWER_STATES)[number];

/* ── §6 · THE REFERENCE PROVIDER ENTRY ───────────────────────────────────── */

export type ReferenceEditionLanguage = 'en' | 'pl';

export interface ReferenceEdition {
  readonly language: ReferenceEditionLanguage;
  /** The ONE governed host for this edition. Editions are never merged (no fuzzy merge). */
  readonly host: string;
}

export type ReferenceReadiness =
  /** Registered; technical qualification (QQ-9 live probes) not yet discharged. */
  'NOT_QUALIFIED' | 'QUALIFIED';

export interface ReferenceActivation {
  /** DEFAULT OFF. Registration is not activation; compiling is not activation. */
  readonly enabled: false;
  /** Every gate that must be discharged before `enabled` may change. Codes, not prose. */
  readonly blockedBy: readonly string[];
}

export interface ReferenceAttribution {
  readonly displayName: string;
  /** Confirm against the live licence footer at activation time, not assumed permanent (PB-8). */
  readonly licenseId: string;
  readonly licenseConfirmation: 'CONFIRM_AT_ACTIVATION';
  readonly attributionRequired: true;
}

/**
 * What a reference answer may be used FOR. A reference page is stable background; it is
 * never current status, never an official figure and never verification.
 */
export interface ReferenceVolatility {
  readonly eligible: 'STABLE_BACKGROUND_ONLY';
  readonly mayVerifyCurrentStatus: false;
  readonly maySatisfyOfficial: false;
}

/** How a fetched page is identified. Every field is derived from the PROVIDER RESPONSE. */
export interface ReferenceIdentityRules {
  /** Canonical page identity: edition + provider page id (never a title guess). */
  readonly canonicalPage: 'EDITION_AND_PAGE_ID';
  /** Version identity from the page REVISION id — never the transport `tid`. */
  readonly version: 'REVISION_ID';
  /** Source timestamp from the provider response — never the local clock. */
  readonly sourceTimestamp: 'PROVIDER_RESPONSE';
}

export interface ReferenceTransportLimits {
  readonly maxRequestsPerSecond: number;
  readonly maxConcurrency: number;
  readonly backoffBaseMs: number;
  readonly backoffMaxMs: number;
  readonly maxAttempts: number;
  readonly honourRetryAfter: true;
  /** Seconds a fetched summary may be reused before it is re-read. */
  readonly cacheTtlSeconds: number;
}

export interface ReferenceProviderEntry {
  readonly kind: 'REFERENCE_PROVIDER';
  /** Fixed. A reference provider has exactly one role. */
  readonly role: 'REFERENCE';
  readonly id: string;
  /** Stable key the evidence record carries (`sourceKey`). */
  readonly sourceKey: string;
  readonly editions: readonly ReferenceEdition[];
  readonly activation: ReferenceActivation;
  readonly readiness: ReferenceReadiness;
  readonly attribution: ReferenceAttribution;
  readonly volatility: ReferenceVolatility;
  readonly identity: ReferenceIdentityRules;
  readonly limits: ReferenceTransportLimits;
  /**
   * The identifying User-Agent, as a TEMPLATE. Its placeholders are deliberately unfilled
   * (PB-8): the production domain and an operational contact are not engineering
   * decisions. `referenceUserAgent()` refuses to build a header while any remain.
   */
  readonly userAgentTemplate: string;

  /* SQ-22 — the OFFICIAL fields, declared impossible. */
  readonly authorityClass?: never;
  readonly ingestionMethod?: never;
  readonly rights?: never;
}

/** The placeholders `userAgentTemplate` may carry. */
export const REFERENCE_USER_AGENT_PLACEHOLDERS = [
  '{PRODUCT_DOMAIN}',
  '{OPERATIONS_CONTACT}',
] as const;

export class ReferenceUserAgentUnfilled extends Error {
  constructor(readonly missing: readonly string[]) {
    super(`REFERENCE_USER_AGENT_UNFILLED:${missing.join(',')}`);
    this.name = 'ReferenceUserAgentUnfilled';
  }
}

/**
 * Build the User-Agent header value. Refuses while any placeholder is unfilled, and
 * refuses any value a header cannot safely carry (control characters, CR/LF).
 */
export function referenceUserAgent(
  entry: Pick<ReferenceProviderEntry, 'userAgentTemplate'>,
  fill: Readonly<Partial<Record<(typeof REFERENCE_USER_AGENT_PLACEHOLDERS)[number], string>>> = {},
): string {
  let value = entry.userAgentTemplate;
  for (const [placeholder, replacement] of Object.entries(fill)) {
    if (replacement !== undefined) value = value.split(placeholder).join(replacement);
  }
  const missing = REFERENCE_USER_AGENT_PLACEHOLDERS.filter((p) => value.includes(p));
  if (missing.length > 0) throw new ReferenceUserAgentUnfilled(missing);
  if (!/^[\x20-\x7e]+$/.test(value)) throw new ReferenceUserAgentUnfilled(['NON_PRINTABLE']);
  return value;
}

/* ── SQ-22 · COMPILE-TIME DISJOINTNESS ───────────────────────────────────── */

type Assignable<A, B> = [A] extends [B] ? true : false;
/** Fails to compile (true is not false) if a reference entry could pass as official. */
export const REFERENCE_IS_NOT_OFFICIAL: Assignable<ReferenceProviderEntry, OfficialSourceEntry> =
  false;
/** …and the other way round. */
export const OFFICIAL_IS_NOT_REFERENCE: Assignable<OfficialSourceEntry, ReferenceProviderEntry> =
  false;

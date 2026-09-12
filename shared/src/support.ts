/**
 * Support loop — S1 canonical contracts.
 *
 * These are the SINGLE source of truth for the support vocabulary. The
 * Prisma enums in `backend/prisma/schema.prisma` mirror them member for
 * member, and `backend/src/modules/support/supportContract.spec.ts`
 * reads both files and fails if the two ever diverge — the same parity
 * technique the admin health contract uses.
 *
 * S1 SHIPS VOCABULARY AND NOTHING ELSE. There is no service, no route,
 * no DTO, no reference generator and no triage here. Every value below
 * is a name; nothing in this file performs an action.
 *
 * WHY UPPER_SNAKE RATHER THAN `news.ts`'s LOWERCASE LITERALS. These
 * members must equal the Prisma enum values byte for byte so the parity
 * spec can compare them directly, and PostgreSQL enum members are
 * conventionally upper snake case. Consistency with the database wins
 * over consistency with `NewsCategory`, deliberately.
 *
 * There is no TypeScript `enum` here, because there is not one anywhere
 * in `shared/` — the established convention is a string-literal union
 * plus a frozen-by-convention value array.
 */

/**
 * What a user says their request is about.
 *
 * The category is the ONLY thing that decides whether machine
 * assistance is attempted at all: NEWS_QUESTION may be answered from
 * evidence, and the other six go to a human. That routing lives in S2;
 * this is the vocabulary it will branch on.
 */
export type SupportCategory =
  | 'NEWS_QUESTION'
  | 'BUG_REPORT'
  | 'CONTENT_REPORT'
  | 'FEEDBACK'
  | 'ABUSE_REPORT'
  | 'ACCOUNT_PROBLEM'
  | 'OTHER';

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  'NEWS_QUESTION',
  'BUG_REPORT',
  'CONTENT_REPORT',
  'FEEDBACK',
  'ABUSE_REPORT',
  'ACCOUNT_PROBLEM',
  'OTHER',
];

/**
 * Where a ticket stands.
 *
 * RESOLVED is reachable only by a human action. No machine-authored
 * message may produce it — enforced in S2, stated here so the intent
 * travels with the vocabulary rather than being rediscovered later.
 */
export type SupportTicketStatus = 'OPEN' | 'AWAITING_USER' | 'AWAITING_ADMIN' | 'RESOLVED';

export const SUPPORT_TICKET_STATUSES: SupportTicketStatus[] = [
  'OPEN',
  'AWAITING_USER',
  'AWAITING_ADMIN',
  'RESOLVED',
];

/**
 * Who may read a message.
 *
 * THE MOST IMPORTANT TYPE IN THIS FILE. INTERNAL is an admin-only note
 * and must never reach the person who opened the ticket. This is a
 * STORED COLUMN, filtered server-side in the query — never a display
 * convention, never a frontend concern. A note that is hidden only by
 * the client is not hidden.
 */
export type SupportMessageVisibility = 'PUBLIC' | 'INTERNAL';

export const SUPPORT_MESSAGE_VISIBILITIES: SupportMessageVisibility[] = ['PUBLIC', 'INTERNAL'];

/**
 * Who wrote a message.
 *
 * SYSTEM_AI is a distinct member on purpose. A user must be able to see
 * that an answer came from a machine, and an administrator must be able
 * to see what the machine already told the user before replying.
 * Neither works if machine output is written as ADMIN.
 */
export type SupportAuthorType = 'USER' | 'ADMIN' | 'SYSTEM_AI';

export const SUPPORT_AUTHOR_TYPES: SupportAuthorType[] = ['USER', 'ADMIN', 'SYSTEM_AI'];

/**
 * The human-readable ticket reference: `GN-` followed by ten Crockford
 * Base32 characters, e.g. the shape `GN-7QK2M4XR9T`.
 *
 * OPAQUE ON PURPOSE. A sequential number would tell anyone holding one
 * reference roughly how many tickets the platform has ever had. Drawn
 * from a CSPRNG instead, consecutive references are unrelated.
 *
 * Crockford Base32 excludes I, L, O and U, so a reference survives
 * being read aloud, written down and typed back without the classic
 * 1/I and 0/O confusions. The pattern below encodes exactly that
 * alphabet.
 *
 * A REFERENCE IS AN IDENTIFIER, NEVER A CAPABILITY. Ownership is
 * enforced by scoping every read to the requesting user; anyone who
 * guessed a valid reference would still receive a 404.
 *
 * S1 DECLARES THE SHAPE AND GENERATES NOTHING. The generator and the
 * lookup arrive in S2 and will both be tested against this pattern.
 */
export const SUPPORT_REFERENCE_PREFIX = 'GN-';

export const SUPPORT_REFERENCE_BODY_LENGTH = 10;

/** Crockford Base32: 0-9 and A-Z excluding I, L, O and U. */
export const SUPPORT_REFERENCE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const SUPPORT_REFERENCE_PATTERN = /^GN-[0-9A-HJKMNP-TV-Z]{10}$/;
/**
 * S2 — the response shapes the user-facing support API returns.
 *
 * Canonical here rather than backend-local so the S4 user surface
 * consumes the same declarations the backend produces, with no second
 * copy to drift. These are RESPONSE shapes only: nothing here is an
 * input contract, and no request DTO lives in `shared/`.
 *
 * WHAT IS ABSENT IS THE POINT. There is no `userId`, no `authorId`, no
 * `visibility` and no internal note anywhere in these types. The user
 * API filters INTERNAL messages in the database query, and these shapes
 * carry no field one could be rendered through even by mistake.
 */

/** One message as its ticket's owner is permitted to see it. */
export interface SupportMessageView {
  id: string;
  /**
   * USER, ADMIN or SYSTEM_AI. Exposed so the surface can show who is
   * speaking — a machine-authored reply must be visibly distinct from a
   * human one, and that is only possible if the type reaches the client.
   */
  authorType: SupportAuthorType;
  body: string;
  /** ISO-8601. */
  createdAt: string;
}

/** One ticket in the owner's list. Carries no message bodies at all. */
export interface SupportTicketSummary {
  reference: string;
  category: SupportCategory;
  status: SupportTicketStatus;
  subject: string;
  /** Count of messages the owner may see — INTERNAL notes are excluded. */
  messageCount: number;
  /** ISO-8601. */
  createdAt: string;
  /** ISO-8601. Moves on every reply, so it is a true last-activity time. */
  updatedAt: string;
}

/** One ticket with the conversation its owner is permitted to read. */
export interface SupportTicketDetail extends SupportTicketSummary {
  messages: SupportMessageView[];
}

/**
 * S3 — the response shapes the ADMIN support queue returns.
 *
 * SEPARATE TYPES, NOT WIDENED ONES. The user shapes above are left
 * exactly as S2 wrote them: `SupportMessageView` still has no
 * `visibility` and no `authorId`, so the user contract cannot acquire a
 * field an internal note could travel through, no matter what the admin
 * surface later grows. Two audiences, two declarations, and a
 * compile-time error the moment one is used where the other belongs.
 *
 * THE REQUESTER IS THE TICKET REFERENCE AND NOTHING ELSE (CTO decision,
 * S3). No email address, no display name and no user identifier appears
 * anywhere in these shapes. An administrator handling a queue does not
 * need to know who the person is in order to answer them, and a support
 * operator who cannot see an address cannot leak one.
 */

/**
 * One message as an administrator is permitted to see it — which is
 * every message, INTERNAL notes included.
 *
 * `visibility` is present here and absent from `SupportMessageView`.
 * That asymmetry IS the security boundary expressed in the type system.
 */
export interface AdminSupportMessageView {
  id: string;
  authorType: SupportAuthorType;
  visibility: SupportMessageVisibility;
  /**
   * The administrator who wrote the message, or null for a message
   * written by the requester or by a machine.
   *
   * Never the requester's identifier: on a USER message this field is
   * deliberately nulled by the admin service before serialization, so
   * the admin queue cannot be used to recover who opened a ticket.
   */
  authorId: string | null;
  body: string;
  /** ISO-8601. */
  createdAt: string;
}

/**
 * One ticket in the admin queue. Carries no message bodies.
 *
 * The two counts are separate on purpose: an administrator must be able
 * to see at a glance how much of a thread the requester can actually
 * read, and a single total would hide the difference.
 */
export interface AdminSupportTicketSummary {
  reference: string;
  category: SupportCategory;
  status: SupportTicketStatus;
  subject: string;
  /** Messages the requester can see. */
  publicMessageCount: number;
  /** INTERNAL notes. Never disclosed on any user-facing route. */
  internalNoteCount: number;
  /** ISO-8601. */
  createdAt: string;
  /** ISO-8601. */
  updatedAt: string;
}

/** One ticket with its FULL conversation, internal notes included. */
export interface AdminSupportTicketDetail extends AdminSupportTicketSummary {
  messages: AdminSupportMessageView[];
}

/** The queue. */
export interface AdminSupportQueueResponse {
  tickets: AdminSupportTicketSummary[];
  /** ISO-8601. */
  generatedAt: string;
}

/**
 * The ONLY two statuses an administrator may set directly.
 *
 * OPEN is creation-only: it means "nobody has looked at this yet", and
 * no action can put a ticket back into a state that claims that.
 * AWAITING_USER is DERIVED — it is the consequence of posting a
 * user-visible reply, never a value anybody submits. What remains is
 * resolving a ticket and reopening one, and those are the two members
 * below (CTO decision, S3).
 *
 * `admin-support.dto.ts` validates against this array, so the API and
 * this declaration cannot disagree about the permitted set.
 */
export type AdminSupportStatusAction = Extract<SupportTicketStatus, 'RESOLVED' | 'AWAITING_ADMIN'>;

export const ADMIN_SUPPORT_STATUS_ACTIONS: AdminSupportStatusAction[] = [
  'RESOLVED',
  'AWAITING_ADMIN',
];

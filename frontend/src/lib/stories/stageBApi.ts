import { accountFetch } from '@/lib/api/accountFetch';

/**
 * HOME R1 · STAGE B — the Discussion and in-app Alerts client.
 *
 * Every call goes through the existing first-party account transport (`/api/discussion`,
 * `/api/alerts`: same-origin, session cookie, CSRF double-submit on mutations). No provider,
 * no model, no Ask path. A 404 means the capability is OFF on the server: the UI treats it as
 * "not available" and shows nothing that pretends otherwise.
 */

export type CommentState = 'VISIBLE' | 'HIDDEN' | 'REMOVED' | 'DELETED';

export interface CommentView {
  readonly id: string;
  readonly parentId: string | null;
  readonly state: CommentState;
  readonly body: string | null;
  readonly authorLabel: string | null;
  readonly mine: boolean;
  readonly createdAt: string;
  readonly editedAt: string | null;
  readonly briefVersion: number;
}

export interface ThreadView {
  readonly articleRef: string;
  readonly storyId: string | null;
  readonly briefVersion: number | null;
  readonly locked: boolean;
  readonly count: number;
  readonly comments: readonly CommentView[];
}

export type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: 'OFF' | 'SIGNED_OUT' | 'LOCKED' | 'RATE_LIMITED' | 'INVALID' | 'NOT_FOUND' | 'FAILED' };

async function call<T>(path: string, init: Parameters<typeof accountFetch>[1] = {}, parse = true): Promise<Outcome<T>> {
  try {
    const response = await accountFetch(path, init);
    if (response.ok) return { ok: true, value: (parse && response.status !== 204 ? await response.json() : undefined) as T };
    if (response.status === 404) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      return { ok: false, reason: body?.message && body.message !== 'Not Found' ? 'NOT_FOUND' : 'OFF' };
    }
    if (response.status === 401) return { ok: false, reason: 'SIGNED_OUT' };
    if (response.status === 409) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      return { ok: false, reason: body?.message === 'DISCUSSION_LOCKED' ? 'LOCKED' : 'FAILED' };
    }
    if (response.status === 429) return { ok: false, reason: 'RATE_LIMITED' };
    if (response.status === 400) return { ok: false, reason: 'INVALID' };
    return { ok: false, reason: 'FAILED' };
  } catch {
    return { ok: false, reason: 'FAILED' };
  }
}

// ── Discussion ─────────────────────────────────────────────────────────────

export const fetchThread = (articleRef: string) => call<ThreadView>(`/discussion/articles/${articleRef}`);

export async function fetchDiscussionCounts(articleRefs: readonly string[]): Promise<Record<string, number>> {
  if (articleRefs.length === 0) return {};
  const out = await call<{ counts: Record<string, number> }>('/discussion/counts', { method: 'POST', body: { articleRefs: articleRefs.slice(0, 60) } });
  return out.ok ? out.value.counts : {};
}

export const postComment = (input: { articleRef: string; url: string; body: string; parentId?: string; idempotencyKey: string }) =>
  call<CommentView>('/discussion/comments', { method: 'POST', body: input });

export const editComment = (id: string, body: string) => call<CommentView>(`/discussion/comments/${id}/edit`, { method: 'POST', body: { body } });

export const deleteComment = (id: string) => call<void>(`/discussion/comments/${id}`, { method: 'DELETE' }, false);

export const reportComment = (id: string, reason: string) => call<void>(`/discussion/comments/${id}/report`, { method: 'POST', body: { reason } }, false);

// ── Alerts ─────────────────────────────────────────────────────────────────

export type AlertChange = 'NO_CHANGE_YET' | 'CHANGED' | 'NO_RETAINED_EVIDENCE';

export interface AlertView {
  readonly id: string;
  readonly storyId: string;
  readonly status: 'ACTIVE' | 'PAUSED';
  readonly muted: boolean;
  readonly change: AlertChange;
  readonly briefVersion: number;
  readonly createdBriefVersion: number;
  readonly lastChangeAt: string | null;
  readonly createdAt: string;
  readonly unread: number;
  readonly subject: { readonly articleRef: string; readonly title: string; readonly url: string; readonly sourceName: string } | null;
}

export interface InboxView {
  readonly developments: ReadonlyArray<{
    readonly id: string;
    readonly alertId: string;
    readonly kind: 'NEW_EVIDENCE' | 'STORY_MERGED';
    readonly briefVersion: number;
    readonly createdAt: string;
    readonly read: boolean;
    readonly muted: boolean;
    readonly subject: AlertView['subject'];
    /** TRUST R1 — the retained report that joined the story at this version (what changed). */
    readonly newEvidence?: {
      readonly articleRef: string;
      readonly articleId: string;
      readonly title: string;
      readonly url: string;
      readonly sourceName: string;
      readonly publishedAt: string;
    } | null;
  }>;
  readonly replies: ReadonlyArray<{ readonly id: string; readonly createdAt: string; readonly read: boolean; readonly authorLabel: string | null; readonly storyId: string }>;
  readonly unread: { readonly developments: number; readonly replies: number };
}

export const createAlert = (input: { articleRef: string; url: string }) => call<AlertView>('/alerts', { method: 'POST', body: input });
export const listAlerts = () => call<{ alerts: AlertView[] }>('/alerts');
export const fetchInbox = () => call<InboxView>('/alerts/inbox');
export const markAllRead = () => call<void>('/alerts/inbox/read-all', { method: 'POST' }, false);
export const markEventRead = (id: string) => call<void>(`/alerts/events/${id}/read`, { method: 'POST' }, false);
export type AlertOp = 'pause' | 'resume' | 'mute' | 'unmute' | 'remove' | 'restore';
export const applyAlertOp = (id: string, op: AlertOp) => call<AlertView | { id: string; status: 'REMOVED' }>(`/alerts/${id}/${op}`, { method: 'POST' });

export async function fetchAlertsByArticle(articleRefs: readonly string[]): Promise<Record<string, { alertId: string; status: string }> | null> {
  if (articleRefs.length === 0) return {};
  const out = await call<{ alerts: Record<string, { alertId: string; status: string }> }>('/alerts/by-article', {
    method: 'POST',
    body: { articleRefs: articleRefs.slice(0, 60) },
  });
  return out.ok ? out.value.alerts : null;
}

/** A per-draft idempotency key: a retried submit of the same draft returns the same comment. */
export function newIdempotencyKey(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

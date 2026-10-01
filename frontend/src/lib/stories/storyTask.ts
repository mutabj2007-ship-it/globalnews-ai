import { ARTICLE_REF_PATTERN } from '@globalnews-ai/shared';
import type { StoryTarget } from './stageBStore';

/**
 * HOME R1 · STAGE B — THE SIGN-IN CONTINUATION FOR DISCUSS / ALERT.
 *
 * A signed-out reader who presses Post or Save alert is sent through the EXISTING Google
 * OAuth flow with the EXISTING allow-listed destination '/' (Home — where the task started).
 * No new return destination, no task in the URL: the comment draft and the article identity
 * never travel to Google, to the callback or into a query string.
 *
 * What survives the round trip is ONE same-tab sessionStorage record:
 *   { v, kind, articleRef, url, title, sourceName, draft?, parentId?, at }
 * - same tab only (sessionStorage), never localStorage, never a cookie;
 * - expires after TASK_TTL_MS; read ONCE and cleared on read (consumed or not);
 * - validated on read (shape, articleRef pattern, http(s) URL, draft length) — a tampered or
 *   stale record is discarded, never acted on;
 * - restoring it OPENS the panel with the draft filled in. It never posts or saves by itself:
 *   the reader presses Post / Save alert again.
 * This is not saved-story state (the saved-stories no-browser-storage rule is untouched).
 */
export const STORY_TASK_KEY = 'gna.storyTask.v1';
export const TASK_TTL_MS = 30 * 60 * 1000;
const MAX_DRAFT = 2000;

export interface StoryTask {
  readonly kind: 'discuss' | 'alert';
  readonly story: StoryTarget;
  readonly draft?: string;
  readonly parentId?: string | null;
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveStoryTask(task: StoryTask, now = Date.now()): void {
  const s = storage();
  if (s === null) return;
  try {
    s.setItem(
      STORY_TASK_KEY,
      JSON.stringify({
        v: 1,
        kind: task.kind,
        articleRef: task.story.articleRef,
        url: task.story.url,
        title: task.story.title.slice(0, 300),
        sourceName: task.story.sourceName.slice(0, 120),
        ...(task.kind === 'discuss' && task.draft ? { draft: task.draft.slice(0, MAX_DRAFT) } : {}),
        ...(task.kind === 'discuss' && task.parentId ? { parentId: task.parentId } : {}),
        at: now,
      }),
    );
  } catch {
    /* Storage unavailable: the reader re-opens the panel after signing in. */
  }
}

export function clearStoryTask(): void {
  try {
    storage()?.removeItem(STORY_TASK_KEY);
  } catch {
    /* nothing to clear */
  }
}

const isHttpUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
};

/** Read ONCE: the record is removed whatever it contains. */
export function takeStoryTask(now = Date.now()): StoryTask | null {
  const s = storage();
  if (s === null) return null;
  let raw: string | null = null;
  try {
    raw = s.getItem(STORY_TASK_KEY);
    s.removeItem(STORY_TASK_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const r = JSON.parse(raw) as Record<string, unknown>;
    if (r.v !== 1 || (r.kind !== 'discuss' && r.kind !== 'alert')) return null;
    if (typeof r.at !== 'number' || now - r.at > TASK_TTL_MS || r.at > now + 60000) return null;
    if (typeof r.articleRef !== 'string' || !ARTICLE_REF_PATTERN.test(r.articleRef) || !isHttpUrl(r.url)) return null;
    const story: StoryTarget = {
      articleRef: r.articleRef,
      url: r.url,
      title: typeof r.title === 'string' ? r.title : '',
      sourceName: typeof r.sourceName === 'string' ? r.sourceName : '',
    };
    if (r.kind === 'alert') return { kind: 'alert', story };
    const draft = typeof r.draft === 'string' ? r.draft.slice(0, MAX_DRAFT) : undefined;
    const parentId = typeof r.parentId === 'string' && /^[0-9a-f-]{36}$/.test(r.parentId) ? r.parentId : null;
    return { kind: 'discuss', story, draft, parentId };
  } catch {
    return null;
  }
}

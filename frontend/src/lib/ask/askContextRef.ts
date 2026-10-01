import {
  ARTICLE_REF_PATTERN,
  MAX_SELECTED_STORIES,
  normalizeArticleUrl,
  type GeographyContext,
  type MultiStoryAction,
  type SelectedStoryRef,
  type StoryContext,
} from '@globalnews-ai/shared';

/**
 * HOME R1 · STAGE A — THE CLIENT SIDE OF THE SERVER-RESOLVED CONTEXT CONTRACT.
 *
 * The wire shape mirrors the backend `AskContextRefDto` exactly: a closed entry, up to
 * MAX_SELECTED_STORIES `{articleRef, url}` pairs, an optional governed action and an
 * optional country code. Nothing else — no title, summary, comment, answer or evidence.
 * The server verifies every pair (the URL must hash to the articleRef) and resolves it
 * against retained reporting; what it made of each reference comes back on the operation.
 *
 * PRECEDENCE, STATED (the legacy dock's, extended by one rung): an explicitly held
 * selection, then the story anchor, then the map country. Never two scopes.
 */

export type AskContextEntry = 'home' | 'story' | 'compare' | 'map' | 'my-intelligence';

export interface AskContextRefWire {
  readonly entry: AskContextEntry;
  readonly stories?: readonly SelectedStoryRef[];
  readonly action?: MultiStoryAction;
  readonly country?: string;
}

/** articleRef = sha256(normalizeArticleUrl(url)), the governed identity. Null when unavailable. */
export async function articleRefOf(url: string): Promise<string | null> {
  const subtle = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto.subtle : undefined;
  if (subtle === undefined) return null;
  try {
    const bytes = new TextEncoder().encode(normalizeArticleUrl(url));
    const digest = await subtle.digest('SHA-256', bytes);
    const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    return ARTICLE_REF_PATTERN.test(hex) ? hex : null;
  } catch {
    return null;
  }
}

export interface DockContextSources {
  readonly selection: readonly SelectedStoryRef[];
  /** Where an explicitly held selection came from, and its governed action (closed sets). */
  readonly selectionEntry?: 'compare' | 'my-intelligence';
  readonly selectionAction?: MultiStoryAction;
  readonly story: StoryContext | undefined;
  readonly geography: GeographyContext | undefined;
}

/** Which scope the dock will name before Send — the same precedence the builder applies. */
export function dockContextKind(sources: DockContextSources): 'selection' | 'story' | 'geography' | 'none' {
  if (sources.selection.length > 0) return 'selection';
  if (sources.story?.url !== undefined && sources.story.url.length > 0) return 'story';
  if (sources.geography !== undefined) return 'geography';
  return 'none';
}

/**
 * Build the ONE context bag for a dock Send, or undefined for a plain question. Identities
 * only; the selection's display labels are dropped here, at the boundary.
 */
export async function buildDockContextRef(
  sources: DockContextSources,
  entryOverride?: AskContextEntry,
): Promise<AskContextRefWire | undefined> {
  const kind = dockContextKind(sources);
  if (kind === 'selection') {
    return {
      entry: entryOverride ?? sources.selectionEntry ?? 'compare',
      ...(sources.selectionAction === undefined ? {} : { action: sources.selectionAction }),
      stories: sources.selection
        .slice(0, MAX_SELECTED_STORIES)
        .map((story) => ({ articleRef: story.articleRef, url: story.url })),
    };
  }
  if (kind === 'story' && sources.story?.url !== undefined) {
    const articleRef = await articleRefOf(sources.story.url);
    if (articleRef !== null) {
      return { entry: entryOverride ?? 'story', stories: [{ articleRef, url: sources.story.url }] };
    }
  }
  if (sources.geography !== undefined) {
    return { entry: entryOverride ?? 'map', country: sources.geography.countryCode };
  }
  return undefined;
}

/** My Intelligence / Compare: a selection with its governed action, as references. */
export function selectionContextRef(
  action: MultiStoryAction,
  stories: readonly SelectedStoryRef[],
  entry: 'my-intelligence' | 'compare' = 'my-intelligence',
): AskContextRefWire {
  return {
    entry,
    action,
    stories: stories.slice(0, MAX_SELECTED_STORIES).map((s) => ({ articleRef: s.articleRef, url: s.url })),
  };
}

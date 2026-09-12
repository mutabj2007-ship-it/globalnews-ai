'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { LanguageCode, NewsArticle, NewsCategory, NewsDataMode } from '@globalnews-ai/shared';
import { resolveLiveStatus, type LiveStatusKey } from '@/lib/liveStatus';

/**
 * M66.14B — THE ONE OWNER OF HERO FOCUS STATE.
 *
 * WHY A PROVIDER AND NOT Hero STATE. Hero and GlobalDevelopments are SIBLINGS
 * rendered by app/page.tsx, which is a Server Component. Hero-owned state is
 * therefore unreachable from TrendingCard, so trending could never join the
 * same chain. This provider is mounted around exactly those two children.
 *
 * THE SERVER BOUNDARY SURVIVES because children arrive as a prop: the subtree
 * stays server-rendered and only this file joins the client bundle. That is the
 * whole reason it renders {children} and nothing else.
 *
 * GlobalDevelopments is inside the provider from the first commit even though
 * TrendingCard does not call into it until B-2. Nothing here is temporary and
 * nothing built here will be replaced.
 *
 * ONE NULLABLE OBJECT. focused article, focused country, focused category and
 * card visibility are all derived from it; visibility IS `focus !== null`, so
 * there is no second flag to fall out of sync.
 */
export interface HeroFocus {
  articleId: string;
  /** null = the article resolved to no country. See setFocusFromArticle. */
  countryCode: string | null;
  countryName: string | null;
  category: NewsCategory;
  /** Provider text, verbatim. NEVER translated — see M66.13C. */
  headline: string;
  summary: string;
}

interface HeroFocusContextValue {
  focus: HeroFocus | null;
  /**
   * THE ONE CANONICAL FOCUS ACTION. Both the pointer path and the keyboard path
   * call this same function with the same article, so they cannot diverge — and
   * it is deterministic, so the same article always produces the same state.
   */
  setFocusFromArticle: (article: NewsArticle) => void;
  clearFocus: () => void;
  /** The AUTHORITATIVE provenance state, resolved once here. */
  statusKey: LiveStatusKey;
}

const HeroFocusContext = createContext<HeroFocusContextValue | null>(null);

export function useHeroFocus(): HeroFocusContextValue {
  const value = useContext(HeroFocusContext);

  if (value === null) {
    throw new Error('useHeroFocus must be used inside HeroFocusProvider');
  }

  return value;
}

interface HeroFocusProviderProps {
  language: LanguageCode;
  isLive: boolean;
  dataMode: NewsDataMode | null;
  updatedAt: string;
  children: ReactNode;
}

export function HeroFocusProvider({
  language,
  isLive,
  dataMode,
  updatedAt,
  children,
}: HeroFocusProviderProps): JSX.Element {
  const [focus, setFocus] = useState<HeroFocus | null>(null);

  /*
    PROVENANCE. The same four authoritative values page.tsx already hands to
    Hero and LiveStatusStrip, resolved ONCE through the shared resolver. No
    child re-derives a data mode: TrendingCard and the context card read this.

    This is a third call site of resolveLiveStatus, not a second provenance
    model — Hero and LiveStatusStrip are the first two, and
    m65LanguageIntegrity.spec.ts already asserts that both compute their state
    from the SAME shared function. One pure function, identical inputs.
  */
  const { statusKey } = resolveLiveStatus(isLive, dataMode, language, updatedAt);

  /*
    THE UNRESOLVED-ARTICLE RULE.

    An article with no countryCode sets focus with countryCode null rather than
    leaving the previous focus in place. That matters: if hovering article B did
    nothing, the map and card would still be showing article A's country while
    B's row is highlighted — a false geographic claim produced by silence.

    Clearing is a WRITE like any other, so "last interaction wins" holds with no
    special case, and pointer-leave persistence is untouched: nothing here is
    triggered by leaving.
  */
  const setFocusFromArticle = useCallback((article: NewsArticle) => {
    setFocus({
      articleId: article.id,
      countryCode: article.countryCode ?? null,
      countryName: article.countryName ?? null,
      category: article.category,
      headline: article.title,
      summary: article.summary,
    });
  }, []);

  const clearFocus = useCallback(() => {
    setFocus(null);
  }, []);

  const value = useMemo(
    () => ({ focus, setFocusFromArticle, clearFocus, statusKey }),
    [focus, setFocusFromArticle, clearFocus, statusKey],
  );

  return <HeroFocusContext.Provider value={value}>{children}</HeroFocusContext.Provider>;
}

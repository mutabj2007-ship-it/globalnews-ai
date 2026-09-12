import type { CountryNewsResponse, LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * Milestone #49/#50 — pure text-resolution functions, originally
 * defined inside CountryPanel.tsx and exported from there. Moved to
 * their own file in Milestone #50 Phase F specifically to avoid a
 * circular import: CountryContextShelf.tsx (new) needs these same
 * functions, but CountryPanel.tsx now also imports
 * CountryContextShelf — importing from `./CountryPanel` from
 * CountryContextShelf would have created a cycle. Behavior is
 * byte-for-byte unchanged; this is a pure relocation.
 */

export function resolveFeedBadgeText(
  response: CountryNewsResponse,
  language: LanguageCode = 'en',
): string {
  const t = getDictionary(language).map.badge;

  // Milestone #49 Phase D — 'unavailable' is an internal dataMode
  // value, never a provider name. It must be checked BEFORE the
  // feedTier==='delayed' fallback below: the M49 Phase C
  // containment fix constructs an unavailable response with
  // feedTier:'delayed' and providerDisplayName:'Unavailable' (an
  // internal placeholder, never meant for direct display), which —
  // without this explicit branch — fell through into that fallback
  // and rendered "DELAYED FEED · POWERED BY Unavailable" verbatim.
  if (response.dataMode === 'unavailable') {
    return t.unavailable;
  }

  if (response.dataMode === 'mock') {
    return t.demo;
  }

  if (response.dataMode === 'cached') {
    return t.stored;
  }

  if (response.feedTier === 'delayed') {
    return `${t.delayedPrefix}${response.providerDisplayName}`;
  }

  return `${t.livePrefix}${response.providerDisplayName}`;
}

export function resolveFallbackTitle(
  response: CountryNewsResponse,
  language: LanguageCode = 'en',
): string | null {
  if (response.dataMode !== 'cached') {
    return null;
  }

  const t = getDictionary(language).map.fallback;

  if (response.fallbackReason === 'provider-error') {
    return t.providerErrorTitle;
  }

  if (response.fallbackReason === 'no-live-results') {
    return t.noLiveResultsTitle;
  }

  return t.genericTitle;
}

export function resolveFallbackDescription(
  response: CountryNewsResponse,
  language: LanguageCode = 'en',
): string | null {
  if (response.dataMode !== 'cached') {
    return null;
  }

  const t = getDictionary(language).map.fallback;

  if (response.fallbackReason === 'provider-error') {
    return t.providerErrorDescription;
  }

  if (response.fallbackReason === 'no-live-results') {
    return t.noLiveResultsDescription;
  }

  return t.genericDescription;
}

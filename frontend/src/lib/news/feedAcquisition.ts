import { askProgressStrings } from '@/lib/ask/askProgressStrings';

/*
  CTO #95 c6375734941 §4 — an empty Home feed must not say only "Couldn't load the latest updates"
  when the reason is that NO SOURCE IS CLEARED. The backend states that reason itself, typed
  (news.service #96 Gate A: `acquisition: { state: 'SOURCE_RIGHTS_UNCLEARED', notSearched }`, sent
  only when nothing was returned and a configured provider was not admitted). This reads that
  field and nothing else: never inferred from HTTP 200, a zero-length list or `dataMode`.
*/

/** True only when the response itself says the news was not searched because no source is cleared. */
export function feedNotSearchedRightsUncleared(response: unknown): boolean {
  if (response === null || typeof response !== 'object') return false;
  const a = (response as { acquisition?: unknown }).acquisition;
  if (a === null || typeof a !== 'object') return false;
  return (a as { state?: unknown }).state === 'SOURCE_RIGHTS_UNCLEARED';
}

/**
 * The empty-feed status line. A rights refusal reads as "not searched" (Claude L's qualified
 * `searchNotPermitted`, the same words Ask's Search activity uses, 7 locales); anything else keeps
 * the existing unavailable wording, which is true for an unreachable backend or a real outage.
 */
export function emptyFeedLine(notSearched: boolean, language: string, unavailable: string): string {
  return notSearched ? askProgressStrings(language).searchNotPermitted : unavailable;
}

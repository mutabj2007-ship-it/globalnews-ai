import type { LanguageCode, PublishedAtBasis } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * Milestone #47 (Defect 1 correction) — `language` defaults to 'en',
 * so every existing caller that never passes it renders byte-for-byte
 * identical output to before this change. Formats an ISO-8601
 * timestamp as "12 min ago" / "3 hr ago" / "2 days ago" (or the
 * localized equivalent) — never touches the timestamp VALUE itself,
 * only the presentation words around it.
 */
export function formatRelativeTime(iso: string, language: LanguageCode = 'en'): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const t = getDictionary(language).formatRelativeTime;

  const diffMs = Date.now() - then;
  const diffMinutes = Math.max(0, Math.round(diffMs / 60_000));

  if (diffMinutes < 1) return t.justNow;
  if (diffMinutes < 60) return `${diffMinutes} ${t.minAgo}`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} ${t.hrAgo}`;

  const diffDays = Math.round(diffHours / 24);
  const dayWord = diffDays === 1 ? t.daySingular : t.dayPlural;
  return `${diffDays} ${dayWord} ${t.ago}`;
}

/**
 * R4 GDELT — THE SAME ELAPSED TIME, DESCRIBED TRUTHFULLY.
 *
 * `formatRelativeTime` answers "how long ago". It does not, and must not,
 * answer "how long ago WHAT" — and with a second provider that second
 * question stopped having one answer.
 *
 *   basis 'publisher'  the outlet said it published then    -> "3 hr ago"
 *   basis 'observed'   an aggregator saw it then            -> "Seen 3 hr ago"
 *   basis absent       we do not know which                 -> "3 hr ago"
 *
 * The captured Haberler record makes the difference concrete: GDELT's
 * `seendate` was 55 minutes after the outlet's own publication time.
 * Rendering that as "Published 55 min later than it was" is a small lie
 * told confidently, which is the kind this codebase keeps refusing.
 *
 * WHY ABSENT FALLS BACK TO THE PLAIN FORM RATHER THAN "Seen". The plain
 * form makes NO claim about which kind of time it is — it says only "3 hr
 * ago", which is true either way. "Seen 3 hr ago" WOULD make a claim, and
 * an unproven basis is not entitled to make one. So the fallback is the
 * weaker statement, not the stronger.
 */
export function formatObservationalTime(
  iso: string,
  basis: PublishedAtBasis | undefined,
  language: LanguageCode = 'en',
): string {
  const relative = formatRelativeTime(iso, language);
  if (relative === '') return '';

  if (basis !== 'observed') return relative;

  return `${getDictionary(language).formatRelativeTime.seenPrefix} ${relative}`;
}

/** Formats an ISO-8601 timestamp as a UTC "HH:MM UTC" label. Timezone abbreviation intentionally stays "UTC" (a technical/universal label, not natural-language prose) regardless of language. */
export function formatUtcClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes} UTC`;
}

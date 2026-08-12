import type { LanguageCode } from '@globalnews-ai/shared';
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

/** Formats an ISO-8601 timestamp as a UTC "HH:MM UTC" label. Timezone abbreviation intentionally stays "UTC" (a technical/universal label, not natural-language prose) regardless of language. */
export function formatUtcClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes} UTC`;
}

import type { DisplayLocale } from '@globalnews-ai/shared';

/**
 * R4 · CTO LOCALIZATION CONVERGENCE (category B — a localized DATA formatter).
 *
 * "How long ago", in the reader's own DisplayLocale, through CLDR (`Intl.RelativeTimeFormat`).
 * The released `formatRelativeTime` composes `${n} ${minAgo}` in English word order, which no
 * translated word can repair ("5 il y a", "2 Tage vor"); CLDR carries each language's own order
 * and plural forms ("il y a 5 minutes", "vor 2 Tagen", "há 2 dias", "منذ ٥ دقائق"). The
 * thresholds are the released ones: under a minute → now; minutes; hours under a day; days.
 */
export function askRelativeTime(
  iso: string,
  locale: DisplayLocale,
  now: number = Date.now(),
): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const minutes = Math.max(0, Math.round((now - then) / 60_000));
  if (minutes < 1) return rtf.format(0, 'second');
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.round(hours / 24), 'day');
}

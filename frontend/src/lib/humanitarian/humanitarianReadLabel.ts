import type { HumanitarianRetainedRead } from '@globalnews-ai/shared';
import type { HumLocale } from './humStrings';

export function humanitarianReadLabel(read: HumanitarianRetainedRead, locale: HumLocale): string {
  if (locale === 'pl') return read.absence === 'NOT_ASSESSED'
    ? 'Nie oceniono — brak zatwierdzonych obserwacji'
    : 'Luka w pokryciu — odczyt niedostępny';
  return read.absence === 'NOT_ASSESSED'
    ? 'Not assessed — no admitted observations'
    : 'Coverage gap — read unavailable';
}
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
/** Release capability explained inside the existing assessment statement, never a new region. */
export function humanitarianReadExplanation(read: HumanitarianRetainedRead, locale: HumLocale): string {
  if (read.absence !== 'NOT_ASSESSED') return locale === 'pl'
    ? 'Odczyt dowodów jest niedostępny. Nie można ustalić potrzeb, dostępu ani zmian.'
    : 'The evidence read is unavailable. Need, access and change cannot be established.';
  return locale === 'pl'
    ? 'Brak oceny: wymagane są zweryfikowane dowody, aktualna zgoda na ich ujawnienie i zatwierdzony odczyt publiczny. Doniesienia prasowe są kontekstem.'
    : 'No assessment: reviewed evidence, current protection approval and a governed public reader are required. Related reporting is contextual.';
}

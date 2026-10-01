import type { HumanitarianRetainedRead } from '@globalnews-ai/shared';
import type { HumLocale } from './humStrings';

/**
 * The read state as one token (for `data-hum-read`): the reader absence for UNAVAILABLE, else
 * the result kind. NO_RETAINED_EVIDENCE is its own token and never an absence value.
 */
export function humanitarianReadState(read: HumanitarianRetainedRead): string {
  return read.kind === 'UNAVAILABLE' ? read.absence : read.kind;
}

export function humanitarianReadLabel(read: HumanitarianRetainedRead, locale: HumLocale): string {
  switch (read.kind) {
    case 'UNAVAILABLE':
      if (locale === 'pl')
        return read.absence === 'NOT_ASSESSED' ? 'Nie oceniono' : 'Luka w pokryciu';
      return read.absence === 'NOT_ASSESSED'
        ? 'Not assessed — no admitted observations'
        : 'Coverage gap — read unavailable';
    /* HUMANITARIAN CONVERGENCE (CTO absence ruling): the store was queried and is empty — a fact
       about our store, never a finding about a crisis. */
    case 'NO_RETAINED_EVIDENCE':
      return locale === 'pl'
        ? 'Brak zachowanych rekordów — to nie jest ocena'
        : 'No retained records — not an assessment';
    case 'RETAINED':
      return locale === 'pl'
        ? `Zachowane dowody — rekordy: ${read.observations.length}`
        : `Retained evidence — ${read.observations.length} ${read.observations.length === 1 ? 'record' : 'records'}`;
  }
}

/** Release capability explained inside the existing assessment statement, never a new region. */
export function humanitarianReadExplanation(
  read: HumanitarianRetainedRead,
  locale: HumLocale,
): string {
  switch (read.kind) {
    case 'UNAVAILABLE':
      if (read.absence !== 'NOT_ASSESSED')
        return locale === 'pl'
          ? 'Odczyt dowodów jest niedostępny. Nie można ustalić potrzeb, dostępu ani zmian.'
          : 'The evidence read is unavailable. Need, access and change cannot be established.';
      return locale === 'pl'
        ? 'Brak dopuszczonych obserwacji: wymagane są zweryfikowane dowody, aktualna zgoda na ujawnienie i zatwierdzony odczyt publiczny. Doniesienia są kontekstem.'
        : 'No assessment: reviewed evidence, current protection approval and a governed public reader are required. Related reporting is contextual.';
    case 'NO_RETAINED_EVIDENCE':
      return locale === 'pl'
        ? 'Magazyn zachowanych dowodów został odpytany i nie zawiera rekordów. Nie mówi to nic o tym, czy cokolwiek się wydarzyło.'
        : 'The retained evidence store was queried and holds no records. This says nothing about whether anything happened.';
    case 'RETAINED':
      return locale === 'pl'
        ? 'Zachowane dowody z dopuszczonych źródeł. Liczby pokazujemy wyłącznie tak, jak podało je źródło.'
        : 'Retained evidence from admitted sources. Figures appear only as the source stated them.';
  }
}

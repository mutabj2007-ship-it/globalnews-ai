import type { DisplayLocale } from '@globalnews-ai/shared';

/**
 * IMIHIGO / DELIVERY · EN / PL ONLY.
 *
 * **R-ML-1 · no string is shipped in `rw`.** Kinyarwanda is a `LanguageCode`
 * and not a `DisplayLocale`, and `ACTIVE_LANGUAGES` is `['en','pl']` — the
 * established baseline, reused rather than widened.
 *
 * ── WHY `rw` IS NOT PRODUCTION-READY, AND IT IS THE BACKBONE NOT THE FONT ─
 *
 * Main executed the probe: `Intl.DateTimeFormat`, `Intl.NumberFormat` and
 * `Intl.RelativeTimeFormat` RESOLVE for `rw`; `Intl.PluralRules`,
 * `Intl.Collator` and `Intl.ListFormat` FALL BACK to `en-US`. **Three resolve,
 * three fall back, none throws.**
 *
 * **R-ML-2 · the partial-resolution trap.** A developer who probes
 * `Intl.NumberFormat('rw')` concludes `rw` is supported. *A constructor that
 * resolves is not evidence the locale is supported.* The plural categories
 * obtained for `rw` are `[one, other]` resolved from `en-US`: a Kinyarwanda
 * plural does not look wrong — **it is English, silently.**
 *
 * **R-ML-3** — over the 11 governed East Africa countries,
 * `Intl.DisplayNames(['rw'],{type:'region'})` returns bare ISO codes for 10 of
 * 11. No region name is rendered in `rw` anywhere.
 *
 * **R-ML-6 · source provenance is a DIFFERENT AXIS and is preserved.** A
 * commitment published in Kinyarwanda is `sourceLanguage: 'rw'` whatever the
 * reader sees, and `sourceLanguage`, `assessmentLanguage` and `displayLanguage`
 * stay three distinct axes. **Not displaying a language is not the same as not
 * recording it.** Nothing in this file is that axis, and nothing here touches
 * it.
 *
 * **R-ML-8** — `sourceLanguageFor` is not called with `'rw'` anywhere in this
 * lane. Two implementations exist with different domains and the frontend copy
 * returns `undefined` for `rw`, where `undefined` already carries two
 * distinguishable absences. Filed by Main as `TL-IK-2`; not H's to fix.
 */
export type DeliveryLocale = Extract<DisplayLocale, 'en' | 'pl'>;

export interface DeliveryStrings {
  readonly title: string;
  readonly previewMarker: string;
  readonly previewNote: string;
  readonly modeLabel: string;
  readonly scopeLabel: string;
  readonly hudRegion: string;
  readonly commitmentRegion: string;
  readonly subjectRegion: string;
  readonly readingsRegion: string;
  /**
   * `RC-2` · the order's provenance, stated as a FACT rather than as a
   * disclaimer. R1 carried `arbitraryOrder`, which was `K-8`'s "declared
   * arbitrary" caption — **withdrawn by R3**, because *"a list rendered in an
   * order we chose, captioned as meaningless, is still a list we ordered."*
   * The declaration now lives on a required field of the record; this string
   * only tells the reader which of the three it is.
   */
  readonly orderReasonLabel: Readonly<Record<'AUTHORITY_PUBLISHED' | 'LEXICAL', string>>;
  readonly absenceAssertion: string;
  readonly absenceIsNotUnderperformance: string;
  readonly loadingLabel: string;
  readonly noBoundSubject: string;
  readonly identityNotGeometry: string;
  readonly sourceLanguageNote: string;
  readonly indicatorLabels: {
    readonly heading: string;
    readonly risingOf: string;
    readonly showAll: string;
    readonly noneObserved: string;
    readonly staleSuffix: string;
    readonly directions: Readonly<Record<'RISING' | 'FALLING' | 'FLAT' | 'UNKNOWN', string>>;
  };
  readonly unresolvedNote: string;
}

const EN: DeliveryStrings = {
  title: 'Delivery Intelligence — provider-free preview',
  previewMarker: 'PREVIEW · NO DELIVERY DATA IS BOUND',
  previewNote:
    'Every subject on this screen is a placeholder with no real-world referent. No commitment, target, progress value or achieved result is bound, and none is computed.',
  modeLabel: 'DELIVERY COMMITMENTS',
  scopeLabel: 'NO SUBJECT BOUND',
  hudRegion: 'HUD',
  commitmentRegion: 'COMMITMENTS',
  subjectRegion: 'SUBJECTS',
  readingsRegion: 'COMPETING READINGS',
  orderReasonLabel: { AUTHORITY_PUBLISHED: 'Order as the authority published it', LEXICAL: 'Order by label' },
  absenceAssertion: 'Nothing has been assessed.',
  absenceIsNotUnderperformance:
    'A subject with no evidence has not underperformed. It has not been reported on.',
  loadingLabel: 'Not yet measured',
  noBoundSubject: 'No subject bound',
  identityNotGeometry:
    'Subjects are identities, not shapes. No boundary geometry is held, and none is drawn.',
  sourceLanguageNote:
    'Source language is recorded whatever the reader sees. Not displaying a language is not the same as not recording it.',
  indicatorLabels: {
    heading: 'COMMITMENTS',
    risingOf: '{rising} of {total} rising',
    showAll: 'Show all',
    noneObserved: 'No commitment is bound.',
    staleSuffix: 'stale',
    directions: { RISING: 'rising', FALLING: 'falling', FLAT: 'flat', UNKNOWN: 'not stated' },
  },
  unresolvedNote: 'The platform records the disagreement and does not adjudicate it.',
};

const PL: DeliveryStrings = {
  title: 'Analiza realizacji — podgląd bez dostawców',
  previewMarker: 'PODGLĄD · ŻADNE DANE O REALIZACJI NIE SĄ POWIĄZANE',
  previewNote:
    'Każdy temat na tym ekranie jest zastępczy i nie odnosi się do niczego rzeczywistego. Żadne zobowiązanie, żaden cel, żaden postęp ani żaden osiągnięty wynik nie są powiązane i żadne nie są wyliczane.',
  modeLabel: 'ZOBOWIĄZANIA',
  scopeLabel: 'BRAK POWIĄZANEGO TEMATU',
  hudRegion: 'HUD',
  commitmentRegion: 'ZOBOWIĄZANIA',
  subjectRegion: 'TEMATY',
  readingsRegion: 'ROZBIEŻNE ODCZYTY',
  orderReasonLabel: { AUTHORITY_PUBLISHED: 'Kolejność zgodna z publikacją organu', LEXICAL: 'Kolejność według etykiety' },
  absenceAssertion: 'Nic nie zostało ocenione.',
  absenceIsNotUnderperformance:
    'Temat bez dowodów nie wypadł słabo. Nie był przedmiotem sprawozdania.',
  loadingLabel: 'Jeszcze nie zmierzono',
  noBoundSubject: 'Brak powiązanego tematu',
  identityNotGeometry:
    'Tematy są tożsamościami, a nie kształtami. Nie posiadamy granic i żadnych nie rysujemy.',
  sourceLanguageNote:
    'Język źródła jest zapisywany niezależnie od tego, co widzi czytelnik. Niewyświetlanie języka to nie to samo co jego niezapisanie.',
  indicatorLabels: {
    heading: 'ZOBOWIĄZANIA',
    risingOf: '{rising} z {total} rośnie',
    showAll: 'Pokaż wszystkie',
    noneObserved: 'Żadne zobowiązanie nie jest powiązane.',
    staleSuffix: 'nieaktualne',
    directions: { RISING: 'rośnie', FALLING: 'spada', FLAT: 'bez zmian', UNKNOWN: 'nie podano' },
  },
  unresolvedNote: 'Platforma odnotowuje rozbieżność i jej nie rozstrzyga.',
};

const CATALOGUE: Readonly<Record<DeliveryLocale, DeliveryStrings>> = { en: EN, pl: PL };

export function deliveryStrings(locale: DeliveryLocale): DeliveryStrings {
  return CATALOGUE[locale];
}

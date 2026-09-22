import type { DisplayLocale } from '@globalnews-ai/shared';
import type { Finality, Reportedness } from '@/lib/election/electionReporting';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * KENYA ELECTIONS · EN / PL ONLY, AND THE TWO AXES NEVER SHARE A WORD
 * ════════════════════════════════════════════════════════════════════════════
 *
 * **R-ML-1** — the preview displays in the established `ACTIVE_LANGUAGES`
 * baseline. No language is activated and no `DisplayLocale` is added.
 *
 * **R-ML-5 · NO KISWAHILI STRING IS AUTHORED** — by Main, by L, or by H. `sw`
 * is a `LanguageCode` and not a `DisplayLocale`, and L declined to invent six
 * Kiswahili status strings for a reason this file honours rather than repeats:
 * *"producing six Kiswahili strings and calling the result a collapse analysis
 * would be the estimate this programme refuses elsewhere, dressed as a
 * measurement."* There is no `sw` key below and none is to be added here — the
 * instrument is a qualified Kiswahili reviewer, not an author.
 *
 * ── WHY THE TWO AXES ARE TWO FIELDS AND NEVER ONE PHRASE ─────────────────
 *
 * **The live collapse risk is Polish, not Kiswahili**, because `pl` is half the
 * active display set. L measured `PARTIALLY_REPORTED` and `PROVISIONAL` both
 * collapsing to `NIEPEŁNE` — idiomatic and true of both — and they are not the
 * same incompleteness.
 *
 * `reportedness` and `finality` are rendered as **two separate elements**, so
 * `NIEPEŁNE` renders `PARTIAL` honestly and **cannot reach `PROVISIONAL` at
 * all**, because `PROVISIONAL` is `COMPLETE` on that axis. The collapse is
 * unrepresentable rather than discouraged, and no Polish word had to be
 * invented to achieve it.
 */
export type ElectionLocale = Extract<DisplayLocale, 'en' | 'pl'>;

export interface ElectionStrings {
  readonly title: string;
  readonly previewMarker: string;
  readonly previewNote: string;
  readonly modeLabel: string;
  readonly scopeLabel: string;
  readonly hudRegion: string;
  readonly indicatorRegion: string;
  readonly contestantRegion: string;
  readonly readingsRegion: string;
  readonly noIndicators: string;
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
  readonly loadingLabel: string;
  readonly valueAbsent: string;
  readonly reportedness: Readonly<Record<Reportedness, string>>;
  readonly finality: Readonly<Record<Finality, string>>;
  readonly corrected: string;
  readonly denominatorPattern: string;
  readonly ceilingNote: string;
  readonly noBoundSubject: string;
  readonly indicatorLabels: {
    readonly heading: string;
    readonly risingOf: string;
    readonly showAll: string;
    readonly noneObserved: string;
    readonly staleSuffix: string;
    readonly directions: Readonly<Record<'RISING' | 'FALLING' | 'FLAT' | 'UNKNOWN', string>>;
  };
  readonly readingsLabels: {
    readonly heading: string;
    readonly notResolved: string;
    readonly agreedHeading: string;
    readonly basis: string;
    readonly countingRule: string;
    readonly unresolvedNote: string;
    readonly sources: string;
    readonly incomplete: string;
    readonly sourceClasses: Readonly<Record<string, string>>;
  };
}

const EN: ElectionStrings = {
  title: 'Election Intelligence — provider-free preview',
  previewMarker: 'PREVIEW · NO ELECTION DATA IS BOUND',
  previewNote:
    'Every subject on this screen is a placeholder with no real-world referent. No result, turnout or certification is bound, and none is computed.',
  modeLabel: 'NATIONAL RESULT SUMMARY',
  scopeLabel: 'COUNTRY',
  hudRegion: 'HUD',
  indicatorRegion: 'REPORTED MEASURES',
  contestantRegion: 'CONTESTANTS',
  readingsRegion: 'COMPETING READINGS',
  noIndicators: 'No reported measure is bound.',
  /* KE2-5 / §6.1 — a list has to be printed in some sequence. Saying so stops a
     reader taking the sequence for meaning. */
  orderReasonLabel: { AUTHORITY_PUBLISHED: 'Order as the authority published it', LEXICAL: 'Order by label' },
  absenceAssertion: 'Nothing has been assessed.',
  loadingLabel: 'Not yet measured',
  valueAbsent: '—',
  reportedness: { PARTIAL: 'PARTIAL', COMPLETE: 'COMPLETE' },
  finality: { UNCERTIFIED: 'UNCERTIFIED', CERTIFIED: 'CERTIFIED' },
  corrected: 'CORRECTED',
  denominatorPattern: '{reported} of {total} {unit} reported',
  ceilingNote: 'Results are shown at the geography they are reported against.',
  noBoundSubject: 'No subject bound',
  indicatorLabels: {
    heading: 'REPORTED MEASURES',
    risingOf: '{rising} of {total} rising',
    showAll: 'Show all',
    noneObserved: 'No reported measure is bound.',
    staleSuffix: 'stale',
    directions: { RISING: 'rising', FALLING: 'falling', FLAT: 'flat', UNKNOWN: 'not stated' },
  },
  readingsLabels: {
    heading: 'COMPETING READINGS',
    notResolved: 'UNRESOLVED',
    agreedHeading: 'AGREED',
    basis: 'Basis',
    countingRule: 'Counting rule',
    unresolvedNote: 'The platform records the disagreement and does not adjudicate it.',
    sources: 'sources',
    incomplete: 'Incomplete',
    sourceClasses: {
      OFFICIAL: 'Official',
      INDEPENDENT: 'Independent',
      SELF_REPORTED: 'Self-reported',
      EVIDENCE_BACKED: 'Evidence-backed',
    },
  },
};

const PL: ElectionStrings = {
  title: 'Analiza wyborcza — podgląd bez dostawców',
  previewMarker: 'PODGLĄD · ŻADNE DANE WYBORCZE NIE SĄ POWIĄZANE',
  previewNote:
    'Każdy temat na tym ekranie jest zastępczy i nie odnosi się do niczego rzeczywistego. Żaden wynik, żadna frekwencja ani żadne potwierdzenie nie są powiązane i żadne nie są wyliczane.',
  modeLabel: 'KRAJOWE ZESTAWIENIE WYNIKÓW',
  scopeLabel: 'KRAJ',
  hudRegion: 'HUD',
  indicatorRegion: 'ZGŁOSZONE MIARY',
  contestantRegion: 'STARTUJĄCY',
  readingsRegion: 'ROZBIEŻNE ODCZYTY',
  noIndicators: 'Żadna zgłoszona miara nie jest powiązana.',
  orderReasonLabel: { AUTHORITY_PUBLISHED: 'Kolejność zgodna z publikacją organu', LEXICAL: 'Kolejność według etykiety' },
  absenceAssertion: 'Nic nie zostało ocenione.',
  loadingLabel: 'Jeszcze nie zmierzono',
  valueAbsent: '—',
  /*
    THE TWO AXES, AND THE WORD THAT USED TO COLLAPSE THEM.

    `NIEPEŁNE` renders PARTIAL and only PARTIAL. It cannot reach PROVISIONAL,
    because PROVISIONAL is COMPLETE on this axis and reads `KOMPLETNE ·
    NIEPOTWIERDZONE`. That is L's structural fix, not a lexical one.
  */
  reportedness: { PARTIAL: 'NIEPEŁNE', COMPLETE: 'KOMPLETNE' },
  finality: { UNCERTIFIED: 'NIEPOTWIERDZONE', CERTIFIED: 'POTWIERDZONE' },
  corrected: 'SKORYGOWANE',
  denominatorPattern: 'zgłoszono {reported} z {total} {unit}',
  ceilingNote: 'Wyniki są pokazywane na poziomie geografii, względem której są zgłaszane.',
  noBoundSubject: 'Brak powiązanego tematu',
  indicatorLabels: {
    heading: 'ZGŁOSZONE MIARY',
    risingOf: '{rising} z {total} rośnie',
    showAll: 'Pokaż wszystkie',
    noneObserved: 'Żadna zgłoszona miara nie jest powiązana.',
    staleSuffix: 'nieaktualne',
    directions: { RISING: 'rośnie', FALLING: 'spada', FLAT: 'bez zmian', UNKNOWN: 'nie podano' },
  },
  readingsLabels: {
    heading: 'ROZBIEŻNE ODCZYTY',
    notResolved: 'NIEROZSTRZYGNIĘTE',
    agreedHeading: 'ZGODNE',
    basis: 'Podstawa',
    countingRule: 'Zasada liczenia',
    unresolvedNote: 'Platforma odnotowuje rozbieżność i jej nie rozstrzyga.',
    sources: 'źródła',
    incomplete: 'Niekompletne',
    sourceClasses: {
      OFFICIAL: 'Urzędowe',
      INDEPENDENT: 'Niezależne',
      SELF_REPORTED: 'Deklaracja własna',
      EVIDENCE_BACKED: 'Poparte dowodami',
    },
  },
};

const CATALOGUE: Readonly<Record<ElectionLocale, ElectionStrings>> = { en: EN, pl: PL };

export function electionStrings(locale: ElectionLocale): ElectionStrings {
  return CATALOGUE[locale];
}

/** A tiny formatter. Functions cannot cross the server/client boundary; templates can. */
export function formatElectionString(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return Object.entries(values).reduce(
    (out, [key, value]) => out.split(`{${key}}`).join(String(value)),
    template,
  );
}

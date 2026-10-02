import type { HumanitarianLanguageStrings } from './humanitarianLanguageEn';

/**
 * PROPOSED  frontend/src/lib/i18n/dictionaries/humanitarianLanguagePl.ts
 * HUMANITARIAN LANGUAGE FINALIZATION R2 · base 58f80fd4108d3472e5433c7a50e19295788f2544
 *
 * Typed as `HumanitarianLanguageStrings`, so a key added in English and forgotten
 * here is a COMPILE ERROR rather than a blank label a Polish reader meets at
 * runtime — the discipline `supportPl.ts` states and the shipped dictionary pairs
 * satisfy.
 *
 * ── TRANSLATION DECISIONS THAT ARE CORRECTNESS CLAIMS ─────────────────────
 *
 * `domainName` -> `Pomoc humanitarna`, taken from the SHIPPED Polish dictionary
 * (`topicLabels.humanitarian`, `navLabels.humanitarian`, `legendLabels.humanitarian`).
 * Reused, not re-minted: a second Polish name for the domain would be a second
 * domain to a reader.
 *
 * `PLATFORM_TRANSLATED` -> `Tłumaczenie maszynowe`. The fact that bears on how far
 * to trust the wording is that it was produced MECHANICALLY. Who ran the engine
 * does not, and naming a provider would read as an endorsement of the result —
 * which is also why no provider is named anywhere in this lane.
 *
 * `SOURCE_TRANSLATION` -> `Tłumaczenie źródła`, NOT `Tłumaczenie oficjalne`. The
 * contract forbids claiming an official translation; "oficjalne" asserts a status
 * the metadata does not carry even when the source did translate the document.
 *
 * `UNKNOWN` -> `Nie podano języka źródła`, NOT `Język nieznany`. "Unknown" reads
 * as the platform having tried to identify the language and failed. Nothing was
 * attempted, because nothing may be inferred. The SOURCE did not state it.
 *
 * `claimClass.FACT` -> `Zarejestrowane`, NOT `Fakt`. `Fakt` in Polish asserts
 * truth; the class means the record exists in retained reporting, which is a
 * weaker and more accurate claim — and the distinction the Humanitarian programme
 * exists to keep.
 *
 * `claimClass.UNKNOWN` -> `Nie wiadomo`, and `notAssessed` -> `Nie oceniono`. Two
 * different states and two different strings: the first is a gap in what a source
 * said, the second is that no admitted source looked. Neither may read as "nic się
 * nie stało", and `notAssessedDetail` says so outright.
 *
 * `map.hazardNotImpact` keeps the contrast in the same order as the English,
 * because the sentence's whole job is to stop a hazard outline being read as the
 * affected population.
 *
 * `askDisclosure.answerLanguageDiffers` names both languages. A Polish reader
 * meeting a Polish answer with no stated source language will assume a Polish
 * source — silence reads as agreement.
 */
export const humanitarianLanguagePl: HumanitarianLanguageStrings = {
  domainName: 'Pomoc humanitarna',

  translationState: {
    ORIGINAL: 'Oryginał',
    SOURCE_TRANSLATION: 'Tłumaczenie źródła',
    PLATFORM_TRANSLATED: 'Tłumaczenie maszynowe',
    UNTRANSLATED: 'Bez tłumaczenia',
    UNKNOWN: 'Nie podano języka źródła',
  },
  translationStateDetail: {
    ORIGINAL: 'To własny tekst źródła, w języku, w którym został opublikowany.',
    SOURCE_TRANSLATION: 'Źródło samo opublikowało to tłumaczenie.',
    PLATFORM_TRANSLATED:
      'To tłumaczenie maszynowe wykonane przez GlobalNews AI. Oryginalne brzmienie źródła zachowujemy i można je otworzyć.',
    UNTRANSLATED:
      'Dla tego tekstu nie ma tłumaczenia. Pokazujemy go w języku, w którym opublikowało go źródło.',
    UNKNOWN:
      'Źródło nie podało, w jakim języku jest ten tekst, więc niczego o nim nie twierdzimy — także tego, czy był tłumaczony.',
  },

  textUnavailable: {
    SOURCE_LANGUAGE_NOT_OBSERVED:
      'Źródło nie podało języka tego tekstu, dlatego nie możemy go bezpiecznie pokazać.',
    SOURCE_LANGUAGE_AMBIGUOUS:
      'Źródło wymienia dla tego rekordu kilka języków i nie wskazuje, w którym jest ten tekst.',
    NO_QUALIFIED_RENDERING:
      'Nie mamy jeszcze sprawdzonego sposobu pokazania tego tekstu w Twoim języku.',
    NOT_PUBLISHED_BY_SOURCE: 'Źródło nie opublikowało treści dla tego rekordu.',
  },
  textUnavailableHeading: 'Nie pokazujemy treści',
  metadataRetainedNote:
    'Wszystko pozostałe o tym rekordzie — kto opublikował, kiedy i czego dotyczy — jest bez zmian i widać to powyżej.',

  sourceLanguageClaim: {
    SINGLE: 'Opublikowano w języku: {language}',
    DESIGNATED: 'Opublikowano w języku: {language}; źródło wymienia także: {others}',
    MULTIPLE_UNDESIGNATED: 'Źródło wymienia: {languages} i nie wskazuje oryginału',
    NOT_OBSERVED: 'Źródło nie podało języka',
  },

  claimClass: {
    FACT: 'Zarejestrowane',
    SOURCE_ASSERTION: 'Podane przez źródło',
    ESTIMATE: 'Szacunek',
    INTERPRETATION: 'Interpretacja',
    UNKNOWN: 'Nie wiadomo',
  },

  title: {
    originalLabel: 'Tytuł w brzmieniu oryginalnym',
    translatedLabel: 'Tytuł w tłumaczeniu',
    showOriginal: 'Pokaż tytuł w brzmieniu oryginalnym',
    originalLanguageIs: 'Opublikowano w języku: {language}',
    languageNotStated: 'Źródło nie podało języka',
  },

  translationIsNotEvidence: 'Tłumaczenie nie niesie większej pewności niż oryginał.',

  humanitarianPage: {
    sourceLanguageRowLabel: 'Język źródła',
    reportLanguageRowLabel: 'Język raportu',
    notAssessed: 'Nie oceniono',
    notAssessedDetail:
      'Żadne dopuszczone źródło tego nie oceniło. To nie znaczy, że nic się nie stało.',
    retainedReportingHeading: 'Zachowane doniesienia',
    noRetainedReporting: 'Nie zachowaliśmy jeszcze żadnych doniesień na ten temat.',
    sourceUnavailable: 'Jedno ze źródeł nie odpowiedziało. To, co widzisz, może być niepełne.',
    coverageGap: 'Tego obszaru nie obejmuje żadne dopuszczone źródło.',
    partial: 'Część tego rekordu jest dostępna. Brakujące elementy są oznaczone.',
  },

  home: {
    cardTitle: 'Pomoc humanitarna',
    cardBlurb: 'Ludzie, potrzeby i reagowanie',
    noRetainedDataYet: 'Nie zachowaliśmy jeszcze żadnych doniesień humanitarnych.',
    sourceLanguagesSeen: 'Dotychczasowe źródła: {languages}',
  },

  map: {
    layerName: 'Pomoc humanitarna',
    geometryFromSource: 'Kształt w postaci podanej przez źródło',
    countryLevelOnly: 'Źródło ustala to wyłącznie na poziomie kraju.',
    hazardNotImpact: 'Ten kształt to zagrożenie, a nie osoby dotknięte.',
    precisionUnknown: 'Źródło nie podało, jak dokładnie jest to zlokalizowane.',
    reportLanguageOnMarker: 'Język raportu: {language}',
  },

  myIntelligence: {
    savedSectionTitle: 'Zapisane wyniki humanitarne',
    reopenedAsStored: 'Otwarte w zapisanej postaci. Nic nie zostało uruchomione ponownie.',
    storedAnswerLanguage: 'Ten wynik napisano w języku: {language}.',
    storedSourceLanguageDiffers:
      'Cytuje źródła opublikowane w: {sourceLanguages}, i nie zastąpił ich tłumaczeniem.',
  },

  admin: {
    sectionTitle: 'Metadane językowe — pomoc humanitarna',
    languageMetadataCoverage: 'Rekordy z podanym językiem źródła: {withLanguage} z {total}',
    recordsWithNoDeclaredLanguage: 'Bez podanego języka: {count}',
    recordsWithAmbiguousLanguage: 'Kilka języków, żaden nie wskazany: {count}',
    bodiesWithheldForLanguage: 'Treści wstrzymane, bo nie dało się zakwalifikować języka: {count}',
    reliefwebAppnameRequired:
      'RELIEFWEB_APPNAME_REQUIRED — pozyskiwanie pozostaje wyłączone do czasu zatwierdzenia nazwy.',
    acquisitionDisabled: 'Pozyskiwanie danych z tego źródła jest wyłączone.',
    noLanguageInference:
      'Rekord bez podanego języka liczymy, a nie zgadujemy na podstawie kraju.',
  },

  askDisclosure: {
    publishedByLabel: 'Opublikowane przez: {publisher}',
    sourceLanguageLabel: 'Język źródła: {language}',
    answerLanguageDiffers:
      'Ta odpowiedź jest w języku {answerLanguage}. Cytowane źródło opublikowano w języku {sourceLanguage}.',
    titleShownAsPublished: 'Tytuł źródła pokazujemy w brzmieniu oryginalnym.',
    answerUsesTranslatedReporting:
      'Ta odpowiedź opiera się na doniesieniach przetłumaczonych maszynowo. Oryginały są podlinkowane.',
    someSourcesWithheldForLanguage:
      'Pominęliśmy {count} zachowanych rekordów, bo nie dało się zakwalifikować ich języka.',
  },
};

import type { HumanitarianLanguageStrings } from './humanitarianEn';

/**
 * PROPOSED  frontend/src/lib/i18n/dictionaries/humanitarianPl.ts
 * HUMANITARIAN LANGUAGE QUALIFICATION R1 · contract and copy · not merged.
 *
 * Typed as `HumanitarianLanguageStrings`, so a key added in English and forgotten
 * here is a compile error rather than a blank label a Polish reader meets.
 *
 * ── TRANSLATION DECISIONS THAT ARE CORRECTNESS CLAIMS ─────────────────────
 *
 * `domainName` -> `Pomoc humanitarna`, taken from the SHIPPED `pl.ts`
 * (`topicLabels.humanitarian`, `navLabels.humanitarian`, `legendLabels.humanitarian`).
 * Reused rather than re-minted: the domain already has a Polish name and a second
 * one would be a second domain to a reader.
 *
 * `PLATFORM_TRANSLATED` -> `Tłumaczenie maszynowe`, NOT `Tłumaczenie GlobalNews AI`.
 * A Polish reader needs to know the translation was produced mechanically, which
 * is the fact that bears on how far to trust the wording; who ran the engine does
 * not, and naming the platform would read as an endorsement of the result.
 *
 * `SOURCE_TRANSLATION` -> `Tłumaczenie źródła` — the source's own translation. NOT
 * `Tłumaczenie oficjalne`: the contract forbids claiming an official translation
 * unless the source supplied one, and "official" would assert a status that the
 * metadata does not carry even when the source did translate it.
 *
 * `UNKNOWN` -> `Nie podano języka źródła` — the SOURCE did not state it. NOT
 * `Język nieznany`, which reads as the platform failing to identify the language
 * and invites a reader to think detection was attempted and failed. Nothing was
 * detected, because nothing may be inferred.
 *
 * `UNTRANSLATED` -> `Bez tłumaczenia`, and the detail sentence says the text is
 * shown in the language the source published. `Nieprzetłumaczone` alone would read
 * as an omission on our side rather than as a stated state.
 *
 * `textUnavailableHeading` -> `Nie pokazujemy treści` — we are not showing it, and
 * we say so in the first person. `Treść niedostępna` would read as the source
 * having nothing, which is a different state (`NOT_PUBLISHED_BY_SOURCE`) with its
 * own string.
 */
export const humanitarianPl: HumanitarianLanguageStrings = {
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

  title: {
    originalLabel: 'Tytuł w brzmieniu oryginalnym',
    translatedLabel: 'Tytuł w tłumaczeniu',
    showOriginal: 'Pokaż tytuł w brzmieniu oryginalnym',
    originalLanguageIs: 'Opublikowano w języku: {language}',
    languageNotStated: 'Źródło nie podało języka',
  },

  citation: {
    publishedByLabel: 'Opublikowane przez: {publisher}',
    sourceLanguageLabel: 'Język źródła: {language}',
    answerLanguageDiffers:
      'Ta odpowiedź jest w języku {answerLanguage}. Cytowane źródło opublikowano w języku {sourceLanguage}.',
    titleShownAsPublished: 'Tytuł źródła pokazujemy w brzmieniu oryginalnym.',
  },

  translationIsNotEvidence: 'Tłumaczenie nie niesie większej pewności niż oryginał.',

  vocabulary: {
    observationKind: {
      HUMANITARIAN_EVENT: 'Zdarzenie',
      HUMANITARIAN_REPORT: 'Raport',
      HUMANITARIAN_IMPACT_ASSERTION: 'Dane o skutkach, według źródła',
    },
    hazardType: {
      EARTHQUAKE: 'Trzęsienie ziemi',
      TROPICAL_CYCLONE: 'Cyklon tropikalny',
      FLOOD: 'Powódź',
      DROUGHT: 'Susza',
      WILDFIRE: 'Pożar roślinności',
      VOLCANIC_ACTIVITY: 'Aktywność wulkaniczna',
      ARMED_CONFLICT_DISPLACEMENT: 'Przesiedlenia w wyniku konfliktu zbrojnego',
      EPIDEMIC: 'Epidemia',
    },
    eventStatus: {
      ONGOING: 'Trwające',
      CLOSED: 'Zakończone',
      NOT_STATED: 'Źródło nie podało statusu',
    },
    impactMeasure: {
      PEOPLE_AFFECTED: 'Osoby dotknięte skutkami',
      PEOPLE_DISPLACED: 'Osoby przesiedlone',
      FATALITIES: 'Ofiary śmiertelne',
      INJURED: 'Ranni',
      PEOPLE_IN_NEED: 'Osoby potrzebujące pomocy',
      HOUSES_DAMAGED: 'Domy uszkodzone',
      HOUSES_DESTROYED: 'Domy zniszczone',
    },
    statusMeasure: {
      SHELTER_STATUS: 'Schronienie',
      HEALTH_STATUS: 'Zdrowie',
      FOOD_SECURITY_STATUS: 'Bezpieczeństwo żywnościowe',
      WATER_STATUS: 'Woda',
      HUMANITARIAN_ACCESS_STATUS: 'Dostęp humanitarny',
    },
    impactBasis: {
      SOURCE_STATED: 'Podane przez źródło',
      SOURCE_ESTIMATED: 'Szacunek źródła',
    },
  },
};

import { DISPLAY_LOCALES, type DisplayLocale } from '@globalnews-ai/shared';
import { askShellStrings } from './shell/askShellCatalogue';
import { ASK_AUTHORED_COPY_LOCALES, type AuthoredCopyLocale } from './askLocale';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK SEVEN-LOCALE COPY — A BOUNDED CATALOGUE, COMPLETE IN ALL SEVEN
 * ════════════════════════════════════════════════════════════════════════════
 *
 * R4 · CLAUDE H.
 *
 * ── WHY A BOUNDED CATALOGUE AND NOT SEVEN COPIES OF `AskR2Strings` ────────
 *
 * `askR2Strings.ts` is 796 lines of EN and PL with nested records and function-valued
 * members, transcribed verbatim from a frozen design authority (`14_COPY_EN_PL.md`).
 * Authoring five more of it is a translation programme, not a frontend round, and a
 * machine-shaped approximation of it would be worse than nothing: a reader would see
 * confident Arabic chrome around evidence vocabulary nobody had reviewed.
 *
 * So this catalogue covers EXACTLY the scope this contract names — composer hint,
 * clarification, error and empty states, `INTERPRETATION_UNRESOLVED`, reasoning labels,
 * evidence and source labels — and covers it COMPLETELY in all seven. Every member is
 * required by the type: `Record<DisplayLocale, …>` is total, so a missing locale is a
 * compile error rather than a silent English substitution at runtime.
 *
 * ── EN AND PL ARE RE-EXPORTED, NEVER RE-AUTHORED ──────────────────────────
 *
 * Where a key already exists in the frozen EN/PL authority, this file READS it from
 * `askR2Strings` rather than copying the text. A second copy of `'CLARIFICATION REQUIRED'`
 * would agree with the first only by discipline, and the next correction would land in one
 * of them. `askSevenStrings('en')` is therefore the frozen English by construction, which
 * is how "preserve English and Polish exactly" is enforced rather than promised.
 *
 * Keys that did NOT exist — `interpretationUnresolved`, the composer hint, the
 * answer-language disclosure — are authored here for all seven, English included.
 *
 * ── WHAT IS OUTSIDE THIS CATALOGUE, AND HOW THAT IS DISCLOSED ─────────────
 *
 * Everything else in `AskR2Strings` remains EN/PL. A surface rendering those keys for a
 * French reader is showing English, and `askCopyCoverage` reports that as data so the
 * surface can say so. An undisclosed fallback is the defect; a disclosed one is a state.
 */

/** The copy this catalogue is contracted to carry. Nested exactly as deeply as needed. */
export interface AskSevenStrings {
  /** The composer's own hint. Never a question, so it cannot read as a suggested prompt. */
  readonly composerHint: string;
  /** Asked when the question admits more than one subject. */
  readonly clarificationNeeded: string;
  readonly clarificationWhichOne: string;
  /** Nothing was asked yet. An empty surface is a state, not an error. */
  readonly emptyNothingAsked: string;
  /** Asked, and the engine presented nothing as fact. */
  readonly emptyNoAnswer: string;
  /** The request failed. Never blames the reader and never guesses a cause. */
  readonly errorRequestFailed: string;
  readonly errorRetry: string;
  /**
   * The interpretation could not be resolved to one subject, one scope or one job.
   *
   * NAMED BY THE CONTRACT AND NEW IN ALL SEVEN. It is distinct from a clarification: a
   * clarification asks the reader to choose, this one states that the question as written
   * does not resolve. Showing the clarification copy for it would promise a choice the
   * surface cannot offer.
   */
  readonly interpretationUnresolved: string;
  /** The nine reasoning labels, keyed as the frozen authority keys them. */
  readonly reasoning: Readonly<
    Record<'ref' | 'ver' | 'cur' | 'clar' | 'part' | 'insuf' | 'unavail' | 'rec' | 'calc', string>
  >;
  /** Evidence and source vocabulary. */
  readonly evidence: {
    readonly sources: string;
    readonly answer: string;
    readonly scope: string;
    readonly noScope: string;
    readonly noCitableSources: string;
    /** A chip's accessible name prefix, so a URL is never the only label. */
    readonly sourceChipLabel: string;
  };
  /*
    THE ANSWER-LANGUAGE DISCLOSURE IS GONE (PO ruling).

    It carried three strings in seven languages: "answers come back in English", "…in
    Polish", and "answers come back in this language". The first two were measured against
    this lane's own stale base and are FALSE on the current backend, which answers in the
    reader's selected language. A false statement in a reader's own language is worse than no
    statement, so the keys are removed rather than left unrendered where a later surface
    could pick them up. The remaining true one said nothing a reader needed.
  */
  /**
   * CENTERED COMPOSER R1 — the accessible name of the rotating example's own control.
   *
   * The example is a SUGGESTION, not a changing value, so it needs a name that says what
   * activating it does. Without one, a screen reader would announce only the question text
   * and a reader could not tell a suggestion from something already typed.
   */
  readonly exampleUse: string;
}

type AuthoredSubset = Omit<
  AskSevenStrings,
  'reasoning' | 'evidence' | 'composerHint' | 'emptyNoAnswer' | 'clarificationWhichOne'
> & {
  readonly evidence: Pick<AskSevenStrings['evidence'], 'sourceChipLabel'>;
};

/**
 * The AUTHORED half: keys with no counterpart in the frozen EN/PL authority.
 *
 * Arabic is authored in Modern Standard Arabic and avoids regional forms, matching the
 * single `ar` formatting profile the shared contract decided on.
 */
const AUTHORED: Readonly<Record<DisplayLocale, AuthoredSubset>> = {
  en: {
    clarificationNeeded: 'More than one subject matches. Choose one to continue.',
    emptyNothingAsked: 'Nothing has been asked yet',
    errorRequestFailed: 'The request did not complete',
    errorRetry: 'Try again',
    interpretationUnresolved: 'The question could not be resolved to one subject · nothing was run',
    evidence: { sourceChipLabel: 'Source' },
    exampleUse: 'Use this example question',
  },
  pl: {
    clarificationNeeded: 'Pasuje więcej niż jeden temat. Wybierz jeden, aby kontynuować.',
    emptyNothingAsked: 'Jeszcze o nic nie zapytano',
    errorRequestFailed: 'Żądanie nie zostało zakończone',
    errorRetry: 'Spróbuj ponownie',
    interpretationUnresolved: 'Nie udało się ustalić jednego tematu pytania · nic nie uruchomiono',
    evidence: { sourceChipLabel: 'Źródło' },
    exampleUse: 'Użyj tego przykładowego pytania',
  },
  fr: {
    clarificationNeeded: 'Plusieurs sujets correspondent. Choisissez-en un pour continuer.',
    emptyNothingAsked: 'Aucune question n’a encore été posée',
    errorRequestFailed: 'La requête ne s’est pas terminée',
    errorRetry: 'Réessayer',
    interpretationUnresolved:
      'La question n’a pu être ramenée à un seul sujet · rien n’a été exécuté',
    evidence: { sourceChipLabel: 'Source' },
    exampleUse: 'Utiliser cet exemple de question',
  },
  de: {
    clarificationNeeded: 'Mehr als ein Thema passt. Wählen Sie eines aus, um fortzufahren.',
    emptyNothingAsked: 'Es wurde noch nichts gefragt',
    errorRequestFailed: 'Die Anfrage wurde nicht abgeschlossen',
    errorRetry: 'Erneut versuchen',
    interpretationUnresolved:
      'Die Frage ließ sich nicht auf ein einzelnes Thema zurückführen · es wurde nichts ausgeführt',
    evidence: { sourceChipLabel: 'Quelle' },
    exampleUse: 'Diese Beispielfrage übernehmen',
  },
  es: {
    clarificationNeeded: 'Coincide más de un tema. Elige uno para continuar.',
    emptyNothingAsked: 'Aún no se ha preguntado nada',
    errorRequestFailed: 'La solicitud no se completó',
    errorRetry: 'Inténtalo de nuevo',
    interpretationUnresolved: 'La pregunta no pudo reducirse a un solo tema · no se ejecutó nada',
    evidence: { sourceChipLabel: 'Fuente' },
    exampleUse: 'Usar esta pregunta de ejemplo',
  },
  pt: {
    clarificationNeeded: 'Corresponde mais do que um assunto. Escolha um para continuar.',
    emptyNothingAsked: 'Ainda não foi feita nenhuma pergunta',
    errorRequestFailed: 'O pedido não foi concluído',
    errorRetry: 'Tentar novamente',
    interpretationUnresolved:
      'Não foi possível reduzir a pergunta a um único assunto · nada foi executado',
    evidence: { sourceChipLabel: 'Fonte' },
    exampleUse: 'Usar esta pergunta de exemplo',
  },
  ar: {
    clarificationNeeded: 'يوجد أكثر من موضوع مطابق. اختر واحدًا للمتابعة.',
    emptyNothingAsked: 'لم يُطرح أي سؤال بعد',
    errorRequestFailed: 'لم يكتمل الطلب',
    errorRetry: 'حاول مرة أخرى',
    interpretationUnresolved: 'لم يتسنَّ حصر السؤال في موضوع واحد · لم يُنفَّذ أي شيء',
    evidence: { sourceChipLabel: 'المصدر' },
    exampleUse: 'استخدم هذا السؤال كمثال',
  },
};

/**
 * THE ONE ACCESSOR. Total over `DisplayLocale`, so there is no fallback branch and no
 * locale that silently resolves to English.
 */
export function askSevenStrings(locale: DisplayLocale): AskSevenStrings {
  const authored = AUTHORED[locale];
  /*
    R4 · CTO "NO TWO TRANSLATION AUTHORITIES" (integration of H 266007c). Every key that exists
    in the Ask shell is READ from the one merged shell for this locale — the frozen EN/PL
    catalogues, or the English source with Claude L's qualified overlay merged over it — never
    from a second, separately authored copy. Until this, FR / DE / ES / PT / AR kept their own
    table of these values and had already drifted from L's wording (the French composer hint,
    the pt-BR "você" form, four "no answer" lines). EN and PL resolve exactly as before.
    Only the keys with no shell counterpart remain authored in AUTHORED above.
  */
  const shell = askShellStrings(locale);
  const frozen = shell.askR2Strings;
  return {
    ...authored,
    composerHint: shell.dict.askAi.inputPlaceholder,
    emptyNoAnswer: frozen.noAnswer,
    clarificationWhichOne: frozen.whichOne,
    reasoning: frozen.badges,
    evidence: {
      sources: frozen.sources,
      answer: frozen.answer,
      scope: frozen.scope,
      noScope: frozen.noScope,
      noCitableSources: frozen.noCitable,
      sourceChipLabel: authored.evidence.sourceChipLabel,
    },
  };
}

/**
 * What a reader actually gets, as data rather than as a promise.
 *
 * `boundedCopy` is always true: this catalogue is complete in all seven. `fullAskCopy` is
 * true only for the locales whose whole `AskR2Strings` catalogue exists, so a surface
 * rendering outside the bounded set can disclose that the rest of the chrome is English.
 */
export interface AskCopyCoverage {
  readonly locale: DisplayLocale;
  readonly boundedCopy: true;
  readonly fullAskCopy: boolean;
  /** The frozen copy catalogue this locale borrows. A TRANSLATION fact, not an answer fact. */
  readonly catalogueLocale: AuthoredCopyLocale;
}

export function askCopyCoverage(locale: DisplayLocale): AskCopyCoverage {
  const hasOwnCatalogue = (ASK_AUTHORED_COPY_LOCALES as readonly string[]).includes(locale);
  return {
    locale,
    boundedCopy: true,
    fullAskCopy: hasOwnCatalogue,
    catalogueLocale: hasOwnCatalogue ? (locale as AuthoredCopyLocale) : 'en',
  };
}

/** The locales this catalogue covers. Exported so a suite asserts totality, not a sample. */
export const ASK_SEVEN_LOCALES: readonly DisplayLocale[] = DISPLAY_LOCALES;

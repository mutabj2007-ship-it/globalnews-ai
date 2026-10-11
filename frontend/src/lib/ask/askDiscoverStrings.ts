import type { DisplayLocale } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R3 IA + GUIDED DISCOVER R2 — the approved copy deck
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Verbatim from Claude Design `GLOBALNEWSAI-R3-IA-DISCOVER-FINAL-R2.zip`
 * (SHA-256 574fc35b…55e32be8, verified here), `07-COPY-DECK-7-LOCALES.csv`. Approved by the
 * Product Owner through the Master CTO, 11 Oct 2026.
 *
 * LANGUAGE QUALIFICATION — the deck itself states it: **EN is the source and is qualified; PL,
 * FR, DE, ES, PT and AR are Claude Design DRAFTS, pending Localisation (Claude L) qualification.**
 * They ship because a drafted string beats an English fallback in a non-English interface, and
 * they are recorded as a dependency in the handoff rather than presented as qualified.
 *
 * `draftRegion` and `draftStory` are composer DRAFTS, never questions: staging sets the composer
 * value and focuses it, and nothing is ever submitted (handoff §4).
 */
export interface AskDiscoverStrings {
  readonly cuesLabel: string;
  readonly cueRegion: string;
  readonly cueStory: string;
  readonly cueJobs: string;
  readonly draftRegion: string;
  readonly hintRegion: string;
  readonly draftStory: string;
  readonly hintStory: string;
  readonly continueH: string;
  readonly allConvs: string;
}

const CATALOGUE: Record<DisplayLocale, AskDiscoverStrings> = {
  en: {
    cuesLabel: 'Ways to start',
    cueRegion: 'What changed in my region?',
    cueStory: 'Explain a story',
    cueJobs: 'Find job opportunities',
    draftRegion: 'What changed this week in ',
    hintRegion: 'Add a city or country, then send. Nothing is searched until you send.',
    draftStory: 'Explain this story: ',
    hintStory: 'Paste a link or describe the story, then send.',
    continueH: 'Continue',
    allConvs: 'All conversations',
  },
  pl: {
    cuesLabel: 'Jak zacząć',
    cueRegion: 'Co się zmieniło w moim regionie?',
    cueStory: 'Wyjaśnij artykuł',
    cueJobs: 'Znajdź oferty pracy',
    draftRegion: 'Co zmieniło się w tym tygodniu w ',
    hintRegion: 'Dodaj miasto lub kraj i wyślij. Nic nie jest wyszukiwane przed wysłaniem.',
    draftStory: 'Wyjaśnij ten artykuł: ',
    hintStory: 'Wklej link lub opisz artykuł i wyślij.',
    continueH: 'Kontynuuj',
    allConvs: 'Wszystkie rozmowy',
  },
  fr: {
    cuesLabel: 'Pour commencer',
    cueRegion: 'Qu’est-ce qui a changé dans ma région ?',
    cueStory: 'Expliquer un article',
    cueJobs: 'Trouver des offres d’emploi',
    draftRegion: 'Qu’est-ce qui a changé cette semaine à ',
    hintRegion: 'Ajoutez une ville ou un pays, puis envoyez. Rien n’est recherché avant l’envoi.',
    draftStory: 'Explique cet article : ',
    hintStory: 'Collez un lien ou décrivez l’article, puis envoyez.',
    continueH: 'Continuer',
    allConvs: 'Toutes les conversations',
  },
  de: {
    cuesLabel: 'So können Sie beginnen',
    cueRegion: 'Was hat sich in meiner Region geändert?',
    cueStory: 'Eine Meldung erklären',
    cueJobs: 'Stellenangebote finden',
    draftRegion: 'Was hat sich diese Woche geändert in ',
    hintRegion: 'Fügen Sie eine Stadt oder ein Land hinzu und senden Sie.',
    draftStory: 'Erkläre diese Meldung: ',
    hintStory: 'Fügen Sie einen Link ein oder beschreiben Sie die Meldung.',
    continueH: 'Fortsetzen',
    allConvs: 'Alle Unterhaltungen',
  },
  es: {
    cuesLabel: 'Formas de empezar',
    cueRegion: '¿Qué ha cambiado en mi región?',
    cueStory: 'Explicar una noticia',
    cueJobs: 'Buscar ofertas de empleo',
    draftRegion: '¿Qué ha cambiado esta semana en ',
    hintRegion: 'Añade una ciudad o un país y envía. No se busca nada hasta que envíes.',
    draftStory: 'Explica esta noticia: ',
    hintStory: 'Pega un enlace o describe la noticia y envía.',
    continueH: 'Continuar',
    allConvs: 'Todas las conversaciones',
  },
  pt: {
    cuesLabel: 'Formas de começar',
    cueRegion: 'O que mudou na minha região?',
    cueStory: 'Explicar uma notícia',
    cueJobs: 'Encontrar vagas de emprego',
    draftRegion: 'O que mudou esta semana em ',
    hintRegion: 'Adicione uma cidade ou um país e envie. Nada é pesquisado antes do envio.',
    draftStory: 'Explique esta notícia: ',
    hintStory: 'Cole um link ou descreva a notícia e envie.',
    continueH: 'Continuar',
    allConvs: 'Todas as conversas',
  },
  ar: {
    cuesLabel: 'طرق للبدء',
    cueRegion: 'ما الذي تغيّر في منطقتي؟',
    cueStory: 'اشرح خبرًا',
    cueJobs: 'ابحث عن فرص عمل',
    draftRegion: 'ما الذي تغيّر هذا الأسبوع في ',
    hintRegion: 'أضف مدينة أو بلدًا ثم أرسل. لا يبدأ أي بحث قبل الإرسال.',
    draftStory: 'اشرح هذا الخبر: ',
    hintStory: 'الصق رابطًا أو صِف الخبر ثم أرسل.',
    continueH: 'تابِع',
    allConvs: 'كل المحادثات',
  },
};

/** EN is qualified; the other six are Design drafts awaiting Claude L (see the docblock). */
export const ASK_DISCOVER_QUALIFIED_LOCALES: readonly DisplayLocale[] = ['en'];

export function askDiscoverStrings(locale: DisplayLocale): AskDiscoverStrings {
  return CATALOGUE[locale] ?? CATALOGUE.en;
}

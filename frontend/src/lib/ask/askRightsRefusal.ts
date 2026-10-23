import type { DisplayLocale } from '@globalnews-ai/shared';

/*
  CTO R115 / Politics R115 live control (G-1) — when EVERY reporting lane was refused for source-use
  rights before any network call, the reader is told that, in these words, everywhere the old outage
  copy appeared ("Some source channels were unavailable", "Live data unavailable", "Live reporting is
  temporarily unavailable. Please try again in a moment."). Waiting cannot fix a rights restriction,
  so no "try again" advice. No source, publisher or count is named (W-2 / S-3 / C-1).
  EN is the CTO's wording; PL / FR / DE / ES / PT / AR are qualified by Claude L (L_R115_CHANGES: fr
  "sources d’actualité", es "fuentes de noticias"; the other ten values approved as drafted).
*/
export interface AskRightsRefusalStrings {
  /** the one sentence, in place of the outage sentence */
  readonly notSearched: string;
  /** the short status chip, in place of "Live data unavailable" */
  readonly chip: string;
}

const STRINGS: Record<DisplayLocale, AskRightsRefusalStrings> = {
  en: {
    notSearched: 'Reporting sources are not cleared for use in this search, so I cannot verify the latest developments.',
    chip: 'Not searched: sources not cleared',
  },
  pl: {
    notSearched: 'Źródła doniesień nie są dopuszczone do użycia w tym wyszukiwaniu, więc nie mogę zweryfikować najnowszych wydarzeń.',
    chip: 'Nie przeszukano: źródła niedopuszczone',
  },
  fr: {
    notSearched: 'Les sources d’actualité ne sont pas autorisées pour cette recherche, je ne peux donc pas vérifier les derniers développements.',
    chip: 'Non consulté : sources non autorisées',
  },
  de: {
    notSearched: 'Die Nachrichtenquellen sind für diese Suche nicht freigegeben, daher kann ich die neuesten Entwicklungen nicht überprüfen.',
    chip: 'Nicht durchsucht: Quellen nicht freigegeben',
  },
  es: {
    notSearched: 'Las fuentes de noticias no están autorizadas para esta búsqueda, así que no puedo verificar los últimos acontecimientos.',
    chip: 'No consultado: fuentes no autorizadas',
  },
  pt: {
    notSearched: 'As fontes de notícias não estão autorizadas para esta pesquisa, por isso não posso verificar os acontecimentos mais recentes.',
    chip: 'Não consultado: fontes não autorizadas',
  },
  ar: {
    notSearched: 'مصادر الأخبار غير مُجازة للاستخدام في هذا البحث، لذلك لا يمكنني التحقق من آخر التطورات.',
    chip: 'لم يُبحث: المصادر غير مُجازة',
  },
};

export function askRightsRefusalStrings(locale: DisplayLocale | string | undefined): AskRightsRefusalStrings {
  return (locale !== undefined && (STRINGS as Record<string, AskRightsRefusalStrings>)[locale]) || STRINGS.en;
}

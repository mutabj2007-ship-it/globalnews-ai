import type { DisplayLocale } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK DICTIONARY ADDITIONS — Ask-reachable keys OUTSIDE the 535-key shell overlay
 * ════════════════════════════════════════════════════════════════════════════
 *
 * R4 · CTO "COMPLETE R4 LOCALIZATION CONVERGENCE" §6. Fixing the real render path exposed
 * Ask-reachable dictionary keys that were never part of Claude L's 535-key qualification. No
 * value here is authored by this lane. Each entry is one of:
 *
 *   C55_REUSE   Claude L's own approved wording from the L-LANG-CATALOG-1 (C55) catalogue
 *               (lib/i18n/recovered/c55-<locale>.ts), copied verbatim, ONLY where today's English
 *               source is byte-identical to the English that wording translated (C55 snapshot
 *               3db5a09). Verified by askDictionaryAdditions.spec.ts.
 *   L_RETURNED  a key sent to Claude L in the additive manifest and returned qualified.
 *
 * A key in neither state is absent here, renders English, and fails the rendered-surface
 * acceptance test until L returns it — the candidate stays local meanwhile.
 */
export type DictionaryAdditions = { readonly [key: string]: unknown };

/**
 * C55_REUSE — the English each reused value translated, as it stood in the C55 snapshot
 * (3db5a09), byte-identical to today's English. askDictionaryAdditions.spec.ts fails the moment
 * today's English for any of these keys changes: the value must then go back to L.
 *
 * NOT reused although C55 holds it: `formatRelativeTime.*`. Its renderer composes
 * `${n} ${minAgo}` in ENGLISH word order, which L's words cannot fix ("5 il y a", "2 Tage vor").
 * The Ask path formats relative time through CLDR (Intl.RelativeTimeFormat) instead — a data
 * formatter, not authored wording (lib/ask/askRelativeTime.ts).
 */
export const C55_REUSE_ENGLISH: Readonly<Record<string, string>> = {
  'analysisFrame.relationalAnswer': 'RELATIONAL ANSWER',
  'analysisModeBadge.analysisRejected': 'AI ANALYSIS REJECTED · Failed validation',
  'analysisModeBadge.cached': 'Cached',
  'analysisModeBadge.demoAiAnalysis': 'DEMO AI ANALYSIS',
  'analysisModeBadge.failed': 'AI ANALYSIS FAILED',
  'analysisModeBadge.liveAiAnalysis': 'LIVE AI ANALYSIS · Powered by OpenAI',
  'analysisModeBadge.notAttempted': 'AI ANALYSIS NOT ATTEMPTED',
  'analysisModeBadge.unavailable': 'AI UNAVAILABLE',
  'retrievalContextStatus.demoReporting': 'Demo reporting',
  'retrievalContextStatus.interpretedAs': 'Interpreted',
  'retrievalContextStatus.interpretedAsMiddle': 'as',
  'retrievalContextStatus.liveDataUnavailable': 'Live data unavailable',
  'retrievalContextStatus.liveNoResultsStoredUsed':
    'The live provider returned no usable results, so stored reporting was used.',
  'retrievalContextStatus.liveNothingNoStored':
    'Live retrieval found nothing usable, and no stored reporting was available for this question.',
  'retrievalContextStatus.liveReporting': 'Live reporting',
  'retrievalContextStatus.liveUnavailableStoredUsed':
    'Live reporting was unavailable, so this analysis uses stored reporting.',
  'retrievalContextStatus.liveUnreachableNoStored':
    'The live news provider could not be reached, and no stored reporting was available for this question.',
  'retrievalContextStatus.newestStoredArticle': 'Newest stored article:',
  'retrievalContextStatus.storedReporting': 'Stored reporting',
};

export const ASK_DICTIONARY_ADDITIONS: Readonly<
  Record<Exclude<DisplayLocale, 'en' | 'pl'>, DictionaryAdditions>
> = {
  /* C55_REUSE — verbatim from lib/i18n/recovered/c55-fr.ts */
  fr: {
    analysisModeBadge: {
      liveAiAnalysis: 'ANALYSE PAR IA EN DIRECT · Propulsée par OpenAI',
      demoAiAnalysis: 'ANALYSE PAR IA DE DÉMONSTRATION',
      analysisRejected: 'ANALYSE PAR IA REJETÉE · Validation échouée',
      notAttempted: 'ANALYSE PAR IA NON TENTÉE',
      unavailable: 'IA INDISPONIBLE',
      failed: 'ANALYSE PAR IA ÉCHOUÉE',
      cached: 'En cache',
    },
    retrievalContextStatus: {
      liveReporting: 'Dépêches en direct',
      liveDataUnavailable: 'Données en direct indisponibles',
      storedReporting: 'Dépêches stockées',
      demoReporting: 'Reportage de démonstration',
      liveUnavailableStoredUsed:
        "Les dépêches en direct étaient indisponibles : cette analyse s'appuie donc sur des dépêches stockées.",
      liveNoResultsStoredUsed:
        "Le fournisseur en direct n'a renvoyé aucun résultat exploitable : les dépêches stockées ont donc été utilisées.",
      liveUnreachableNoStored:
        "Le fournisseur d'actualités en direct n'a pas pu être joint, et aucune dépêche stockée n'était disponible pour cette question.",
      liveNothingNoStored:
        "La récupération en direct n'a rien trouvé d'exploitable, et aucune dépêche stockée n'était disponible pour cette question.",
      newestStoredArticle: 'Article stocké le plus récent :',
      interpretedAs: 'Interprété',
      interpretedAsMiddle: 'comme',
    },
    analysisFrame: {
      relationalAnswer: 'RÉPONSE RELATIONNELLE',
    },
  },
  /* C55_REUSE — verbatim from lib/i18n/recovered/c55-de.ts */
  de: {
    analysisModeBadge: {
      liveAiAnalysis: 'KI-ANALYSE LIVE · Ermöglicht durch OpenAI',
      demoAiAnalysis: 'KI-ANALYSE (DEMO)',
      analysisRejected: 'KI-ANALYSE ABGELEHNT · Validierung fehlgeschlagen',
      notAttempted: 'KI-ANALYSE NICHT VERSUCHT',
      unavailable: 'KI NICHT VERFÜGBAR',
      failed: 'KI-ANALYSE FEHLGESCHLAGEN',
      cached: 'Zwischengespeichert',
    },
    retrievalContextStatus: {
      liveReporting: 'Live-Berichterstattung',
      liveDataUnavailable: 'Live-Daten nicht verfügbar',
      storedReporting: 'Gespeicherte Berichterstattung',
      demoReporting: 'Demo-Berichterstattung',
      liveUnavailableStoredUsed:
        'Live-Berichterstattung war nicht verfügbar, daher verwendet diese Analyse gespeicherte Berichterstattung.',
      liveNoResultsStoredUsed:
        'Der Live-Anbieter lieferte keine verwertbaren Ergebnisse, daher wurde gespeicherte Berichterstattung verwendet.',
      liveUnreachableNoStored:
        'Der Live-Nachrichtenanbieter war nicht erreichbar, und für diese Frage war keine gespeicherte Berichterstattung verfügbar.',
      liveNothingNoStored:
        'Der Live-Abruf fand nichts Verwertbares, und für diese Frage war keine gespeicherte Berichterstattung verfügbar.',
      newestStoredArticle: 'Neuester gespeicherter Artikel:',
      interpretedAs: 'Interpretiert',
      interpretedAsMiddle: 'als',
    },
    analysisFrame: {
      relationalAnswer: 'RELATIONALE ANTWORT',
    },
  },
  /* C55_REUSE — verbatim from lib/i18n/recovered/c55-es.ts */
  es: {
    analysisModeBadge: {
      liveAiAnalysis: 'ANÁLISIS POR IA EN DIRECTO · Con la tecnología de OpenAI',
      demoAiAnalysis: 'ANÁLISIS POR IA DE DEMOSTRACIÓN',
      analysisRejected: 'ANÁLISIS POR IA RECHAZADO · Validación fallida',
      notAttempted: 'ANÁLISIS POR IA NO INTENTADO',
      unavailable: 'IA NO DISPONIBLE',
      failed: 'ANÁLISIS POR IA FALLIDO',
      cached: 'En caché',
    },
    retrievalContextStatus: {
      liveReporting: 'Información en directo',
      liveDataUnavailable: 'Datos en directo no disponibles',
      storedReporting: 'Información almacenada',
      demoReporting: 'Información de demostración',
      liveUnavailableStoredUsed:
        'La información en directo no estaba disponible, así que este análisis usa información almacenada.',
      liveNoResultsStoredUsed:
        'El proveedor en directo no devolvió resultados utilizables, por lo que se usó la información almacenada.',
      liveUnreachableNoStored:
        'No se ha podido contactar con el proveedor de noticias en directo y no había información almacenada disponible para esta pregunta.',
      liveNothingNoStored:
        'La recuperación en directo no encontró nada utilizable y no había información almacenada disponible para esta pregunta.',
      newestStoredArticle: 'Artículo almacenado más reciente:',
      interpretedAs: 'Interpretado',
      interpretedAsMiddle: 'como',
    },
    analysisFrame: {
      relationalAnswer: 'RESPUESTA RELACIONAL',
    },
  },
  /* C55_REUSE — verbatim from lib/i18n/recovered/c55-pt.ts */
  pt: {
    analysisModeBadge: {
      liveAiAnalysis: 'ANÁLISE POR IA AO VIVO · Com tecnologia da OpenAI',
      demoAiAnalysis: 'ANÁLISE POR IA DE DEMONSTRAÇÃO',
      analysisRejected: 'ANÁLISE POR IA REJEITADA · Validação falhou',
      notAttempted: 'ANÁLISE POR IA NÃO TENTADA',
      unavailable: 'IA INDISPONÍVEL',
      failed: 'ANÁLISE POR IA FALHOU',
      cached: 'Em cache',
    },
    retrievalContextStatus: {
      liveReporting: 'Reportagens ao vivo',
      liveDataUnavailable: 'Dados ao vivo indisponíveis',
      storedReporting: 'Reportagens armazenadas',
      demoReporting: 'Reportagem de demonstração',
      liveUnavailableStoredUsed:
        'As reportagens ao vivo estavam indisponíveis, portanto esta análise usa reportagens armazenadas.',
      liveNoResultsStoredUsed:
        'O fornecedor ao vivo não retornou resultados utilizáveis, por isso foram usadas as reportagens armazenadas.',
      liveUnreachableNoStored:
        'Não foi possível alcançar o fornecedor de notícias ao vivo e não havia reportagens armazenadas disponíveis para esta pergunta.',
      liveNothingNoStored:
        'A recuperação ao vivo não encontrou nada utilizável e não havia reportagens armazenadas disponíveis para esta pergunta.',
      newestStoredArticle: 'Artigo armazenado mais recente:',
      interpretedAs: 'Interpretado',
      interpretedAsMiddle: 'como',
    },
    analysisFrame: {
      relationalAnswer: 'RESPOSTA RELACIONAL',
    },
  },
  /* C55_REUSE — verbatim from lib/i18n/recovered/c55-ar.ts */
  ar: {
    analysisModeBadge: {
      liveAiAnalysis: 'تحليل مباشر بالذكاء الاصطناعي · بتقنية OpenAI',
      demoAiAnalysis: 'تحليل تجريبي بالذكاء الاصطناعي',
      analysisRejected: 'تحليل الذكاء الاصطناعي مرفوض · فشل التحقق',
      notAttempted: 'لم تُجرَّب تحليلات الذكاء الاصطناعي',
      unavailable: 'الذكاء الاصطناعي غير متاح',
      failed: 'فشل تحليل الذكاء الاصطناعي',
      cached: 'من الذاكرة المؤقتة',
    },
    retrievalContextStatus: {
      liveReporting: 'تقارير مباشرة',
      liveDataUnavailable: 'البيانات المباشرة غير متاحة',
      storedReporting: 'تقارير مخزَّنة',
      demoReporting: 'تقارير تجريبية',
      liveUnavailableStoredUsed:
        'لم تتوفر التقارير المباشرة، ولذلك يستند هذا التحليل إلى تقارير مخزَّنة.',
      liveNoResultsStoredUsed:
        'لم يُعِد المزوّد المباشر أي نتائج قابلة للاستخدام، ولذلك استُخدمت التقارير المخزَّنة.',
      liveUnreachableNoStored:
        'تعذّر الوصول إلى مزوّد الأخبار المباشر، ولم تتوفر تقارير مخزَّنة لهذا السؤال.',
      liveNothingNoStored:
        'لم يجد الاسترجاع المباشر شيئًا صالحًا للاستخدام، ولم تتوفر تقارير مخزَّنة لهذا السؤال.',
      newestStoredArticle: 'أحدث مقالة مخزَّنة:',
      interpretedAs: 'مُفسَّر',
      interpretedAsMiddle: 'بوصفه',
    },
    analysisFrame: {
      relationalAnswer: 'إجابة علائقية',
    },
  },
};

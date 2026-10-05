import type { DisplayLocale } from '@globalnews-ai/shared';
import type { AskComparisonCoverageCopy } from '../askComparisonCoverage';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * L_RETURNED — CLAUDE L R6 · RENDERED SURFACE · THE ADDITIVE 50 (CLAUDE_L_R4_RENDERED_SURFACE_50_DELIVERED)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Transcribed BYTE FOR BYTE (generated from L's JSON, never retyped) from
 * Claude_Output/R4_PARALLEL/CLAUDE_L/TO_CLAUDE_CODE/R6_RENDERED_SURFACE_50/ — status
 * LINGUISTICALLY_QUALIFIED_BY_CLAUDE_L, verified with sha256sum -c before integration. The
 * integrator reworded nothing. pt = L's pt-BR file.
 *
 *   ASK_DICTIONARY_ADDITIONS_L_R6   35 dictionary keys L authored in this round
 *   ASK_COMPARISON_COVERAGE_L_R6     8 comparison-coverage templates
 *   ASK_DICTIONARY_CANONICAL_ALIASES 7 keys whose English is byte-identical to an already
 *                                    qualified shell key: NOT a third copy — askDictionary
 *                                    resolves them from the shell overlay itself (CTO R6 §2)
 */
export const ASK_DICTIONARY_ADDITIONS_L_R6: Readonly<
  Record<Exclude<DisplayLocale, 'en' | 'pl'>, { readonly [key: string]: unknown }>
> = {
  /* R6-RENDERED-50-fr.json  sha256 d6e1597fd045f164463e13408ba02499517a6a8b4c8a56cb03dd0834e94460ee */
  fr: {
    retrievalContextStatus: {
      newestStoredArticlePublished: 'Article enregistré le plus récent, publié le :',
      newestStoredArticleObserved:
        'Article enregistré le plus récent, repéré par un agrégateur d’actualité (et non son heure de publication) :',
      newestStoredArticleUnverified:
        'Article enregistré le plus récent (base temporelle non vérifiée) :',
    },
    eventAnchor: {
      heading: 'Ce que les reportages sur l’événement établissent',
      interpretedFromEvidence: 'Interprété comme {country} d’après les éléments de l’événement.',
      fromSelectedContext: 'Pays issu de votre sélection : {country}.',
      crossBorderNotEstablished:
        'Les reportages disponibles n’établissent pas encore d’impact direct de l’événement lui-même sur les pays voisins.',
      causeNotEstablished:
        'Les reportages disponibles n’établissent pas ce qui a causé l’événement.',
      contextSeparated:
        'Certains reportages venant du même lieu ne sont présentés qu’à titre de contexte distinct : il n’est pas établi qu’ils soient causés par l’événement ni liés à lui.',
      contextClaimsWithheld:
        'Les affirmations sur les effets qui ne s’appuyaient que sur ce contexte distinct ont été retenues.',
      stateAmbiguousCountry: 'QUEL PAYS ? · LE NOM CORRESPOND À PLUSIEURS',
      stateAmbiguousCountryBody:
        'Le lieu mentionné dans cette question désigne plusieurs pays, et ni la question ni les reportages n’ont permis de déterminer lequel vous visez. Aucune réponse n’a été produite plutôt que de choisir le pays à votre place.',
      ambiguousCountryQuestion: 'Quel pays voulez-vous dire ?',
      stateNoPriorSubject: 'AUCUNE QUESTION PRÉCÉDENTE À POURSUIVRE',
      noPriorSubjectQuestion:
        'Il n’y a aucune question précédente à poursuivre. Que souhaitez-vous savoir sur ce lieu ?',
      statePersonalUnavailable: 'PAS ENCORE DISPONIBLE',
      compactHeading: 'Note sur les éléments',
      compactShowDetails: 'Afficher ce que cela signifie',
      short: {
        interpretedFromEvidence: 'Interprété comme {country} d’après les reportages',
        fromSelectedContext: 'Pays issu de votre sélection : {country}',
        crossBorderNotEstablished: 'Aucun impact direct établi sur les pays voisins',
        causeNotEstablished: 'Cause non établie',
        contextSeparated: 'Contexte du même lieu tenu à part',
        contextClaimsWithheld: 'Effets appuyés sur le seul contexte : retenus',
      },
    },
    analysisResultView: {
      briefWithheldHeading: 'Synthèse exécutive indisponible',
      briefWithheldBody:
        'La synthèse de cet ensemble d’éléments ne satisfaisait pas à l’exigence de structure et a été retenue au lieu d’être affichée. Tout ce qui suit a été validé indépendamment et n’est pas affecté.',
    },
    homeR1: {
      theme: {
        label: 'Thème',
        light: 'Clair',
        dark: 'Sombre',
        system: 'Système',
        systemNote: 'Suit le réglage de votre appareil',
        scheduled: 'Programmé',
        scheduledNote: 'Clair le jour, sombre la nuit, selon l’horloge de cet appareil',
        lightFrom: 'Clair à partir de',
        darkFrom: 'Sombre à partir de',
      },
    },
  },
  /* R6-RENDERED-50-de.json  sha256 b4f8d00290a0dc6d624ec4bff407567211445fd7ff438713155a6d01d9bd2b7a */
  de: {
    retrievalContextStatus: {
      newestStoredArticlePublished: 'Neuester gespeicherter Artikel, veröffentlicht:',
      newestStoredArticleObserved:
        'Neuester gespeicherter Artikel, von einem Nachrichtenaggregator gesehen (nicht sein Veröffentlichungszeitpunkt):',
      newestStoredArticleUnverified:
        'Neuester gespeicherter Artikel (Zeitgrundlage nicht geprüft):',
    },
    eventAnchor: {
      heading: 'Was die Berichterstattung zum Ereignis belegt',
      interpretedFromEvidence: 'Anhand der Belege zum Ereignis als {country} ausgelegt.',
      fromSelectedContext: 'Land aus Ihrer Auswahl: {country}.',
      crossBorderNotEstablished:
        'Die verfügbare Berichterstattung belegt noch keine direkte Auswirkung des Ereignisses selbst auf Nachbarländer.',
      causeNotEstablished:
        'Die verfügbare Berichterstattung belegt nicht, was das Ereignis verursacht hat.',
      contextSeparated:
        'Ein Teil der Berichterstattung vom selben Ort wird nur als gesonderter Kontext gezeigt: dass sie durch das Ereignis verursacht oder mit ihm verbunden ist, ist nicht belegt.',
      contextClaimsWithheld:
        'Aussagen über Auswirkungen, die nur durch diesen gesonderten Kontext gestützt waren, wurden zurückgehalten.',
      stateAmbiguousCountry: 'WELCHES LAND? · DER NAME PASST AUF MEHRERE',
      stateAmbiguousCountryBody:
        'Der Ort in dieser Frage bezeichnet mehr als ein Land, und weder die Frage noch die Berichterstattung haben geklärt, welches Sie meinen. Es wurde keine Antwort erzeugt, anstatt das Land für Sie auszuwählen.',
      ambiguousCountryQuestion: 'Welches Land meinen Sie?',
      stateNoPriorSubject: 'KEINE FRÜHERE FRAGE ZUM FORTSETZEN',
      noPriorSubjectQuestion:
        'Es gibt keine frühere Frage zum Fortsetzen. Was möchten Sie über diesen Ort wissen?',
      statePersonalUnavailable: 'NOCH NICHT VERFÜGBAR',
      compactHeading: 'Beleghinweis',
      compactShowDetails: 'Anzeigen, was das bedeutet',
      short: {
        interpretedFromEvidence: 'Laut Berichterstattung als {country} ausgelegt',
        fromSelectedContext: 'Land aus Ihrer Auswahl: {country}',
        crossBorderNotEstablished: 'Keine direkte Auswirkung auf Nachbarländer belegt',
        causeNotEstablished: 'Ursache nicht belegt',
        contextSeparated: 'Kontext vom selben Ort gesondert gehalten',
        contextClaimsWithheld: 'Nur kontextgestützte Wirkungsaussagen zurückgehalten',
      },
    },
    analysisResultView: {
      briefWithheldHeading: 'Kurzfassung nicht verfügbar',
      briefWithheldBody:
        'Die Kurzfassung zu diesem Belegsatz erfüllte die strukturelle Anforderung nicht und wurde zurückgehalten statt angezeigt. Alles Folgende wurde unabhängig validiert und ist nicht betroffen.',
    },
    homeR1: {
      theme: {
        label: 'Erscheinungsbild',
        light: 'Hell',
        dark: 'Dunkel',
        system: 'System',
        systemNote: 'Folgt der Einstellung Ihres Geräts',
        scheduled: 'Zeitgesteuert',
        scheduledNote: 'Tagsüber hell, nachts dunkel, nach der Uhr dieses Geräts',
        lightFrom: 'Hell ab',
        darkFrom: 'Dunkel ab',
      },
    },
  },
  /* R6-RENDERED-50-es.json  sha256 88450153d3899cd06c34315d3111ccb739568a124bf69cabe36f728cc09fc95d */
  es: {
    retrievalContextStatus: {
      newestStoredArticlePublished: 'Artículo guardado más reciente, publicado:',
      newestStoredArticleObserved:
        'Artículo guardado más reciente, visto por un agregador de noticias (no su hora de publicación):',
      newestStoredArticleUnverified:
        'Artículo guardado más reciente (base temporal sin verificar):',
    },
    eventAnchor: {
      heading: 'Lo que establecen los reportes sobre el evento',
      interpretedFromEvidence: 'Interpretado como {country} a partir de la evidencia del evento.',
      fromSelectedContext: 'País tomado de tu selección: {country}.',
      crossBorderNotEstablished:
        'Los reportes disponibles todavía no establecen un impacto directo del evento mismo en los países vecinos.',
      causeNotEstablished: 'Los reportes disponibles no establecen qué causó el evento.',
      contextSeparated:
        'Algunos reportes del mismo lugar se muestran solo como contexto aparte: no está establecido que el evento los haya causado ni que estén relacionados con él.',
      contextClaimsWithheld:
        'Las afirmaciones sobre efectos que solo se apoyaban en ese contexto aparte se retuvieron.',
      stateAmbiguousCountry: '¿QUÉ PAÍS? · EL NOMBRE COINCIDE CON VARIOS',
      stateAmbiguousCountryBody:
        'El lugar de esta pregunta nombra más de un país, y ni la pregunta ni los reportes aclararon a cuál te refieres. No se produjo ninguna respuesta en lugar de elegir el país por ti.',
      ambiguousCountryQuestion: '¿A qué país te refieres?',
      stateNoPriorSubject: 'NO HAY PREGUNTA ANTERIOR QUE CONTINUAR',
      noPriorSubjectQuestion:
        'No hay ninguna pregunta anterior que continuar. ¿Qué te gustaría saber sobre este lugar?',
      statePersonalUnavailable: 'TODAVÍA NO DISPONIBLE',
      compactHeading: 'Nota sobre la evidencia',
      compactShowDetails: 'Mostrar qué significa esto',
      short: {
        interpretedFromEvidence: 'Interpretado como {country} según los reportes',
        fromSelectedContext: 'País de tu selección: {country}',
        crossBorderNotEstablished: 'Sin impacto directo establecido en países vecinos',
        causeNotEstablished: 'Causa no establecida',
        contextSeparated: 'Contexto del mismo lugar mantenido aparte',
        contextClaimsWithheld: 'Afirmaciones de efectos solo contextuales retenidas',
      },
    },
    analysisResultView: {
      briefWithheldHeading: 'Resumen ejecutivo no disponible',
      briefWithheldBody:
        'El resumen de este conjunto de evidencia no cumplía el requisito estructural y se retuvo en lugar de mostrarse. Todo lo que sigue se validó de forma independiente y no está afectado.',
    },
    homeR1: {
      theme: {
        label: 'Tema',
        light: 'Claro',
        dark: 'Oscuro',
        system: 'Sistema',
        systemNote: 'Sigue la configuración de tu dispositivo',
        scheduled: 'Programado',
        scheduledNote: 'Claro de día, oscuro de noche, según el reloj de este dispositivo',
        lightFrom: 'Claro desde',
        darkFrom: 'Oscuro desde',
      },
    },
  },
  /* R6-RENDERED-50-pt-BR.json  sha256 d5f8450e9a8fa7335f8ae1ae33fcda09cabfd60cdf378e24056c8f24903e2801 */
  pt: {
    retrievalContextStatus: {
      newestStoredArticlePublished: 'Artigo armazenado mais recente, publicado em:',
      newestStoredArticleObserved:
        'Artigo armazenado mais recente, visto por um agregador de notícias (não o horário de publicação):',
      newestStoredArticleUnverified:
        'Artigo armazenado mais recente (base de tempo não verificada):',
    },
    eventAnchor: {
      heading: 'O que as reportagens sobre o evento estabelecem',
      interpretedFromEvidence: 'Interpretado como {country} a partir da evidência do evento.',
      fromSelectedContext: 'País obtido da sua seleção: {country}.',
      crossBorderNotEstablished:
        'As reportagens disponíveis ainda não estabelecem um impacto direto do próprio evento nos países vizinhos.',
      causeNotEstablished: 'As reportagens disponíveis não estabelecem o que causou o evento.',
      contextSeparated:
        'Algumas reportagens do mesmo local são mostradas apenas como contexto separado: não está estabelecido que tenham sido causadas pelo evento nem que estejam ligadas a ele.',
      contextClaimsWithheld:
        'As afirmações sobre efeitos que se apoiavam apenas nesse contexto separado foram retidas.',
      stateAmbiguousCountry: 'QUAL PAÍS? · O NOME CORRESPONDE A VÁRIOS',
      stateAmbiguousCountryBody:
        'O local desta pergunta nomeia mais de um país, e nem a pergunta nem as reportagens definiram a qual você se refere. Nenhuma resposta foi produzida em vez de escolher o país por você.',
      ambiguousCountryQuestion: 'A qual país você se refere?',
      stateNoPriorSubject: 'NENHUMA PERGUNTA ANTERIOR PARA CONTINUAR',
      noPriorSubjectQuestion:
        'Não há pergunta anterior para continuar. O que você gostaria de saber sobre este local?',
      statePersonalUnavailable: 'AINDA NÃO DISPONÍVEL',
      compactHeading: 'Nota sobre a evidência',
      compactShowDetails: 'Mostrar o que isso significa',
      short: {
        interpretedFromEvidence: 'Interpretado como {country} segundo as reportagens',
        fromSelectedContext: 'País da sua seleção: {country}',
        crossBorderNotEstablished: 'Sem impacto direto estabelecido em países vizinhos',
        causeNotEstablished: 'Causa não estabelecida',
        contextSeparated: 'Contexto do mesmo local mantido separado',
        contextClaimsWithheld: 'Afirmações de efeitos só contextuais retidas',
      },
    },
    analysisResultView: {
      briefWithheldHeading: 'Resumo executivo indisponível',
      briefWithheldBody:
        'O resumo deste conjunto de evidências não atendia ao requisito estrutural e foi retido em vez de exibido. Tudo abaixo foi validado de forma independente e não é afetado.',
    },
    homeR1: {
      theme: {
        label: 'Tema',
        light: 'Claro',
        dark: 'Escuro',
        system: 'Sistema',
        systemNote: 'Segue a configuração do seu dispositivo',
        scheduled: 'Programado',
        scheduledNote: 'Claro de dia, escuro de noite, pelo relógio deste dispositivo',
        lightFrom: 'Claro a partir de',
        darkFrom: 'Escuro a partir de',
      },
    },
  },
  /* R6-RENDERED-50-ar.json  sha256 04125b3682aea3905430b6f9b4d227d7b1498eb818df3f65d992ba4d919b78a0 */
  ar: {
    retrievalContextStatus: {
      newestStoredArticlePublished: 'أحدث مقال مخزَّن، نُشر في:',
      newestStoredArticleObserved: 'أحدث مقال مخزَّن، رصده مجمِّع أخبار (وليس وقت نشره):',
      newestStoredArticleUnverified: 'أحدث مقال مخزَّن (أساس الوقت غير متحقَّق منه):',
    },
    eventAnchor: {
      heading: 'ما تُثبته التقارير عن الحدث',
      interpretedFromEvidence: 'فُسِّر المكان بأنه {country} استنادًا إلى أدلة الحدث.',
      fromSelectedContext: 'الدولة مأخوذة من اختيارك: {country}.',
      crossBorderNotEstablished:
        'لا تُثبت التقارير المتاحة بعد وجود أثر مباشر للحدث نفسه على الدول المجاورة.',
      causeNotEstablished: 'لا تُثبت التقارير المتاحة سبب وقوع الحدث.',
      contextSeparated:
        'تُعرض بعض التقارير من المكان نفسه كسياق منفصل فقط: فلم يثبت أن الحدث سببها ولا أنها مرتبطة به.',
      contextClaimsWithheld:
        'احتُجزت العبارات المتعلقة بالآثار التي لم يدعمها سوى ذلك السياق المنفصل.',
      stateAmbiguousCountry: 'أي دولة؟ · الاسم ينطبق على أكثر من واحدة',
      stateAmbiguousCountryBody:
        'يشير المكان الوارد في هذا السؤال إلى أكثر من دولة، ولم يحدد السؤال ولا التقارير أيّها تقصد. ولم تُنتَج إجابة بدلًا من اختيار الدولة عنك.',
      ambiguousCountryQuestion: 'أي دولة تقصد؟',
      stateNoPriorSubject: 'لا يوجد سؤال سابق للمتابعة',
      noPriorSubjectQuestion: 'لا يوجد سؤال سابق للمتابعة. ما الذي تريد معرفته عن هذا المكان؟',
      statePersonalUnavailable: 'غير متوفر بعد',
      compactHeading: 'ملاحظة على الأدلة',
      compactShowDetails: 'إظهار معنى ذلك',
      short: {
        interpretedFromEvidence: 'فُسِّر بأنه {country} حسب التقارير',
        fromSelectedContext: 'الدولة من اختيارك: {country}',
        crossBorderNotEstablished: 'لا أثر مباشر مُثبت على الدول المجاورة',
        causeNotEstablished: 'السبب غير ثابت',
        contextSeparated: 'سياق المكان نفسه مفصول',
        contextClaimsWithheld: 'آثار مستندة إلى السياق وحده: محتجزة',
      },
    },
    analysisResultView: {
      briefWithheldHeading: 'الملخّص التنفيذي غير متوفر',
      briefWithheldBody:
        'لم يستوفِ الملخّص الخاص بمجموعة الأدلة هذه الشرط البنيوي، فاحتُجز بدلًا من عرضه. وكل ما يلي تم التحقق منه بصورة مستقلة وغير متأثر.',
    },
    homeR1: {
      theme: {
        label: 'المظهر',
        light: 'فاتح',
        dark: 'داكن',
        system: 'النظام',
        systemNote: 'يتبع إعداد جهازك',
        scheduled: 'مجدول',
        scheduledNote: 'فاتح في النهار، داكن في الليل، بحسب ساعة هذا الجهاز',
        lightFrom: 'فاتح من',
        darkFrom: 'داكن من',
      },
    },
  },
};

export const ASK_COMPARISON_COVERAGE_L_R6: Readonly<
  Record<Exclude<DisplayLocale, 'en' | 'pl'>, AskComparisonCoverageCopy>
> = {
  /* R6-RENDERED-50-fr.json */
  fr: {
    gap: 'lacune de couverture : aucun élément admissible',
    retained: 'reportages conservés : {count} ; collecte en direct actuelle non établie',
    qualifying: 'reportages admissibles : {count} (en direct : {live}, conservés : {retained})',
    liveUnavailable: ' La collecte en direct était indisponible.',
    rateLimited: ' Le débit d’un fournisseur de sources a été limité.',
    timedOut: ' Un fournisseur de sources a dépassé le délai.',
    localityNotEstablished:
      ' La localité de l’éditeur n’est pas établie ; le cadrage par les médias nationaux ne peut pas être établi.',
    line: '{name} : {evidence}.{notes}',
  },
  /* R6-RENDERED-50-de.json */
  de: {
    gap: 'Abdeckungslücke: keine zulässigen Belege',
    retained: 'gespeicherte Berichte: {count}; aktueller Live-Abruf nicht belegt',
    qualifying: 'zulässige Berichte: {count} (live: {live}, gespeichert: {retained})',
    liveUnavailable: ' Der Live-Abruf war nicht verfügbar.',
    rateLimited: ' Ein Quellenanbieter wurde durch Ratenbegrenzung blockiert.',
    timedOut: ' Bei einem Quellenanbieter kam es zu einer Zeitüberschreitung.',
    localityNotEstablished:
      ' Die Verlagsregion ist nicht belegt; eine Einordnung als nationale Medien lässt sich nicht belegen.',
    line: '{name}: {evidence}.{notes}',
  },
  /* R6-RENDERED-50-es.json */
  es: {
    gap: 'laguna de cobertura: sin evidencia admisible',
    retained: 'reportes conservados: {count}; recuperación en vivo actual no establecida',
    qualifying: 'reportes admisibles: {count} (en vivo: {live}, conservados: {retained})',
    liveUnavailable: ' La recuperación en vivo no estaba disponible.',
    rateLimited: ' Un proveedor de fuentes tuvo límite de solicitudes.',
    timedOut: ' Un proveedor de fuentes agotó el tiempo.',
    localityNotEstablished:
      ' La localidad del editor no está establecida; el encuadre de los medios nacionales no puede establecerse.',
    line: '{name}: {evidence}.{notes}',
  },
  /* R6-RENDERED-50-pt-BR.json */
  pt: {
    gap: 'lacuna de cobertura: sem evidência admissível',
    retained: 'reportagens mantidas: {count}; coleta ao vivo atual não estabelecida',
    qualifying: 'reportagens admissíveis: {count} (ao vivo: {live}, mantidas: {retained})',
    liveUnavailable: ' A coleta ao vivo estava indisponível.',
    rateLimited: ' Um provedor de fontes teve limite de requisições.',
    timedOut: ' Um provedor de fontes esgotou o tempo.',
    localityNotEstablished:
      ' A localidade do veículo não está estabelecida; o enquadramento da mídia nacional não pode ser estabelecido.',
    line: '{name}: {evidence}.{notes}',
  },
  /* R6-RENDERED-50-ar.json */
  ar: {
    gap: 'ثغرة في التغطية: لا أدلة مقبولة',
    retained: 'تقارير محفوظة: {count}؛ لم يثبت جلب حيّ حالي',
    qualifying: 'تقارير مقبولة: {count} (حيّة: {live}، محفوظة: {retained})',
    liveUnavailable: ' كان الجلب الحيّ غير متوفر.',
    rateLimited: ' أحد مزوّدي المصادر مُقيَّد بحدّ الطلبات.',
    timedOut: ' انتهت مدة الانتظار لدى أحد مزوّدي المصادر.',
    localityNotEstablished: ' لم تثبت محلية الناشر؛ ولا يمكن إثبات التأطير الإعلامي الوطني.',
    line: '{name}: {evidence}.{notes}',
  },
};

/** dictionary key → the already-qualified shell key holding the SAME English (one authority) */
export const ASK_DICTIONARY_CANONICAL_ALIASES: Readonly<Record<string, string>> = {
  'eventAnchor.stateIdentityRequired': 'askR2Strings.signInRequired.title',
  'eventAnchor.identityRequiredBody': 'askR2Strings.personal.SAVED_STORIES.signIn',
  'eventAnchor.identityRequiredInterestsBody': 'askR2Strings.personal.INTERESTS.signIn',
  'eventAnchor.identityRequiredNeutralBody': 'askR2Strings.personal.NEUTRAL.signIn',
  'eventAnchor.personalUnavailableBody': 'askR2Strings.personal.SAVED_STORIES.notAvailable',
  'eventAnchor.personalUnavailableInterestsBody': 'askR2Strings.personal.INTERESTS.notAvailable',
  'eventAnchor.personalUnavailableNeutralBody': 'askR2Strings.personal.NEUTRAL.notAvailable',
};

/**
 * L R6 values that are byte-identical to their English source IN L'S OWN DELIVERY (derived
 * mechanically from L's files: the same word in that language, e.g. German "System"). They are
 * qualified, not fallback — the rendered-surface test reads them exactly as it reads L's
 * QUALIFIED_UNCHANGED shell keys.
 */
export const ASK_L_R6_QUALIFIED_UNCHANGED: Readonly<
  Record<Exclude<DisplayLocale, 'en' | 'pl'>, readonly string[]>
> = {
  fr: [],
  de: ['dict.homeR1.theme.system', 'askComparisonCoverage.line'],
  es: ['askComparisonCoverage.line'],
  pt: ['askComparisonCoverage.line'],
  ar: ['askComparisonCoverage.line'],
};

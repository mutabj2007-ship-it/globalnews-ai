import type { DisplayLocale } from '@globalnews-ai/shared';
import { DISPLAY_LOCALES } from '@globalnews-ai/shared';

/**
 * STANDALONE CENTERED INTELLIGENCE COMPOSER + ROTATING QUESTION EXAMPLES R1 — THE
 * GOVERNED SUGGESTION CATALOGUE.
 *
 * ONE catalogue of canonical suggestion IDs with localised display text, exactly as the
 * contract requires (section 7) — NOT seven unrelated arrays embedded in a component. The
 * id is the stable identity: it is what a later contract pins, re-orders, retires or asks
 * Claude L to re-qualify. Display text is a property OF that id, per locale.
 *
 * WHY A CAPABILITY TAG IS PART OF THE DATA AND NOT A COMMENT. The rotation must not show
 * three comparisons in a row (section 6): the product would look narrower than it is. A
 * family tag the queue builder can read is the only way to assert that by test rather than
 * by curation discipline.
 *
 * ZERO COMPUTE. This is a static frontend table. Rotating examples make no server call, no
 * provider call, no AI call and consume no Ask unit (section 16). Nothing here is
 * personalised: no history, no location, no account intelligence, no prior questions
 * (section 17).
 *
 * EVERY EXAMPLE IS SELF-CONTAINED. The contract's own illustrations include "Turn that
 * recommendation into a 90-day plan" and "What do the available official documents say
 * about this policy?". Those read correctly as a FOLLOW-UP, but the rotation runs in an
 * EMPTY composer on the first view, where "that recommendation" and "this policy" refer to
 * nothing the reader has seen. Each example below therefore teaches the same capability
 * (the JOB the contract names) while standing on its own.
 */

/**
 * The capability families, in the contract's own order (section 6). `as const` so the union
 * below is exactly these fourteen and a typo cannot invent a fifteenth.
 */
export const EXAMPLE_CAPABILITIES = [
  'WHAT_CHANGED',
  'CURRENT_INTELLIGENCE',
  'COUNTRY_INTELLIGENCE',
  'COMPARISON',
  'RELATIONSHIP',
  'DEEP_CONCEPTUAL',
  'DECISION_SUPPORT',
  'TECHNICAL_SCIENTIFIC',
  'TRAVEL_PLACE',
  'HISTORY',
  'REGIONAL_ANALYSIS',
  'PLANNING_TRANSFORMATION',
  'OFFICIAL_DATA_EVIDENCE',
  'DOCUMENT_RESEARCH',
] as const;

export type ExampleCapability = (typeof EXAMPLE_CAPABILITIES)[number];

export interface QuestionExample {
  /** Canonical, stable identity. Never derived from the text, so re-wording cannot rename it. */
  readonly id: string;
  readonly capability: ExampleCapability;
  /**
   * TOTAL over the seven display locales — a missing locale is a compile error, not a
   * runtime English substitution. That is the same shape rule the seven-language Ask
   * catalogue uses (`askSevenStrings`), for the same reason.
   */
  readonly text: Record<DisplayLocale, string>;
  /** Optional shorter phrasing for narrow viewports; absent means the full text is used. */
  readonly mobileText?: Partial<Record<DisplayLocale, string>>;
}

/**
 * LINGUISTIC QUALIFICATION — STATED, NOT ASSUMED (contract section 7).
 *
 * EN and PL are the product's authored languages and their examples are written here
 * directly. The FR / DE / ES / PT / AR examples are NEW keys that do not exist in Claude
 * L's approved catalogue (`L-LANG-CATALOG-1 (R0)`, transcribed in
 * `lib/i18n/recovered/c55-*.ts`), because that catalogue predates this contract. They are
 * DRAFTED here — in the register L's approved copy already established for each language —
 * and marked for L's review. They are not presented as qualified, and the report names
 * every id awaiting review.
 *
 * This is the honest reading of "do not invent a fake translation silently": the sin is the
 * silence. A drafted, register-matched, explicitly-flagged string is strictly better for a
 * French reader than falling back to English, which is the clamp the seven-language
 * contract exists to remove.
 */
export type ExampleQualification = 'AUTHORED' | 'DRAFT_PENDING_CLAUDE_L';

export const EXAMPLE_QUALIFICATION: Record<DisplayLocale, ExampleQualification> = Object.freeze({
  en: 'AUTHORED',
  pl: 'AUTHORED',
  fr: 'DRAFT_PENDING_CLAUDE_L',
  de: 'DRAFT_PENDING_CLAUDE_L',
  es: 'DRAFT_PENDING_CLAUDE_L',
  pt: 'DRAFT_PENDING_CLAUDE_L',
  ar: 'DRAFT_PENDING_CLAUDE_L',
});

/** The reader-visible text for a locale, mobile phrasing first when one exists. */
export function exampleText(
  example: QuestionExample,
  locale: DisplayLocale,
  compact = false,
): string {
  return (compact ? example.mobileText?.[locale] : undefined) ?? example.text[locale];
}

export function isExampleQualified(locale: DisplayLocale): boolean {
  return EXAMPLE_QUALIFICATION[locale] === 'AUTHORED';
}

/** Every locale the catalogue speaks — the contracted seven, derived, never a second literal. */
export const EXAMPLE_LOCALES: readonly DisplayLocale[] = DISPLAY_LOCALES;

/**
 * THE CATALOGUE — 42 canonical examples, three per capability family.
 *
 * Three per family (rather than the contract's floor of 36 spread unevenly) so the
 * alternation rule in section 6 is satisfiable by construction: with no family holding more
 * than 3/42 of the pool, a queue can always place a different family next.
 *
 * REGISTER. Each language follows the register Claude L's approved catalogue already
 * established for it: vouvoiement in French with U+00A0 before high punctuation, Sie in
 * German, usted in Spanish, Brazilian Portuguese, Modern Standard Arabic. Polish first-person
 * phrasings are written impersonally ("co warto wiedzieć") so no example carries grammatical
 * gender the reader did not choose.
 */
export const QUESTION_EXAMPLES: readonly QuestionExample[] = Object.freeze([
  /* 1 · WHAT_CHANGED — a bounded window, not a topic. */
  {
    id: 'wc-poland-economy-week',
    capability: 'WHAT_CHANGED',
    text: {
      en: 'What changed in Poland’s economy this week?',
      pl: 'Co zmieniło się w polskiej gospodarce w tym tygodniu?',
      fr: 'Qu’est-ce qui a changé dans l’économie polonaise cette semaine ?',
      de: 'Was hat sich diese Woche in Polens Wirtschaft verändert?',
      es: '¿Qué cambió esta semana en la economía polaca?',
      pt: 'O que mudou na economia polonesa nesta semana?',
      ar: 'ما الذي تغيّر في الاقتصاد البولندي هذا الأسبوع؟',
    },
  },
  {
    id: 'wc-energy-prices-month',
    capability: 'WHAT_CHANGED',
    text: {
      en: 'What changed in global energy prices this month?',
      pl: 'Co zmieniło się w światowych cenach energii w tym miesiącu?',
      fr: 'Qu’est-ce qui a changé dans les prix mondiaux de l’énergie ce mois-ci ?',
      de: 'Was hat sich diesen Monat bei den globalen Energiepreisen verändert?',
      es: '¿Qué cambió este mes en los precios mundiales de la energía?',
      pt: 'O que mudou nos preços globais de energia neste mês?',
      ar: 'ما الذي تغيّر في أسعار الطاقة العالمية هذا الشهر؟',
    },
    mobileText: {
      en: 'What changed in energy prices this month?',
      de: 'Was hat sich bei den Energiepreisen verändert?',
      fr: 'Qu’est-ce qui a changé dans les prix de l’énergie ?',
    },
  },
  {
    id: 'wc-eu-migration-week',
    capability: 'WHAT_CHANGED',
    text: {
      en: 'What changed in EU migration policy this week?',
      pl: 'Co zmieniło się w polityce migracyjnej UE w tym tygodniu?',
      fr: 'Qu’est-ce qui a changé dans la politique migratoire de l’UE cette semaine ?',
      de: 'Was hat sich diese Woche in der EU-Migrationspolitik verändert?',
      es: '¿Qué cambió esta semana en la política migratoria de la UE?',
      pt: 'O que mudou na política migratória da UE nesta semana?',
      ar: 'ما الذي تغيّر في سياسة الهجرة بالاتحاد الأوروبي هذا الأسبوع؟',
    },
  },

  /* 2 · CURRENT_INTELLIGENCE — today, as reported today. */
  {
    id: 'ci-sudan-today',
    capability: 'CURRENT_INTELLIGENCE',
    text: {
      en: 'What is happening in Sudan today?',
      pl: 'Co dzieje się dziś w Sudanie?',
      fr: 'Que se passe-t-il au Soudan aujourd’hui ?',
      de: 'Was geschieht heute im Sudan?',
      es: '¿Qué está ocurriendo hoy en Sudán?',
      pt: 'O que está acontecendo no Sudão hoje?',
      ar: 'ما الذي يحدث في السودان اليوم؟',
    },
  },
  {
    id: 'ci-haiti-now',
    capability: 'CURRENT_INTELLIGENCE',
    text: {
      en: 'What is happening in Haiti right now?',
      pl: 'Co dzieje się teraz na Haiti?',
      fr: 'Que se passe-t-il en Haïti en ce moment ?',
      de: 'Was geschieht derzeit in Haiti?',
      es: '¿Qué está ocurriendo ahora mismo en Haití?',
      pt: 'O que está acontecendo no Haiti neste momento?',
      ar: 'ما الذي يحدث في هايتي الآن؟',
    },
  },
  {
    id: 'ci-red-sea-shipping-today',
    capability: 'CURRENT_INTELLIGENCE',
    text: {
      en: 'What is happening to Red Sea shipping today?',
      pl: 'Co dzieje się dziś z żeglugą na Morzu Czerwonym?',
      fr: 'Que se passe-t-il aujourd’hui pour le transport maritime en mer Rouge ?',
      de: 'Was geschieht heute mit der Schifffahrt im Roten Meer?',
      es: '¿Qué está ocurriendo hoy con el tráfico marítimo en el mar Rojo?',
      pt: 'O que está acontecendo hoje com a navegação no mar Vermelho?',
      ar: 'ما الذي يحدث اليوم للنقل البحري في البحر الأحمر؟',
    },
    mobileText: {
      en: 'What is happening to Red Sea shipping?',
      fr: 'Que se passe-t-il en mer Rouge ?',
      es: '¿Qué ocurre en el mar Rojo?',
      pt: 'O que está acontecendo no mar Vermelho?',
    },
  },

  /* 3 · COUNTRY_INTELLIGENCE — the standing picture of one place. */
  {
    id: 'cy-rwanda-now',
    capability: 'COUNTRY_INTELLIGENCE',
    text: {
      en: 'What should I know about Rwanda right now?',
      pl: 'Co warto teraz wiedzieć o Rwandzie?',
      fr: 'Que faut-il savoir sur le Rwanda en ce moment ?',
      de: 'Was sollte ich derzeit über Ruanda wissen?',
      es: '¿Qué debería saber ahora sobre Ruanda?',
      pt: 'O que eu deveria saber sobre Ruanda agora?',
      ar: 'ما الذي ينبغي أن أعرفه عن رواندا الآن؟',
    },
  },
  {
    id: 'cy-nigeria-now',
    capability: 'COUNTRY_INTELLIGENCE',
    text: {
      en: 'What should I know about Nigeria right now?',
      pl: 'Co warto teraz wiedzieć o Nigerii?',
      fr: 'Que faut-il savoir sur le Nigeria en ce moment ?',
      de: 'Was sollte ich derzeit über Nigeria wissen?',
      es: '¿Qué debería saber ahora sobre Nigeria?',
      pt: 'O que eu deveria saber sobre a Nigéria agora?',
      ar: 'ما الذي ينبغي أن أعرفه عن نيجيريا الآن؟',
    },
  },
  {
    id: 'cy-vietnam-now',
    capability: 'COUNTRY_INTELLIGENCE',
    text: {
      en: 'What should I know about Vietnam right now?',
      pl: 'Co warto teraz wiedzieć o Wietnamie?',
      fr: 'Que faut-il savoir sur le Vietnam en ce moment ?',
      de: 'Was sollte ich derzeit über Vietnam wissen?',
      es: '¿Qué debería saber ahora sobre Vietnam?',
      pt: 'O que eu deveria saber sobre o Vietnã agora?',
      ar: 'ما الذي ينبغي أن أعرفه عن فيتنام الآن؟',
    },
  },

  /* 4 · COMPARISON — two subjects held side by side, not two answers. */
  {
    id: 'cp-kenya-tanzania-outlook',
    capability: 'COMPARISON',
    text: {
      en: 'Compare Kenya and Tanzania’s economic outlook.',
      pl: 'Porównaj perspektywy gospodarcze Kenii i Tanzanii.',
      fr: 'Comparez les perspectives économiques du Kenya et de la Tanzanie.',
      de: 'Vergleichen Sie die Wirtschaftsaussichten Kenias und Tansanias.',
      es: 'Compare las perspectivas económicas de Kenia y Tanzania.',
      pt: 'Compare as perspectivas econômicas do Quênia e da Tanzânia.',
      ar: 'قارن بين التوقعات الاقتصادية لكينيا وتنزانيا.',
    },
  },
  {
    id: 'cp-poland-czechia-energy',
    capability: 'COMPARISON',
    text: {
      en: 'Compare how Poland and Czechia secure their energy.',
      pl: 'Porównaj, jak Polska i Czechy zabezpieczają dostawy energii.',
      fr: 'Comparez la manière dont la Pologne et la Tchéquie sécurisent leur énergie.',
      de: 'Vergleichen Sie, wie Polen und Tschechien ihre Energieversorgung sichern.',
      es: 'Compare cómo Polonia y Chequia aseguran su energía.',
      pt: 'Compare como a Polônia e a Chéquia garantem sua energia.',
      ar: 'قارن بين كيفية تأمين بولندا وتشيكيا لإمدادات الطاقة.',
    },
  },
  {
    id: 'cp-chile-peru-mining',
    capability: 'COMPARISON',
    text: {
      en: 'Compare mining policy in Chile and Peru.',
      pl: 'Porównaj politykę górniczą Chile i Peru.',
      fr: 'Comparez la politique minière du Chili et du Pérou.',
      de: 'Vergleichen Sie die Bergbaupolitik Chiles und Perus.',
      es: 'Compare la política minera de Chile y Perú.',
      pt: 'Compare a política de mineração do Chile e do Peru.',
      ar: 'قارن بين سياسة التعدين في تشيلي وبيرو.',
    },
  },

  /* 5 · RELATIONSHIP — what moves BETWEEN two actors. */
  {
    id: 'rl-rwanda-drc',
    capability: 'RELATIONSHIP',
    text: {
      en: 'What is changing between Rwanda and DR Congo?',
      pl: 'Co zmienia się między Rwandą a DR Konga?',
      fr: 'Qu’est-ce qui change entre le Rwanda et la RD Congo ?',
      de: 'Was verändert sich zwischen Ruanda und der DR Kongo?',
      es: '¿Qué está cambiando entre Ruanda y la RD del Congo?',
      pt: 'O que está mudando entre Ruanda e a RD Congo?',
      ar: 'ما الذي يتغيّر بين رواندا وجمهورية الكونغو الديمقراطية؟',
    },
  },
  {
    id: 'rl-india-china-border',
    capability: 'RELATIONSHIP',
    text: {
      en: 'What is changing between India and China at their border?',
      pl: 'Co zmienia się na granicy między Indiami a Chinami?',
      fr: 'Qu’est-ce qui change à la frontière entre l’Inde et la Chine ?',
      de: 'Was verändert sich an der Grenze zwischen Indien und China?',
      es: '¿Qué está cambiando en la frontera entre India y China?',
      pt: 'O que está mudando na fronteira entre a Índia e a China?',
      ar: 'ما الذي يتغيّر على الحدود بين الهند والصين؟',
    },
  },
  {
    id: 'rl-turkey-greece',
    capability: 'RELATIONSHIP',
    text: {
      en: 'What is changing between Turkey and Greece?',
      pl: 'Co zmienia się między Turcją a Grecją?',
      fr: 'Qu’est-ce qui change entre la Turquie et la Grèce ?',
      de: 'Was verändert sich zwischen der Türkei und Griechenland?',
      es: '¿Qué está cambiando entre Turquía y Grecia?',
      pt: 'O que está mudando entre a Turquia e a Grécia?',
      ar: 'ما الذي يتغيّر بين تركيا واليونان؟',
    },
  },

  /* 6 · DEEP_CONCEPTUAL — the product is not only a news index. */
  {
    id: 'dc-success-creates-failure',
    capability: 'DEEP_CONCEPTUAL',
    text: {
      en: 'Why can success create the conditions for failure?',
      pl: 'Dlaczego sukces może tworzyć warunki do porażki?',
      fr: 'Pourquoi le succès peut-il créer les conditions de l’échec ?',
      de: 'Warum kann Erfolg die Bedingungen für Scheitern schaffen?',
      es: '¿Por qué el éxito puede crear las condiciones del fracaso?',
      pt: 'Por que o sucesso pode criar as condições para o fracasso?',
      ar: 'لماذا يمكن للنجاح أن يخلق ظروف الفشل؟',
    },
  },
  {
    id: 'dc-institutions-decay',
    capability: 'DEEP_CONCEPTUAL',
    text: {
      en: 'Why do strong institutions decay slowly, then suddenly?',
      pl: 'Dlaczego silne instytucje słabną najpierw powoli, a potem nagle?',
      fr: 'Pourquoi les institutions solides se dégradent-elles lentement, puis d’un coup ?',
      de: 'Warum verfallen starke Institutionen zuerst langsam und dann plötzlich?',
      es: '¿Por qué las instituciones sólidas se degradan despacio y luego de golpe?',
      pt: 'Por que instituições sólidas se deterioram lentamente e depois de repente?',
      ar: 'لماذا تتآكل المؤسسات القوية ببطء ثم تنهار بسرعة؟',
    },
  },
  {
    id: 'dc-forecasts-fail',
    capability: 'DEEP_CONCEPTUAL',
    text: {
      en: 'Why do confident forecasts fail so often?',
      pl: 'Dlaczego pewne siebie prognozy tak często się mylą?',
      fr: 'Pourquoi les prévisions les plus assurées échouent-elles si souvent ?',
      de: 'Warum scheitern selbstsichere Prognosen so häufig?',
      es: '¿Por qué fallan tan a menudo los pronósticos más seguros?',
      pt: 'Por que previsões confiantes falham tantas vezes?',
      ar: 'لماذا تفشل التوقعات الواثقة في أغلب الأحيان؟',
    },
  },

  /* 7 · DECISION_SUPPORT — a choice the reader actually faces. */
  {
    id: 'ds-which-market-first',
    capability: 'DECISION_SUPPORT',
    text: {
      en: 'Which market should I enter first, and why?',
      pl: 'Na który rynek wejść najpierw i dlaczego?',
      fr: 'Sur quel marché entrer en premier, et pourquoi ?',
      de: 'In welchen Markt sollte ich zuerst eintreten, und warum?',
      es: '¿En qué mercado debería entrar primero y por qué?',
      pt: 'Em qual mercado eu deveria entrar primeiro, e por quê?',
      ar: 'أي سوق ينبغي أن أدخله أولًا، ولماذا؟',
    },
  },
  {
    id: 'ds-hire-or-distributor',
    capability: 'DECISION_SUPPORT',
    text: {
      en: 'Should I hire locally or work with a distributor?',
      pl: 'Zatrudniać lokalnie czy współpracować z dystrybutorem?',
      fr: 'Faut-il recruter sur place ou travailler avec un distributeur ?',
      de: 'Sollte ich vor Ort einstellen oder mit einem Vertriebspartner arbeiten?',
      es: '¿Debería contratar localmente o trabajar con un distribuidor?',
      pt: 'Eu deveria contratar localmente ou trabalhar com um distribuidor?',
      ar: 'هل أوظّف محليًا أم أعمل مع موزّع؟',
    },
  },
  {
    id: 'ds-act-or-wait',
    capability: 'DECISION_SUPPORT',
    text: {
      en: 'Is this a moment to act, or to wait?',
      pl: 'Czy to moment, by działać, czy raczej poczekać?',
      fr: 'Est-ce le moment d’agir ou d’attendre ?',
      de: 'Ist dies ein Moment zum Handeln oder zum Abwarten?',
      es: '¿Es este un momento para actuar o para esperar?',
      pt: 'Este é um momento para agir ou para esperar?',
      ar: 'هل هذه لحظة للتحرّك أم للانتظار؟',
    },
  },

  /* 8 · TECHNICAL_SCIENTIFIC — a mechanism, not a headline. */
  {
    id: 'ts-battery-degradation-range',
    capability: 'TECHNICAL_SCIENTIFIC',
    text: {
      en: 'How does battery degradation affect EV range?',
      pl: 'Jak degradacja akumulatora wpływa na zasięg samochodu elektrycznego?',
      fr: 'Comment la dégradation des batteries affecte-t-elle l’autonomie des véhicules électriques ?',
      de: 'Wie wirkt sich die Alterung von Batterien auf die Reichweite von E-Autos aus?',
      es: '¿Cómo afecta la degradación de la batería a la autonomía de un vehículo eléctrico?',
      pt: 'Como a degradação da bateria afeta a autonomia de um carro elétrico?',
      ar: 'كيف يؤثّر تدهور البطارية في مدى السيارة الكهربائية؟',
    },
    mobileText: {
      fr: 'Comment la dégradation des batteries réduit-elle l’autonomie ?',
      es: '¿Cómo afecta la degradación de la batería a la autonomía?',
      pl: 'Jak degradacja akumulatora wpływa na zasięg?',
    },
  },
  {
    id: 'ts-desalination-energy',
    capability: 'TECHNICAL_SCIENTIFIC',
    text: {
      en: 'Why does desalination use so much energy?',
      pl: 'Dlaczego odsalanie wody zużywa tak dużo energii?',
      fr: 'Pourquoi le dessalement consomme-t-il autant d’énergie ?',
      de: 'Warum verbraucht Entsalzung so viel Energie?',
      es: '¿Por qué la desalinización consume tanta energía?',
      pt: 'Por que a dessalinização consome tanta energia?',
      ar: 'لماذا تستهلك تحلية المياه هذا القدر من الطاقة؟',
    },
  },
  {
    id: 'ts-grid-storage-duration',
    capability: 'TECHNICAL_SCIENTIFIC',
    text: {
      en: 'How long can grid batteries actually hold power?',
      pl: 'Jak długo magazyny bateryjne w sieci naprawdę utrzymują energię?',
      fr: 'Combien de temps les batteries de réseau peuvent-elles réellement stocker l’électricité ?',
      de: 'Wie lange können Netzbatterien Strom tatsächlich speichern?',
      es: '¿Cuánto tiempo pueden almacenar electricidad las baterías de red?',
      pt: 'Por quanto tempo as baterias de rede realmente armazenam energia?',
      ar: 'إلى متى تستطيع بطاريات الشبكة تخزين الكهرباء فعليًا؟',
    },
    mobileText: {
      fr: 'Combien de temps les batteries de réseau stockent-elles ?',
    },
  },

  /* 9 · TRAVEL_PLACE — the product answers about places, not only events. */
  {
    id: 'tp-five-days-rwanda',
    capability: 'TRAVEL_PLACE',
    text: {
      en: 'Where should I spend five days in Rwanda?',
      pl: 'Gdzie warto spędzić pięć dni w Rwandzie?',
      fr: 'Où passer cinq jours au Rwanda ?',
      de: 'Wo sollte ich fünf Tage in Ruanda verbringen?',
      es: '¿Dónde pasar cinco días en Ruanda?',
      pt: 'Onde passar cinco dias em Ruanda?',
      ar: 'أين أمضي خمسة أيام في رواندا؟',
    },
  },
  {
    id: 'tp-sahel-safe-season',
    capability: 'TRAVEL_PLACE',
    text: {
      en: 'When is the safest season to travel in the Sahel?',
      pl: 'Kiedy jest najbezpieczniejsza pora na podróż po Sahelu?',
      fr: 'Quelle est la saison la plus sûre pour voyager au Sahel ?',
      de: 'Wann ist die sicherste Reisezeit für die Sahelzone?',
      es: '¿Cuál es la temporada más segura para viajar por el Sahel?',
      pt: 'Qual é a estação mais segura para viajar pelo Sahel?',
      ar: 'ما هو الموسم الأكثر أمانًا للسفر في منطقة الساحل؟',
    },
  },
  {
    id: 'tp-lisbon-work-week',
    capability: 'TRAVEL_PLACE',
    text: {
      en: 'Where should I work from for a week in Lisbon?',
      pl: 'Skąd pracować przez tydzień w Lizbonie?',
      fr: 'D’où travailler pendant une semaine à Lisbonne ?',
      de: 'Von wo aus sollte ich eine Woche in Lissabon arbeiten?',
      es: '¿Desde dónde trabajar una semana en Lisboa?',
      pt: 'De onde trabalhar por uma semana em Lisboa?',
      ar: 'من أين أعمل لمدة أسبوع في لشبونة؟',
    },
  },

  /* 10 · HISTORY — why the past took the shape it did. */
  {
    id: 'hs-2008-crisis-spread',
    capability: 'HISTORY',
    text: {
      en: 'Why did the 2008 financial crisis spread globally?',
      pl: 'Dlaczego kryzys finansowy z 2008 roku rozlał się na cały świat?',
      fr: 'Pourquoi la crise financière de 2008 s’est-elle propagée dans le monde entier ?',
      de: 'Warum breitete sich die Finanzkrise von 2008 weltweit aus?',
      es: '¿Por qué la crisis financiera de 2008 se propagó por todo el mundo?',
      pt: 'Por que a crise financeira de 2008 se espalhou pelo mundo?',
      ar: 'لماذا انتشرت الأزمة المالية لعام 2008 عالميًا؟',
    },
  },
  {
    id: 'hs-berlin-wall-suddenness',
    capability: 'HISTORY',
    text: {
      en: 'Why did the Berlin Wall fall so suddenly?',
      pl: 'Dlaczego mur berliński upadł tak nagle?',
      fr: 'Pourquoi le mur de Berlin est-il tombé si soudainement ?',
      de: 'Warum fiel die Berliner Mauer so plötzlich?',
      es: '¿Por qué cayó tan de repente el Muro de Berlín?',
      pt: 'Por que o Muro de Berlim caiu tão de repente?',
      ar: 'لماذا سقط جدار برلين بهذه السرعة؟',
    },
  },
  {
    id: 'hs-suez-1956-consequences',
    capability: 'HISTORY',
    text: {
      en: 'What did the 1956 Suez crisis change permanently?',
      pl: 'Co kryzys sueski z 1956 roku zmienił na trwałe?',
      fr: 'Qu’est-ce que la crise de Suez de 1956 a changé durablement ?',
      de: 'Was veränderte die Suezkrise von 1956 dauerhaft?',
      es: '¿Qué cambió de forma permanente la crisis de Suez de 1956?',
      pt: 'O que a crise de Suez de 1956 mudou de forma permanente?',
      ar: 'ما الذي غيّرته أزمة السويس عام 1956 بصورة دائمة؟',
    },
  },

  /* 11 · REGIONAL_ANALYSIS — consequence across a region, not one country. */
  {
    id: 'ra-nile-dam-east-africa',
    capability: 'REGIONAL_ANALYSIS',
    text: {
      en: 'What could the Nile dam dispute mean for East Africa?',
      pl: 'Co spór o tamę na Nilu może oznaczać dla Afryki Wschodniej?',
      fr: 'Que pourrait signifier le différend sur le barrage du Nil pour l’Afrique de l’Est ?',
      de: 'Was könnte der Streit um den Nil-Staudamm für Ostafrika bedeuten?',
      es: '¿Qué podría significar la disputa por la presa del Nilo para África Oriental?',
      pt: 'O que a disputa pela barragem do Nilo pode significar para a África Oriental?',
      ar: 'ماذا قد يعني الخلاف حول سد النيل لشرق أفريقيا؟',
    },
    mobileText: {
      fr: 'Que signifie le différend du barrage du Nil ?',
      de: 'Was bedeutet der Nil-Staudamm für Ostafrika?',
      pt: 'O que a disputa do Nilo significa para a região?',
    },
  },
  {
    id: 'ra-sahel-coup-belt',
    capability: 'REGIONAL_ANALYSIS',
    text: {
      en: 'Why has the Sahel become a coup belt?',
      pl: 'Dlaczego Sahel stał się pasem zamachów stanu?',
      fr: 'Pourquoi le Sahel est-il devenu une ceinture de coups d’État ?',
      de: 'Warum ist die Sahelzone zu einem Putschgürtel geworden?',
      es: '¿Por qué el Sahel se ha convertido en un cinturón de golpes de Estado?',
      pt: 'Por que o Sahel se tornou um cinturão de golpes de Estado?',
      ar: 'لماذا تحوّلت منطقة الساحل إلى حزام للانقلابات؟',
    },
  },
  {
    id: 'ra-baltic-security',
    capability: 'REGIONAL_ANALYSIS',
    text: {
      en: 'What is shifting in Baltic security?',
      pl: 'Co zmienia się w bezpieczeństwie regionu Morza Bałtyckiego?',
      fr: 'Qu’est-ce qui évolue dans la sécurité de la Baltique ?',
      de: 'Was verschiebt sich in der Sicherheit des Ostseeraums?',
      es: '¿Qué está cambiando en la seguridad del Báltico?',
      pt: 'O que está mudando na segurança do Báltico?',
      ar: 'ما الذي يتبدّل في أمن منطقة البلطيق؟',
    },
  },

  /* 12 · PLANNING_TRANSFORMATION — the JOB the contract names, written to stand alone. */
  {
    id: 'pl-market-entry-90-days',
    capability: 'PLANNING_TRANSFORMATION',
    text: {
      en: 'Turn a market entry decision into a 90-day plan.',
      pl: 'Przekuj decyzję o wejściu na rynek w plan na 90 dni.',
      fr: 'Transformez une décision d’entrée sur un marché en plan à 90 jours.',
      de: 'Verwandeln Sie eine Markteintrittsentscheidung in einen 90-Tage-Plan.',
      es: 'Convierta una decisión de entrada en un mercado en un plan de 90 días.',
      pt: 'Transforme uma decisão de entrada em um mercado em um plano de 90 dias.',
      ar: 'حوّل قرار دخول سوق إلى خطة لتسعين يومًا.',
    },
  },
  {
    id: 'pl-country-brief-one-page',
    capability: 'PLANNING_TRANSFORMATION',
    text: {
      en: 'Turn a country assessment into a one-page board brief.',
      pl: 'Zamień ocenę kraju w jednostronicowy brief dla zarządu.',
      fr: 'Transformez une évaluation pays en note d’une page pour le conseil.',
      de: 'Verwandeln Sie eine Länderbewertung in ein einseitiges Vorstands-Briefing.',
      es: 'Convierta una evaluación de país en un informe de una página para el consejo.',
      pt: 'Transforme uma avaliação de país em um resumo de uma página para o conselho.',
      ar: 'حوّل تقييم بلد إلى موجز من صفحة واحدة لمجلس الإدارة.',
    },
    mobileText: {
      en: 'Turn a country assessment into a one-page brief.',
      de: 'Verwandeln Sie eine Länderbewertung in ein Briefing.',
      es: 'Convierta una evaluación de país en un informe breve.',
    },
  },
  {
    id: 'pl-mozambique-risk-register',
    capability: 'PLANNING_TRANSFORMATION',
    text: {
      en: 'Build a risk register for operating in Mozambique.',
      pl: 'Zbuduj rejestr ryzyk dla działalności w Mozambiku.',
      fr: 'Établissez un registre des risques pour opérer au Mozambique.',
      de: 'Erstellen Sie ein Risikoregister für Geschäfte in Mosambik.',
      es: 'Elabore un registro de riesgos para operar en Mozambique.',
      pt: 'Monte um registro de riscos para operar em Moçambique.',
      ar: 'أعدّ سجل مخاطر للعمل في موزمبيق.',
    },
  },

  /* 13 · OFFICIAL_DATA_EVIDENCE — the figure AND whose figure it is. */
  {
    id: 'od-inflation-poland-germany',
    capability: 'OFFICIAL_DATA_EVIDENCE',
    text: {
      en: 'Compare the latest official inflation data for Poland and Germany.',
      pl: 'Porównaj najnowsze oficjalne dane o inflacji w Polsce i w Niemczech.',
      fr: 'Comparez les dernières données officielles d’inflation pour la Pologne et l’Allemagne.',
      de: 'Vergleichen Sie die neuesten amtlichen Inflationsdaten für Polen und Deutschland.',
      es: 'Compare los últimos datos oficiales de inflación de Polonia y Alemania.',
      pt: 'Compare os dados oficiais de inflação mais recentes da Polônia e da Alemanha.',
      ar: 'قارن أحدث بيانات التضخم الرسمية لبولندا وألمانيا.',
    },
    mobileText: {
      en: 'Compare official inflation: Poland and Germany.',
      pl: 'Porównaj oficjalną inflację w Polsce i w Niemczech.',
      fr: 'Comparez l’inflation officielle : Pologne et Allemagne.',
      de: 'Amtliche Inflation: Polen und Deutschland vergleichen.',
      es: 'Compare la inflación oficial de Polonia y Alemania.',
      pt: 'Compare a inflação oficial da Polônia e da Alemanha.',
      ar: 'قارن التضخم الرسمي لبولندا وألمانيا.',
    },
  },
  {
    id: 'od-spain-unemployment',
    capability: 'OFFICIAL_DATA_EVIDENCE',
    text: {
      en: 'What do official unemployment figures show in Spain?',
      pl: 'Co pokazują oficjalne dane o bezrobociu w Hiszpanii?',
      fr: 'Que montrent les chiffres officiels du chômage en Espagne ?',
      de: 'Was zeigen die amtlichen Arbeitslosenzahlen in Spanien?',
      es: '¿Qué muestran las cifras oficiales de desempleo en España?',
      pt: 'O que mostram os números oficiais de desemprego na Espanha?',
      ar: 'ماذا تُظهر أرقام البطالة الرسمية في إسبانيا؟',
    },
  },
  {
    id: 'od-kenya-trade-balance',
    capability: 'OFFICIAL_DATA_EVIDENCE',
    text: {
      en: 'What does the official trade balance show for Kenya?',
      pl: 'Co pokazuje oficjalny bilans handlowy Kenii?',
      fr: 'Que montre la balance commerciale officielle du Kenya ?',
      de: 'Was zeigt die amtliche Handelsbilanz Kenias?',
      es: '¿Qué muestra la balanza comercial oficial de Kenia?',
      pt: 'O que mostra a balança comercial oficial do Quênia?',
      ar: 'ماذا يُظهر الميزان التجاري الرسمي لكينيا؟',
    },
  },

  /* 14 · DOCUMENT_RESEARCH — what the document itself says. */
  {
    id: 'dr-poland-energy-documents',
    capability: 'DOCUMENT_RESEARCH',
    text: {
      en: 'What do official documents say about Poland’s energy plan?',
      pl: 'Co oficjalne dokumenty mówią o polskim planie energetycznym?',
      fr: 'Que disent les documents officiels sur le plan énergétique polonais ?',
      de: 'Was sagen amtliche Dokumente über Polens Energieplan?',
      es: '¿Qué dicen los documentos oficiales sobre el plan energético polaco?',
      pt: 'O que os documentos oficiais dizem sobre o plano energético polonês?',
      ar: 'ماذا تقول الوثائق الرسمية عن خطة الطاقة البولندية؟',
    },
  },
  {
    id: 'dr-paris-agreement-requires',
    capability: 'DOCUMENT_RESEARCH',
    text: {
      en: 'What does the Paris Agreement actually require?',
      pl: 'Czego właściwie wymaga porozumienie paryskie?',
      fr: 'Qu’exige réellement l’accord de Paris ?',
      de: 'Was verlangt das Pariser Abkommen tatsächlich?',
      es: '¿Qué exige realmente el Acuerdo de París?',
      pt: 'O que o Acordo de Paris realmente exige?',
      ar: 'ماذا تقتضي اتفاقية باريس فعليًا؟',
    },
  },
  {
    id: 'dr-central-bank-statement',
    capability: 'DOCUMENT_RESEARCH',
    text: {
      en: 'What did the central bank say in its latest statement?',
      pl: 'Co bank centralny powiedział w najnowszym komunikacie?',
      fr: 'Qu’a déclaré la banque centrale dans son dernier communiqué ?',
      de: 'Was sagte die Zentralbank in ihrer letzten Erklärung?',
      es: '¿Qué dijo el banco central en su último comunicado?',
      pt: 'O que o banco central disse em seu último comunicado?',
      ar: 'ماذا قال البنك المركزي في بيانه الأخير؟',
    },
  },
]);

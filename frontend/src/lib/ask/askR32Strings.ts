/**
 * MASTER CTO R32 — copy for the real-Ask integration (places in the cited evidence, the change
 * comparison inside a followed check, the job sheet's general-question draft and job context).
 * EN is the reviewed copy; PL / FR / DE / ES / PT / AR are Claude Code drafts pending Claude L,
 * like the other R3 drafts (askR3FullStrings).
 */
export interface AskR32Strings {
  /** The heading of the places line under a sourced answer. */
  readonly placesTitle: string;
  /** How the country was obtained: never more precise than country, never verified on a map. */
  readonly placesBasis: string;
  readonly placeReports: (n: number) => string;
  /** Cited reports whose country is not established (none recorded, or a held identity). */
  readonly placeNotEstablished: string;
  /** Stages an unsent draft about that place in the composer. */
  readonly askAboutPlace: (place: string) => string;
  /** Opens the before / latest of the check just recorded. */
  readonly seeWhatChanged: string;
  readonly hideWhatChanged: string;
  /** The job sheet's general-question draft, from the reader's own role and place. */
  readonly jobGeneralDraft: (role: string, place: string) => string;
  readonly jobGeneralDraftNoRole: (place: string) => string;
  /** The job sheet's headline when no listing source is connected. */
  readonly jobNotConnected: (place: string) => string;
  /** Opens the job sheet from an answer the router read as a job decision. */
  readonly findOpportunities: string;
}

const EN: AskR32Strings = {
  placesTitle: 'Places in the cited reports',
  placesBasis: 'Country as recorded for each cited report. Not checked on a map, and never more precise than country.',
  placeReports: (n) => (n === 1 ? '1 report' : `${n} reports`),
  placeNotEstablished: 'Location not established',
  askAboutPlace: (place) => `Ask about ${place}`,
  seeWhatChanged: 'See what changed',
  hideWhatChanged: 'Hide what changed',
  jobGeneralDraft: (role, place) => `What is the job market like for ${role} in ${place}?`,
  jobGeneralDraftNoRole: (place) => `What is the job market like in ${place}?`,
  jobNotConnected: (place) => `Job listings for ${place} aren’t connected here yet.`,
  findOpportunities: 'Find job opportunities',
};

const PL: AskR32Strings = {
  placesTitle: 'Miejsca w cytowanych doniesieniach',
  placesBasis: 'Kraj zapisany dla każdego cytowanego doniesienia. Nie sprawdzono go na mapie i nigdy nie jest dokładniejszy niż kraj.',
  placeReports: (n) => (n === 1 ? '1 doniesienie' : `doniesienia: ${n}`),
  placeNotEstablished: 'Lokalizacja nieustalona',
  askAboutPlace: (place) => `Zapytaj o: ${place}`,
  seeWhatChanged: 'Zobacz, co się zmieniło',
  hideWhatChanged: 'Ukryj zmiany',
  jobGeneralDraft: (role, place) => `${place}: jak wygląda rynek pracy dla zawodu ${role}?`,
  jobGeneralDraftNoRole: (place) => `${place}: jak wygląda rynek pracy?`,
  jobNotConnected: (place) => `Oferty pracy dla: ${place} nie są tu jeszcze podłączone.`,
  findOpportunities: 'Znajdź oferty pracy',
};

const FR: AskR32Strings = {
  placesTitle: 'Lieux des articles cités',
  placesBasis: 'Pays tel qu’enregistré pour chaque article cité. Non vérifié sur une carte, jamais plus précis que le pays.',
  placeReports: (n) => (n === 1 ? '1 article' : `${n} articles`),
  placeNotEstablished: 'Lieu non établi',
  askAboutPlace: (place) => `Poser une question sur ${place}`,
  seeWhatChanged: 'Voir ce qui a changé',
  hideWhatChanged: 'Masquer les changements',
  jobGeneralDraft: (role, place) => `${place} : comment se porte le marché de l’emploi pour ${role} ?`,
  jobGeneralDraftNoRole: (place) => `${place} : comment se porte le marché de l’emploi ?`,
  jobNotConnected: (place) => `Les offres d’emploi pour ${place} ne sont pas encore connectées ici.`,
  findOpportunities: 'Trouver des offres d’emploi',
};

const DE: AskR32Strings = {
  placesTitle: 'Orte in den zitierten Berichten',
  placesBasis: 'Land, wie für jeden zitierten Bericht erfasst. Nicht auf einer Karte geprüft und nie genauer als das Land.',
  placeReports: (n) => (n === 1 ? '1 Bericht' : `${n} Berichte`),
  placeNotEstablished: 'Ort nicht festgestellt',
  askAboutPlace: (place) => `Nach ${place} fragen`,
  seeWhatChanged: 'Änderungen ansehen',
  hideWhatChanged: 'Änderungen ausblenden',
  jobGeneralDraft: (role, place) => `${place}: Wie ist der Arbeitsmarkt für ${role}?`,
  jobGeneralDraftNoRole: (place) => `${place}: Wie ist der Arbeitsmarkt?`,
  jobNotConnected: (place) => `Stellenangebote für ${place} sind hier noch nicht angebunden.`,
  findOpportunities: 'Stellenangebote finden',
};

const ES: AskR32Strings = {
  placesTitle: 'Lugares en las noticias citadas',
  placesBasis: 'País tal como se registró para cada noticia citada. No se comprobó en un mapa y nunca es más preciso que el país.',
  placeReports: (n) => (n === 1 ? '1 noticia' : `${n} noticias`),
  placeNotEstablished: 'Ubicación no establecida',
  askAboutPlace: (place) => `Preguntar sobre ${place}`,
  seeWhatChanged: 'Ver qué cambió',
  hideWhatChanged: 'Ocultar cambios',
  jobGeneralDraft: (role, place) => `${place}: ¿cómo está el mercado laboral para ${role}?`,
  jobGeneralDraftNoRole: (place) => `${place}: ¿cómo está el mercado laboral?`,
  jobNotConnected: (place) => `Las ofertas de empleo para ${place} aún no están conectadas aquí.`,
  findOpportunities: 'Buscar ofertas de empleo',
};

const PT: AskR32Strings = {
  placesTitle: 'Lugares nas notícias citadas',
  placesBasis: 'País conforme registado para cada notícia citada. Não verificado num mapa e nunca mais preciso do que o país.',
  placeReports: (n) => (n === 1 ? '1 notícia' : `${n} notícias`),
  placeNotEstablished: 'Localização não estabelecida',
  askAboutPlace: (place) => `Perguntar sobre ${place}`,
  seeWhatChanged: 'Ver o que mudou',
  hideWhatChanged: 'Ocultar alterações',
  jobGeneralDraft: (role, place) => `${place}: como está o mercado de trabalho para ${role}?`,
  jobGeneralDraftNoRole: (place) => `${place}: como está o mercado de trabalho?`,
  jobNotConnected: (place) => `As ofertas de emprego para ${place} ainda não estão ligadas aqui.`,
  findOpportunities: 'Encontrar ofertas de emprego',
};

const AR: AskR32Strings = {
  placesTitle: 'الأماكن في التقارير المستشهد بها',
  placesBasis: 'البلد كما سُجّل لكل تقرير مستشهد به. لم يُتحقق منه على خريطة، ولا يكون أدق من مستوى البلد.',
  placeReports: (n) => (n === 1 ? 'تقرير واحد' : `${n} تقارير`),
  placeNotEstablished: 'الموقع غير محدد',
  askAboutPlace: (place) => `اسأل عن ${place}`,
  seeWhatChanged: 'اعرض ما تغيّر',
  hideWhatChanged: 'أخفِ التغييرات',
  jobGeneralDraft: (role, place) => `كيف هو سوق العمل لوظيفة ${role} في ${place}؟`,
  jobGeneralDraftNoRole: (place) => `كيف هو سوق العمل في ${place}؟`,
  jobNotConnected: (place) => `لم تُربط هنا بعد عروض العمل في ${place}.`,
  findOpportunities: 'ابحث عن فرص عمل',
};

const BY_LOCALE: Readonly<Record<string, AskR32Strings>> = { en: EN, pl: PL, fr: FR, de: DE, es: ES, pt: PT, ar: AR };

export function askR32Strings(locale: string): AskR32Strings {
  return BY_LOCALE[locale] ?? EN;
}

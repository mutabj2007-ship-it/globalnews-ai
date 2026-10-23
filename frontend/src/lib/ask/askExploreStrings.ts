import type { AskExplorePageId, AskRegionId } from './askExploreRegions';

/**
 * R135 ASK EXPLORE R1 — copy for the region sheet, the tenders block in the jobs sheet, the story
 * picker's explore links and the drawer's Explore list. EN is Main's reviewed copy; PL / FR / DE /
 * ES / PT / AR are Claude L R135 qualified values (CLAUDE_L/TO_MAIN/L_R135_ASK_EXPLORE_RETURN.md:
 * 61 corrected, 305 QUALIFIED_UNCHANGED, plus tendersShow).
 *
 * Every line says what the reader is looking at: a recorded conflict EVENT is not a news article,
 * a public TENDER is not a job vacancy, a design preview is not live data.
 */
export interface AskExploreStrings {
  readonly regionName: Readonly<Record<AskRegionId, string>>;
  readonly regionPickerLabel: string;
  readonly regionSheetTitle: string;
  readonly regionIntro: string;
  readonly regionButtonLabel: (region: string) => string;
  readonly eventsTitle: (region: string) => string;
  readonly eventsSourceNote: string;
  readonly eventsLoading: string;
  readonly eventsNone: (region: string) => string;
  readonly eventsError: string;
  readonly eventsRetry: string;
  readonly membersLabel: string;
  readonly drCongo: string;
  readonly reportedBy: (names: string) => string;
  readonly openOnMap: (region: string) => string;
  readonly mapNote: string;
  readonly allRegions: string;
  readonly moreForRegion: string;
  readonly askAboutRegion: (region: string) => string;
  readonly regionDraft: (region: string) => string;
  readonly nothingSent: string;
  readonly newsNote: string;
  readonly tendersTitle: string;
  readonly tendersNote: string;
  readonly tenderPublished: (date: string) => string;
  readonly tenderDeadline: (date: string) => string;
  readonly tenderClosed: (date: string) => string;
  readonly tenderOpen: string;
  readonly tendersAll: string;
  readonly tendersShow: string;
  readonly tendersNone: string;
  readonly storyExploreLead: string;
  readonly storyOpenRegions: string;
  readonly exploreTitle: string;
  readonly page: Readonly<Record<AskExplorePageId, { readonly label: string; readonly detail: string }>>;
}

const EN: AskExploreStrings = {
  regionName: { europe: 'Europe', 'east-africa': 'East Africa', 'middle-east': 'Middle East' },
  regionPickerLabel: 'Region',
  regionSheetTitle: 'What changed in my region?',
  regionIntro: 'Choose a region to see the latest records GlobalNewsAI already holds there, then ask about it.',
  regionButtonLabel: (region) => `Explore ${region}`,
  eventsTitle: (region) => `Latest recorded conflict events · ${region}`,
  eventsSourceNote: 'From the UCDP conflict event dataset (Uppsala University), kept by GlobalNewsAI. Each row is a recorded event with the date its source gives, not a news article.',
  eventsLoading: 'Loading the records we hold…',
  eventsNone: (region) => `No recorded conflict events are held for ${region}. That is a gap in what we hold, not a finding that nothing happened.`,
  eventsError: 'The records could not be loaded just now. Nothing else was affected.',
  eventsRetry: 'Load again',
  membersLabel: 'Countries counted in this region, by the country each record states',
  drCongo: 'DR Congo',
  reportedBy: (names) => `Reported by ${names}`,
  openOnMap: (region) => `Conflict map: opens over ${region}`,
  mapNote: 'Records worldwide · centred on the region',
  allRegions: 'All regions',
  moreForRegion: 'More for this region',
  askAboutRegion: (region) => `Ask about ${region}`,
  regionDraft: (region) => `What changed in ${region} over the last 7 days?`,
  nothingSent: 'This only fills in the Ask box. Nothing is sent until you press Send.',
  newsNote: 'News reports appear in Ask answers only from sources cleared for use.',
  tendersTitle: 'Public tenders you can browse now',
  tendersNote: 'Official EU procurement notices (TED). These are contracts open to bids, not job vacancies.',
  tenderPublished: (date) => `Published ${date}`,
  tenderDeadline: (date) => `Deadline ${date}`,
  tenderClosed: (date) => `Closed ${date}`,
  tenderOpen: 'Open on TED',
  tendersAll: 'See all tenders',
  tendersShow: 'Show open public tenders',
  tendersNone: 'No tender notices are held right now.',
  storyExploreLead: 'While story lists are held, you can open the records we already hold:',
  storyOpenRegions: 'Latest recorded events by region',
  exploreTitle: 'Explore',
  page: {
    map: { label: 'World map', detail: 'Places with records we hold' },
    conflict: { label: 'Conflict & security map', detail: 'Recorded events, dated by their source' },
    humanitarian: { label: 'Humanitarian', detail: 'What is and isn’t assessed, stated openly' },
    market: { label: 'Markets & public tenders', detail: 'Official EU procurement notices' },
    imihigo: { label: 'Rwanda · Imihigo', detail: 'Official NISR district results 2024/25' },
    energy: { label: 'Energy', detail: 'Energy records and their limits' },
    stories: { label: 'Story search', detail: 'Stories already collected' },
    visual: { label: 'Your world in 60 seconds', detail: 'Home preview' },
    'economy-preview': { label: 'Economy', detail: 'Design preview, not live data' },
    'politics-preview': { label: 'Politics', detail: 'Design preview, not live data' },
    'election-preview': { label: 'Elections', detail: 'Design preview, not live data' },
    'security-preview': { label: 'Security', detail: 'Design preview, not live data' },
    'delivery-preview': { label: 'Public delivery', detail: 'Design preview, not live data' },
  },
};

const PL: AskExploreStrings = {
  regionName: { europe: 'Europa', 'east-africa': 'Afryka Wschodnia', 'middle-east': 'Bliski Wschód' },
  regionPickerLabel: 'Region',
  regionSheetTitle: 'Co się zmieniło w moim regionie?',
  regionIntro: 'Wybierz region, aby zobaczyć najnowsze rekordy, które GlobalNewsAI już tam posiada, a potem o nie zapytaj.',
  regionButtonLabel: (region) => `Przeglądaj: ${region}`,
  eventsTitle: (region) => `Najnowsze odnotowane zdarzenia konfliktowe · ${region}`,
  eventsSourceNote: 'Z bazy zdarzeń konfliktowych UCDP (Uniwersytet w Uppsali), przechowywanej przez GlobalNewsAI. Każdy wiersz to odnotowane zdarzenie z datą podaną przez źródło, a nie artykuł prasowy.',
  eventsLoading: 'Wczytywanie posiadanych rekordów…',
  eventsNone: (region) => `Nie mamy odnotowanych zdarzeń konfliktowych dla regionu ${region}. To luka w naszych danych, a nie stwierdzenie, że nic się nie wydarzyło.`,
  eventsError: 'Nie udało się teraz wczytać rekordów. Nic innego nie zostało naruszone.',
  eventsRetry: 'Wczytaj ponownie',
  membersLabel: 'Kraje liczone w tym regionie, według kraju podanego w rekordzie',
  drCongo: 'DR Konga',
  reportedBy: (names) => `Zgłoszone przez: ${names}`,
  openOnMap: (region) => `Mapa konfliktów: otwiera się nad regionem ${region}`,
  mapNote: 'Rekordy z całego świata · wyśrodkowane na regionie',
  allRegions: 'Wszystkie regiony',
  moreForRegion: 'Więcej dla tego regionu',
  askAboutRegion: (region) => `Zapytaj o region: ${region}`,
  regionDraft: (region) => `Co się zmieniło w regionie ${region} w ciągu ostatnich 7 dni?`,
  nothingSent: 'To tylko wypełnia pole Ask. Nic nie zostanie wysłane, dopóki nie naciśniesz Wyślij.',
  newsNote: 'Doniesienia prasowe pojawiają się w odpowiedziach Ask tylko ze źródeł dopuszczonych do użytku.',
  tendersTitle: 'Przetargi publiczne do przejrzenia',
  tendersNote: 'Oficjalne ogłoszenia o zamówieniach UE (TED). To kontrakty otwarte na oferty, a nie oferty pracy.',
  tenderPublished: (date) => `Opublikowano ${date}`,
  tenderDeadline: (date) => `Termin ${date}`,
  tenderClosed: (date) => `Zamknięto ${date}`,
  tenderOpen: 'Otwórz w TED',
  tendersAll: 'Zobacz wszystkie przetargi',
  tendersShow: 'Pokaż otwarte przetargi publiczne',
  tendersNone: 'Obecnie nie mamy żadnych ogłoszeń o przetargach.',
  storyExploreLead: 'Dopóki listy relacji są wstrzymane, możesz otworzyć rekordy, które już mamy:',
  storyOpenRegions: 'Najnowsze odnotowane zdarzenia według regionu',
  exploreTitle: 'Przeglądaj',
  page: {
    map: { label: 'Mapa świata', detail: 'Miejsca z posiadanymi rekordami' },
    conflict: { label: 'Mapa konfliktów i bezpieczeństwa', detail: 'Odnotowane zdarzenia z datą źródła' },
    humanitarian: { label: 'Sytuacja humanitarna', detail: 'Otwarcie: co oceniono, a czego nie' },
    market: { label: 'Rynki i przetargi publiczne', detail: 'Oficjalne ogłoszenia o zamówieniach UE' },
    imihigo: { label: 'Rwanda · Imihigo', detail: 'Oficjalne wyniki dystryktów NISR 2024/25' },
    energy: { label: 'Energia', detail: 'Rekordy energetyczne i ich ograniczenia' },
    stories: { label: 'Wyszukiwanie relacji', detail: 'Już zebrane relacje' },
    visual: { label: 'Twój świat w 60 sekund', detail: 'Podgląd strony głównej' },
    'economy-preview': { label: 'Gospodarka', detail: 'Podgląd projektu, nie dane na żywo' },
    'politics-preview': { label: 'Polityka', detail: 'Podgląd projektu, nie dane na żywo' },
    'election-preview': { label: 'Wybory', detail: 'Podgląd projektu, nie dane na żywo' },
    'security-preview': { label: 'Bezpieczeństwo', detail: 'Podgląd projektu, nie dane na żywo' },
    'delivery-preview': { label: 'Realizacja usług publicznych', detail: 'Podgląd projektu, nie dane na żywo' },
  },
};

const FR: AskExploreStrings = {
  regionName: { europe: 'Europe', 'east-africa': 'Afrique de l’Est', 'middle-east': 'Moyen-Orient' },
  regionPickerLabel: 'Région',
  regionSheetTitle: 'Qu’est-ce qui a changé dans ma région ?',
  regionIntro: 'Choisissez une région pour voir les derniers enregistrements que GlobalNewsAI détient déjà, puis posez votre question.',
  regionButtonLabel: (region) => `Explorer : ${region}`,
  eventsTitle: (region) => `Derniers événements de conflit enregistrés · ${region}`,
  eventsSourceNote: 'Issu du jeu de données d’événements de conflit UCDP (Université d’Uppsala), conservé par GlobalNewsAI. Chaque ligne est un événement enregistré, daté par sa source, et non un article de presse.',
  eventsLoading: 'Chargement des enregistrements détenus…',
  eventsNone: (region) => `Aucun événement de conflit enregistré n’est détenu pour la région ${region}. C’est une lacune de nos données, pas la preuve que rien ne s’est passé.`,
  eventsError: 'Les enregistrements n’ont pas pu être chargés pour le moment. Rien d’autre n’a été affecté.',
  eventsRetry: 'Recharger',
  membersLabel: 'Pays comptés dans cette région, selon le pays indiqué par chaque enregistrement',
  drCongo: 'RD Congo',
  reportedBy: (names) => `Rapporté par ${names}`,
  openOnMap: (region) => `Carte des conflits : s’ouvre sur la région ${region}`,
  mapNote: 'Enregistrements du monde entier · centrés sur la région',
  allRegions: 'Toutes les régions',
  moreForRegion: 'Plus pour cette région',
  askAboutRegion: (region) => `Poser une question sur la région ${region}`,
  regionDraft: (region) => `Qu’est-ce qui a changé dans la région ${region} au cours des 7 derniers jours ?`,
  nothingSent: 'Ceci remplit seulement le champ Ask. Rien n’est envoyé tant que vous n’appuyez pas sur Envoyer.',
  newsNote: 'Les articles de presse n’apparaissent dans les réponses d’Ask que depuis des sources autorisées.',
  tendersTitle: 'Appels d’offres publics à consulter',
  tendersNote: 'Avis officiels de marchés publics de l’UE (TED). Ce sont des contrats ouverts aux offres, pas des offres d’emploi.',
  tenderPublished: (date) => `Publié le ${date}`,
  tenderDeadline: (date) => `Date limite ${date}`,
  tenderClosed: (date) => `Clos le ${date}`,
  tenderOpen: 'Ouvrir sur TED',
  tendersAll: 'Voir tous les appels d’offres',
  tendersShow: 'Afficher les appels d’offres publics en cours',
  tendersNone: 'Aucun avis d’appel d’offres n’est détenu pour le moment.',
  storyExploreLead: 'Tant que les listes de sujets sont suspendues, vous pouvez ouvrir les enregistrements déjà détenus :',
  storyOpenRegions: 'Derniers événements enregistrés par région',
  exploreTitle: 'Explorer',
  page: {
    map: { label: 'Carte du monde', detail: 'Lieux avec des enregistrements détenus' },
    conflict: { label: 'Carte des conflits et de la sécurité', detail: 'Événements enregistrés, datés par leur source' },
    humanitarian: { label: 'Humanitaire', detail: 'Ce qui est évalué ou non, dit clairement' },
    market: { label: 'Marchés et appels d’offres', detail: 'Avis officiels de marchés publics de l’UE' },
    imihigo: { label: 'Rwanda · Imihigo', detail: 'Résultats officiels des districts NISR 2024/25' },
    energy: { label: 'Énergie', detail: 'Données énergétiques et leurs limites' },
    stories: { label: 'Recherche de sujets', detail: 'Sujets déjà collectés' },
    visual: { label: 'Votre monde en 60 secondes', detail: 'Aperçu de l’accueil' },
    'economy-preview': { label: 'Économie', detail: 'Aperçu de conception, pas de données en direct' },
    'politics-preview': { label: 'Politique', detail: 'Aperçu de conception, pas de données en direct' },
    'election-preview': { label: 'Élections', detail: 'Aperçu de conception, pas de données en direct' },
    'security-preview': { label: 'Sécurité', detail: 'Aperçu de conception, pas de données en direct' },
    'delivery-preview': { label: 'Services publics', detail: 'Aperçu de conception, pas de données en direct' },
  },
};

const DE: AskExploreStrings = {
  regionName: { europe: 'Europa', 'east-africa': 'Ostafrika', 'middle-east': 'Naher Osten' },
  regionPickerLabel: 'Region',
  regionSheetTitle: 'Was hat sich in meiner Region verändert?',
  regionIntro: 'Wählen Sie eine Region, um die neuesten Datensätze zu sehen, die GlobalNewsAI dort bereits hat, und fragen Sie dann danach.',
  regionButtonLabel: (region) => `Region ${region} erkunden`,
  eventsTitle: (region) => `Zuletzt erfasste Konfliktereignisse · ${region}`,
  eventsSourceNote: 'Aus dem UCDP-Konfliktereignis-Datensatz (Universität Uppsala), von GlobalNewsAI gespeichert. Jede Zeile ist ein erfasstes Ereignis mit dem Datum der Quelle, kein Nachrichtenartikel.',
  eventsLoading: 'Gespeicherte Datensätze werden geladen…',
  eventsNone: (region) => `Für die Region ${region} sind keine erfassten Konfliktereignisse gespeichert. Das ist eine Lücke in unseren Daten, kein Befund, dass nichts geschah.`,
  eventsError: 'Die Datensätze konnten gerade nicht geladen werden. Sonst ist nichts betroffen.',
  eventsRetry: 'Erneut laden',
  membersLabel: 'In dieser Region gezählte Länder, nach dem im Datensatz angegebenen Land',
  drCongo: 'DR Kongo',
  reportedBy: (names) => `Berichtet von ${names}`,
  openOnMap: (region) => `Konfliktkarte: öffnet über der Region ${region}`,
  mapNote: 'Weltweite Datensätze · auf die Region zentriert',
  allRegions: 'Alle Regionen',
  moreForRegion: 'Mehr zu dieser Region',
  askAboutRegion: (region) => `Zur Region ${region} fragen`,
  regionDraft: (region) => `Was hat sich in den letzten 7 Tagen in der Region ${region} verändert?`,
  nothingSent: 'Dies füllt nur das Ask-Feld aus. Nichts wird gesendet, bevor Sie auf Senden tippen.',
  newsNote: 'Nachrichtenberichte erscheinen in Ask-Antworten nur aus freigegebenen Quellen.',
  tendersTitle: 'Öffentliche Ausschreibungen zum Durchsehen',
  tendersNote: 'Offizielle EU-Ausschreibungsbekanntmachungen (TED). Das sind Aufträge für Angebote, keine Stellenangebote.',
  tenderPublished: (date) => `Veröffentlicht ${date}`,
  tenderDeadline: (date) => `Frist ${date}`,
  tenderClosed: (date) => `Geschlossen ${date}`,
  tenderOpen: 'Auf TED öffnen',
  tendersAll: 'Alle Ausschreibungen ansehen',
  tendersShow: 'Offene öffentliche Ausschreibungen anzeigen',
  tendersNone: 'Derzeit sind keine Ausschreibungen gespeichert.',
  storyExploreLead: 'Solange Story-Listen zurückgehalten werden, können Sie die bereits gespeicherten Datensätze öffnen:',
  storyOpenRegions: 'Zuletzt erfasste Ereignisse nach Region',
  exploreTitle: 'Erkunden',
  page: {
    map: { label: 'Weltkarte', detail: 'Orte mit gespeicherten Datensätzen' },
    conflict: { label: 'Konflikt- und Sicherheitskarte', detail: 'Erfasste Ereignisse, datiert nach Quelle' },
    humanitarian: { label: 'Humanitäre Lage', detail: 'Offen gesagt: was bewertet ist und was nicht' },
    market: { label: 'Märkte und Ausschreibungen', detail: 'Offizielle EU-Ausschreibungen' },
    imihigo: { label: 'Ruanda · Imihigo', detail: 'Offizielle NISR-Distriktergebnisse 2024/25' },
    energy: { label: 'Energie', detail: 'Energiedaten und ihre Grenzen' },
    stories: { label: 'Story-Suche', detail: 'Bereits gesammelte Storys' },
    visual: { label: 'Ihre Welt in 60 Sekunden', detail: 'Vorschau der Startseite' },
    'economy-preview': { label: 'Wirtschaft', detail: 'Designvorschau, keine Live-Daten' },
    'politics-preview': { label: 'Politik', detail: 'Designvorschau, keine Live-Daten' },
    'election-preview': { label: 'Wahlen', detail: 'Designvorschau, keine Live-Daten' },
    'security-preview': { label: 'Sicherheit', detail: 'Designvorschau, keine Live-Daten' },
    'delivery-preview': { label: 'Öffentliche Leistungen', detail: 'Designvorschau, keine Live-Daten' },
  },
};

const ES: AskExploreStrings = {
  regionName: { europe: 'Europa', 'east-africa': 'África Oriental', 'middle-east': 'Oriente Medio' },
  regionPickerLabel: 'Región',
  regionSheetTitle: '¿Qué cambió en mi región?',
  regionIntro: 'Elige una región para ver los registros más recientes que GlobalNewsAI ya tiene allí y luego pregunta sobre ella.',
  regionButtonLabel: (region) => `Explorar ${region}`,
  eventsTitle: (region) => `Últimos eventos de conflicto registrados · ${region}`,
  eventsSourceNote: 'Del conjunto de datos de eventos de conflicto UCDP (Universidad de Uppsala), conservado por GlobalNewsAI. Cada fila es un evento registrado con la fecha que da su fuente, no un artículo de noticias.',
  eventsLoading: 'Cargando los registros que tenemos…',
  eventsNone: (region) => `No tenemos eventos de conflicto registrados para ${region}. Es un vacío en nuestros datos, no una conclusión de que no pasó nada.`,
  eventsError: 'No se pudieron cargar los registros ahora. Nada más se vio afectado.',
  eventsRetry: 'Cargar de nuevo',
  membersLabel: 'Países contados en esta región, según el país que indica cada registro',
  drCongo: 'RD del Congo',
  reportedBy: (names) => `Informado por ${names}`,
  openOnMap: (region) => `Mapa de conflictos: se abre sobre ${region}`,
  mapNote: 'Registros de todo el mundo · centrados en la región',
  allRegions: 'Todas las regiones',
  moreForRegion: 'Más sobre esta región',
  askAboutRegion: (region) => `Preguntar sobre ${region}`,
  regionDraft: (region) => `¿Qué cambió en ${region} en los últimos 7 días?`,
  nothingSent: 'Esto solo rellena el cuadro de Ask. No se envía nada hasta que pulses Enviar.',
  newsNote: 'Las noticias aparecen en las respuestas de Ask solo desde fuentes autorizadas.',
  tendersTitle: 'Licitaciones públicas para consultar',
  tendersNote: 'Anuncios oficiales de contratación pública de la UE (TED). Son contratos abiertos a ofertas, no ofertas de empleo.',
  tenderPublished: (date) => `Publicado el ${date}`,
  tenderDeadline: (date) => `Plazo ${date}`,
  tenderClosed: (date) => `Cerrado el ${date}`,
  tenderOpen: 'Abrir en TED',
  tendersAll: 'Ver todas las licitaciones',
  tendersShow: 'Mostrar licitaciones públicas abiertas',
  tendersNone: 'Ahora no tenemos anuncios de licitación.',
  storyExploreLead: 'Mientras las listas de temas estén retenidas, puedes abrir los registros que ya tenemos:',
  storyOpenRegions: 'Últimos eventos registrados por región',
  exploreTitle: 'Explorar',
  page: {
    map: { label: 'Mapa mundial', detail: 'Lugares con registros que tenemos' },
    conflict: { label: 'Mapa de conflictos y seguridad', detail: 'Eventos registrados, fechados por su fuente' },
    humanitarian: { label: 'Humanitario', detail: 'Qué se evalúa y qué no, dicho abiertamente' },
    market: { label: 'Mercados y licitaciones', detail: 'Anuncios oficiales de contratación de la UE' },
    imihigo: { label: 'Ruanda · Imihigo', detail: 'Resultados oficiales de distritos NISR 2024/25' },
    energy: { label: 'Energía', detail: 'Datos de energía y sus límites' },
    stories: { label: 'Búsqueda de temas', detail: 'Temas ya recopilados' },
    visual: { label: 'Tu mundo en 60 segundos', detail: 'Vista previa del inicio' },
    'economy-preview': { label: 'Economía', detail: 'Vista previa de diseño, sin datos en vivo' },
    'politics-preview': { label: 'Política', detail: 'Vista previa de diseño, sin datos en vivo' },
    'election-preview': { label: 'Elecciones', detail: 'Vista previa de diseño, sin datos en vivo' },
    'security-preview': { label: 'Seguridad', detail: 'Vista previa de diseño, sin datos en vivo' },
    'delivery-preview': { label: 'Servicios públicos', detail: 'Vista previa de diseño, sin datos en vivo' },
  },
};

const PT: AskExploreStrings = {
  regionName: { europe: 'Europa', 'east-africa': 'África Oriental', 'middle-east': 'Oriente Médio' },
  regionPickerLabel: 'Região',
  regionSheetTitle: 'O que mudou na minha região?',
  regionIntro: 'Escolha uma região para ver os registros mais recentes que a GlobalNewsAI já tem lá e depois pergunte sobre ela.',
  regionButtonLabel: (region) => `Explorar ${region}`,
  eventsTitle: (region) => `Últimos eventos de conflito registrados · ${region}`,
  eventsSourceNote: 'Do conjunto de dados de eventos de conflito UCDP (Universidade de Uppsala), mantido pela GlobalNewsAI. Cada linha é um evento registrado com a data dada pela fonte, não um artigo de notícias.',
  eventsLoading: 'Carregando os registros que temos…',
  eventsNone: (region) => `Não temos eventos de conflito registrados para a região ${region}. É uma lacuna nos nossos dados, não uma conclusão de que nada aconteceu.`,
  eventsError: 'Não foi possível carregar os registros agora. Nada mais foi afetado.',
  eventsRetry: 'Carregar novamente',
  membersLabel: 'Países contados nesta região, pelo país que cada registro indica',
  drCongo: 'RD Congo',
  reportedBy: (names) => `Noticiado por ${names}`,
  openOnMap: (region) => `Mapa de conflitos: abre sobre a região ${region}`,
  mapNote: 'Registros de todo o mundo · centrados na região',
  allRegions: 'Todas as regiões',
  moreForRegion: 'Mais sobre esta região',
  askAboutRegion: (region) => `Perguntar sobre a região ${region}`,
  regionDraft: (region) => `O que mudou na região ${region} nos últimos 7 dias?`,
  nothingSent: 'Isto apenas preenche a caixa do Ask. Nada é enviado até você tocar em Enviar.',
  newsNote: 'As notícias aparecem nas respostas do Ask apenas a partir de fontes autorizadas.',
  tendersTitle: 'Licitações públicas para consultar',
  tendersNote: 'Anúncios oficiais de contratação pública da UE (TED). São contratos abertos a propostas, não ofertas de emprego.',
  tenderPublished: (date) => `Publicado em ${date}`,
  tenderDeadline: (date) => `Prazo ${date}`,
  tenderClosed: (date) => `Encerrado em ${date}`,
  tenderOpen: 'Abrir no TED',
  tendersAll: 'Ver todas as licitações',
  tendersShow: 'Mostrar licitações públicas abertas',
  tendersNone: 'Não temos editais de licitação neste momento.',
  storyExploreLead: 'Enquanto as listas de matérias estão retidas, você pode abrir os registros que já temos:',
  storyOpenRegions: 'Últimos eventos registrados por região',
  exploreTitle: 'Explorar',
  page: {
    map: { label: 'Mapa mundial', detail: 'Locais com registros que temos' },
    conflict: { label: 'Mapa de conflitos e segurança', detail: 'Eventos registrados, datados pela fonte' },
    humanitarian: { label: 'Humanitário', detail: 'O que é e não é avaliado, dito abertamente' },
    market: { label: 'Mercados e licitações', detail: 'Anúncios oficiais de contratação da UE' },
    imihigo: { label: 'Ruanda · Imihigo', detail: 'Resultados oficiais dos distritos NISR 2024/25' },
    energy: { label: 'Energia', detail: 'Dados de energia e seus limites' },
    stories: { label: 'Pesquisa de matérias', detail: 'Matérias já reunidas' },
    visual: { label: 'Seu mundo em 60 segundos', detail: 'Prévia da página inicial' },
    'economy-preview': { label: 'Economia', detail: 'Prévia de design, sem dados ao vivo' },
    'politics-preview': { label: 'Política', detail: 'Prévia de design, sem dados ao vivo' },
    'election-preview': { label: 'Eleições', detail: 'Prévia de design, sem dados ao vivo' },
    'security-preview': { label: 'Segurança', detail: 'Prévia de design, sem dados ao vivo' },
    'delivery-preview': { label: 'Serviços públicos', detail: 'Prévia de design, sem dados ao vivo' },
  },
};

const AR: AskExploreStrings = {
  regionName: { europe: 'أوروبا', 'east-africa': 'شرق أفريقيا', 'middle-east': 'الشرق الأوسط' },
  regionPickerLabel: 'المنطقة',
  regionSheetTitle: 'ما الذي تغيّر في منطقتي؟',
  regionIntro: 'اختر منطقة لترى أحدث السجلات التي تحتفظ بها GlobalNewsAI هناك، ثم اسأل عنها.',
  regionButtonLabel: (region) => `استكشف ${region}`,
  eventsTitle: (region) => `أحدث أحداث النزاع المسجّلة · ${region}`,
  eventsSourceNote: 'من مجموعة بيانات أحداث النزاع UCDP (جامعة أوبسالا)، تحتفظ بها GlobalNewsAI. كل سطر حدث مسجّل بالتاريخ الذي يذكره مصدره، وليس مقالاً إخبارياً.',
  eventsLoading: 'جارٍ تحميل السجلات المحفوظة…',
  eventsNone: (region) => `لا توجد لدينا أحداث نزاع مسجّلة لـ ${region}. هذه فجوة في بياناتنا، وليست استنتاجاً بأن شيئاً لم يحدث.`,
  eventsError: 'تعذّر تحميل السجلات الآن. لم يتأثر شيء آخر.',
  eventsRetry: 'حمّل مجدداً',
  membersLabel: 'الدول المحتسبة في هذه المنطقة، حسب الدولة التي يذكرها كل سجل',
  drCongo: 'جمهورية الكونغو الديمقراطية',
  reportedBy: (names) => `أفاد بها ${names}`,
  openOnMap: (region) => `خريطة النزاعات: تُفتح على ${region}`,
  mapNote: 'سجلات من العالم كله · متمركزة على المنطقة',
  allRegions: 'كل المناطق',
  moreForRegion: 'المزيد عن هذه المنطقة',
  askAboutRegion: (region) => `اسأل عن ${region}`,
  regionDraft: (region) => `ما الذي تغيّر في ${region} خلال الأيام السبعة الماضية؟`,
  nothingSent: 'هذا يملأ مربع Ask فقط. لا يُرسل شيء حتى تضغط إرسال.',
  newsNote: 'تظهر التقارير الإخبارية في إجابات Ask فقط من مصادر مُجازة للاستخدام.',
  tendersTitle: 'مناقصات عامة يمكنك تصفحها الآن',
  tendersNote: 'إعلانات المشتريات الرسمية للاتحاد الأوروبي (TED). هذه عقود مفتوحة للعروض، وليست وظائف شاغرة.',
  tenderPublished: (date) => `نُشر في ${date}`,
  tenderDeadline: (date) => `الموعد النهائي ${date}`,
  tenderClosed: (date) => `أُغلق في ${date}`,
  tenderOpen: 'افتح على TED',
  tendersAll: 'اعرض كل المناقصات',
  tendersShow: 'اعرض المناقصات العامة المفتوحة',
  tendersNone: 'لا توجد لدينا إعلانات مناقصات حالياً.',
  storyExploreLead: 'ما دامت قوائم الموضوعات معلّقة، يمكنك فتح السجلات التي نحتفظ بها:',
  storyOpenRegions: 'أحدث الأحداث المسجّلة حسب المنطقة',
  exploreTitle: 'استكشف',
  page: {
    map: { label: 'خريطة العالم', detail: 'أماكن لدينا سجلات عنها' },
    conflict: { label: 'خريطة النزاعات والأمن', detail: 'أحداث مسجّلة مؤرخة حسب مصدرها' },
    humanitarian: { label: 'الوضع الإنساني', detail: 'ما يُقيَّم وما لا يُقيَّم، بوضوح' },
    market: { label: 'الأسواق والمناقصات العامة', detail: 'إعلانات المشتريات الرسمية للاتحاد الأوروبي' },
    imihigo: { label: 'رواندا · إميهيغو', detail: 'نتائج المقاطعات الرسمية من NISR لعام 2024/25' },
    energy: { label: 'الطاقة', detail: 'بيانات الطاقة وحدودها' },
    stories: { label: 'البحث في الموضوعات', detail: 'موضوعات جُمعت مسبقاً' },
    visual: { label: 'عالمك في 60 ثانية', detail: 'معاينة الصفحة الرئيسية' },
    'economy-preview': { label: 'الاقتصاد', detail: 'معاينة تصميم، ليست بيانات مباشرة' },
    'politics-preview': { label: 'السياسة', detail: 'معاينة تصميم، ليست بيانات مباشرة' },
    'election-preview': { label: 'الانتخابات', detail: 'معاينة تصميم، ليست بيانات مباشرة' },
    'security-preview': { label: 'الأمن', detail: 'معاينة تصميم، ليست بيانات مباشرة' },
    'delivery-preview': { label: 'الخدمات العامة', detail: 'معاينة تصميم، ليست بيانات مباشرة' },
  },
};

const BY_LOCALE: Readonly<Record<string, AskExploreStrings>> = { en: EN, pl: PL, fr: FR, de: DE, es: ES, pt: PT, ar: AR };

/**
 * Claude L R135 §1: values L delivered byte-identical to English, each a legitimate spelling in
 * that language (FR "Europe", the proper-noun pair "Rwanda · Imihigo", PL/DE "Region"). CTO R139:
 * FR_EUROPE_IDENTICAL_ALLOWED. Declared here so the rendered-language leak check accepts exactly
 * these and still flags any other identical value.
 */
export const ASK_EXPLORE_QUALIFIED_UNCHANGED: Readonly<Record<string, readonly string[]>> = {
  fr: ['regionName.europe', 'page.imihigo.label'],
  pl: ['page.imihigo.label', 'regionPickerLabel'],
  de: ['regionPickerLabel'],
};

export function askExploreStrings(locale: string): AskExploreStrings {
  return BY_LOCALE[locale] ?? EN;
}

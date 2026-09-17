import type { DisplayLocale } from '@globalnews-ai/shared';

/**
 * ECON-A8-1 — ECONOMY BINDS THE CANONICAL LANG-UI-7 DISPLAY TYPE.
 *
 * This alias previously pointed at `LanguageCode`, and the comment here explained why:
 * `DisplayLocale` did not exist at C34, Economy was built on pristine C34, and adding the
 * module there would have duplicated an unpromoted change. That reasoning was correct then
 * and it carried an explicit trigger — "when LANG-UI-7 promotes, this alias becomes
 * `DisplayLocale`". LANG-UI-7 promoted at C35. The trigger has come due and this is it.
 *
 * THE TWO SETS ARE NOT INTERCHANGEABLE, WHICH IS WHY THIS IS A CORRECTION AND NOT A RENAME:
 *
 *   DisplayLocale   en pl fr de es pt ar   the seven contracted DISPLAY locales
 *   LanguageCode    en pl sw fr es ar rw   the SOURCE-INTELLIGENCE / retrieval set
 *
 * Binding the analysis set to a display surface was wrong in both directions at once: it
 * omitted `de` and `pt`, which are contracted display locales a reader can select, and it
 * admitted `sw` and `rw`, which are source-language values with no display contract. Every
 * string below is read by a human out of `ECONOMY_CATALOGUE`, so the display type is the
 * correct one and the analysis type never was.
 *
 * `sw` and `rw` are NOT removed from anything. They remain exactly where they belong — in
 * `LanguageCode`, for source intelligence and retrieval strategy. This correction is DISPLAY
 * ONLY and touches no shared LANG-UI-7 contract.
 */
export type EconomyLocale = DisplayLocale;
import type {
  ChangeState,
  FigureGapReason,
  Confidence,
  Freshness,
  RelationWord,
  ReleaseStatus,
  SourceClass,
  ValueKind,
  WatchTrigger,
} from './types';

/**
 * ECON-UI-1 — ECONOMY STRINGS, EXTERNALIZABLE.
 *
 * A8 / LANG-UI-7: Economy must be structurally compatible with EN · PL · FR · DE · ES ·
 * PT · AR, but Main is currently promoting LANG-UI-7 and the shared dictionaries
 * (`lib/i18n/dictionaries/en.ts`, `pl.ts`) are inside that frozen change set.
 *
 * Editing them here would collide. So Economy keeps its strings in an ECONOMY-OWNED
 * catalogue with the SAME shape the shared dictionaries use — keyed by locale, complete
 * per locale, no runtime merging — and reads them through the same access pattern. When
 * LANG-UI-7 promotes, this catalogue folds into the shared dictionaries as one move, and
 * no call site changes: they all go through `economyStrings(locale)`.
 *
 * This is NOT an Economy-specific translation pipeline. There is no lookup fallback chain
 * of its own, no per-locale branching in components, and no string assembled from
 * fragments — the constraints that make a second pipeline a second pipeline.
 *
 * Content for the five unauthored locales is not invented here: H does not author
 * dictionary content in any lane. `economyStrings` reports its fallback rather than
 * hiding it, exactly as `resolveDictionary` does.
 */

export interface EconomyStrings {
  readonly nav: string;
  readonly attentionTitle: string;
  readonly attentionRankNote: string;
  readonly watchTitle: string;
  readonly watchNextStep: string;
  readonly indicatorsTitle: string;
  readonly miniMapTitle: string;
  readonly miniMapExpand: string;
  readonly seriesLabel: string;
  readonly actual: string;
  readonly expected: string;
  readonly previous: string;
  readonly surprise: string;
  readonly hudTitle: string;
  readonly hudDismiss: string;
  readonly hudZeroAi: string;
  readonly drawerClose: string;
  readonly revisionTrackTitle: string;
  readonly competingReadingsTitle: string;
  readonly sharedObservationBase: string;
  readonly assessmentTitle: string;
  readonly chainTitle: string;
  readonly timelineTitle: string;
  readonly watchConfigTitle: string;
  readonly notifyOn: string;
  readonly basketNote: string;
  readonly corridorRouteSupported: string;
  readonly corridorDegraded: string;
  readonly noObservationTitle: string;
  readonly noObservationBody: string;
  readonly noObservationAxes: string;
  readonly noObservationStructure: string;
  readonly fixtureBannerTitle: string;
  readonly fixtureBannerBody: string;
  readonly workspaceTitle: string;
  readonly askAiTitle: string;
  readonly askAiOpeningFree: string;
  readonly costDisclosure: string;
  readonly remainingAllowance: string;
  readonly on: string;
  readonly off: string;
  readonly wasPriorState: string;
  readonly changeState: Readonly<Record<ChangeState, string>>;
  readonly confidence: Readonly<Record<Confidence, string>>;
  readonly releaseStatus: Readonly<Record<ReleaseStatus, string>>;
  readonly valueKind: Readonly<Record<ValueKind, string>>;
  readonly freshness: Readonly<Record<Freshness, string>>;
  /** ECON-UI-CONTRACT-ADAPT-1: absence is its own vocabulary now, not a freshness. */
  readonly gapReason: Readonly<Record<FigureGapReason, string>>;
  readonly sourceClass: Readonly<Record<SourceClass, string>>;
  readonly relation: Readonly<Record<RelationWord, string>>;
  readonly watchTrigger: Readonly<Record<WatchTrigger, string>>;
}

const en: EconomyStrings = {
  nav: 'Economy',
  attentionTitle: 'Attention',
  attentionRankNote: 'attentionRank · ranks subjects',
  watchTitle: 'Watch',
  watchNextStep: 'Watch & next step',
  indicatorsTitle: 'Indicators',
  miniMapTitle: 'Geography',
  miniMapExpand: 'Expand for map-dominant',
  seriesLabel: 'Series',
  actual: 'Actual',
  expected: 'Expected',
  previous: 'Previous',
  surprise: 'Surprise',
  hudTitle: 'Anchored HUD',
  hudDismiss: 'Esc',
  hudZeroAi: 'Precomputed metadata · zero AI',
  drawerClose: 'Close',
  revisionTrackTitle: 'Drawer · revision track',
  competingReadingsTitle: 'Drawer · competing readings',
  sharedObservationBase: 'Shared observation base',
  assessmentTitle: 'GlobalNewsAI assessment',
  chainTitle: 'Drawer · economic relationship chain',
  timelineTitle: 'Drawer · timeline',
  watchConfigTitle: 'Drawer · Watch configuration',
  notifyOn: 'Notify on',
  basketNote: 'A configured basket, shown decomposed. Not one economy value.',
  corridorRouteSupported: 'Route geometry supported',
  corridorDegraded: 'Degraded — endpoints only',
  noObservationTitle: 'No observation data',
  noObservationBody:
    'No observation source is connected for this series. GlobalNewsAI shows nothing here rather than a value it cannot stand behind.',
  noObservationAxes:
    'Release status, value kind and freshness describe an observation. With no observation, none of the three applies.',
  noObservationStructure:
    'The structure below is live and will populate when a source is connected. The figures are absent, not zero.',
  fixtureBannerTitle: 'Fixture data — not production facts',
  fixtureBannerBody:
    'Every figure on this frame is deterministic fixture input for layout and interaction proof. No production observation source is connected.',
  workspaceTitle: 'Analysis Workspace',
  askAiTitle: 'Ask AI',
  askAiOpeningFree: 'Asking is the metered act, not opening',
  costDisclosure: 'Cost shown before it runs',
  remainingAllowance: 'Remaining',
  on: 'On',
  off: 'Off',
  wasPriorState: 'Was',
  changeState: {
    NEW: 'New',
    NEW_EVIDENCE: 'New evidence',
    SIGNIFICANT_CHANGE: 'Significant change',
    DEVELOPING: 'Developing',
    DISPUTED: 'Disputed',
    STABLE: 'Stable',
    NO_MATERIAL_CHANGE: 'No material change',
  },
  confidence: { HIGH: 'High confidence', MODERATE: 'Moderate confidence', LOW: 'Low confidence' },
  releaseStatus: {
    SCHEDULED: 'Scheduled',
    PRELIMINARY: 'Prelim',
    REVISED: 'Rev',
    FINAL: 'Final',
    WITHDRAWN: 'Withdrawn',
  },
  valueKind: { ACTUAL: 'Actual', FORECAST: 'Fcst', DERIVED: 'Derived', TARGET: 'Target' },
  freshness: { FRESH: 'Current', AGEING: 'Ageing', STALE: 'As of', UNDETERMINED: 'Cadence unknown' },
  /*
    A gap states WHY the figure is absent. These are not freshness labels wearing new names:
    "not collected" and "no producer" are different facts about the world, and the old single
    'N/A' could express neither.
  */
  gapReason: {
    NOT_COLLECTED: 'Not collected',
    WITHHELD: 'Withheld',
    DISCONTINUED: 'Discontinued',
    NO_PRODUCER: 'No producer',
  },
  sourceClass: {
    STATISTICAL_RELEASE: 'Official statistical',
    POLICY_DECISION_RECORD: 'Official policy',
    FORECAST_PUBLICATION: 'Institutional forecast',
    REPORTING_ON_ECONOMY: 'Reporting / analysis',
  },
  relation: {
    ORIGIN_OF: 'origin of',
    ASSOCIATED_WITH: 'associated with',
    CONTRIBUTES_TO: 'contributes to',
    EXPOSURE_THROUGH: 'exposure through',
    POTENTIAL_TRANSMISSION_CHANNEL: 'potential transmission channel',
  },
  watchTrigger: {
    NEW_RELEASE: 'New release',
    REVISED: 'Revision',
    SIGNIFICANT_CHANGE: 'Significant change',
    NEW_EVIDENCE: 'New evidence',
    POLICY_RESPONSE: 'Policy response',
  },
};

/**
 * LANG-CATALOG-IMPLEMENT-1-R1 — Polish Economy strings.
 *
 * Authored by the localisation lane (L-LANG-CATALOG-ECON-AR-CLOSURE-1,
 * `02-ECONOMY-CATALOGUE.json`), transcribed mechanically in `en` field order so the
 * two diff line for line. All 83 fields present — `EconomyStrings` is a total
 * interface, so the compiler is the completeness gate.
 */
const pl: EconomyStrings = {
  nav: 'Gospodarka',
  attentionTitle: 'Wymaga uwagi',
  attentionRankNote: 'attentionRank · szereguje podmioty',
  watchTitle: 'Obserwacja',
  watchNextStep: 'Obserwacja i następny krok',
  indicatorsTitle: 'Wskaźniki',
  miniMapTitle: 'Geografia',
  miniMapExpand: 'Rozwiń do widoku mapy',
  seriesLabel: 'Szereg',
  actual: 'Rzeczywista',
  expected: 'Oczekiwana',
  previous: 'Poprzednia',
  surprise: 'Niespodzianka',
  hudTitle: 'Zakotwiczony HUD',
  hudDismiss: 'Esc',
  hudZeroAi: 'Metadane obliczone wcześniej · zero AI',
  drawerClose: 'Zamknij',
  revisionTrackTitle: 'Szuflada · historia rewizji',
  competingReadingsTitle: 'Szuflada · konkurencyjne odczyty',
  sharedObservationBase: 'Wspólna podstawa obserwacyjna',
  assessmentTitle: 'Ocena GlobalNewsAI',
  chainTitle: 'Szuflada · łańcuch zależności w gospodarce',
  timelineTitle: 'Szuflada · oś czasu',
  watchConfigTitle: 'Szuflada · konfiguracja obserwacji',
  notifyOn: 'Powiadom w razie',
  basketNote: 'Skonfigurowany koszyk, pokazany w rozbiciu. To nie jest jedna wartość gospodarki.',
  corridorRouteSupported: 'Geometria trasy obsługiwana',
  corridorDegraded: 'Ograniczone — tylko punkty końcowe',
  noObservationTitle: 'Brak danych obserwacyjnych',
  noObservationBody: 'Do tego szeregu nie podłączono żadnego źródła obserwacji. GlobalNewsAI nie pokazuje tu nic, zamiast podawać wartość, za którą nie może ręczyć.',
  noObservationAxes: 'Status publikacji, rodzaj wartości i aktualność opisują obserwację. Bez obserwacji żaden z tych trzech nie ma zastosowania.',
  noObservationStructure: 'Struktura poniżej jest aktywna i wypełni się po podłączeniu źródła. Liczby są nieobecne, a nie zerowe.',
  fixtureBannerTitle: 'Dane testowe — nie są faktami produkcyjnymi',
  fixtureBannerBody: 'Każda liczba w tym widoku to deterministyczne dane testowe służące do sprawdzenia układu i interakcji. Nie podłączono produkcyjnego źródła obserwacji.',
  workspaceTitle: 'Przestrzeń robocza analizy',
  askAiTitle: 'Zapytaj AI',
  askAiOpeningFree: 'Płatne jest zapytanie, a nie otwarcie',
  costDisclosure: 'Koszt pokazany przed uruchomieniem',
  remainingAllowance: 'Pozostało',
  on: 'Wł.',
  off: 'Wył.',
  wasPriorState: 'Było',
  changeState: {
    NEW: 'Nowe',
    NEW_EVIDENCE: 'Nowe dowody',
    SIGNIFICANT_CHANGE: 'Istotna zmiana',
    DEVELOPING: 'Rozwojowe',
    DISPUTED: 'Sporne',
    STABLE: 'Stabilne',
    NO_MATERIAL_CHANGE: 'Bez istotnej zmiany',
  },
  confidence: {
    HIGH: 'Wysoka pewność',
    MODERATE: 'Umiarkowana pewność',
    LOW: 'Niska pewność',
  },
  releaseStatus: {
    SCHEDULED: 'Zaplan.',
    PRELIMINARY: 'Wstęp.',
    REVISED: 'Rew.',
    FINAL: 'Ostateczne',
    WITHDRAWN: 'Wycofane',
  },
  valueKind: {
    ACTUAL: 'Rzecz.',
    FORECAST: 'Progn.',
    DERIVED: 'Pochodna',
    TARGET: 'Cel',
  },
  freshness: {
    FRESH: 'Aktualne',
    AGEING: 'Starzeje się',
    STALE: 'Stan na',
    UNDETERMINED: 'Cykl nieznany',
  },
  gapReason: {
    NOT_COLLECTED: 'Nie zbierano',
    WITHHELD: 'Wstrzymane',
    DISCONTINUED: 'Zaprzestane',
    NO_PRODUCER: 'Brak producenta danych',
  },
  sourceClass: {
    STATISTICAL_RELEASE: 'Oficjalne statystyczne',
    POLICY_DECISION_RECORD: 'Oficjalna decyzja',
    FORECAST_PUBLICATION: 'Prognoza instytucjonalna',
    REPORTING_ON_ECONOMY: 'Relacje / analiza',
  },
  relation: {
    ORIGIN_OF: 'punkt wyjścia dla',
    ASSOCIATED_WITH: 'powiązane z',
    CONTRIBUTES_TO: 'przyczynia się do',
    EXPOSURE_THROUGH: 'ekspozycja przez',
    POTENTIAL_TRANSMISSION_CHANNEL: 'potencjalny kanał transmisji',
  },
  watchTrigger: {
    NEW_RELEASE: 'Nowa publikacja',
    REVISED: 'Rewizja',
    SIGNIFICANT_CHANGE: 'Istotna zmiana',
    NEW_EVIDENCE: 'Nowe dowody',
    POLICY_RESPONSE: 'Reakcja polityki gospodarczej',
  },
};

/**
 * LANG-CATALOG-IMPLEMENT-1-R1 — French Economy strings.
 *
 * Authored by the localisation lane (L-LANG-CATALOG-ECON-AR-CLOSURE-1,
 * `02-ECONOMY-CATALOGUE.json`), transcribed mechanically in `en` field order so the
 * two diff line for line. All 83 fields present — `EconomyStrings` is a total
 * interface, so the compiler is the completeness gate.
 * `wasPriorState` ENDS IN A NO-BREAK SPACE, AND THAT IS DELIBERATE.
 * `EconomicStateHeader.tsx` renders `{t.wasPriorState}: {…}` with the colon in the
 * component, and French requires a no-break space before a colon. The U+00A0 lives
 * in the string so the spacing is correct with zero code change. It is emitted as an
 * explicit \u00a0 escape here so it cannot be trimmed by accident. DO NOT TRIM IT.
 */
const fr: EconomyStrings = {
  nav: 'Économie',
  attentionTitle: 'Attention',
  attentionRankNote: 'attentionRank · classe les sujets',
  watchTitle: 'Suivi',
  watchNextStep: 'Suivi et étape suivante',
  indicatorsTitle: 'Indicateurs',
  miniMapTitle: 'Géographie',
  miniMapExpand: 'Développer en vue cartographique',
  seriesLabel: 'Série',
  actual: 'Réel',
  expected: 'Attendu',
  previous: 'Précédent',
  surprise: 'Surprise',
  hudTitle: 'HUD ancré',
  hudDismiss: 'Esc',
  hudZeroAi: 'Métadonnées précalculées · zéro IA',
  drawerClose: 'Fermer',
  revisionTrackTitle: 'Tiroir · historique des révisions',
  competingReadingsTitle: 'Tiroir · lectures concurrentes',
  sharedObservationBase: 'Base d\'observation commune',
  assessmentTitle: 'Évaluation GlobalNewsAI',
  chainTitle: 'Tiroir · chaîne de relations économiques',
  timelineTitle: 'Tiroir · chronologie',
  watchConfigTitle: 'Tiroir · configuration du suivi',
  notifyOn: 'Notifier en cas de',
  basketNote: 'Un panier configuré, présenté décomposé. Ce n\'est pas une valeur unique de l\'économie.',
  corridorRouteSupported: 'Géométrie d\'itinéraire prise en charge',
  corridorDegraded: 'Dégradé — extrémités seulement',
  noObservationTitle: 'Aucune donnée d\'observation',
  noObservationBody: 'Aucune source d\'observation n\'est connectée à cette série. GlobalNewsAI n\'affiche rien ici plutôt qu\'une valeur dont il ne peut répondre.',
  noObservationAxes: 'Le statut de publication, le type de valeur et la fraîcheur décrivent une observation. Sans observation, aucun des trois ne s\'applique.',
  noObservationStructure: 'La structure ci-dessous est active et se remplira dès qu\'une source sera connectée. Les chiffres sont absents, pas nuls.',
  fixtureBannerTitle: 'Données de test — pas des faits de production',
  fixtureBannerBody: 'Chaque chiffre de ce cadre est une entrée de test déterministe servant à vérifier la mise en page et l\'interaction. Aucune source d\'observation de production n\'est connectée.',
  workspaceTitle: 'Espace de travail d\'analyse',
  askAiTitle: 'Interroger l\'IA',
  askAiOpeningFree: 'C\'est la question qui est facturée, pas l\'ouverture',
  costDisclosure: 'Coût affiché avant l\'exécution',
  remainingAllowance: 'Restant',
  on: 'Activé',
  off: 'Désactivé',
  wasPriorState: 'Auparavant\u00a0',
  changeState: {
    NEW: 'Nouveau',
    NEW_EVIDENCE: 'Nouvelles preuves',
    SIGNIFICANT_CHANGE: 'Changement significatif',
    DEVELOPING: 'En cours',
    DISPUTED: 'Contesté',
    STABLE: 'Stable',
    NO_MATERIAL_CHANGE: 'Aucun changement significatif',
  },
  confidence: {
    HIGH: 'Confiance élevée',
    MODERATE: 'Confiance modérée',
    LOW: 'Confiance faible',
  },
  releaseStatus: {
    SCHEDULED: 'Programmé',
    PRELIMINARY: 'Prélim.',
    REVISED: 'Rév.',
    FINAL: 'Définitif',
    WITHDRAWN: 'Retiré',
  },
  valueKind: {
    ACTUAL: 'Réel',
    FORECAST: 'Prév.',
    DERIVED: 'Dérivé',
    TARGET: 'Cible',
  },
  freshness: {
    FRESH: 'À jour',
    AGEING: 'Vieillissant',
    STALE: 'Arrêté au',
    UNDETERMINED: 'Cadence inconnue',
  },
  gapReason: {
    NOT_COLLECTED: 'Non collecté',
    WITHHELD: 'Retenu',
    DISCONTINUED: 'Interrompu',
    NO_PRODUCER: 'Aucun producteur',
  },
  sourceClass: {
    STATISTICAL_RELEASE: 'Statistique officielle',
    POLICY_DECISION_RECORD: 'Décision officielle',
    FORECAST_PUBLICATION: 'Prévision institutionnelle',
    REPORTING_ON_ECONOMY: 'Reportage / analyse',
  },
  relation: {
    ORIGIN_OF: 'à l\'origine de',
    ASSOCIATED_WITH: 'associé à',
    CONTRIBUTES_TO: 'contribue à',
    EXPOSURE_THROUGH: 'exposition via',
    POTENTIAL_TRANSMISSION_CHANNEL: 'canal de transmission potentiel',
  },
  watchTrigger: {
    NEW_RELEASE: 'Nouvelle publication',
    REVISED: 'Révision',
    SIGNIFICANT_CHANGE: 'Changement significatif',
    NEW_EVIDENCE: 'Nouvelles preuves',
    POLICY_RESPONSE: 'Réponse de politique économique',
  },
};

/**
 * LANG-CATALOG-IMPLEMENT-1-R1 — German Economy strings.
 *
 * Authored by the localisation lane (L-LANG-CATALOG-ECON-AR-CLOSURE-1,
 * `02-ECONOMY-CATALOGUE.json`), transcribed mechanically in `en` field order so the
 * two diff line for line. All 83 fields present — `EconomyStrings` is a total
 * interface, so the compiler is the completeness gate.
 */
const de: EconomyStrings = {
  nav: 'Wirtschaft',
  attentionTitle: 'Zu beachten',
  attentionRankNote: 'attentionRank · ordnet Subjekte',
  watchTitle: 'Beobachtung',
  watchNextStep: 'Beobachtung und nächster Schritt',
  indicatorsTitle: 'Indikatoren',
  miniMapTitle: 'Geografie',
  miniMapExpand: 'Für die Kartenansicht erweitern',
  seriesLabel: 'Reihe',
  actual: 'Ist',
  expected: 'Erwartet',
  previous: 'Vorwert',
  surprise: 'Überraschung',
  hudTitle: 'Verankertes HUD',
  hudDismiss: 'Esc',
  hudZeroAi: 'Vorberechnete Metadaten · keine KI',
  drawerClose: 'Schließen',
  revisionTrackTitle: 'Schublade · Revisionsverlauf',
  competingReadingsTitle: 'Schublade · konkurrierende Lesarten',
  sharedObservationBase: 'Gemeinsame Beobachtungsbasis',
  assessmentTitle: 'GlobalNewsAI-Bewertung',
  chainTitle: 'Schublade · ökonomische Beziehungskette',
  timelineTitle: 'Schublade · Zeitleiste',
  watchConfigTitle: 'Schublade · Beobachtungskonfiguration',
  notifyOn: 'Benachrichtigen bei',
  basketNote: 'Ein konfigurierter Warenkorb, aufgeschlüsselt dargestellt. Kein einzelner Wirtschaftswert.',
  corridorRouteSupported: 'Routengeometrie unterstützt',
  corridorDegraded: 'Eingeschränkt — nur Endpunkte',
  noObservationTitle: 'Keine Beobachtungsdaten',
  noObservationBody: 'Für diese Reihe ist keine Beobachtungsquelle angebunden. GlobalNewsAI zeigt hier nichts an statt eines Wertes, für den es nicht einstehen kann.',
  noObservationAxes: 'Veröffentlichungsstatus, Wertart und Aktualität beschreiben eine Beobachtung. Ohne Beobachtung trifft keines der drei zu.',
  noObservationStructure: 'Die Struktur unten ist aktiv und füllt sich, sobald eine Quelle angebunden ist. Die Zahlen fehlen, sie sind nicht null.',
  fixtureBannerTitle: 'Testdaten — keine Produktionsfakten',
  fixtureBannerBody: 'Jede Zahl in diesem Rahmen ist eine deterministische Testeingabe zum Nachweis von Layout und Interaktion. Es ist keine produktive Beobachtungsquelle angebunden.',
  workspaceTitle: 'Analyse-Arbeitsbereich',
  askAiTitle: 'KI fragen',
  askAiOpeningFree: 'Abgerechnet wird die Frage, nicht das Öffnen',
  costDisclosure: 'Kosten werden vor der Ausführung angezeigt',
  remainingAllowance: 'Verbleibend',
  on: 'Ein',
  off: 'Aus',
  wasPriorState: 'Zuvor',
  changeState: {
    NEW: 'Neu',
    NEW_EVIDENCE: 'Neue Belege',
    SIGNIFICANT_CHANGE: 'Wesentliche Änderung',
    DEVELOPING: 'In Entwicklung',
    DISPUTED: 'Umstritten',
    STABLE: 'Stabil',
    NO_MATERIAL_CHANGE: 'Keine wesentliche Änderung',
  },
  confidence: {
    HIGH: 'Hohe Konfidenz',
    MODERATE: 'Mittlere Konfidenz',
    LOW: 'Geringe Konfidenz',
  },
  releaseStatus: {
    SCHEDULED: 'Geplant',
    PRELIMINARY: 'Vorl.',
    REVISED: 'Rev.',
    FINAL: 'Endgültig',
    WITHDRAWN: 'Zurückgez.',
  },
  valueKind: {
    ACTUAL: 'Ist',
    FORECAST: 'Prog.',
    DERIVED: 'Abgeleit.',
    TARGET: 'Ziel',
  },
  freshness: {
    FRESH: 'Aktuell',
    AGEING: 'Veraltend',
    STALE: 'Stand',
    UNDETERMINED: 'Takt unbekannt',
  },
  gapReason: {
    NOT_COLLECTED: 'Nicht erhoben',
    WITHHELD: 'Zurückgehalten',
    DISCONTINUED: 'Eingestellt',
    NO_PRODUCER: 'Kein Produzent',
  },
  sourceClass: {
    STATISTICAL_RELEASE: 'Amtliche Statistik',
    POLICY_DECISION_RECORD: 'Amtlicher Beschluss',
    FORECAST_PUBLICATION: 'Institutionelle Prognose',
    REPORTING_ON_ECONOMY: 'Berichterstattung / Analyse',
  },
  relation: {
    ORIGIN_OF: 'Ursprung von',
    ASSOCIATED_WITH: 'verbunden mit',
    CONTRIBUTES_TO: 'trägt bei zu',
    EXPOSURE_THROUGH: 'Exposition über',
    POTENTIAL_TRANSMISSION_CHANNEL: 'möglicher Übertragungskanal',
  },
  watchTrigger: {
    NEW_RELEASE: 'Neue Veröffentlichung',
    REVISED: 'Revision',
    SIGNIFICANT_CHANGE: 'Wesentliche Änderung',
    NEW_EVIDENCE: 'Neue Belege',
    POLICY_RESPONSE: 'Wirtschaftspolitische Reaktion',
  },
};

/**
 * LANG-CATALOG-IMPLEMENT-1-R1 — Spanish Economy strings.
 *
 * Authored by the localisation lane (L-LANG-CATALOG-ECON-AR-CLOSURE-1,
 * `02-ECONOMY-CATALOGUE.json`), transcribed mechanically in `en` field order so the
 * two diff line for line. All 83 fields present — `EconomyStrings` is a total
 * interface, so the compiler is the completeness gate.
 */
const es: EconomyStrings = {
  nav: 'Economía',
  attentionTitle: 'Atención',
  attentionRankNote: 'attentionRank · ordena los asuntos',
  watchTitle: 'Seguimiento',
  watchNextStep: 'Seguimiento y paso siguiente',
  indicatorsTitle: 'Indicadores',
  miniMapTitle: 'Geografía',
  miniMapExpand: 'Ampliar a la vista de mapa',
  seriesLabel: 'Serie',
  actual: 'Real',
  expected: 'Esperado',
  previous: 'Anterior',
  surprise: 'Sorpresa',
  hudTitle: 'HUD anclado',
  hudDismiss: 'Esc',
  hudZeroAi: 'Metadatos precalculados · cero IA',
  drawerClose: 'Cerrar',
  revisionTrackTitle: 'Cajón · historial de revisiones',
  competingReadingsTitle: 'Cajón · lecturas contrapuestas',
  sharedObservationBase: 'Base de observación compartida',
  assessmentTitle: 'Valoración de GlobalNewsAI',
  chainTitle: 'Cajón · cadena de relaciones económicas',
  timelineTitle: 'Cajón · cronología',
  watchConfigTitle: 'Cajón · configuración del seguimiento',
  notifyOn: 'Notificar en caso de',
  basketNote: 'Una cesta configurada, mostrada desglosada. No es un único valor de la economía.',
  corridorRouteSupported: 'Geometría de la ruta admitida',
  corridorDegraded: 'Degradado — solo los extremos',
  noObservationTitle: 'Sin datos de observación',
  noObservationBody: 'No hay ninguna fuente de observación conectada para esta serie. GlobalNewsAI no muestra nada aquí en lugar de un valor del que no puede responder.',
  noObservationAxes: 'El estado de publicación, el tipo de valor y la actualidad describen una observación. Sin observación, ninguno de los tres es aplicable.',
  noObservationStructure: 'La estructura de abajo está activa y se rellenará cuando se conecte una fuente. Las cifras están ausentes, no son cero.',
  fixtureBannerTitle: 'Datos de prueba — no son hechos de producción',
  fixtureBannerBody: 'Cada cifra de este marco es una entrada de prueba determinista para verificar la maquetación y la interacción. No hay conectada ninguna fuente de observación de producción.',
  workspaceTitle: 'Espacio de trabajo de análisis',
  askAiTitle: 'Preguntar a la IA',
  askAiOpeningFree: 'Lo que se cobra es la pregunta, no abrirlo',
  costDisclosure: 'El costo se muestra antes de ejecutarse',
  remainingAllowance: 'Restante',
  on: 'Activado',
  off: 'Desactivado',
  wasPriorState: 'Antes',
  changeState: {
    NEW: 'Nuevo',
    NEW_EVIDENCE: 'Nuevas evidencias',
    SIGNIFICANT_CHANGE: 'Cambio significativo',
    DEVELOPING: 'En desarrollo',
    DISPUTED: 'Disputado',
    STABLE: 'Estable',
    NO_MATERIAL_CHANGE: 'Sin cambios significativos',
  },
  confidence: {
    HIGH: 'Confianza alta',
    MODERATE: 'Confianza moderada',
    LOW: 'Confianza baja',
  },
  releaseStatus: {
    SCHEDULED: 'Program.',
    PRELIMINARY: 'Prelim.',
    REVISED: 'Rev.',
    FINAL: 'Definitivo',
    WITHDRAWN: 'Retirado',
  },
  valueKind: {
    ACTUAL: 'Real',
    FORECAST: 'Prev.',
    DERIVED: 'Derivado',
    TARGET: 'Objetivo',
  },
  freshness: {
    FRESH: 'Actual',
    AGEING: 'Envejece',
    STALE: 'A fecha de',
    UNDETERMINED: 'Cadencia desc.',
  },
  gapReason: {
    NOT_COLLECTED: 'No recopilado',
    WITHHELD: 'Retenido',
    DISCONTINUED: 'Descontinuado',
    NO_PRODUCER: 'Sin productor',
  },
  sourceClass: {
    STATISTICAL_RELEASE: 'Estadística oficial',
    POLICY_DECISION_RECORD: 'Decisión oficial',
    FORECAST_PUBLICATION: 'Previsión institucional',
    REPORTING_ON_ECONOMY: 'Reportaje / análisis',
  },
  relation: {
    ORIGIN_OF: 'origen de',
    ASSOCIATED_WITH: 'asociado con',
    CONTRIBUTES_TO: 'contribuye a',
    EXPOSURE_THROUGH: 'exposición a través de',
    POTENTIAL_TRANSMISSION_CHANNEL: 'canal de transmisión potencial',
  },
  watchTrigger: {
    NEW_RELEASE: 'Nueva publicación',
    REVISED: 'Revisión',
    SIGNIFICANT_CHANGE: 'Cambio significativo',
    NEW_EVIDENCE: 'Nuevas evidencias',
    POLICY_RESPONSE: 'Respuesta de política económica',
  },
};

/**
 * LANG-CATALOG-IMPLEMENT-1-R1 — Portuguese Economy strings.
 *
 * Authored by the localisation lane (L-LANG-CATALOG-ECON-AR-CLOSURE-1,
 * `02-ECONOMY-CATALOGUE.json`), transcribed mechanically in `en` field order so the
 * two diff line for line. All 83 fields present — `EconomyStrings` is a total
 * interface, so the compiler is the completeness gate.
 */
const pt: EconomyStrings = {
  nav: 'Economia',
  attentionTitle: 'Atenção',
  attentionRankNote: 'attentionRank · ordena os assuntos',
  watchTitle: 'Acompanhamento',
  watchNextStep: 'Acompanhamento e próximo passo',
  indicatorsTitle: 'Indicadores',
  miniMapTitle: 'Geografia',
  miniMapExpand: 'Expandir para a vista de mapa',
  seriesLabel: 'Série',
  actual: 'Real',
  expected: 'Esperado',
  previous: 'Anterior',
  surprise: 'Surpresa',
  hudTitle: 'HUD ancorado',
  hudDismiss: 'Esc',
  hudZeroAi: 'Metadados pré-calculados · zero IA',
  drawerClose: 'Fechar',
  revisionTrackTitle: 'Gaveta · histórico de revisões',
  competingReadingsTitle: 'Gaveta · leituras concorrentes',
  sharedObservationBase: 'Base de observação comum',
  assessmentTitle: 'Avaliação de GlobalNewsAI',
  chainTitle: 'Gaveta · cadeia de relações na economia',
  timelineTitle: 'Gaveta · cronologia',
  watchConfigTitle: 'Gaveta · configuração do acompanhamento',
  notifyOn: 'Notificar em caso de',
  basketNote: 'Um conjunto configurado, apresentado decomposto. Não é um valor único da economia.',
  corridorRouteSupported: 'Geometria da rota suportada',
  corridorDegraded: 'Degradado — apenas os extremos',
  noObservationTitle: 'Sem dados de observação',
  noObservationBody: 'Não há nenhuma fonte de observação conectada para esta série. GlobalNewsAI não mostra nada aqui em vez de um valor pelo qual não pode responder.',
  noObservationAxes: 'O estado de publicação, o tipo de valor e a atualidade descrevem uma observação. Sem observação, nenhum dos três se aplica.',
  noObservationStructure: 'A estrutura abaixo está ativa e será preenchida quando uma fonte for conectada. Os números estão ausentes, não são zero.',
  fixtureBannerTitle: 'Dados de teste — não são dados de produção reais',
  fixtureBannerBody: 'Cada número deste enquadramento é uma entrada de teste determinista para verificar o layout e a interação. Não há nenhuma fonte de observação de produção conectada.',
  workspaceTitle: 'Espaço de trabalho de análise',
  askAiTitle: 'Perguntar à IA',
  askAiOpeningFree: 'O que é cobrado é a pergunta, não a abertura',
  costDisclosure: 'O custo é mostrado antes da execução',
  remainingAllowance: 'Restante',
  on: 'Ativado',
  off: 'Desativado',
  wasPriorState: 'Antes',
  changeState: {
    NEW: 'Novo',
    NEW_EVIDENCE: 'Novas evidências',
    SIGNIFICANT_CHANGE: 'Mudança significativa',
    DEVELOPING: 'Em desenvolvimento',
    DISPUTED: 'Contestado',
    STABLE: 'Estável',
    NO_MATERIAL_CHANGE: 'Sem mudança significativa',
  },
  confidence: {
    HIGH: 'Confiança alta',
    MODERATE: 'Confiança moderada',
    LOW: 'Confiança baixa',
  },
  releaseStatus: {
    SCHEDULED: 'Agendado',
    PRELIMINARY: 'Prelim.',
    REVISED: 'Rev.',
    FINAL: 'Definitivo',
    WITHDRAWN: 'Retirado',
  },
  valueKind: {
    ACTUAL: 'Real',
    FORECAST: 'Prev.',
    DERIVED: 'Derivado',
    TARGET: 'Meta',
  },
  freshness: {
    FRESH: 'Atual',
    AGEING: 'Envelhece',
    STALE: 'Na data de',
    UNDETERMINED: 'Cadência desc.',
  },
  gapReason: {
    NOT_COLLECTED: 'Não apurado',
    WITHHELD: 'Retido',
    DISCONTINUED: 'Descontinuado',
    NO_PRODUCER: 'Sem produtor',
  },
  sourceClass: {
    STATISTICAL_RELEASE: 'Estatística oficial',
    POLICY_DECISION_RECORD: 'Decisão oficial',
    FORECAST_PUBLICATION: 'Previsão institucional',
    REPORTING_ON_ECONOMY: 'Reportagem / análise',
  },
  relation: {
    ORIGIN_OF: 'origem de',
    ASSOCIATED_WITH: 'associado a',
    CONTRIBUTES_TO: 'contribui para',
    EXPOSURE_THROUGH: 'exposição através de',
    POTENTIAL_TRANSMISSION_CHANNEL: 'canal de transmissão potencial',
  },
  watchTrigger: {
    NEW_RELEASE: 'Nova publicação',
    REVISED: 'Revisão',
    SIGNIFICANT_CHANGE: 'Mudança significativa',
    NEW_EVIDENCE: 'Novas evidências',
    POLICY_RESPONSE: 'Resposta de política pública',
  },
};

/**
 * LANG-CATALOG-IMPLEMENT-1-R1 — Arabic Economy strings.
 *
 * Authored by the localisation lane (L-LANG-CATALOG-ECON-AR-CLOSURE-1,
 * `02-ECONOMY-CATALOGUE.json`), transcribed mechanically in `en` field order so the
 * two diff line for line. All 83 fields present — `EconomyStrings` is a total
 * interface, so the compiler is the completeness gate.
 * `releaseStatus.REVISED` (مراجَع, adjective) and `watchTrigger.REVISED`
 * (مراجعة, noun) are DIFFERENT WORDS ON PURPOSE. They are different enum
 * members playing different grammatical roles — one describes a release, the other
 * names a trigger. DO NOT UNIFY THEM.
 */
const ar: EconomyStrings = {
  nav: 'الاقتصاد',
  attentionTitle: 'يستدعي الانتباه',
  attentionRankNote: 'attentionRank · يرتّب المواضيع',
  watchTitle: 'الرصد',
  watchNextStep: 'الرصد والخطوة التالية',
  indicatorsTitle: 'المؤشرات',
  miniMapTitle: 'الجغرافيا',
  miniMapExpand: 'وسّع لعرض الخريطة',
  seriesLabel: 'السلسلة',
  actual: 'الفعلي',
  expected: 'المتوقَّع',
  previous: 'السابق',
  surprise: 'المفاجأة',
  hudTitle: 'لوحة HUD مثبَّتة',
  hudDismiss: 'Esc',
  hudZeroAi: 'بيانات وصفية محسوبة مسبقًا · بلا ذكاء اصطناعي',
  drawerClose: 'إغلاق',
  revisionTrackTitle: 'اللوحة الجانبية · سجل المراجعات',
  competingReadingsTitle: 'اللوحة الجانبية · قراءات متعارضة',
  sharedObservationBase: 'قاعدة رصد مشتركة',
  assessmentTitle: 'تقييم GlobalNewsAI',
  chainTitle: 'اللوحة الجانبية · سلسلة العلاقات الاقتصادية',
  timelineTitle: 'اللوحة الجانبية · الخط الزمني',
  watchConfigTitle: 'اللوحة الجانبية · إعداد الرصد',
  notifyOn: 'التنبيه عند',
  basketNote: 'سلة مُعدّة، تُعرض مفصَّلة. وليست قيمة اقتصادية واحدة.',
  corridorRouteSupported: 'هندسة المسار مدعومة',
  corridorDegraded: 'محدود — نقاط النهاية فقط',
  noObservationTitle: 'لا توجد بيانات رصد',
  noObservationBody: 'لا يوجد مصدر رصد متصل بهذه السلسلة. ولا تعرض GlobalNewsAI هنا شيئًا بدلًا من قيمة لا تستطيع ضمانها.',
  noObservationAxes: 'حالة الإصدار ونوع القيمة والحداثة تصف الرصد. وبلا رصد، لا ينطبق أي من الثلاثة.',
  noObservationStructure: 'البنية أدناه فعّالة وستُملأ عند توصيل مصدر. الأرقام غائبة، وليست أصفارًا.',
  fixtureBannerTitle: 'بيانات اختبارية — وليست وقائع إنتاجية',
  fixtureBannerBody: 'كل رقم في هذا الإطار مُدخَل اختباري حتمي لإثبات التخطيط والتفاعل. ولا يوجد مصدر رصد إنتاجي متصل.',
  workspaceTitle: 'مساحة عمل التحليل',
  askAiTitle: 'اسأل الذكاء',
  askAiOpeningFree: 'المحاسَبة على السؤال، لا على الفتح',
  costDisclosure: 'تُعرض التكلفة قبل التنفيذ',
  remainingAllowance: 'المتبقي',
  on: 'مُفعَّل',
  off: 'مُعطَّل',
  wasPriorState: 'كان',
  changeState: {
    NEW: 'جديد',
    NEW_EVIDENCE: 'أدلة جديدة',
    SIGNIFICANT_CHANGE: 'تغيّر جوهري',
    DEVELOPING: 'قيد التطور',
    DISPUTED: 'متنازع عليه',
    STABLE: 'مستقر',
    NO_MATERIAL_CHANGE: 'لا تغيّر جوهري',
  },
  confidence: {
    HIGH: 'ثقة عالية',
    MODERATE: 'ثقة متوسطة',
    LOW: 'ثقة منخفضة',
  },
  releaseStatus: {
    SCHEDULED: 'مجدول',
    PRELIMINARY: 'أولي',
    REVISED: 'مراجَع',
    FINAL: 'نهائي',
    WITHDRAWN: 'مسحوب',
  },
  valueKind: {
    ACTUAL: 'الفعلي',
    FORECAST: 'توقّع',
    DERIVED: 'مشتق',
    TARGET: 'مستهدف',
  },
  freshness: {
    FRESH: 'حديث',
    AGEING: 'يتقادم',
    STALE: 'حتى تاريخ',
    UNDETERMINED: 'الوتيرة غير معروفة',
  },
  gapReason: {
    NOT_COLLECTED: 'غير مجموع',
    WITHHELD: 'محجوب',
    DISCONTINUED: 'موقوف',
    NO_PRODUCER: 'لا جهة منتِجة',
  },
  sourceClass: {
    STATISTICAL_RELEASE: 'إحصاء رسمي',
    POLICY_DECISION_RECORD: 'قرار رسمي',
    FORECAST_PUBLICATION: 'توقّع مؤسسي',
    REPORTING_ON_ECONOMY: 'تغطية / تحليل',
  },
  relation: {
    ORIGIN_OF: 'منشأ',
    ASSOCIATED_WITH: 'مرتبط',
    CONTRIBUTES_TO: 'يسهم في',
    EXPOSURE_THROUGH: 'تعرّض عبر',
    POTENTIAL_TRANSMISSION_CHANNEL: 'قناة انتقال محتملة',
  },
  watchTrigger: {
    NEW_RELEASE: 'إصدار جديد',
    REVISED: 'مراجعة',
    SIGNIFICANT_CHANGE: 'تغيّر جوهري',
    NEW_EVIDENCE: 'أدلة جديدة',
    POLICY_RESPONSE: 'استجابة السياسة الاقتصادية',
  },
};

/**
 * LANG-CATALOG-IMPLEMENT-1-R1 — ALL SEVEN CONTRACTED LOCALES ARE NOW AUTHORED.
 *
 * The fold this file's own header promised — "when LANG-UI-7 promotes, this catalogue
 * folds into the shared dictionaries as one move" — is discharged here in the form the
 * localisation lane delivered it: 83 fields × 6 new locales, registered in the SAME
 * catalogue through the SAME accessor. No second Economy localisation architecture was
 * created, no call site changed, and `resolveEconomyStrings` is untouched.
 *
 * `economyLocalesAwaitingContent()` now returns `[]` — not because the report was
 * removed, but because there is nothing left to report.
 */
const ECONOMY_CATALOGUE: Partial<Record<EconomyLocale, EconomyStrings>> = {
  en,
  pl,
  fr,
  de,
  es,
  pt,
  ar,
};

export interface EconomyStringsResolution {
  readonly strings: EconomyStrings;
  readonly requested: EconomyLocale;
  readonly resolved: EconomyLocale;
  readonly fellBack: boolean;
}

/** Resolution with the fallback made visible, never silent. */
export function resolveEconomyStrings(locale: EconomyLocale): EconomyStringsResolution {
  const found = ECONOMY_CATALOGUE[locale];
  if (found) return { strings: found, requested: locale, resolved: locale, fellBack: false };
  return { strings: en, requested: locale, resolved: 'en', fellBack: true };
}

/** The value accessor every component uses. One fallback decision, defined above. */
export function economyStrings(locale: EconomyLocale): EconomyStrings {
  return resolveEconomyStrings(locale).strings;
}

/** Contracted locales with no authored Economy content yet. Reported, not hidden. */
export function economyLocalesAwaitingContent(locales: readonly EconomyLocale[]): EconomyLocale[] {
  return locales.filter((l) => ECONOMY_CATALOGUE[l] === undefined);
}

/*
  ASK R3 PROGRESS R1 — the research-progress copy of Claude Design R3 (ProgressPanel.dc.html,
  ask-data.js `single` stage, PROGRESS_MOTION_SPEC.md). EN verbatim from the package:
  "Search activity · {n} step|steps", "Show" / "Hide", the status words "In progress" /
  "Completed" / "Not completed", the completion "Answer ready", and the reduced-motion
  "In progress ·" prefix. The running line itself stays the existing qualified `r2s.working`
  until ruling 7 ("…your question…" vs "…your answer…") is made. PL / DE / FR / ES / PT / AR are
  Claude Code DRAFTS until Claude L qualifies them.
*/
import type { DisplayLocale } from '@globalnews-ai/shared';

export interface AskProgressStrings {
  readonly group: string;
  readonly collapsed: (steps: number) => string;
  readonly show: string;
  readonly hide: string;
  readonly inProgress: string;
  readonly completed: string;
  readonly answerReady: string;
  /* ASK R3 RESEARCH ACTIVITY R1 — recorded search outcomes (R3 wording where the package has it) */
  readonly partlyCompleted: string;
  readonly notCompleted: string;
  readonly sourcesSearched: string;
  readonly someSourcesSearched: string;
  readonly couldNotFinish: string;
  readonly earlierReviewed: string;
  readonly noNewSearch: string;
  readonly noMatch: string;
  readonly filtered: string;
  readonly unreached: (lanes: string) => string;
  /* R1.1 (CTO review) — an attempted search with no typed outcome; a completed request ≠ a verified answer */
  readonly searchAttemptedUnknown: string;
  readonly outcomeUnavailable: string;
  readonly requestCompleted: string;
  readonly noVerifiedAnswer: string;
  readonly noAnswerProduced: string;
  readonly someEvidenceMissing: string;
}

const EN: AskProgressStrings = {
  group: 'Search activity',
  collapsed: (n) => `Search activity · ${n} ${n === 1 ? 'step' : 'steps'}`,
  show: 'Show',
  hide: 'Hide',
  inProgress: 'In progress',
  completed: 'Completed',
  answerReady: 'Answer ready',
  partlyCompleted: 'Partly completed',
  notCompleted: 'Not completed',
  sourcesSearched: 'Sources searched',
  someSourcesSearched: 'Some sources searched',
  couldNotFinish: 'Could not finish searching sources',
  earlierReviewed: 'Earlier sources reviewed',
  noNewSearch: 'No new search was made.',
  noMatch: 'No matching reports were found.',
  filtered: 'Reports were found, but none matched the question closely enough.',
  unreached: (l) => `Not reached: ${l}.`,
  searchAttemptedUnknown: 'Search attempted; detailed retrieval outcome unavailable.',
  outcomeUnavailable: 'Outcome unavailable',
  requestCompleted: 'Request completed',
  noVerifiedAnswer: 'No verified answer from current reporting.',
  noAnswerProduced: 'No answer was produced',
  someEvidenceMissing: 'Some required evidence is missing.',
};
const PL: AskProgressStrings = {
  group: 'Przebieg wyszukiwania',
  collapsed: (n) => `Przebieg wyszukiwania · kroki: ${n}`,
  show: 'Pokaż',
  hide: 'Ukryj',
  inProgress: 'W toku',
  completed: 'Zakończono',
  answerReady: 'Odpowiedź gotowa',
  partlyCompleted: 'Częściowo zakończono',
  notCompleted: 'Nie zakończono',
  sourcesSearched: 'Przeszukano źródła',
  someSourcesSearched: 'Przeszukano część źródeł',
  couldNotFinish: 'Nie udało się dokończyć przeszukiwania źródeł',
  earlierReviewed: 'Przejrzano wcześniejsze źródła',
  noNewSearch: 'Nie wykonano nowego wyszukiwania.',
  noMatch: 'Nie znaleziono pasujących doniesień.',
  filtered: 'Znaleziono doniesienia, ale żadne nie odpowiadało wystarczająco pytaniu.',
  unreached: (l) => `Niedostępne: ${l}.`,
  searchAttemptedUnknown: 'Podjęto wyszukiwanie; szczegółowy wynik wyszukiwania jest niedostępny.',
  outcomeUnavailable: 'Wynik niedostępny',
  requestCompleted: 'Zapytanie zakończone',
  noVerifiedAnswer: 'Brak zweryfikowanej odpowiedzi na podstawie bieżących doniesień.',
  noAnswerProduced: 'Nie powstała odpowiedź',
  someEvidenceMissing: 'Brakuje części wymaganych dowodów.',
};
const DE: AskProgressStrings = {
  group: 'Suchverlauf',
  collapsed: (n) => `Suchverlauf · ${n} ${n === 1 ? 'Schritt' : 'Schritte'}`,
  show: 'Anzeigen',
  hide: 'Ausblenden',
  inProgress: 'In Arbeit',
  completed: 'Abgeschlossen',
  answerReady: 'Antwort bereit',
  partlyCompleted: 'Teilweise abgeschlossen',
  notCompleted: 'Nicht abgeschlossen',
  sourcesSearched: 'Quellen durchsucht',
  someSourcesSearched: 'Einige Quellen durchsucht',
  couldNotFinish: 'Die Suche in den Quellen konnte nicht abgeschlossen werden',
  earlierReviewed: 'Frühere Quellen geprüft',
  noNewSearch: 'Es wurde keine neue Suche durchgeführt.',
  noMatch: 'Es wurden keine passenden Berichte gefunden.',
  filtered: 'Es wurden Berichte gefunden, aber keiner passte genau genug zur Frage.',
  unreached: (l) => `Nicht erreicht: ${l}.`,
  searchAttemptedUnknown: 'Suche versucht; das genaue Suchergebnis ist nicht verfügbar.',
  outcomeUnavailable: 'Ergebnis nicht verfügbar',
  requestCompleted: 'Anfrage abgeschlossen',
  noVerifiedAnswer: 'Keine verifizierte Antwort aus aktueller Berichterstattung.',
  noAnswerProduced: 'Es wurde keine Antwort erstellt',
  someEvidenceMissing: 'Einige erforderliche Belege fehlen.',
};
const FR: AskProgressStrings = {
  group: 'Activité de recherche',
  collapsed: (n) => `Activité de recherche · ${n} ${n === 1 ? 'étape' : 'étapes'}`,
  show: 'Afficher',
  hide: 'Masquer',
  inProgress: 'En cours',
  completed: 'Terminé',
  answerReady: 'Réponse prête',
  partlyCompleted: 'Partiellement terminé',
  notCompleted: 'Non terminé',
  sourcesSearched: 'Sources consultées',
  someSourcesSearched: 'Certaines sources consultées',
  couldNotFinish: 'Impossible de terminer la recherche dans les sources',
  earlierReviewed: 'Sources précédentes réexaminées',
  noNewSearch: 'Aucune nouvelle recherche n’a été effectuée.',
  noMatch: 'Aucun article correspondant n’a été trouvé.',
  filtered: 'Des articles ont été trouvés, mais aucun ne correspondait assez à la question.',
  unreached: (l) => `Non joignables : ${l}.`,
  searchAttemptedUnknown: 'Recherche tentée ; le résultat détaillé de la recherche n’est pas disponible.',
  outcomeUnavailable: 'Résultat indisponible',
  requestCompleted: 'Demande traitée',
  noVerifiedAnswer: 'Aucune réponse vérifiée à partir d’articles récents.',
  noAnswerProduced: 'Aucune réponse n’a été produite',
  someEvidenceMissing: 'Certaines preuves requises manquent.',
};
const ES: AskProgressStrings = {
  group: 'Actividad de búsqueda',
  collapsed: (n) => `Actividad de búsqueda · ${n} ${n === 1 ? 'paso' : 'pasos'}`,
  show: 'Mostrar',
  hide: 'Ocultar',
  inProgress: 'En curso',
  completed: 'Completado',
  answerReady: 'Respuesta lista',
  partlyCompleted: 'Completado en parte',
  notCompleted: 'No completado',
  sourcesSearched: 'Fuentes consultadas',
  someSourcesSearched: 'Algunas fuentes consultadas',
  couldNotFinish: 'No se pudo terminar la búsqueda en las fuentes',
  earlierReviewed: 'Fuentes anteriores revisadas',
  noNewSearch: 'No se hizo una nueva búsqueda.',
  noMatch: 'No se encontraron informes coincidentes.',
  filtered: 'Se encontraron informes, pero ninguno coincidía lo suficiente con la pregunta.',
  unreached: (l) => `Sin respuesta: ${l}.`,
  searchAttemptedUnknown: 'Se intentó la búsqueda; el resultado detallado de la búsqueda no está disponible.',
  outcomeUnavailable: 'Resultado no disponible',
  requestCompleted: 'Solicitud completada',
  noVerifiedAnswer: 'No hay una respuesta verificada a partir de informes actuales.',
  noAnswerProduced: 'No se produjo ninguna respuesta',
  someEvidenceMissing: 'Falta parte de la evidencia necesaria.',
};
const PT: AskProgressStrings = {
  group: 'Atividade de pesquisa',
  collapsed: (n) => `Atividade de pesquisa · ${n} ${n === 1 ? 'etapa' : 'etapas'}`,
  show: 'Mostrar',
  hide: 'Ocultar',
  inProgress: 'Em andamento',
  completed: 'Concluído',
  answerReady: 'Resposta pronta',
  partlyCompleted: 'Concluído em parte',
  notCompleted: 'Não concluído',
  sourcesSearched: 'Fontes pesquisadas',
  someSourcesSearched: 'Algumas fontes pesquisadas',
  couldNotFinish: 'Não foi possível concluir a pesquisa nas fontes',
  earlierReviewed: 'Fontes anteriores revistas',
  noNewSearch: 'Nenhuma nova pesquisa foi feita.',
  noMatch: 'Nenhuma notícia correspondente foi encontrada.',
  filtered: 'Foram encontradas notícias, mas nenhuma correspondia o suficiente à pergunta.',
  unreached: (l) => `Sem resposta: ${l}.`,
  searchAttemptedUnknown: 'Pesquisa tentada; o resultado detalhado da pesquisa não está disponível.',
  outcomeUnavailable: 'Resultado indisponível',
  requestCompleted: 'Pedido concluído',
  noVerifiedAnswer: 'Não há resposta verificada a partir de notícias atuais.',
  noAnswerProduced: 'Nenhuma resposta foi produzida',
  someEvidenceMissing: 'Falta parte das evidências necessárias.',
};
const AR: AskProgressStrings = {
  group: 'نشاط البحث',
  collapsed: (n) => `نشاط البحث · عدد الخطوات: ${n}`,
  show: 'إظهار',
  hide: 'إخفاء',
  inProgress: 'قيد التنفيذ',
  completed: 'اكتمل',
  answerReady: 'الإجابة جاهزة',
  partlyCompleted: 'اكتمل جزئيًا',
  notCompleted: 'لم يكتمل',
  sourcesSearched: 'تم البحث في المصادر',
  someSourcesSearched: 'تم البحث في بعض المصادر',
  couldNotFinish: 'تعذّر إكمال البحث في المصادر',
  earlierReviewed: 'تمت مراجعة المصادر السابقة',
  noNewSearch: 'لم يُجرَ بحث جديد.',
  noMatch: 'لم يُعثر على تقارير مطابقة.',
  filtered: 'عُثر على تقارير، لكن لم يطابق أيٌّ منها السؤال بما يكفي.',
  unreached: (l) => `تعذّر الوصول: ${l}.`,
  searchAttemptedUnknown: 'جرت محاولة البحث؛ النتيجة التفصيلية للبحث غير متاحة.',
  outcomeUnavailable: 'النتيجة غير متاحة',
  requestCompleted: 'اكتمل الطلب',
  noVerifiedAnswer: 'لا توجد إجابة موثَّقة من التقارير الحالية.',
  noAnswerProduced: 'لم تُنتَج أي إجابة',
  someEvidenceMissing: 'بعض الأدلة المطلوبة مفقودة.',
};

const BY_LOCALE: Readonly<Record<string, AskProgressStrings>> = { en: EN, pl: PL, de: DE, fr: FR, es: ES, pt: PT, ar: AR };
export const ASK_PROGRESS_LOCALES = ['en', 'pl', 'de', 'fr', 'es', 'pt', 'ar'] as const;

export function askProgressStrings(locale: DisplayLocale | string): AskProgressStrings {
  return BY_LOCALE[String(locale).slice(0, 2)] ?? EN;
}

/** Only EN is design-sourced; the rest are drafts until Claude L qualifies them. */
export function askProgressStringsQualified(locale: DisplayLocale | string): boolean {
  return String(locale).slice(0, 2) === 'en';
}

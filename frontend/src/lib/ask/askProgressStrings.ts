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
}

const EN: AskProgressStrings = {
  group: 'Search activity',
  collapsed: (n) => `Search activity · ${n} ${n === 1 ? 'step' : 'steps'}`,
  show: 'Show',
  hide: 'Hide',
  inProgress: 'In progress',
  completed: 'Completed',
  answerReady: 'Answer ready',
};
const PL: AskProgressStrings = {
  group: 'Przebieg wyszukiwania',
  collapsed: (n) => `Przebieg wyszukiwania · kroki: ${n}`,
  show: 'Pokaż',
  hide: 'Ukryj',
  inProgress: 'W toku',
  completed: 'Zakończono',
  answerReady: 'Odpowiedź gotowa',
};
const DE: AskProgressStrings = {
  group: 'Suchverlauf',
  collapsed: (n) => `Suchverlauf · ${n} ${n === 1 ? 'Schritt' : 'Schritte'}`,
  show: 'Anzeigen',
  hide: 'Ausblenden',
  inProgress: 'In Arbeit',
  completed: 'Abgeschlossen',
  answerReady: 'Antwort bereit',
};
const FR: AskProgressStrings = {
  group: 'Activité de recherche',
  collapsed: (n) => `Activité de recherche · ${n} ${n === 1 ? 'étape' : 'étapes'}`,
  show: 'Afficher',
  hide: 'Masquer',
  inProgress: 'En cours',
  completed: 'Terminé',
  answerReady: 'Réponse prête',
};
const ES: AskProgressStrings = {
  group: 'Actividad de búsqueda',
  collapsed: (n) => `Actividad de búsqueda · ${n} ${n === 1 ? 'paso' : 'pasos'}`,
  show: 'Mostrar',
  hide: 'Ocultar',
  inProgress: 'En curso',
  completed: 'Completado',
  answerReady: 'Respuesta lista',
};
const PT: AskProgressStrings = {
  group: 'Atividade de pesquisa',
  collapsed: (n) => `Atividade de pesquisa · ${n} ${n === 1 ? 'etapa' : 'etapas'}`,
  show: 'Mostrar',
  hide: 'Ocultar',
  inProgress: 'Em andamento',
  completed: 'Concluído',
  answerReady: 'Resposta pronta',
};
const AR: AskProgressStrings = {
  group: 'نشاط البحث',
  collapsed: (n) => `نشاط البحث · عدد الخطوات: ${n}`,
  show: 'إظهار',
  hide: 'إخفاء',
  inProgress: 'قيد التنفيذ',
  completed: 'اكتمل',
  answerReady: 'الإجابة جاهزة',
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

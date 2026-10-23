import type { DisplayLocale } from '@globalnews-ai/shared';

/**
 * ASK R3 · D09 — CHANGE DETAIL (Before / Latest of ONE recorded check). New strings only; the
 * outcome names, the partial / correction / earlier-found notes and the structured-record notes are
 * REUSED from followStrings so one fact never has two wordings.
 *
 * EN is exact. PL, DE, FR, ES, PT and AR are DRAFTS by the Claude Code implementation lane —
 * DRAFT_PENDING_CLAUDE_L: Claude L to qualify or replace them.
 *
 * Wording rules (CTO, 2026-10-10): no "reviewed" state exists, so nothing here says or implies
 * reviewed / unread; new reporting is never presented as a change to the answer; a missing or
 * unreadable version is said plainly and nothing is compared.
 */
export interface FollowComparisonStrings {
  /** My updates → the change detail of one recorded check. */
  readonly compareLink: string;
  readonly checkOf: (when: string) => string;
  readonly before: string;
  readonly latest: string;
  readonly versionRecorded: (version: number, when: string) => string;
  readonly noText: string;
  readonly sources: string;
  /* truthful statuses — nothing is compared in any of these */
  readonly checkNotFound: string;
  readonly noBaseline: string;
  readonly noResult: string;
  readonly sameVersion: string;
  readonly beforeUnavailable: string;
  readonly latestUnavailable: string;
  readonly beforeWithheld: string;
  readonly latestWithheld: string;
  readonly loading: string;
  /* incomplete check */
  readonly incompleteNote: string;
  /* actual changes vs new reporting */
  readonly changesHeading: string;
  readonly changesNote: string;
  readonly noChanges: string;
  readonly newReportingHeading: string;
  readonly newReportingNote: string;
}

const en: FollowComparisonStrings = {
  compareLink: 'Compare with your earlier answer',
  checkOf: (when) => `Check of ${when}`,
  before: 'Before',
  latest: 'Latest',
  versionRecorded: (version, when) => `Version ${version} · recorded ${when}`,
  noText: 'No answer text was stored for this version.',
  sources: 'Sources',
  checkNotFound: 'This check is no longer recorded, so there is nothing to compare.',
  noBaseline: 'No earlier answer was recorded for this check, so there is nothing to compare it with.',
  noResult: 'This check did not record a new answer, so there is no latest version to compare.',
  sameVersion: 'This check kept the same saved answer, so there is no difference to show.',
  beforeUnavailable: 'The earlier version could not be loaded. Nothing is compared.',
  latestUnavailable: 'The latest version could not be loaded. Nothing is compared.',
  beforeWithheld: 'The earlier version is withheld for source rights. Its text is not shown, and nothing is compared.',
  latestWithheld: 'The latest version is withheld for source rights. Its text is not shown, and nothing is compared.',
  loading: 'Loading the two versions…',
  incompleteNote:
    'This check did not finish. What is shown is not a complete comparison, and it does not mean nothing else changed.',
  changesHeading: 'Changes in the latest answer',
  changesNote: 'Points of the latest answer that cite reporting published after your earlier answer.',
  noChanges: 'The latest answer makes no point that cites reporting published after your earlier answer.',
  newReportingHeading: 'New reporting',
  newReportingNote:
    'Published after your earlier answer. Listed for you to read; on its own it is not a change to the answer.',
};

/* DRAFT_PENDING_CLAUDE_L */
const pl: FollowComparisonStrings = {
  compareLink: 'Porównaj z wcześniejszą odpowiedzią',
  checkOf: (when) => `Sprawdzenie z ${when}`,
  before: 'Wcześniej',
  latest: 'Najnowsza',
  versionRecorded: (version, when) => `Wersja ${version} · zapisana ${when}`,
  noText: 'Dla tej wersji nie zapisano tekstu odpowiedzi.',
  sources: 'Źródła',
  checkNotFound: 'To sprawdzenie nie jest już zapisane, więc nie ma czego porównać.',
  noBaseline: 'Dla tego sprawdzenia nie zapisano wcześniejszej odpowiedzi, więc nie ma z czym porównać.',
  noResult: 'To sprawdzenie nie zapisało nowej odpowiedzi, więc nie ma najnowszej wersji do porównania.',
  sameVersion: 'To sprawdzenie zachowało tę samą zapisaną odpowiedź, więc nie ma różnicy do pokazania.',
  beforeUnavailable: 'Nie udało się wczytać wcześniejszej wersji. Nic nie jest porównywane.',
  latestUnavailable: 'Nie udało się wczytać najnowszej wersji. Nic nie jest porównywane.',
  beforeWithheld: 'Wcześniejsza wersja jest wstrzymana z powodu praw do źródeł. Jej tekst nie jest pokazywany i nic nie jest porównywane.',
  latestWithheld: 'Najnowsza wersja jest wstrzymana z powodu praw do źródeł. Jej tekst nie jest pokazywany i nic nie jest porównywane.',
  loading: 'Wczytywanie obu wersji…',
  incompleteNote:
    'To sprawdzenie nie zostało ukończone. To, co widać, nie jest pełnym porównaniem i nie oznacza, że nic innego się nie zmieniło.',
  changesHeading: 'Zmiany w najnowszej odpowiedzi',
  changesNote: 'Punkty najnowszej odpowiedzi, które powołują się na doniesienia opublikowane po wcześniejszej odpowiedzi.',
  noChanges: 'Najnowsza odpowiedź nie zawiera punktu opartego na doniesieniach opublikowanych po wcześniejszej odpowiedzi.',
  newReportingHeading: 'Nowe doniesienia',
  newReportingNote:
    'Opublikowane po wcześniejszej odpowiedzi. Do przeczytania; same w sobie nie są zmianą odpowiedzi.',
};

/* DRAFT_PENDING_CLAUDE_L */
const de: FollowComparisonStrings = {
  compareLink: 'Mit Ihrer früheren Antwort vergleichen',
  checkOf: (when) => `Prüfung vom ${when}`,
  before: 'Vorher',
  latest: 'Neueste',
  versionRecorded: (version, when) => `Version ${version} · gespeichert ${when}`,
  noText: 'Für diese Version wurde kein Antworttext gespeichert.',
  sources: 'Quellen',
  checkNotFound: 'Diese Prüfung ist nicht mehr gespeichert, daher gibt es nichts zu vergleichen.',
  noBaseline: 'Für diese Prüfung wurde keine frühere Antwort gespeichert, daher gibt es nichts zum Vergleichen.',
  noResult: 'Diese Prüfung hat keine neue Antwort gespeichert, daher gibt es keine neueste Version zum Vergleichen.',
  sameVersion: 'Diese Prüfung hat dieselbe gespeicherte Antwort behalten, daher gibt es keinen Unterschied.',
  beforeUnavailable: 'Die frühere Version konnte nicht geladen werden. Es wird nichts verglichen.',
  latestUnavailable: 'Die neueste Version konnte nicht geladen werden. Es wird nichts verglichen.',
  beforeWithheld: 'Die frühere Version ist aus Quellenrechten zurückgehalten. Ihr Text wird nicht gezeigt, und es wird nichts verglichen.',
  latestWithheld: 'Die neueste Version ist aus Quellenrechten zurückgehalten. Ihr Text wird nicht gezeigt, und es wird nichts verglichen.',
  loading: 'Die beiden Versionen werden geladen…',
  incompleteNote:
    'Diese Prüfung wurde nicht abgeschlossen. Das Gezeigte ist kein vollständiger Vergleich und bedeutet nicht, dass sich sonst nichts geändert hat.',
  changesHeading: 'Änderungen in der neuesten Antwort',
  changesNote: 'Punkte der neuesten Antwort, die sich auf Berichte stützen, die nach Ihrer früheren Antwort erschienen sind.',
  noChanges: 'Die neueste Antwort enthält keinen Punkt, der sich auf Berichte nach Ihrer früheren Antwort stützt.',
  newReportingHeading: 'Neue Berichte',
  newReportingNote:
    'Nach Ihrer früheren Antwort erschienen. Zum Lesen aufgeführt; für sich genommen keine Änderung der Antwort.',
};

/* DRAFT_PENDING_CLAUDE_L */
const fr: FollowComparisonStrings = {
  compareLink: 'Comparer avec votre réponse précédente',
  checkOf: (when) => `Vérification du ${when}`,
  before: 'Avant',
  latest: 'Dernière',
  versionRecorded: (version, when) => `Version ${version} · enregistrée le ${when}`,
  noText: 'Aucun texte de réponse n’a été enregistré pour cette version.',
  sources: 'Sources',
  checkNotFound: 'Cette vérification n’est plus enregistrée ; il n’y a donc rien à comparer.',
  noBaseline: 'Aucune réponse précédente n’a été enregistrée pour cette vérification ; il n’y a donc rien à comparer.',
  noResult: 'Cette vérification n’a pas enregistré de nouvelle réponse ; il n’y a donc pas de dernière version à comparer.',
  sameVersion: 'Cette vérification a conservé la même réponse enregistrée ; il n’y a donc aucune différence à montrer.',
  beforeUnavailable: 'La version précédente n’a pas pu être chargée. Rien n’est comparé.',
  latestUnavailable: 'La dernière version n’a pas pu être chargée. Rien n’est comparé.',
  beforeWithheld: 'La version précédente est retenue pour des raisons de droits des sources. Son texte n’est pas affiché et rien n’est comparé.',
  latestWithheld: 'La dernière version est retenue pour des raisons de droits des sources. Son texte n’est pas affiché et rien n’est comparé.',
  loading: 'Chargement des deux versions…',
  incompleteNote:
    'Cette vérification n’a pas abouti. Ce qui est affiché n’est pas une comparaison complète et ne signifie pas que rien d’autre n’a changé.',
  changesHeading: 'Changements dans la dernière réponse',
  changesNote: 'Points de la dernière réponse qui citent des articles publiés après votre réponse précédente.',
  noChanges: 'La dernière réponse ne contient aucun point citant des articles publiés après votre réponse précédente.',
  newReportingHeading: 'Nouveaux articles',
  newReportingNote:
    'Publiés après votre réponse précédente. Listés pour lecture ; à eux seuls, ils ne changent pas la réponse.',
};

/* DRAFT_PENDING_CLAUDE_L */
const es: FollowComparisonStrings = {
  compareLink: 'Comparar con tu respuesta anterior',
  checkOf: (when) => `Comprobación del ${when}`,
  before: 'Antes',
  latest: 'Más reciente',
  versionRecorded: (version, when) => `Versión ${version} · guardada el ${when}`,
  noText: 'No se guardó texto de respuesta para esta versión.',
  sources: 'Fuentes',
  checkNotFound: 'Esta comprobación ya no está registrada, así que no hay nada que comparar.',
  noBaseline: 'No se guardó una respuesta anterior para esta comprobación, así que no hay con qué comparar.',
  noResult: 'Esta comprobación no guardó una respuesta nueva, así que no hay versión reciente que comparar.',
  sameVersion: 'Esta comprobación mantuvo la misma respuesta guardada, así que no hay diferencia que mostrar.',
  beforeUnavailable: 'No se pudo cargar la versión anterior. No se compara nada.',
  latestUnavailable: 'No se pudo cargar la versión más reciente. No se compara nada.',
  beforeWithheld: 'La versión anterior está retenida por derechos de las fuentes. Su texto no se muestra y no se compara nada.',
  latestWithheld: 'La versión más reciente está retenida por derechos de las fuentes. Su texto no se muestra y no se compara nada.',
  loading: 'Cargando las dos versiones…',
  incompleteNote:
    'Esta comprobación no terminó. Lo que se muestra no es una comparación completa y no significa que nada más haya cambiado.',
  changesHeading: 'Cambios en la respuesta más reciente',
  changesNote: 'Puntos de la respuesta más reciente que citan noticias publicadas después de tu respuesta anterior.',
  noChanges: 'La respuesta más reciente no incluye ningún punto que cite noticias publicadas después de tu respuesta anterior.',
  newReportingHeading: 'Noticias nuevas',
  newReportingNote:
    'Publicadas después de tu respuesta anterior. Se listan para que las leas; por sí solas no cambian la respuesta.',
};

/* DRAFT_PENDING_CLAUDE_L */
const pt: FollowComparisonStrings = {
  compareLink: 'Comparar com a sua resposta anterior',
  checkOf: (when) => `Verificação de ${when}`,
  before: 'Antes',
  latest: 'Mais recente',
  versionRecorded: (version, when) => `Versão ${version} · guardada em ${when}`,
  noText: 'Não foi guardado texto de resposta para esta versão.',
  sources: 'Fontes',
  checkNotFound: 'Esta verificação já não está registada, por isso não há nada a comparar.',
  noBaseline: 'Não foi guardada uma resposta anterior para esta verificação, por isso não há com que comparar.',
  noResult: 'Esta verificação não guardou uma nova resposta, por isso não há versão mais recente a comparar.',
  sameVersion: 'Esta verificação manteve a mesma resposta guardada, por isso não há diferença a mostrar.',
  beforeUnavailable: 'Não foi possível carregar a versão anterior. Nada é comparado.',
  latestUnavailable: 'Não foi possível carregar a versão mais recente. Nada é comparado.',
  beforeWithheld: 'A versão anterior está retida por direitos das fontes. O texto não é mostrado e nada é comparado.',
  latestWithheld: 'A versão mais recente está retida por direitos das fontes. O texto não é mostrado e nada é comparado.',
  loading: 'A carregar as duas versões…',
  incompleteNote:
    'Esta verificação não terminou. O que é mostrado não é uma comparação completa e não significa que nada mais mudou.',
  changesHeading: 'Alterações na resposta mais recente',
  changesNote: 'Pontos da resposta mais recente que citam notícias publicadas depois da sua resposta anterior.',
  noChanges: 'A resposta mais recente não tem nenhum ponto que cite notícias publicadas depois da sua resposta anterior.',
  newReportingHeading: 'Notícias novas',
  newReportingNote:
    'Publicadas depois da sua resposta anterior. Listadas para leitura; por si só não alteram a resposta.',
};

/* DRAFT_PENDING_CLAUDE_L */
const ar: FollowComparisonStrings = {
  compareLink: 'قارن بإجابتك السابقة',
  checkOf: (when) => `تحقق بتاريخ ${when}`,
  before: 'قبل',
  latest: 'الأحدث',
  versionRecorded: (version, when) => `الإصدار ${version} · سُجّل في ${when}`,
  noText: 'لم يُحفظ نص إجابة لهذا الإصدار.',
  sources: 'المصادر',
  checkNotFound: 'لم يعد هذا التحقق مسجّلًا، فلا يوجد ما يُقارن.',
  noBaseline: 'لم تُسجَّل إجابة سابقة لهذا التحقق، فلا يوجد ما يُقارن به.',
  noResult: 'لم يسجّل هذا التحقق إجابة جديدة، فلا يوجد إصدار أحدث للمقارنة.',
  sameVersion: 'أبقى هذا التحقق الإجابة المحفوظة نفسها، فلا يوجد فرق لعرضه.',
  beforeUnavailable: 'تعذّر تحميل الإصدار السابق. لا تُجرى أي مقارنة.',
  latestUnavailable: 'تعذّر تحميل الإصدار الأحدث. لا تُجرى أي مقارنة.',
  beforeWithheld: 'الإصدار السابق محجوب بسبب حقوق المصادر. لا يُعرض نصه ولا تُجرى أي مقارنة.',
  latestWithheld: 'الإصدار الأحدث محجوب بسبب حقوق المصادر. لا يُعرض نصه ولا تُجرى أي مقارنة.',
  loading: 'جارٍ تحميل الإصدارين…',
  incompleteNote: 'لم يكتمل هذا التحقق. ما يُعرض ليس مقارنة كاملة، ولا يعني أن شيئًا آخر لم يتغيّر.',
  changesHeading: 'تغييرات في الإجابة الأحدث',
  changesNote: 'نقاط في الإجابة الأحدث تستند إلى تقارير نُشرت بعد إجابتك السابقة.',
  noChanges: 'لا تتضمن الإجابة الأحدث أي نقطة تستند إلى تقارير نُشرت بعد إجابتك السابقة.',
  newReportingHeading: 'تقارير جديدة',
  newReportingNote: 'نُشرت بعد إجابتك السابقة. مدرجة للقراءة؛ وهي وحدها ليست تغييرًا في الإجابة.',
};

const BY_LOCALE: Readonly<Record<DisplayLocale, FollowComparisonStrings>> = Object.freeze({
  en,
  pl,
  de,
  fr,
  es,
  pt,
  ar,
} as Record<DisplayLocale, FollowComparisonStrings>);

/** The locales whose wording here is still a Claude Code draft awaiting Claude L. */
export const FOLLOW_COMPARISON_DRAFT_LOCALES: readonly DisplayLocale[] = Object.freeze([
  'pl',
  'de',
  'fr',
  'es',
  'pt',
  'ar',
] as DisplayLocale[]);

export function followComparisonStrings(locale: DisplayLocale | string): FollowComparisonStrings {
  return (BY_LOCALE as Record<string, FollowComparisonStrings | undefined>)[locale] ?? en;
}

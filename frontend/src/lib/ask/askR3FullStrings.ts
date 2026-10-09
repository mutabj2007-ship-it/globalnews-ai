/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R3 FULL DESIGN R1 — COPY FOR THE R1-C WELCOME, THE OPTIONAL JOB ENTRY AND R3 STATES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * EN is verbatim from Claude Design's R3 package (WELCOME_PLACEHOLDER_SPEC.md and HANDOFF.md §6
 * copy deck; AskPrototype.dc.html for the job sheet labels). The six other locales are Claude Code
 * DRAFTS so no reader is shown English chrome, NOT yet qualified by Claude L:
 * `askR3FullStringsQualified(locale)` is false for them until Claude L replaces these objects. The
 * review packet is Claude_Output/ASK-R3-FULL-SOURCE-RECOVERY/CLAUDE-L-REVIEW-R3-FULL.md.
 *
 * Truth rules: the coverage-focus line is an ORIENTATION statement, never a claim that a place has
 * reporting or job coverage; the job outcome never reads as "no jobs"; nothing here carries a count.
 */
export interface AskR3FullStrings {
  /** WELCOME_PLACEHOLDER_SPEC §Composition 4. */
  readonly welcomeSupport: string;
  /** D02 signed in without a verified name (HANDOFF §6 "Welcome back"). */
  readonly welcomeBack: string;
  /** §Composition 8 — the visible regions, and the screen-reader prefix before them. */
  readonly coverageFocusLabel: string;
  readonly coverageRegions: string;
  /** D02 resume group. */
  readonly resumeGroupLabel: string;
  readonly resume: string;
  /** J01 entry and setup sheet. */
  readonly jobEntry: string;
  readonly jobIntro: string;
  readonly jobRoleLabel: string;
  readonly jobRolePlaceholder: string;
  readonly jobPlaceLabel: string;
  readonly jobPlacePlaceholder: string;
  readonly jobPlaceHelp: string;
  readonly jobMoreFilters: string;
  readonly jobHideFilters: string;
  readonly jobWorkType: string;
  readonly jobWorkTypes: readonly [string, string, string, string];
  readonly jobExperience: string;
  readonly jobLevels: readonly [string, string, string, string];
  readonly jobNeedsPlace: string;
  readonly jobSearch: string;
  readonly jobBoundary: string;
  /** J06-unsupported: the truthful outcome while Ask checks no job sources. */
  readonly jobUnsupported: (place: string) => string;
  readonly jobNotNoJobs: (place: string) => string;
  readonly jobGeneralHint: string;
  readonly jobChangePlace: string;
  readonly jobAskGeneral: string;
  readonly close: string;
  /** D15-savefail (HANDOFF §10 / prototype TOASTS.savefail). */
  readonly saveFailed: string;
  readonly retry: string;
  /** D12-delete dialog and D06 More (HANDOFF §10: Delete conversation). */
  readonly deleteTitle: string;
  readonly keep: string;
  readonly deleteConversationAction: string;
  /** D13 Preferences heading (prototype VIEW_SUB.profile 'Preferences'). */
  readonly preferencesHeading: string;
  /** D14 'How updates are checked' (prototype vSchedule). Manual only; the rest is labelled later. */
  readonly howChecked: string;
  readonly whenToCheck: string;
  readonly whenIChoose: string;
  readonly whenIChooseNote: string;
  readonly dailyLater: string;
  readonly dailyLaterNote: string;
  readonly weeklyLater: string;
  readonly notAvailableYet: string;
  readonly whereUpdates: string;
  readonly inMyUpdates: string;
  readonly emailLater: string;
  readonly pushLater: string;
  readonly plansHeading: string;
  readonly plansNote: string;
}

const EN: AskR3FullStrings = {
  welcomeSupport: 'See what changed in the questions that matter to you, with evidence.',
  welcomeBack: 'Welcome back',
  coverageFocusLabel: 'Coverage focus: ',
  coverageRegions: 'Europe · East Africa · Middle East',
  resumeGroupLabel: 'Pick up where you left off',
  resume: 'Resume',
  jobEntry: 'Job opportunities',
  jobIntro:
    'Search job listings from the sources Ask checks. Nothing runs until you choose Search. You can also just type your question in the box.',
  jobRoleLabel: 'Job, role or keywords',
  jobRolePlaceholder: 'For example, accountant',
  jobPlaceLabel: 'City or country',
  jobPlacePlaceholder: 'For example, Kigali or Poland',
  jobPlaceHelp: 'The place you type decides where Ask looks. Some places aren’t covered yet; Ask will tell you.',
  jobMoreFilters: 'More filters',
  jobHideFilters: 'Hide filters',
  jobWorkType: 'Work type',
  jobWorkTypes: ['Any', 'On-site', 'Hybrid', 'Remote'],
  jobExperience: 'Experience',
  jobLevels: ['Any', 'Entry level', 'Mid level', 'Senior'],
  jobNeedsPlace: 'Add a city or country to search.',
  jobSearch: 'Search opportunities',
  jobBoundary: 'Ask doesn’t apply for you, share your details with employers, or guess your right to work.',
  jobUnsupported: (place) => `Ask doesn’t check job sources for ${place} yet.`,
  jobNotNoJobs: (place) =>
    `This isn’t a “no jobs” result. Nothing was searched for ${place}, so Ask can’t show listings there.`,
  jobGeneralHint:
    'You can still ask general questions, for example about work permits or living costs, answered from news and public sources.',
  jobChangePlace: 'Change place',
  jobAskGeneral: 'Ask a general question',
  close: 'Close',
  saveFailed: 'Couldn’t save. Check your connection and try again.',
  retry: 'Retry',
  deleteTitle: 'Delete this conversation?',
  keep: 'Keep',
  deleteConversationAction: 'Delete conversation',
  preferencesHeading: 'Preferences',
  howChecked: 'How updates are checked',
  whenToCheck: 'When to check',
  whenIChoose: 'When I choose',
  whenIChooseNote: 'Use Check for changes in My updates.',
  dailyLater: 'Daily · coming later',
  dailyLaterNote: 'Not available yet. Nothing will be checked automatically.',
  weeklyLater: 'Weekly · coming later',
  notAvailableYet: 'Not available yet.',
  whereUpdates: 'Where updates appear',
  inMyUpdates: 'In My updates',
  emailLater: 'Email · coming later',
  pushLater: 'Push notification · coming later',
  plansHeading: 'Monitoring plans',
  plansNote: 'Scheduled checks may become part of a plan later. Nothing is for sale yet.',
};

/* ── Claude Code DRAFTS — pending Claude L qualification ───────────────────── */

const PL: AskR3FullStrings = {
  welcomeSupport: 'Zobacz, co się zmieniło w ważnych dla Ciebie pytaniach — z dowodami.',
  welcomeBack: 'Witaj ponownie',
  coverageFocusLabel: 'Główny obszar relacji: ',
  coverageRegions: 'Europa · Afryka Wschodnia · Bliski Wschód',
  resumeGroupLabel: 'Kontynuuj tam, gdzie skończyłeś',
  resume: 'Wróć do rozmowy',
  jobEntry: 'Oferty pracy',
  jobIntro:
    'Szukaj ofert pracy w źródłach, które sprawdza Ask. Nic się nie uruchomi, dopóki nie wybierzesz Szukaj. Możesz też po prostu wpisać pytanie w polu.',
  jobRoleLabel: 'Praca, stanowisko lub słowa kluczowe',
  jobRolePlaceholder: 'Na przykład: księgowy',
  jobPlaceLabel: 'Miasto lub kraj',
  jobPlacePlaceholder: 'Na przykład: Kigali lub Polska',
  jobPlaceHelp: 'Wpisane miejsce decyduje, gdzie Ask szuka. Niektóre miejsca nie są jeszcze objęte; Ask Cię o tym poinformuje.',
  jobMoreFilters: 'Więcej filtrów',
  jobHideFilters: 'Ukryj filtry',
  jobWorkType: 'Rodzaj pracy',
  jobWorkTypes: ['Dowolny', 'Na miejscu', 'Hybrydowo', 'Zdalnie'],
  jobExperience: 'Doświadczenie',
  jobLevels: ['Dowolne', 'Początkujący', 'Średni poziom', 'Senior'],
  jobNeedsPlace: 'Dodaj miasto lub kraj, aby wyszukać.',
  jobSearch: 'Szukaj ofert',
  jobBoundary: 'Ask nie aplikuje za Ciebie, nie przekazuje Twoich danych pracodawcom i nie zgaduje Twojego prawa do pracy.',
  jobUnsupported: (place) => `Ask nie sprawdza jeszcze źródeł ofert pracy dla: ${place}.`,
  jobNotNoJobs: (place) =>
    `To nie jest wynik „brak ofert”. Dla miejsca ${place} nic nie zostało przeszukane, więc Ask nie może pokazać ofert.`,
  jobGeneralHint:
    'Nadal możesz zadawać ogólne pytania, na przykład o pozwolenia na pracę lub koszty życia, z odpowiedziami na podstawie wiadomości i źródeł publicznych.',
  jobChangePlace: 'Zmień miejsce',
  jobAskGeneral: 'Zadaj ogólne pytanie',
  close: 'Zamknij',
  saveFailed: 'Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie.',
  retry: 'Ponów',
  deleteTitle: 'Usunąć tę rozmowę?',
  keep: 'Zachowaj',
  deleteConversationAction: 'Usuń rozmowę',
  preferencesHeading: 'Preferencje',
  howChecked: 'Jak sprawdzane są aktualizacje',
  whenToCheck: 'Kiedy sprawdzać',
  whenIChoose: 'Kiedy zdecyduję',
  whenIChooseNote: 'Użyj opcji Sprawdź zmiany w Moich aktualizacjach.',
  dailyLater: 'Codziennie · wkrótce',
  dailyLaterNote: 'Jeszcze niedostępne. Nic nie będzie sprawdzane automatycznie.',
  weeklyLater: 'Co tydzień · wkrótce',
  notAvailableYet: 'Jeszcze niedostępne.',
  whereUpdates: 'Gdzie pojawiają się aktualizacje',
  inMyUpdates: 'W Moich aktualizacjach',
  emailLater: 'E-mail · wkrótce',
  pushLater: 'Powiadomienie push · wkrótce',
  plansHeading: 'Plany monitorowania',
  plansNote: 'Zaplanowane sprawdzenia mogą później stać się częścią planu. Na razie nic nie jest w sprzedaży.',
};

const DE: AskR3FullStrings = {
  welcomeSupport: 'Sehen Sie, was sich bei den Fragen geändert hat, die Ihnen wichtig sind – mit Belegen.',
  welcomeBack: 'Willkommen zurück',
  coverageFocusLabel: 'Berichtsschwerpunkt: ',
  coverageRegions: 'Europa · Ostafrika · Naher Osten',
  resumeGroupLabel: 'Dort weitermachen, wo Sie aufgehört haben',
  resume: 'Fortsetzen',
  jobEntry: 'Stellenangebote',
  jobIntro:
    'Durchsuchen Sie Stellenanzeigen aus den Quellen, die Ask prüft. Nichts startet, bevor Sie Suchen wählen. Sie können Ihre Frage auch einfach ins Feld schreiben.',
  jobRoleLabel: 'Beruf, Stelle oder Stichwörter',
  jobRolePlaceholder: 'Zum Beispiel: Buchhalter',
  jobPlaceLabel: 'Stadt oder Land',
  jobPlacePlaceholder: 'Zum Beispiel: Kigali oder Polen',
  jobPlaceHelp: 'Der eingegebene Ort bestimmt, wo Ask sucht. Manche Orte sind noch nicht abgedeckt; Ask sagt es Ihnen.',
  jobMoreFilters: 'Weitere Filter',
  jobHideFilters: 'Filter ausblenden',
  jobWorkType: 'Arbeitsform',
  jobWorkTypes: ['Beliebig', 'Vor Ort', 'Hybrid', 'Remote'],
  jobExperience: 'Erfahrung',
  jobLevels: ['Beliebig', 'Einstieg', 'Mittlere Ebene', 'Senior'],
  jobNeedsPlace: 'Geben Sie eine Stadt oder ein Land ein, um zu suchen.',
  jobSearch: 'Stellen suchen',
  jobBoundary: 'Ask bewirbt sich nicht für Sie, gibt Ihre Daten nicht an Arbeitgeber weiter und rät nicht, ob Sie arbeiten dürfen.',
  jobUnsupported: (place) => `Ask prüft für ${place} noch keine Stellenquellen.`,
  jobNotNoJobs: (place) =>
    `Das ist kein Ergebnis „keine Stellen“. Für ${place} wurde nichts durchsucht, daher kann Ask dort keine Anzeigen zeigen.`,
  jobGeneralHint:
    'Sie können weiterhin allgemeine Fragen stellen, etwa zu Arbeitserlaubnissen oder Lebenshaltungskosten, beantwortet aus Nachrichten und öffentlichen Quellen.',
  jobChangePlace: 'Ort ändern',
  jobAskGeneral: 'Allgemeine Frage stellen',
  close: 'Schließen',
  saveFailed: 'Speichern fehlgeschlagen. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
  retry: 'Erneut versuchen',
  deleteTitle: 'Diese Unterhaltung löschen?',
  keep: 'Behalten',
  deleteConversationAction: 'Unterhaltung löschen',
  preferencesHeading: 'Einstellungen',
  howChecked: 'Wie Updates geprüft werden',
  whenToCheck: 'Wann prüfen',
  whenIChoose: 'Wenn ich es auswähle',
  whenIChooseNote: 'Nutzen Sie „Auf Änderungen prüfen“ in „Meine Updates“.',
  dailyLater: 'Täglich · folgt später',
  dailyLaterNote: 'Noch nicht verfügbar. Es wird nichts automatisch geprüft.',
  weeklyLater: 'Wöchentlich · folgt später',
  notAvailableYet: 'Noch nicht verfügbar.',
  whereUpdates: 'Wo Updates erscheinen',
  inMyUpdates: 'In „Meine Updates“',
  emailLater: 'E-Mail · folgt später',
  pushLater: 'Push-Benachrichtigung · folgt später',
  plansHeading: 'Überwachungspläne',
  plansNote: 'Geplante Prüfungen können später Teil eines Plans werden. Derzeit wird nichts verkauft.',
};

const FR: AskR3FullStrings = {
  welcomeSupport: 'Voyez ce qui a changé dans les questions qui comptent pour vous, preuves à l’appui.',
  welcomeBack: 'Bon retour',
  coverageFocusLabel: 'Zones couvertes en priorité : ',
  coverageRegions: 'Europe · Afrique de l’Est · Moyen-Orient',
  resumeGroupLabel: 'Reprendre là où vous en étiez',
  resume: 'Reprendre',
  jobEntry: 'Offres d’emploi',
  jobIntro:
    'Cherchez des offres d’emploi dans les sources que Ask consulte. Rien ne se lance avant que vous choisissiez Rechercher. Vous pouvez aussi simplement écrire votre question dans le champ.',
  jobRoleLabel: 'Emploi, poste ou mots-clés',
  jobRolePlaceholder: 'Par exemple : comptable',
  jobPlaceLabel: 'Ville ou pays',
  jobPlacePlaceholder: 'Par exemple : Kigali ou Pologne',
  jobPlaceHelp: 'Le lieu saisi détermine où Ask cherche. Certains lieux ne sont pas encore couverts ; Ask vous le dira.',
  jobMoreFilters: 'Plus de filtres',
  jobHideFilters: 'Masquer les filtres',
  jobWorkType: 'Type de travail',
  jobWorkTypes: ['Indifférent', 'Sur site', 'Hybride', 'À distance'],
  jobExperience: 'Expérience',
  jobLevels: ['Indifférent', 'Débutant', 'Intermédiaire', 'Senior'],
  jobNeedsPlace: 'Ajoutez une ville ou un pays pour lancer la recherche.',
  jobSearch: 'Rechercher des offres',
  jobBoundary: 'Ask ne postule pas à votre place, ne transmet pas vos informations aux employeurs et ne devine pas votre droit de travailler.',
  jobUnsupported: (place) => `Ask ne consulte pas encore de sources d’offres d’emploi pour ${place}.`,
  jobNotNoJobs: (place) =>
    `Ce n’est pas un résultat « aucune offre ». Rien n’a été recherché pour ${place}, donc Ask ne peut pas y afficher d’offres.`,
  jobGeneralHint:
    'Vous pouvez toujours poser des questions générales, par exemple sur les permis de travail ou le coût de la vie, avec des réponses tirées de l’actualité et de sources publiques.',
  jobChangePlace: 'Changer de lieu',
  jobAskGeneral: 'Poser une question générale',
  close: 'Fermer',
  saveFailed: 'Impossible d’enregistrer. Vérifiez votre connexion et réessayez.',
  retry: 'Réessayer',
  deleteTitle: 'Supprimer cette conversation ?',
  keep: 'Conserver',
  deleteConversationAction: 'Supprimer la conversation',
  preferencesHeading: 'Préférences',
  howChecked: 'Comment les mises à jour sont vérifiées',
  whenToCheck: 'Quand vérifier',
  whenIChoose: 'Quand je le décide',
  whenIChooseNote: 'Utilisez Vérifier les changements dans Mes mises à jour.',
  dailyLater: 'Chaque jour · bientôt disponible',
  dailyLaterNote: 'Pas encore disponible. Rien ne sera vérifié automatiquement.',
  weeklyLater: 'Chaque semaine · bientôt disponible',
  notAvailableYet: 'Pas encore disponible.',
  whereUpdates: 'Où les mises à jour apparaissent',
  inMyUpdates: 'Dans Mes mises à jour',
  emailLater: 'E-mail · bientôt disponible',
  pushLater: 'Notification push · bientôt disponible',
  plansHeading: 'Formules de suivi',
  plansNote: 'Les vérifications programmées pourront faire partie d’une formule plus tard. Rien n’est en vente pour l’instant.',
};

const ES: AskR3FullStrings = {
  welcomeSupport: 'Mira qué ha cambiado en las preguntas que te importan, con pruebas.',
  welcomeBack: 'Hola de nuevo',
  coverageFocusLabel: 'Cobertura prioritaria: ',
  coverageRegions: 'Europa · África Oriental · Oriente Medio',
  resumeGroupLabel: 'Continúa donde lo dejaste',
  resume: 'Continuar',
  jobEntry: 'Ofertas de empleo',
  jobIntro:
    'Busca ofertas de empleo en las fuentes que consulta Ask. No se ejecuta nada hasta que elijas Buscar. También puedes escribir tu pregunta en el cuadro.',
  jobRoleLabel: 'Empleo, puesto o palabras clave',
  jobRolePlaceholder: 'Por ejemplo, contable',
  jobPlaceLabel: 'Ciudad o país',
  jobPlacePlaceholder: 'Por ejemplo, Kigali o Polonia',
  jobPlaceHelp: 'El lugar que escribas decide dónde busca Ask. Algunos lugares aún no están cubiertos; Ask te lo dirá.',
  jobMoreFilters: 'Más filtros',
  jobHideFilters: 'Ocultar filtros',
  jobWorkType: 'Tipo de trabajo',
  jobWorkTypes: ['Cualquiera', 'Presencial', 'Híbrido', 'Remoto'],
  jobExperience: 'Experiencia',
  jobLevels: ['Cualquiera', 'Inicial', 'Intermedio', 'Sénior'],
  jobNeedsPlace: 'Añade una ciudad o un país para buscar.',
  jobSearch: 'Buscar ofertas',
  jobBoundary: 'Ask no presenta solicitudes por ti, no comparte tus datos con empleadores ni adivina tu derecho a trabajar.',
  jobUnsupported: (place) => `Ask todavía no consulta fuentes de empleo para ${place}.`,
  jobNotNoJobs: (place) =>
    `Esto no es un resultado de «no hay empleos». No se buscó nada para ${place}, así que Ask no puede mostrar ofertas allí.`,
  jobGeneralHint:
    'Aún puedes hacer preguntas generales, por ejemplo sobre permisos de trabajo o el coste de la vida, respondidas con noticias y fuentes públicas.',
  jobChangePlace: 'Cambiar lugar',
  jobAskGeneral: 'Hacer una pregunta general',
  close: 'Cerrar',
  saveFailed: 'No se pudo guardar. Comprueba tu conexión e inténtalo de nuevo.',
  retry: 'Reintentar',
  deleteTitle: '¿Eliminar esta conversación?',
  keep: 'Conservar',
  deleteConversationAction: 'Eliminar conversación',
  preferencesHeading: 'Preferencias',
  howChecked: 'Cómo se comprueban las actualizaciones',
  whenToCheck: 'Cuándo comprobar',
  whenIChoose: 'Cuando yo lo elija',
  whenIChooseNote: 'Usa Comprobar cambios en Mis actualizaciones.',
  dailyLater: 'A diario · próximamente',
  dailyLaterNote: 'Aún no disponible. No se comprobará nada automáticamente.',
  weeklyLater: 'Semanal · próximamente',
  notAvailableYet: 'Aún no disponible.',
  whereUpdates: 'Dónde aparecen las actualizaciones',
  inMyUpdates: 'En Mis actualizaciones',
  emailLater: 'Correo electrónico · próximamente',
  pushLater: 'Notificación push · próximamente',
  plansHeading: 'Planes de seguimiento',
  plansNote: 'Las comprobaciones programadas podrían formar parte de un plan más adelante. Por ahora no se vende nada.',
};

const PT: AskR3FullStrings = {
  welcomeSupport: 'Veja o que mudou nas perguntas que importam para você, com evidências.',
  welcomeBack: 'Bem-vindo de volta',
  coverageFocusLabel: 'Foco da cobertura: ',
  coverageRegions: 'Europa · África Oriental · Oriente Médio',
  resumeGroupLabel: 'Continue de onde parou',
  resume: 'Retomar',
  jobEntry: 'Vagas de emprego',
  jobIntro:
    'Pesquise vagas nas fontes que o Ask consulta. Nada é executado até você escolher Pesquisar. Você também pode simplesmente digitar sua pergunta na caixa.',
  jobRoleLabel: 'Emprego, cargo ou palavras-chave',
  jobRolePlaceholder: 'Por exemplo, contador',
  jobPlaceLabel: 'Cidade ou país',
  jobPlacePlaceholder: 'Por exemplo, Kigali ou Polônia',
  jobPlaceHelp: 'O lugar que você digitar decide onde o Ask procura. Alguns lugares ainda não são cobertos; o Ask vai avisar.',
  jobMoreFilters: 'Mais filtros',
  jobHideFilters: 'Ocultar filtros',
  jobWorkType: 'Tipo de trabalho',
  jobWorkTypes: ['Qualquer', 'Presencial', 'Híbrido', 'Remoto'],
  jobExperience: 'Experiência',
  jobLevels: ['Qualquer', 'Iniciante', 'Intermediário', 'Sênior'],
  jobNeedsPlace: 'Adicione uma cidade ou um país para pesquisar.',
  jobSearch: 'Pesquisar vagas',
  jobBoundary: 'O Ask não se candidata por você, não compartilha seus dados com empregadores nem supõe seu direito de trabalhar.',
  jobUnsupported: (place) => `O Ask ainda não consulta fontes de vagas para ${place}.`,
  jobNotNoJobs: (place) =>
    `Este não é um resultado de “nenhuma vaga”. Nada foi pesquisado para ${place}, então o Ask não pode mostrar vagas lá.`,
  jobGeneralHint:
    'Você ainda pode fazer perguntas gerais, por exemplo sobre autorizações de trabalho ou custo de vida, respondidas com notícias e fontes públicas.',
  jobChangePlace: 'Mudar o lugar',
  jobAskGeneral: 'Fazer uma pergunta geral',
  close: 'Fechar',
  saveFailed: 'Não foi possível salvar. Verifique sua conexão e tente novamente.',
  retry: 'Tentar de novo',
  deleteTitle: 'Excluir esta conversa?',
  keep: 'Manter',
  deleteConversationAction: 'Excluir conversa',
  preferencesHeading: 'Preferências',
  howChecked: 'Como as atualizações são verificadas',
  whenToCheck: 'Quando verificar',
  whenIChoose: 'Quando eu escolher',
  whenIChooseNote: 'Use Verificar mudanças em Minhas atualizações.',
  dailyLater: 'Diariamente · em breve',
  dailyLaterNote: 'Ainda não disponível. Nada será verificado automaticamente.',
  weeklyLater: 'Semanalmente · em breve',
  notAvailableYet: 'Ainda não disponível.',
  whereUpdates: 'Onde as atualizações aparecem',
  inMyUpdates: 'Em Minhas atualizações',
  emailLater: 'E-mail · em breve',
  pushLater: 'Notificação push · em breve',
  plansHeading: 'Planos de monitoramento',
  plansNote: 'Verificações programadas podem fazer parte de um plano no futuro. Nada está à venda por enquanto.',
};

const AR: AskR3FullStrings = {
  welcomeSupport: 'اطّلع على ما تغيّر في الأسئلة التي تهمّك، مع الأدلة.',
  welcomeBack: 'مرحبًا بعودتك',
  coverageFocusLabel: 'محور التغطية: ',
  coverageRegions: 'أوروبا · شرق أفريقيا · الشرق الأوسط',
  resumeGroupLabel: 'تابِع من حيث توقفت',
  resume: 'متابعة',
  jobEntry: 'فرص العمل',
  jobIntro:
    'ابحث في إعلانات الوظائف من المصادر التي يتحقق منها Ask. لا يبدأ أي شيء حتى تختار «بحث». ويمكنك أيضًا كتابة سؤالك في المربع.',
  jobRoleLabel: 'الوظيفة أو المسمّى أو الكلمات المفتاحية',
  jobRolePlaceholder: 'مثلًا: محاسب',
  jobPlaceLabel: 'المدينة أو البلد',
  jobPlacePlaceholder: 'مثلًا: كيغالي أو بولندا',
  jobPlaceHelp: 'المكان الذي تكتبه يحدد أين يبحث Ask. بعض الأماكن غير مشمولة بعد، وسيخبرك Ask بذلك.',
  jobMoreFilters: 'مزيد من عوامل التصفية',
  jobHideFilters: 'إخفاء عوامل التصفية',
  jobWorkType: 'نوع العمل',
  jobWorkTypes: ['أي نوع', 'في الموقع', 'مختلط', 'عن بُعد'],
  jobExperience: 'الخبرة',
  jobLevels: ['أي مستوى', 'مبتدئ', 'متوسط', 'خبير'],
  jobNeedsPlace: 'أضف مدينة أو بلدًا للبحث.',
  jobSearch: 'ابحث عن فرص',
  jobBoundary: 'لا يتقدّم Ask بطلبات نيابة عنك، ولا يشارك بياناتك مع أصحاب العمل، ولا يخمّن أهليتك للعمل.',
  jobUnsupported: (place) => `لا يتحقق Ask بعد من مصادر الوظائف في ${place}.`,
  jobNotNoJobs: (place) =>
    `هذه ليست نتيجة «لا توجد وظائف». لم يُبحث في ${place}، لذا لا يستطيع Ask عرض إعلانات هناك.`,
  jobGeneralHint:
    'لا يزال بإمكانك طرح أسئلة عامة، مثل تصاريح العمل أو تكاليف المعيشة، تُجاب من الأخبار والمصادر العامة.',
  jobChangePlace: 'تغيير المكان',
  jobAskGeneral: 'اطرح سؤالًا عامًا',
  close: 'إغلاق',
  saveFailed: 'تعذّر الحفظ. تحقّق من اتصالك وحاول مرة أخرى.',
  retry: 'إعادة المحاولة',
  deleteTitle: 'حذف هذه المحادثة؟',
  keep: 'الاحتفاظ بها',
  deleteConversationAction: 'حذف المحادثة',
  preferencesHeading: 'التفضيلات',
  howChecked: 'كيف تُفحص التحديثات',
  whenToCheck: 'متى يتم الفحص',
  whenIChoose: 'عندما أختار',
  whenIChooseNote: 'استخدم «التحقق من التغييرات» في «تحديثاتي».',
  dailyLater: 'يوميًا · قريبًا',
  dailyLaterNote: 'غير متاح بعد. لن يُفحص أي شيء تلقائيًا.',
  weeklyLater: 'أسبوعيًا · قريبًا',
  notAvailableYet: 'غير متاح بعد.',
  whereUpdates: 'أين تظهر التحديثات',
  inMyUpdates: 'في «تحديثاتي»',
  emailLater: 'البريد الإلكتروني · قريبًا',
  pushLater: 'الإشعارات الفورية · قريبًا',
  plansHeading: 'خطط المتابعة',
  plansNote: 'قد تصبح الفحوص المجدولة جزءًا من خطة لاحقًا. لا شيء معروض للبيع حاليًا.',
};

const BY_LOCALE: Readonly<Record<string, AskR3FullStrings>> = { en: EN, pl: PL, de: DE, fr: FR, es: ES, pt: PT, ar: AR };

export function askR3FullStrings(locale: string): AskR3FullStrings {
  return BY_LOCALE[locale] ?? EN;
}

/** False for the six locales whose R3 copy Claude L has not yet qualified (Claude Code drafts). */
export function askR3FullStringsQualified(locale: string): boolean {
  return locale === 'en';
}

export const ASK_R3_FULL_LOCALES = Object.keys(BY_LOCALE);

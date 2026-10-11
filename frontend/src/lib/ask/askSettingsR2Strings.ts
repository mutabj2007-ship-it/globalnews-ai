import type { DisplayLocale } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R3 IA R2 COMPLETION — drawer identity + gear, conversation search, grouped Settings
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Two sources, kept apart so neither is mistaken for the other:
 *
 * 1. DECK keys (`signedInState` … `clearSearch`) — verbatim from Claude Design
 *    `GLOBALNEWSAI-R3-IA-DISCOVER-FINAL-R2.zip` (SHA-256 574fc35b…55e32be8),
 *    `07-COPY-DECK-7-LOCALES.csv`. EN is the qualified source; PL / FR / DE / ES / PT / AR are
 *    Claude Design drafts, PENDING Localisation (Claude L) qualification.
 * 2. INTEGRATOR keys (`accountH` … `privacyNote`, R3.1 `aliasHint`) — labels the frames draw (F06b, F08a, F08d)
 *    but the deck does not list. EN written to the frames; the six other locales are Claude Code
 *    drafts, PENDING the same Claude L qualification. None is presented as qualified.
 */
export interface AskSettingsR2Strings {
  /* deck */
  readonly signedInState: string;
  readonly langApp: string;
  readonly privacyData: string;
  readonly followedH: string;
  readonly updatesNote: string;
  readonly supportLegal: string;
  readonly signOutNote: string;
  readonly guestNote: string;
  readonly acctFail: string;
  readonly retry: string;
  readonly clearSearch: string;
  /* integrator */
  readonly accountH: string;
  readonly emailLabel: string;
  readonly privacyPolicy: string;
  readonly termsOfUse: string;
  /** F06b — the polite result count; the real number of conversations the search matched. */
  readonly conversationsFound: (count: number) => string;
  /** Settings-nav COPY-STRINGS `appearance` (Design draft) */
  readonly appearance: string;
  /** R2 deck `themeSaved` — the Appearance sub-view footnote */
  readonly themeSaved: string;
  /** F08a — the Privacy & data note (drawn; in neither deck: integrator draft) */
  readonly privacyNote: string;
  /**
   * R3.1 FIX 4 — the display-name hint when the account has an automatic alias (integrator draft:
   * EN written for the PO ruling; the six others PENDING Claude L). The alias is wrapped in
   * FSI/PDI so a Latin alias keeps its own direction inside Arabic.
   */
  readonly aliasHint: (a: string) => string;
}

const CATALOGUE: Record<DisplayLocale, AskSettingsR2Strings> = {
  en: {
    signedInState: 'Signed in',
    langApp: 'Language & appearance',
    privacyData: 'Privacy & data',
    followedH: 'Followed questions',
    updatesNote: 'Ask checks a followed question when you choose Check. There are no notifications yet.',
    supportLegal: 'Help & legal',
    signOutNote: 'Signs you out on this device. Your conversations stay in your account.',
    guestNote: 'Sign in to keep your conversations and follow questions.',
    acctFail: 'Your account details could not be loaded. Other settings still work.',
    retry: 'Try again',
    clearSearch: 'Clear search',
    accountH: 'Account',
    emailLabel: 'Email',
    privacyPolicy: 'Privacy policy',
    termsOfUse: 'Terms of use',
    conversationsFound: (n) => (n === 1 ? '1 conversation' : `${n} conversations`),
    appearance: 'Appearance',
    themeSaved: 'Saved on this device.',
    privacyNote: 'Your conversations stay in your account. Delete one from its ⋯ menu in Conversations.',
    aliasHint: (a) =>
      `Your account name is ⁨${a}⁩, made from the first part of your sign-in address. Type the name you prefer, or leave this empty to use ⁨${a}⁩.`,
  },
  pl: {
    signedInState: 'Zalogowano',
    langApp: 'Język i wygląd',
    privacyData: 'Prywatność i dane',
    followedH: 'Obserwowane pytania',
    updatesNote: 'Ask sprawdza obserwowane pytanie, gdy wybierzesz Sprawdź. Powiadomień jeszcze nie ma.',
    supportLegal: 'Pomoc i informacje prawne',
    signOutNote: 'Wylogowuje Cię na tym urządzeniu. Rozmowy pozostają na Twoim koncie.',
    guestNote: 'Zaloguj się, aby zachować rozmowy i obserwować pytania.',
    acctFail: 'Nie udało się wczytać danych konta. Pozostałe ustawienia działają.',
    retry: 'Spróbuj ponownie',
    clearSearch: 'Wyczyść wyszukiwanie',
    accountH: 'Konto',
    emailLabel: 'E-mail',
    privacyPolicy: 'Polityka prywatności',
    termsOfUse: 'Warunki korzystania',
    conversationsFound: (n) => {
      const rule = new Intl.PluralRules('pl').select(n);
      return `${n} ${rule === 'one' ? 'rozmowa' : rule === 'few' ? 'rozmowy' : 'rozmów'}`;
    },
    appearance: 'Wygląd',
    themeSaved: 'Zapisano na tym urządzeniu.',
    privacyNote: 'Twoje rozmowy pozostają na Twoim koncie. Aby usunąć rozmowę, użyj jej menu ⋯ w Rozmowach.',
    aliasHint: (a) =>
      `Nazwa Twojego konta to ⁨${a}⁩, utworzona z pierwszej części adresu, którym się logujesz. Wpisz preferowane imię lub zostaw to pole puste, aby używać ⁨${a}⁩.`,
  },
  fr: {
    signedInState: 'Connecté',
    langApp: 'Langue et apparence',
    privacyData: 'Confidentialité et données',
    followedH: 'Questions suivies',
    updatesNote: 'Ask vérifie une question suivie quand vous choisissez Vérifier. Pas encore de notifications.',
    supportLegal: 'Aide et mentions légales',
    signOutNote: 'Vous déconnecte sur cet appareil. Vos conversations restent dans votre compte.',
    guestNote: 'Connectez-vous pour garder vos conversations et suivre des questions.',
    acctFail: 'Impossible de charger votre compte. Les autres réglages fonctionnent.',
    retry: 'Réessayer',
    clearSearch: 'Effacer la recherche',
    accountH: 'Compte',
    emailLabel: 'E-mail',
    privacyPolicy: 'Politique de confidentialité',
    termsOfUse: 'Conditions d’utilisation',
    conversationsFound: (n) => (n < 2 ? `${n} conversation` : `${n} conversations`),
    appearance: 'Apparence',
    themeSaved: 'Enregistré sur cet appareil.',
    privacyNote: 'Vos conversations restent dans votre compte. Supprimez-en une depuis son menu ⋯ dans Conversations.',
    aliasHint: (a) =>
      `Le nom de votre compte est ⁨${a}⁩, créé à partir de la première partie de votre adresse de connexion. Saisissez le nom de votre choix, ou laissez ce champ vide pour utiliser ⁨${a}⁩.`,
  },
  de: {
    signedInState: 'Angemeldet',
    langApp: 'Sprache und Darstellung',
    privacyData: 'Datenschutz und Daten',
    followedH: 'Verfolgte Fragen',
    updatesNote: 'Ask prüft eine verfolgte Frage, wenn Sie „Prüfen“ wählen. Benachrichtigungen gibt es noch nicht.',
    supportLegal: 'Hilfe und Rechtliches',
    signOutNote: 'Meldet Sie auf diesem Gerät ab. Ihre Unterhaltungen bleiben in Ihrem Konto.',
    guestNote: 'Melden Sie sich an, um Ihre Unterhaltungen zu behalten.',
    acctFail: 'Ihre Kontodaten konnten nicht geladen werden.',
    retry: 'Erneut versuchen',
    clearSearch: 'Suche löschen',
    accountH: 'Konto',
    emailLabel: 'E-Mail',
    privacyPolicy: 'Datenschutzerklärung',
    termsOfUse: 'Nutzungsbedingungen',
    conversationsFound: (n) => (n === 1 ? '1 Unterhaltung' : `${n} Unterhaltungen`),
    appearance: 'Darstellung',
    themeSaved: 'Auf diesem Gerät gespeichert.',
    privacyNote: 'Ihre Unterhaltungen bleiben in Ihrem Konto. Löschen Sie eine über ihr ⋯-Menü in den Unterhaltungen.',
    aliasHint: (a) =>
      `Ihr Kontoname ist ⁨${a}⁩, gebildet aus dem ersten Teil Ihrer Anmeldeadresse. Geben Sie Ihren bevorzugten Namen ein oder lassen Sie das Feld leer, um ⁨${a}⁩ zu verwenden.`,
  },
  es: {
    signedInState: 'Sesión iniciada',
    langApp: 'Idioma y apariencia',
    privacyData: 'Privacidad y datos',
    followedH: 'Preguntas seguidas',
    updatesNote: 'Ask revisa una pregunta seguida cuando eliges Revisar. Aún no hay notificaciones.',
    supportLegal: 'Ayuda y avisos legales',
    signOutNote: 'Cierra la sesión en este dispositivo. Tus conversaciones siguen en tu cuenta.',
    guestNote: 'Inicia sesión para guardar tus conversaciones y seguir preguntas.',
    acctFail: 'No se pudieron cargar los datos de tu cuenta. Los demás ajustes funcionan.',
    retry: 'Reintentar',
    clearSearch: 'Borrar búsqueda',
    accountH: 'Cuenta',
    emailLabel: 'Correo electrónico',
    privacyPolicy: 'Política de privacidad',
    termsOfUse: 'Condiciones de uso',
    conversationsFound: (n) => (n === 1 ? '1 conversación' : `${n} conversaciones`),
    appearance: 'Apariencia',
    themeSaved: 'Guardado en este dispositivo.',
    privacyNote: 'Tus conversaciones siguen en tu cuenta. Elimina una desde su menú ⋯ en Conversaciones.',
    aliasHint: (a) =>
      `El nombre de tu cuenta es ⁨${a}⁩, creado a partir de la primera parte de tu dirección de inicio de sesión. Escribe el nombre que prefieras o deja este campo vacío para usar ⁨${a}⁩.`,
  },
  pt: {
    signedInState: 'Sessão iniciada',
    langApp: 'Idioma e aparência',
    privacyData: 'Privacidade e dados',
    followedH: 'Perguntas seguidas',
    updatesNote: 'O Ask verifica uma pergunta seguida quando você escolhe Verificar. Ainda não há notificações.',
    supportLegal: 'Ajuda e informações legais',
    signOutNote: 'Encerra a sessão neste dispositivo. Suas conversas continuam na sua conta.',
    guestNote: 'Entre para manter suas conversas e seguir perguntas.',
    acctFail: 'Não foi possível carregar os dados da conta. As outras configurações funcionam.',
    retry: 'Tentar novamente',
    clearSearch: 'Limpar pesquisa',
    accountH: 'Conta',
    emailLabel: 'E-mail',
    privacyPolicy: 'Política de privacidade',
    termsOfUse: 'Termos de uso',
    conversationsFound: (n) => (n === 1 ? '1 conversa' : `${n} conversas`),
    appearance: 'Aparência',
    themeSaved: 'Salvo neste dispositivo.',
    privacyNote: 'Suas conversas continuam na sua conta. Exclua uma pelo menu ⋯ dela em Conversas.',
    aliasHint: (a) =>
      `O nome da sua conta é ⁨${a}⁩, criado a partir da primeira parte do seu endereço de login. Digite o nome que preferir ou deixe este campo vazio para usar ⁨${a}⁩.`,
  },
  ar: {
    signedInState: 'مسجّل الدخول',
    langApp: 'اللغة والمظهر',
    privacyData: 'الخصوصية والبيانات',
    followedH: 'الأسئلة المتابَعة',
    updatesNote: 'يتحقق Ask من السؤال المتابَع عندما تختار «تحقّق». لا توجد إشعارات بعد.',
    supportLegal: 'المساعدة والشؤون القانونية',
    signOutNote: 'يسجّل خروجك على هذا الجهاز فقط. تبقى محادثاتك في حسابك.',
    guestNote: 'سجّل الدخول للاحتفاظ بمحادثاتك ومتابعة الأسئلة.',
    acctFail: 'تعذّر تحميل بيانات حسابك. بقية الإعدادات تعمل.',
    retry: 'إعادة المحاولة',
    clearSearch: 'مسح البحث',
    accountH: 'الحساب',
    emailLabel: 'البريد الإلكتروني',
    privacyPolicy: 'سياسة الخصوصية',
    termsOfUse: 'شروط الاستخدام',
    conversationsFound: (n) => {
      const rule = new Intl.PluralRules('ar').select(n);
      return rule === 'zero'
        ? 'لا توجد محادثات'
        : rule === 'one'
          ? 'محادثة واحدة'
          : rule === 'two'
            ? 'محادثتان'
            : rule === 'few'
              ? `${n} محادثات`
              : `${n} محادثة`;
    },
    appearance: 'المظهر',
    themeSaved: 'محفوظ على هذا الجهاز.',
    privacyNote: 'تبقى محادثاتك في حسابك. احذف أيًّا منها من قائمة ⋯ الخاصة بها في المحادثات.',
    aliasHint: (a) =>
      `اسم حسابك هو ⁨${a}⁩، وقد أُنشئ من الجزء الأول من عنوان تسجيل الدخول. اكتب الاسم الذي تفضّله، أو اترك هذا الحقل فارغًا لاستخدام ⁨${a}⁩.`,
  },
};

export function askSettingsR2Strings(locale: DisplayLocale): AskSettingsR2Strings {
  return CATALOGUE[locale] ?? CATALOGUE.en;
}

import type { RecoveredCatalogue as SupportDictionary } from './recoveredCatalogue';

/**
 * LANG-CATALOG-IMPLEMENT-1 - العربية (`ar`) Support surface dictionary.
 *
 * AUTHORED BY THE LOCALISATION LANE, NOT HERE. Every string below is the
 * approved value from `L-LANG-CATALOG-1 (R0)` / `06-CATALOGUE-AR.json`
 * (sha256 `a68119c47dc62a59...`), transcribed mechanically in `en` key
 * order so the two files diff line for line. No value was invented, softened,
 * shortened or re-worded at implementation time, and no key was omitted:
 * completeness is asserted by test, not by inspection.
 *
 * IDENTIFIERS ARE NOT TRANSLATED, exactly as in `adminPl`/`supportPl`: screen
 * codes, probe statuses, pipeline modes, window labels and the `GN-` support
 * reference prefix are protocol tokens a person reads aloud and types back.
 * Their EXPLANATIONS are translated.
 *
 * A REGISTERED DICTIONARY IS NOT A SELECTABLE LOCALE. `SELECTABLE_LOCALES`
 * is unchanged at `['en', 'pl']`. Publishing a catalogue makes this locale
 * expressible; it does not make it offered, does not qualify it for Support,
 * and says nothing about source-intelligence maturity.
 *
 * Arabic supplies all six CLDR categories. Typography is governed by LANG-UI-7 and is NOT re-decided here: IBM Plex Sans Arabic 400/500/600 (no 700), 11px visible human-text floor, tracking 0, MachineReadable LTR islands. D7 remains PARTIAL - not PASS.
 */

/**
 * A SUPPORT DICTIONARY IS NOT A SUPPORT LANGUAGE. These strings let the
 * Support surface RENDER in العربية; they do not make العربية a
 * deterministic Support language. Qualification stays with the backend
 * (`F_PUBLISHED_QUALIFIED = ['en', 'pl']`) and dictionary presence is never
 * the detector - SUPPORT-LANG-7-D16.
 */
export const supportAr: SupportDictionary = {
  meta: {
    title: 'الدعم — GlobalNews AI',
    description: 'افتح طلب دعم وتابع الردود عليه.',
  },
  heading: 'الدعم',
  intro: 'اطرح سؤالًا أو أبلغ عن مشكلة أو أرسل ملاحظة. وسترى كل الردود هنا — فنحن لا نرد في أي مكان آخر.',
  signedOut: {
    title: 'سجّل الدخول لفتح طلب دعم',
    body: 'طلبات الدعم مرتبطة بحساب كي لا يقرأ الردود سواك. أما GlobalNews AI نفسه فيعمل بلا حساب.',
    signIn: 'تسجيل الدخول عبر Google',
  },
  signedOutHelp: {
    title: 'إن تعذّر عليك تسجيل الدخول، فابدأ من هنا',
    intro: 'يحتاج طلب الدعم إلى حساب، فإذا كان تسجيل الدخول نفسه هو ما يتعثّر، فإن فتح طلب غير متاح لك بعد. وهذه هي الأسباب التي تُحدث ذلك فعليًا في GlobalNews AI. وإن لم يكن أي منها سببك، فالخلل عندنا لا عندك.',
    cannotSignIn: {
      title: 'لا يكتمل تسجيل الدخول',
      body: 'يمر تسجيل الدخول عبر Google ويعود إلينا في رحلة واحدة. وإذا انتهى بك الأمر في الصفحة الرئيسية لـ GlobalNews AI بدل المكان الذي بدأت منه، فإن الرحلة لم تكتمل ولم تُنشأ أي جلسة — ويستحق الأمر محاولة أخرى من زر تسجيل الدخول قبل أي شيء آخر، لأن محاولة واحدة متقطعة هي السبب الأكثر شيوعًا.',
    },
    sessionIssue: {
      title: 'كنت مسجَّل الدخول ولم تعد كذلك',
      body: 'تُحفَظ جلستك في ملف تعريف ارتباط يضعه GlobalNews AI نفسه. والمتصفح المضبوط على حجب ملفات تعريف الارتباط لهذا الموقع أو مسحها، أو نافذة خاصة أُغلقت منذئذٍ، أو متصفح أو جهاز آخر، كلها ستبدو كتسجيل خروج — فالحساب سليم، والجلسة ببساطة غير موجودة. والسماح بملفات تعريف الارتباط لهذا الموقع ثم تسجيل الدخول من جديد يعيدها.',
    },
    accountAccess: {
      title: 'أنت مسجَّل الدخول بحساب خاطئ',
      body: 'لا يملك GlobalNews AI كلمة مرور خاصة به، فأنت من يقول Google إنك هو. وإذا كنت مسجَّل الدخول في أكثر من حساب Google، فقد لا يكون الحساب الذي تصل به إلى هنا هو الحساب الذي تعود إليه طلباتك. وتسجيل الخروج ثم الدخول من جديد يتيح لك الاختيار، وستكون طلباتك تحت الحساب الذي فتحها.',
    },
    securityIssue: {
      title: 'هناك ما يبدو خاطئًا في الوصول',
      body: 'إذا كنت تعتقد أن شخصًا آخر قد وصل إلى حسابك، أو أنك تُعرض عليك أشياء لا تخصّك، فعامل الأمر بوصفه عاجلًا ولا تنتظر ردًا هنا. سجّل الخروج من GlobalNews AI في كل مكان أنت مسجَّل الدخول فيه، ثم أمّن حساب Google نفسه، فهو الباب — وحسابنا يتبعه فحسب.',
    },
    stillStuck: 'إن لم يُدخلك أي مما سبق، فالخلل خللنا ويستحق الإبلاغ عنه فور استطاعتك — افتح طلبًا من هذه الصفحة بعد تسجيل الدخول واذكر ما رأيته، بما في ذلك أي الخطوات أعلاه جرّبت.',
  },
  list: {
    heading: 'طلباتك',
    newRequest: 'طلب جديد',
    emptyTitle: 'لم تفتح أي طلب حتى الآن',
    emptyBody: 'عندما تفتح طلبًا سيظهر هنا مع كل رد مرتبط به.',
    errorTitle: 'تعذّر تحميل طلباتك',
    errorBody: 'فشل الطلب. ولا يُعرض شيء بدلًا من قائمة ناقصة — وإن كانت لديك طلبات مفتوحة فهي لا تزال موجودة.',
    loading: 'جارٍ تحميل طلباتك…',
    retry: 'إعادة المحاولة',
    messageCount: 'الرسائل',
    opened: 'فُتح',
    lastActivity: 'آخر نشاط',
  },
  form: {
    heading: 'طلب دعم جديد',
    categoryLabel: 'عمّ يدور هذا؟',
    categoryPlaceholder: 'اختر واحدًا',
    subjectLabel: 'الموضوع',
    subjectPlaceholder: 'ملخص قصير',
    messageLabel: 'الرسالة',
    messagePlaceholder: 'ماذا حدث، وما الذي كنت تتوقعه؟',
    submit: 'إرسال الطلب',
    submitting: 'جارٍ الإرسال…',
    sendingNotice: 'جارٍ إرسال طلبك. وسيظهر هنا بمجرد حفظه.',
    cancel: 'إلغاء',
    charactersRemaining: 'الأحرف المتبقية',
    tooShortSubject: 'يُرجى أن يتكوّن الموضوع من 3 أحرف على الأقل.',
    tooShortMessage: 'يُرجى وصف المشكلة بما لا يقل عن 10 أحرف.',
    categoryRequired: 'يُرجى اختيار موضوع الطلب.',
  },
  thread: {
    back: 'كل الطلبات',
    reference: 'المرجع',
    replyLabel: 'الرد',
    replyPlaceholder: 'أضف إلى هذا الطلب',
    send: 'إرسال الرد',
    sending: 'جارٍ الإرسال…',
    tooShortReply: 'يُرجى كتابة حرفين على الأقل.',
    errorTitle: 'تعذّر تحميل هذا الطلب',
    errorBody: 'فشل الطلب. ولا يُعرض شيء بدلًا من جزء من المحادثة.',
    loading: 'جارٍ التحميل…',
    resolvedNotice: 'هذا الطلب محلول. ويشير ذلك إلى الطلب نفسه — لا إلى تأكيد أن مشكلة أبلغت عنها قد أُصلحت، ما لم يقل ذلك ردٌّ صريح. والرد عليه سيعيد فتحه وسينظر فيه أحدهم من جديد.',
  },
  errors: {
    sendFailedTitle: 'لم تُرسَل رسالتك',
    sendFailedBody: 'لم يُرسَل شيء. فإما أن هذه الرسالة جاءت بعد رسالتك السابقة بوقت قصير جدًا، وإما أنك بلغت الحد الأقصى من الطلبات المفتوحة — وحلّ أحدها أو إغلاقه يتيح لك فتح طلب آخر.',
    genericTitle: 'حدث خطأ ما',
    genericBody: 'لم يُرسَل شيء. يُرجى المحاولة مجددًا بعد قليل.',
  },
  categories: {
    NEWS_QUESTION: 'سؤال عن خبر',
    BUG_REPORT: 'هناك شيء لا يعمل',
    CONTENT_REPORT: 'الإبلاغ عن محتوى',
    FEEDBACK: 'ملاحظة أو اقتراح',
    ABUSE_REPORT: 'الإبلاغ عن إساءة',
    ACCOUNT_PROBLEM: 'مشكلة في حسابي',
    OTHER: 'شيء آخر',
  },
  statuses: {
    OPEN: 'فتح',
    AWAITING_USER: 'بانتظارك',
    AWAITING_ADMIN: 'لدى فريقنا',
    RESOLVED: 'تم الحل',
  },
  authors: {
    USER: 'أنت',
    ADMIN: 'دعم GlobalNews AI',
    SYSTEM_AI: 'وكيل دعم GlobalNews AI · آلي',
  },
  automaticAnswers: {
    notice: 'تُكتب الردود التلقائية بالإنجليزية والبولندية فقط. ويُحال طلبك بدلًا من ذلك إلى شخص.',
    ariaNotice: 'تُكتب الردود التلقائية في هذه الصفحة بالإنجليزية والبولندية فقط. ولأنك تكتب بلغة أخرى، لا توجد أي إجابة تلقائية — يُحال طلبك مباشرةً إلى شخص، وهو المسار الأبطأ والأكثر أمانًا. ولم تتغيّر اللغة التي اخترتها.',
  },
};

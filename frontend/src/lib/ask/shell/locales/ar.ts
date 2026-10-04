import type { ShellLocaleOverlay } from '@/lib/ask/shell/askShellOverlay';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK SHELL OVERLAY — ARABIC
 * ════════════════════════════════════════════════════════════════════════════
 *
 * R4 · PHASE B · CLAUDE H.
 *
 * ── EVERY STRING IN THIS FILE IS `DRAFT_PENDING_CLAUDE_L` ────────────────
 *
 * The Product Owner ruled that Claude L owns native-quality wording for
 * fr / de / es / pt-BR / ar, and that H must never label its own strings as
 * linguistically qualified. These are H's DRAFTS. They exist so the seven-language
 * shell can be wired, tested and shown working end to end — the French screenshot
 * and the Arabic RTL proof the contract asks for — not because H is qualifying
 * Arabic.
 *
 * `askShellQualification('ar')` reports `DRAFT_PENDING_CLAUDE_L` for every key
 * below, and the acceptance spec asserts that the whole set is still declared as
 * pending. When L returns wording for a key, the key moves out of the draft
 * declaration and the test tightens by itself. Nothing here is presented to a
 * reviewer as finished translation.
 *
 * ── SCOPE OF THIS DRAFT ──────────────────────────────────────────────────
 *
 * The chrome a Standalone Ask reader meets on first paint: navigation, the account
 * and language menus, the hero and composer, the primary answer labels, the
 * no-compute state line, Privacy and Cookies, Recent and Saved, the loading stages
 * and the sign-in error copy — i.e. the strings the Product Owner's own French
 * screenshot showed in English. Keys outside that set are NOT drafted and are
 * reported by `askShellCoverage('ar')` as fallbacks, so the gap is visible
 * rather than guessed at.
 *
 * Two templates are drafted deliberately — `askR2Strings.sourcesLabel` and
 * `briefingStrings.version` — so the plural-category machinery is exercised in
 * production code and not only in its own spec.
 */

export const arShellOverlay: ShellLocaleOverlay = {
  data: {
    askR2Strings: {
      askTitle: "اسأل GlobalNewsAI",
      ask: "اسأل",
      close: "إغلاق",
      returnMap: "العودة إلى الخريطة",
      youAsked: "سؤالك",
      scope: "النطاق",
      noScope: "سؤال عام · لم يُطبَّق أي نطاق",
      answer: "الإجابة",
      sources: "المصادر",
      openFull: "فتح التحليل الكامل",
      runDeep: "إجراء تحليل أعمق",
      newQ: "سؤال جديد",
      earlier: "سابقًا في هذه المحادثة",
      privacyLink: "الخصوصية",
      cookiesLink: "ملفات تعريف الارتباط",
      sourcesLabel: {
        kind: "plural",
        forms: {
          zero: "لا مصادر",
          one: "مصدر واحد",
          two: "مصدران",
          few: "{0} مصادر",
          many: "{0} مصدرًا",
          other: "{0} مصدر",
        },
      },
    },
    askStrings: {
      frameLabel: "اسأل الذكاء الاصطناعي",
      metaTitle: "اسأل الذكاء الاصطناعي — GlobalNews AI",
      states: {
        costNotConfigured: "لا يبدأ البحث إلا عند إرسال سؤالك.",
        awaitingQuestion: "اطرح سؤالًا للبدء.",
      },
      regions: {
        composer: "اطرح سؤالًا",
        answer: "الإجابة",
        sources: "المصادر",
      },
      metaDescription: "واجهة البحث الخاصة بكل سؤال: مدركة للموقع الجغرافي، ومستندة إلى المصادر، وصريحة بشأن ما لم يُقيَّم.",
    },
    askContinuityStrings: {
      recentTitle: "الأخيرة",
      savedTitle: "المحفوظة",
    },
    briefingStrings: {
      version: {
        kind: "plural",
        forms: {
          other: "الإصدار {0}",
        },
      },
    },
    askNavStrings: {
      newQuestion: "سؤال جديد",
      recent: "الأخيرة",
      saved: "المحفوظة",
      help: "المساعدة والملاحظات",
      settings: "الإعدادات",
      language: "اللغة",
      signIn: "تسجيل الدخول",
      signOut: "تسجيل الخروج",
      navAriaLabel: "تنقّل الاستفسار",
      openMenuAriaLabel: "فتح القائمة",
      closeMenuAriaLabel: "إغلاق القائمة",
      account: "الحساب",
      accountMenuAriaLabel: "قائمة الحساب",
      languageSelectorAction: "اختيار اللغة",
    },
    dict: {
      askAi: {
        title: "اسأل GlobalNews AI",
        panelLabel: "اسأل GlobalNews AI",
        submit: "اسأل",
        launcher: "اسأل الذكاء الاصطناعي",
        inputLabel: "اطرح سؤالًا عن الأحداث العالمية",
        resultSourcesHeading: "المصادر",
      },
      navBar: {
        signIn: "تسجيل الدخول",
        signOut: "تسجيل الخروج",
        account: "الحساب",
        settings: "الإعدادات",
        help: "المساعدة",
        languageSelectorLabel: "اللغة",
        accountMenuAriaLabel: "قائمة الحساب",
      },
      accountSettings: {
        heading: "إعدادات الحساب",
      },
      loadingStages: [
        "جارٍ البحث في المصادر الموثوقة…",
        "جارٍ تجميع التقارير ذات الصلة…",
        "جارٍ مقارنة التغطية…",
        "جارٍ إعداد التحليل المُسنَد إلى المصادر…",
      ],
      authError: {
        cancelled: "تم إلغاء تسجيل الدخول. يمكنك تسجيل الدخول في أي وقت.",
        failed: "لم يكتمل تسجيل الدخول. يُرجى المحاولة مرة أخرى.",
        dismissLabel: "تجاهل",
      },
    },
  },
};

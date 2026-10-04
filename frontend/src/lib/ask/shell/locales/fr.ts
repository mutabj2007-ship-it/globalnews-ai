import type { ShellLocaleOverlay } from '@/lib/ask/shell/askShellOverlay';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK SHELL OVERLAY — FRENCH
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
 * French.
 *
 * `askShellQualification('fr')` reports `DRAFT_PENDING_CLAUDE_L` for every key
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
 * reported by `askShellCoverage('fr')` as fallbacks, so the gap is visible
 * rather than guessed at.
 *
 * Two templates are drafted deliberately — `askR2Strings.sourcesLabel` and
 * `briefingStrings.version` — so the plural-category machinery is exercised in
 * production code and not only in its own spec.
 */

export const frShellOverlay: ShellLocaleOverlay = {
  data: {
    askR2Strings: {
      askTitle: "Interroger GlobalNewsAI",
      ask: "Demander",
      close: "Fermer",
      returnMap: "Retour à la carte",
      youAsked: "VOTRE QUESTION",
      scope: "PÉRIMÈTRE",
      noScope: "Question générale · aucun périmètre appliqué",
      answer: "RÉPONSE",
      sources: "Sources",
      openFull: "Ouvrir l'analyse complète",
      runDeep: "Lancer une analyse approfondie",
      newQ: "Nouvelle question",
      earlier: "PLUS TÔT DANS CETTE CONVERSATION",
      privacyLink: "Confidentialité",
      cookiesLink: "Cookies",
      sourcesLabel: {
        kind: "plural",
        forms: {
          one: "{0} source",
          other: "{0} sources",
        },
      },
    },
    askStrings: {
      frameLabel: "Demander à l'IA",
      metaTitle: "Demander à l'IA — GlobalNews AI",
      states: {
        costNotConfigured: "La recherche ne démarre que lorsque vous envoyez une question.",
        awaitingQuestion: "Posez une question pour commencer.",
      },
      regions: {
        composer: "Poser une question",
        answer: "Réponse",
        sources: "Sources",
      },
    },
    askContinuityStrings: {
      recentTitle: "Récentes",
      savedTitle: "Enregistrées",
    },
    briefingStrings: {
      version: {
        kind: "plural",
        forms: {
          other: "Version {0}",
        },
      },
    },
    askNavStrings: {
      newQuestion: "Nouvelle question",
      recent: "Récentes",
      saved: "Enregistrées",
      help: "Aide et commentaires",
      settings: "Paramètres",
      language: "Langue",
      signIn: "Se connecter",
      signOut: "Se déconnecter",
      navAriaLabel: "Navigation Interroger",
      openMenuAriaLabel: "Ouvrir le menu",
      closeMenuAriaLabel: "Fermer le menu",
      account: "Compte",
      accountMenuAriaLabel: "Menu du compte",
      languageSelectorAction: "Choisir la langue",
    },
    dict: {
      askAi: {
        title: "Interroger GlobalNews AI",
        panelLabel: "Interroger GlobalNews AI",
        submit: "Demander",
        launcher: "Demander à l'IA",
        inputLabel: "Posez une question sur l'actualité mondiale",
        resultSourcesHeading: "Sources",
      },
      navBar: {
        signIn: "Se connecter",
        signOut: "Se déconnecter",
        account: "Compte",
        settings: "Paramètres",
        help: "Aide",
        languageSelectorLabel: "Langue",
        accountMenuAriaLabel: "Menu du compte",
      },
      accountSettings: {
        heading: "Paramètres du compte",
      },
      loadingStages: [
        "Recherche dans les sources de confiance…",
        "Regroupement des articles liés…",
        "Comparaison de la couverture…",
        "Préparation de l'analyse sourcée…",
      ],
      authError: {
        cancelled: "La connexion a été annulée. Vous pourrez vous connecter quand vous le souhaiterez.",
        failed: "La connexion n'a pas abouti. Veuillez réessayer.",
        dismissLabel: "Ignorer",
      },
    },
  },
};

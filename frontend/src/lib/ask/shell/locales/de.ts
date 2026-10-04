import type { ShellLocaleOverlay } from '@/lib/ask/shell/askShellOverlay';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK SHELL OVERLAY — GERMAN
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
 * German.
 *
 * `askShellQualification('de')` reports `DRAFT_PENDING_CLAUDE_L` for every key
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
 * reported by `askShellCoverage('de')` as fallbacks, so the gap is visible
 * rather than guessed at.
 *
 * Two templates are drafted deliberately — `askR2Strings.sourcesLabel` and
 * `briefingStrings.version` — so the plural-category machinery is exercised in
 * production code and not only in its own spec.
 */

export const deShellOverlay: ShellLocaleOverlay = {
  data: {
    askR2Strings: {
      askTitle: "GlobalNewsAI fragen",
      ask: "Fragen",
      close: "Schließen",
      returnMap: "Zurück zur Karte",
      youAsked: "IHRE FRAGE",
      scope: "GELTUNGSBEREICH",
      noScope: "Allgemeine Frage · kein Geltungsbereich angewendet",
      answer: "ANTWORT",
      sources: "Quellen",
      openFull: "Vollständige Analyse öffnen",
      runDeep: "Tiefere Analyse starten",
      newQ: "Neue Frage",
      earlier: "FRÜHER IN DIESEM GESPRÄCH",
      privacyLink: "Datenschutz",
      cookiesLink: "Cookies",
      sourcesLabel: {
        kind: "plural",
        forms: {
          one: "{0} Quelle",
          other: "{0} Quellen",
        },
      },
    },
    askStrings: {
      frameLabel: "KI fragen",
      metaTitle: "KI fragen — GlobalNews AI",
      states: {
        costNotConfigured: "Die Recherche startet erst, wenn Sie eine Frage absenden.",
        awaitingQuestion: "Stellen Sie eine Frage, um zu beginnen.",
      },
      regions: {
        composer: "Eine Frage stellen",
        answer: "Antwort",
        sources: "Quellen",
      },
      metaDescription: "Die fragenspezifische Rechercheoberfläche: kartenbewusst, quellengestützt und ausdrücklich darüber, was nicht bewertet wurde.",
    },
    askContinuityStrings: {
      recentTitle: "Zuletzt",
      savedTitle: "Gespeichert",
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
      newQuestion: "Neue Frage",
      recent: "Zuletzt",
      saved: "Gespeichert",
      help: "Hilfe und Feedback",
      settings: "Einstellungen",
      language: "Sprache",
      signIn: "Anmelden",
      signOut: "Abmelden",
      navAriaLabel: "Fragen-Navigation",
      openMenuAriaLabel: "Menü öffnen",
      closeMenuAriaLabel: "Menü schließen",
      account: "Konto",
      accountMenuAriaLabel: "Kontomenü",
      languageSelectorAction: "Sprache wählen",
    },
    dict: {
      askAi: {
        title: "GlobalNews AI fragen",
        panelLabel: "GlobalNews AI fragen",
        submit: "Fragen",
        launcher: "KI fragen",
        inputLabel: "Stellen Sie eine Frage zum Weltgeschehen",
        resultSourcesHeading: "Quellen",
      },
      navBar: {
        signIn: "Anmelden",
        signOut: "Abmelden",
        account: "Konto",
        settings: "Einstellungen",
        help: "Hilfe",
        languageSelectorLabel: "Sprache",
        accountMenuAriaLabel: "Kontomenü",
      },
      accountSettings: {
        heading: "Kontoeinstellungen",
      },
      loadingStages: [
        "Suche in vertrauenswürdigen Quellen…",
        "Gruppierung verwandter Berichte…",
        "Vergleich der Berichterstattung…",
        "Quellenbasierte Analyse wird vorbereitet…",
      ],
      authError: {
        cancelled: "Die Anmeldung wurde abgebrochen. Sie können sich jederzeit anmelden.",
        failed: "Die Anmeldung wurde nicht abgeschlossen. Bitte versuchen Sie es erneut.",
        dismissLabel: "Schließen",
      },
    },
  },
};

import type { ShellLocaleOverlay } from '@/lib/ask/shell/askShellOverlay';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK SHELL OVERLAY — SPANISH
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
 * Spanish.
 *
 * `askShellQualification('es')` reports `DRAFT_PENDING_CLAUDE_L` for every key
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
 * reported by `askShellCoverage('es')` as fallbacks, so the gap is visible
 * rather than guessed at.
 *
 * Two templates are drafted deliberately — `askR2Strings.sourcesLabel` and
 * `briefingStrings.version` — so the plural-category machinery is exercised in
 * production code and not only in its own spec.
 */

export const esShellOverlay: ShellLocaleOverlay = {
  data: {
    askR2Strings: {
      askTitle: "Preguntar a GlobalNewsAI",
      ask: "Preguntar",
      close: "Cerrar",
      returnMap: "Volver al mapa",
      youAsked: "TU PREGUNTA",
      scope: "ÁMBITO",
      noScope: "Pregunta general · sin ámbito aplicado",
      answer: "RESPUESTA",
      sources: "Fuentes",
      openFull: "Abrir el análisis completo",
      runDeep: "Ejecutar un análisis más profundo",
      newQ: "Nueva pregunta",
      earlier: "ANTES EN ESTA CONVERSACIÓN",
      privacyLink: "Privacidad",
      cookiesLink: "Cookies",
      sourcesLabel: {
        kind: "plural",
        forms: {
          one: "{0} fuente",
          other: "{0} fuentes",
        },
      },
    },
    askStrings: {
      frameLabel: "Preguntar a la IA",
      metaTitle: "Preguntar a la IA — GlobalNews AI",
      states: {
        costNotConfigured: "La investigación se ejecuta solo cuando envías una pregunta.",
        awaitingQuestion: "Haz una pregunta para empezar.",
      },
      regions: {
        composer: "Hacer una pregunta",
        answer: "Respuesta",
        sources: "Fuentes",
      },
      metaDescription: "La superficie de investigación específica para cada pregunta: atenta al mapa, respaldada por fuentes y explícita sobre lo que no se ha evaluado.",
    },
    askContinuityStrings: {
      recentTitle: "Recientes",
      savedTitle: "Guardadas",
    },
    briefingStrings: {
      version: {
        kind: "plural",
        forms: {
          other: "Versión {0}",
        },
      },
    },
    askNavStrings: {
      newQuestion: "Nueva pregunta",
      recent: "Recientes",
      saved: "Guardadas",
      help: "Ayuda y comentarios",
      settings: "Configuración",
      language: "Idioma",
      signIn: "Iniciar sesión",
      signOut: "Cerrar sesión",
      navAriaLabel: "Navegación de Preguntar",
      openMenuAriaLabel: "Abrir menú",
      closeMenuAriaLabel: "Cerrar menú",
      account: "Cuenta",
      accountMenuAriaLabel: "Menú de la cuenta",
      languageSelectorAction: "Seleccionar idioma",
    },
    dict: {
      askAi: {
        title: "Preguntar a GlobalNews AI",
        panelLabel: "Preguntar a GlobalNews AI",
        submit: "Preguntar",
        launcher: "Preguntar a la IA",
        inputLabel: "Haz una pregunta sobre la actualidad mundial",
        resultSourcesHeading: "Fuentes",
      },
      navBar: {
        signIn: "Iniciar sesión",
        signOut: "Cerrar sesión",
        account: "Cuenta",
        settings: "Configuración",
        help: "Ayuda",
        languageSelectorLabel: "Idioma",
        accountMenuAriaLabel: "Menú de la cuenta",
      },
      accountSettings: {
        heading: "Configuración de la cuenta",
      },
      loadingStages: [
        "Buscando en fuentes de confianza…",
        "Agrupando informes relacionados…",
        "Comparando la cobertura…",
        "Preparando el análisis con fuentes…",
      ],
      authError: {
        cancelled: "Se canceló el inicio de sesión. Puedes iniciar sesión cuando quieras.",
        failed: "El inicio de sesión no se completó. Inténtalo de nuevo.",
        dismissLabel: "Descartar",
      },
    },
  },
};

import type { ShellLocaleOverlay } from '@/lib/ask/shell/askShellOverlay';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK SHELL OVERLAY — PORTUGUESE (PT-BR)
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
 * Portuguese (pt-BR).
 *
 * `askShellQualification('pt')` reports `DRAFT_PENDING_CLAUDE_L` for every key
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
 * reported by `askShellCoverage('pt')` as fallbacks, so the gap is visible
 * rather than guessed at.
 *
 * Two templates are drafted deliberately — `askR2Strings.sourcesLabel` and
 * `briefingStrings.version` — so the plural-category machinery is exercised in
 * production code and not only in its own spec.
 */

export const ptShellOverlay: ShellLocaleOverlay = {
  data: {
    askR2Strings: {
      askTitle: "Perguntar ao GlobalNewsAI",
      ask: "Perguntar",
      close: "Fechar",
      returnMap: "Voltar ao mapa",
      youAsked: "SUA PERGUNTA",
      scope: "ESCOPO",
      noScope: "Pergunta geral · nenhum escopo aplicado",
      answer: "RESPOSTA",
      sources: "Fontes",
      openFull: "Abrir a análise completa",
      runDeep: "Executar uma análise mais profunda",
      newQ: "Nova pergunta",
      earlier: "ANTES NESTA CONVERSA",
      privacyLink: "Privacidade",
      cookiesLink: "Cookies",
      sourcesLabel: {
        kind: "plural",
        forms: {
          one: "{0} fonte",
          other: "{0} fontes",
        },
      },
    },
    askStrings: {
      frameLabel: "Perguntar à IA",
      metaTitle: "Perguntar à IA — GlobalNews AI",
      states: {
        costNotConfigured: "A pesquisa é executada apenas quando você envia uma pergunta.",
        awaitingQuestion: "Faça uma pergunta para começar.",
      },
      regions: {
        composer: "Fazer uma pergunta",
        answer: "Resposta",
        sources: "Fontes",
      },
    },
    askContinuityStrings: {
      recentTitle: "Recentes",
      savedTitle: "Salvas",
    },
    briefingStrings: {
      version: {
        kind: "plural",
        forms: {
          other: "Versão {0}",
        },
      },
    },
    askNavStrings: {
      newQuestion: "Nova pergunta",
      recent: "Recentes",
      saved: "Salvas",
      help: "Ajuda e comentários",
      settings: "Configurações",
      language: "Idioma",
      signIn: "Entrar",
      signOut: "Sair",
      navAriaLabel: "Navegação do Perguntar",
      openMenuAriaLabel: "Abrir menu",
      closeMenuAriaLabel: "Fechar menu",
      account: "Conta",
      accountMenuAriaLabel: "Menu da conta",
      languageSelectorAction: "Selecionar idioma",
    },
    dict: {
      askAi: {
        title: "Perguntar ao GlobalNews AI",
        panelLabel: "Perguntar ao GlobalNews AI",
        submit: "Perguntar",
        launcher: "Perguntar à IA",
        inputLabel: "Faça uma pergunta sobre os acontecimentos mundiais",
        resultSourcesHeading: "Fontes",
      },
      navBar: {
        signIn: "Entrar",
        signOut: "Sair",
        account: "Conta",
        settings: "Configurações",
        help: "Ajuda",
        languageSelectorLabel: "Idioma",
        accountMenuAriaLabel: "Menu da conta",
      },
      accountSettings: {
        heading: "Configurações da conta",
      },
      loadingStages: [
        "Buscando em fontes confiáveis…",
        "Agrupando relatos relacionados…",
        "Comparando a cobertura…",
        "Preparando a análise com fontes…",
      ],
      authError: {
        cancelled: "O login foi cancelado. Você pode entrar quando quiser.",
        failed: "O login não foi concluído. Tente novamente.",
        dismissLabel: "Dispensar",
      },
    },
  },
};

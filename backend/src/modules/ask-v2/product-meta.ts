/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK RELIABILITY R1 (I) — QUESTIONS ABOUT GLOBALNEWSAI ITSELF, ANSWERED FROM WHAT IS TRUE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Observed: "Which model are you using?" got a generic paragraph about guidelines; "How can I train
 * you … you are running short of recent news" got generic advice and a blanket claim that live data
 * is unavailable. Both were sent to the background model, which knows nothing about this product.
 *
 * These questions are answered deterministically (zero AI, zero provider, zero cost) from trusted
 * application facts passed in by the adapter — the configured model, whether live reporting is
 * configured — never from invented self-knowledge. EN and PL; other languages fall through to the
 * ordinary path rather than receive an untranslated answer.
 */
export type ProductMetaKind = 'MODEL_IDENTITY' | 'IMPROVE_OR_TRAIN' | 'PRODUCT_FEEDBACK';

export interface ProductFacts {
  /** The configured writing model id (e.g. "gpt-4o-mini"); null when not configured. */
  readonly model: string | null;
  readonly modelProvider: string;
}

const EN = {
  identity:
    /\b(?:which|what)\s+(?:ai\s+|language\s+|llm\s+)?(?:model|llm|engine|ai)\s+(?:are\s+you|do\s+you\s+use|is\s+this|powers?|are\s+you\s+using|is\s+(?:being\s+)?used)|\bwho\s+(?:made|built|trained|created)\s+you\b|\bare\s+you\s+(?:gpt|chatgpt|claude|gemini|llama)\b|\bwhat\s+are\s+you\s+(?:built|based)\s+on\b/i,
  improve:
    /\b(?:how\s+(?:can|could|do|should)\s+(?:i|we)\s+(?:train|teach|improve|fine[-\s]?tune|make)\s+you|train\s+you\s+(?:better|to)|how\s+do\s+you\s+learn|do\s+you\s+learn\s+from\s+(?:me|our|this|conversations?))\b/i,
  feedback:
    /\b(?:you|your\s+(?:app|answers?|news|service)|the\s+app|globalnewsai)\s+(?:are|is)\s+(?:running\s+short\s+of|missing|lacking|short\s+on|out\s+of\s+date|outdated|not\s+(?:up\s+to\s+date|current))|\b(?:you|your\s+app|the\s+app|globalnewsai)\s+(?:lack|lacks|don'?t\s+have|doesn'?t\s+have)\s+(?:recent|current|new|enough)\s+(?:news|reporting|updates)\b/i,
};
const PL = {
  identity: /(?:jakiego|jaki|który)\s+(?:model\p{L}*|silnik\p{L}*)\s+(?:używasz|jesteś|wykorzystujesz)|kto\s+(?:cię|ciebie)\s+(?:stworzył|zbudował|wytrenował)/iu,
  improve: /jak\s+(?:mogę|możemy|można)\s+(?:cię|ciebie)\s+(?:wytrenować|trenować|nauczyć|ulepszyć|poprawić)/iu,
  feedback: /(?:brakuje\s+(?:ci|wam|aplikacji)\s+(?:najnowszych|aktualnych|świeżych)\s+wiadomości|(?:masz|macie)\s+(?:mało|za\s+mało)\s+(?:najnowszych|aktualnych)\s+wiadomości)/iu,
};

export function readProductMeta(question: string, language: string): ProductMetaKind | null {
  const lex = language === 'pl' ? PL : language === 'en' ? EN : null;
  if (lex === null) return null;
  if (lex.identity.test(question)) return 'MODEL_IDENTITY';
  if (lex.improve.test(question)) return 'IMPROVE_OR_TRAIN';
  if (lex.feedback.test(question)) return 'PRODUCT_FEEDBACK';
  return null;
}

export function productMetaAnswer(kind: ProductMetaKind, language: string, facts: ProductFacts): string {
  const pl = language === 'pl';
  const model = facts.model ?? null;
  switch (kind) {
    case 'MODEL_IDENTITY':
      return pl
        ? `GlobalNewsAI to aplikacja, a nie pojedynczy model. Odpowiedzi pisze model językowy ${model === null ? 'skonfigurowany przez operatora' : `${facts.modelProvider} „${model}”`}, ale to aplikacja decyduje, jakich raportów szukać, które z nich dopuścić jako dowód i co pokazać jako źródło. Odpowiedź oznaczona jako „aktualna” opiera się na raportach pobranych dla Twojego pytania; odpowiedź „ogólna” jest wiedzą ogólną bez źródeł. Model nie uczy się z Twoich rozmów.`
        : `GlobalNewsAI is an application, not a single model. Answers are written by ${model === null ? 'a language model configured by the operator' : `${facts.modelProvider}'s "${model}" model`}, but the application decides which reports to look for, which of them are admitted as evidence, and what is shown as a source. An answer marked as current intelligence rests on reports retrieved for your question; a "general explanation" is background knowledge with no sources. The model does not learn from your conversations.`;
    case 'IMPROVE_OR_TRAIN':
      return pl
        ? 'Rozmowa z Ask nie trenuje modelu — jego wagi nie zmieniają się od pytań. GlobalNewsAI ulepsza się na trzy inne sposoby: (1) zgłoszenia i przykłady problemów (np. pytanie, które dało nietrafioną odpowiedź) trafiają do zespołu jako przypadki testowe; (2) zespół poprawia wyszukiwanie, źródła i reguły aplikacji; (3) Twoje ustawienia — obserwowane kraje i zainteresowania w Moim wywiadzie — zmieniają to, co widzisz. Najbardziej pomaga konkretne pytanie, oczekiwana odpowiedź i to, co było nie tak.'
        : "Chatting with Ask does not train the model — its weights do not change from your questions. GlobalNewsAI improves in three other ways: (1) reports and examples of problems (a question and what went wrong) reach the team as test cases; (2) the team improves the search, the sources and the application's rules; (3) your own settings — the countries and interests you follow in My Intelligence — change what you see. The most useful feedback is a specific question, the answer you expected, and what was wrong with the one you got.";
    case 'PRODUCT_FEEDBACK':
      return pl
        ? 'Dziękujemy — to uwaga o produkcie, więc nie szukamy wiadomości na jej temat. GlobalNewsAI pobiera aktualne raporty przy pytaniach o bieżące wydarzenia, ale zasięg jest ograniczony: główny dostawca wiadomości ma limity zapytań, a część lokalnych źródeł nie jest jeszcze podłączona. Gdy zapytanie nie znajdzie odpowiednich raportów, odpowiedź mówi to wprost, zamiast udawać kompletność. Jeśli podasz konkretne pytanie, przy którym zabrakło aktualnych informacji, zespół może je sprawdzić.'
        : "Thank you — that is feedback about the product, so we have not searched the news for it. GlobalNewsAI does retrieve current reporting for questions about current events, but coverage is limited: the main news provider has request limits, and some local sources are not connected yet. When a search finds no relevant reports, the answer says so rather than pretending to be complete. If you share a specific question where recent information was missing, the team can investigate it.";
  }
}
